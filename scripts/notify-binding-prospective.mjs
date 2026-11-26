#!/usr/bin/env node
import {readFile, lstat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {timingSafeEqual} from "node:crypto";
import {digest} from "./functions-config-guard-lib.mjs";
import {validateFirebaseAlias} from "./deploy-environment-lib.mjs";
import {readLocalSource, sharedLockDirectory} from "./notify-secret-binding-repair.mjs";
import {readEvidenceToolBinding, resolveEvidenceFilesystemPath, isCanonicalEvidenceDirectory} from "./notify-binding-evidence.mjs";
import {createBindingEvidenceProvider} from "./notify-binding-evidence-provider.mjs";
import {readBindingEvidenceCapture, readProspectiveJsonInput, readProspectiveOperationRecords,
  readBindingRepairClaimDirectories, initializeProspectiveEvidenceDirectory} from "./notify-secret-binding-repair-store.mjs";
import {compareProspectiveBindingEvidence, validateProspectiveInputs} from "./notify-binding-prospective-lib.mjs";

const PROJECT = "sodc-web-production";
const need = (condition, code) => {if (!condition) throw Object.assign(new Error(code), {code});};
const help = `Usage: node scripts/notify-binding-prospective.mjs --phase <before|after>
  --capture-dir <original-private-capture> --source-root <clean-built-candidate>
  --limits-baseline <private-json-sidecar> --output-dir <new-private-directory>
  [--operator-run-dir <private-intent-and-ack-directory>]

Production GET-only comparison. after requires operator-run-dir with intent.json
and the retained operation.json acknowledgement. There is no apply, retry, accept,
unlock or waiver. Keep the capture comparison.key private and outside Git.
BASELINE_MATCH exits0. Metadata-with-provenance-limit or PENDING exits3; FAIL exits1.
No result authorizes Production or writes a deployment receipt.`;

export function parseProspectiveArguments(args) {
  if (args.length === 1 && args[0] === "--help") return {help: true};
  const names = {"--phase": "phase", "--capture-dir": "captureDirectory", "--source-root": "sourceRoot",
    "--limits-baseline": "limitsBaselineFile", "--output-dir": "outputDirectory", "--operator-run-dir": "operatorDirectory"};
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    need(Object.hasOwn(names, args[i]) && !Object.hasOwn(result, names[args[i]]) && typeof args[i + 1] === "string" &&
      !args[i + 1].startsWith("--"), "invalid-prospective-arguments");
    result[names[args[i]]] = args[i + 1];
  }
  need(["before", "after"].includes(result.phase) && [result.captureDirectory, result.sourceRoot, result.outputDirectory]
    .every(isCanonicalEvidenceDirectory), "invalid-prospective-arguments");
  need(typeof result.limitsBaselineFile === "string" && path.isAbsolute(result.limitsBaselineFile) &&
    path.normalize(result.limitsBaselineFile) === result.limitsBaselineFile && /^[A-Za-z0-9_.-]+\.json$/.test(path.basename(result.limitsBaselineFile)),
  "invalid-prospective-limits-path");
  need(result.phase === "after" ? isCanonicalEvidenceDirectory(result.operatorDirectory) : result.operatorDirectory === undefined,
    "prospective-operator-records-phase-mismatch");
  return result;
}

async function outputBoundary(root, options, locks, readClaims, previousRuns = []) {
  need(isCanonicalEvidenceDirectory(locks), "invalid-prospective-lock-directory");
  const claims = await readClaims(locks);
  need(Array.isArray(claims) && claims.length <= 2 && claims.every(isCanonicalEvidenceDirectory), "invalid-prospective-claim-directories");
  const keptRuns = [...new Set([...previousRuns, ...claims])];
  const paths = [root, options.sourceRoot, options.captureDirectory, path.dirname(options.limitsBaselineFile), locks,
    ...(options.operatorDirectory ? [options.operatorDirectory] : []), ...keptRuns];
  const output = await resolveEvidenceFilesystemPath(options.outputDirectory);
  const nested = (a, b) => a === b || b.startsWith(a + path.sep);
  for (const protectedPath of await Promise.all(paths.map(resolveEvidenceFilesystemPath))) {
    need(!nested(protectedPath, output) && !nested(output, protectedPath), "prospective-output-overlaps-protected-input");
  }
  let exists = true;
  try {await lstat(options.outputDirectory);} catch (error) {if (error.code === "ENOENT") exists = false; else throw error;}
  need(!exists, "prospective-output-already-exists");
  return keptRuns;
}

export async function runProspectiveComparison(root, options, {
  readCapture = readBindingEvidenceCapture, readJson = readProspectiveJsonInput, readRecords = readProspectiveOperationRecords,
  readSource = (project, sourceRoot) => readLocalSource(sourceRoot, project), readTool = readEvidenceToolBinding,
  providerFactory = createBindingEvidenceProvider, compare = compareProspectiveBindingEvidence, validate = validateProspectiveInputs,
  initialize = initializeProspectiveEvidenceDirectory, readClaims = readBindingRepairClaimDirectories,
  lockDirectory = sourceRoot => sharedLockDirectory(sourceRoot), now = Date.now,
} = {}) {
  if (options.help) return {status: "HELP", help};
  need(Object.keys(options).every(name => ["phase", "captureDirectory", "sourceRoot", "limitsBaselineFile", "outputDirectory", "operatorDirectory"].includes(name)),
    "invalid-prospective-arguments");
  // Validate injected options through the same strict parser as command-line input.
  parseProspectiveArguments(["--phase", options.phase, "--capture-dir", options.captureDirectory, "--source-root", options.sourceRoot,
    "--limits-baseline", options.limitsBaselineFile, "--output-dir", options.outputDirectory,
    ...(options.operatorDirectory ? ["--operator-run-dir", options.operatorDirectory] : [])]);
  const locks = lockDirectory(options.sourceRoot);
  const protectedRuns = await outputBoundary(root, options, locks, readClaims);
  for (const base of [root, options.sourceRoot]) {
    const aliases = JSON.parse(await readFile(path.join(base, ".firebaserc"), "utf8"));
    need(validateFirebaseAlias(aliases, "prod") === PROJECT, "prospective-production-alias-mismatch");
  }
  const toolBinding = await readTool(root), source = await readSource(PROJECT, options.sourceRoot);
  const original = await readCapture(options.captureDirectory);
  let latest;
  try {
    const capture = original.report, comparisonKey = original.comparisonKey;
    need(capture.projectId === PROJECT && capture.schemaVersion === "sodc-notify-binding-capture/v1" &&
      Buffer.isBuffer(comparisonKey) && comparisonKey.length === 32, "invalid-prospective-production-capture");
    const limitsBaseline = await readJson(options.limitsBaselineFile);
    const records = options.phase === "after" ? await readRecords(options.operatorDirectory) : {};
    validate({phase: options.phase, capture, comparisonKey, source, toolBinding, limitsBaseline, ...records, now});
    const provider = providerFactory({projectId: PROJECT, region: "europe-west2"});
    const snapshot = await provider.snapshot();
    const expected = Object.keys(capture.baseline?.functions ?? {}).sort();
    need(Array.isArray(snapshot.functions) && digest(snapshot.functions.map(fn => fn.name?.split("/").at(-1)).sort()) === digest(expected),
      "prospective-provider-inventory-changed");
    let operation, provenance = {}, limitsObservation;
    if (options.phase === "after") {
      need(records.acknowledgement && Object.keys(records.acknowledgement).length === 1 &&
        typeof records.acknowledgement.name === "string", "invalid-prospective-operation-acknowledgement");
      operation = await provider.operation(records.acknowledgement.name);
    }
    if (!operation || operation.done === true) {
      limitsObservation = await provider.limits(snapshot);
      provenance = await provider.provenance({snapshot, ...(operation ? {operation,
        previousRevision: capture.baseline.targetObservation.revision} : {})});
    }
    const report = compare({phase: options.phase, capture, comparisonKey, source, toolBinding, snapshot, provenance,
      limitsBaseline, limitsObservation, ...records, operation, now});
    // A provider wait cannot silently refresh the input, source, key or tool binding.
    need(digest((await readSource(PROJECT, options.sourceRoot)).binding) === digest(source.binding) &&
      digest(await readTool(root)) === digest(toolBinding), "prospective-source-or-tool-changed-during-read");
    need(digest(await readJson(options.limitsBaselineFile)) === digest(limitsBaseline), "prospective-sidecar-changed-during-read");
    if (options.phase === "after") need(digest(await readRecords(options.operatorDirectory)) === digest(records),
      "prospective-operator-records-changed-during-read");
    latest = await readCapture(options.captureDirectory);
    need(digest(latest.report) === digest(capture) && Buffer.isBuffer(latest.comparisonKey) && latest.comparisonKey.length === 32 &&
      timingSafeEqual(latest.comparisonKey, comparisonKey), "prospective-capture-or-key-changed-during-read");
    await outputBoundary(root, options, locks, readClaims, protectedRuns);
    const written = await initialize(options.outputDirectory, {report});
    return {status: report.status, projectId: PROJECT, reportPath: path.join(written.outputDirectory, "report.json"),
      reportSha256: written.reportSha256, originalContractAccepted: false, productionAuthorized: false,
      releaseAuthorized: false, providerWrites: 0};
  } finally {original.comparisonKey?.fill(0); latest?.comparisonKey?.fill(0);}
}

export async function runProspectiveCommand(args, {root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), deps,
  stdout = text => console.log(text), stderr = text => console.error(text)} = {}) {
  try {
    const result = await runProspectiveComparison(root, parseProspectiveArguments(args), deps);
    stdout(result.status === "HELP" ? result.help : JSON.stringify(result, null, 2));
    return ["HELP", "BASELINE_MATCH"].includes(result.status) ? 0 : result.status === "FAIL" ? 1 : 3;
  } catch (error) {
    const code = /^[a-z0-9-]{1,100}$/.test(error?.code ?? "") ? error.code : "invalid-prospective-input-or-state";
    stderr(`Prospective comparison blocked: ${code}.`);
    return 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runProspectiveCommand(process.argv.slice(2));
}
