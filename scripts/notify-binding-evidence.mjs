#!/usr/bin/env node
import {execFileSync} from "node:child_process";
import {lstat, readFile, realpath} from "node:fs/promises";
import {createHash, randomBytes, timingSafeEqual} from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {digest} from "./functions-config-guard-lib.mjs";
import {validateFirebaseAlias} from "./deploy-environment-lib.mjs";
import {readLocalSource, sharedLockDirectory} from "./notify-secret-binding-repair.mjs";
import {BindingRepairError, assertRepairSource} from "./notify-secret-binding-repair-lib.mjs";
import {BindingRepairProviderError} from "./notify-secret-binding-repair-provider.mjs";
import {readRepairRunEvidence, readBindingRepairClaimDirectories, initializeBindingEvidenceDirectory} from "./notify-secret-binding-repair-store.mjs";
import {BindingEvidenceError, assertEvidenceToolBinding, captureBindingEvidence, reconcileBindingEvidence} from "./notify-binding-evidence-lib.mjs";
import {BindingEvidenceProviderError, createBindingEvidenceProvider} from "./notify-binding-evidence-provider.mjs";

const help = `Usage: npm run operations:notify-binding-evidence -- --phase <capture|reconcile> --env <dev|prod> --source-root <clean-application-checkout> --output-dir <new-private-directory> [--run-dir <original-private-run>]

capture: new metadata observation and component fingerprints, no mutation approval.
reconcile: Dev-only read-only assessment of an acknowledged original operation.
reconcile requires --run-dir and the retained original --source-root.

Every cloud request is GET. There is no apply, retry, accept, unlock or waiver.
The original run, comparison key, intent, claim and failed verification remain intact.
Reports cannot authorize releases or Production. Keep capture comparison.key private.`;
const need = (condition, code) => {if (!condition) throw new BindingEvidenceError(code);};
const nested = (parent, child) => child === parent || child.startsWith(`${parent}${path.sep}`);
async function filesystemPath(directory) {
  let existing = directory;
  const missing = [];
  while (true) {
    try {
      const resolved = path.join(await realpath(existing), ...missing);
      // Darwin volumes may ignore case and Unicode normalization. Conservatively
      // protect aliases even when an operator uses a case-sensitive volume.
      return process.platform === "darwin" ? resolved.normalize("NFD").toLowerCase() : resolved;
    } catch (error) {
      need(error.code === "ENOENT" && path.dirname(existing) !== existing, "evidence-path-inspection-failed");
      let absent = false;
      try {await lstat(existing);}
      catch (entry) {need(entry.code === "ENOENT", "evidence-path-inspection-failed"); absent = true;}
      need(absent, "evidence-path-inspection-failed");
      missing.unshift(path.basename(existing)); existing = path.dirname(existing);
    }
  }
}
async function assertOutputBoundary(root, options, claims, readClaims, earlierRuns = []) {
  need(canonicalDirectory(claims), "invalid-shared-lock-directory");
  const [output, tool, source, locks, original] = await Promise.all([
    filesystemPath(options.outputDirectory), filesystemPath(root), filesystemPath(options.sourceRoot), filesystemPath(claims),
    options.phase === "reconcile" ? filesystemPath(options.runDirectory) : null,
  ]);
  const overlaps = directory => nested(directory, output) || nested(output, directory);
  need(!original || !overlaps(original), "output-overlaps-original-run");
  need(!overlaps(tool) && !overlaps(source), "output-inside-source-checkout");
  need(!overlaps(locks), "output-overlaps-shared-lock-directory");
  const latestRuns = await readClaims(claims);
  need(Array.isArray(latestRuns) && latestRuns.length <= 2 && latestRuns.every(canonicalDirectory), "invalid-shared-claim-run-directories");
  const protectedRuns = [...new Set([...earlierRuns, ...latestRuns])];
  for (const directory of await Promise.all(protectedRuns.map(filesystemPath))) {
    need(!overlaps(directory), "output-overlaps-original-run");
  }
  return protectedRuns;
}
function canonicalDirectory(value) {
  return typeof value === "string" && path.isAbsolute(value) && path.resolve(value) === value &&
    value !== path.parse(value).root && !value.endsWith(path.sep) && !value.includes("\0");
}
function validateOptions(options) {
  need(["capture", "reconcile"].includes(options.phase) && ["dev", "prod"].includes(options.environment) &&
    canonicalDirectory(options.sourceRoot) && canonicalDirectory(options.outputDirectory), "invalid-arguments");
  if (options.phase === "reconcile") {
    need(options.environment === "dev" && canonicalDirectory(options.runDirectory), "reconciliation-dev-original-run-required");
    need(!nested(options.runDirectory, options.outputDirectory) && !nested(options.outputDirectory, options.runDirectory), "output-overlaps-original-run");
  } else need(options.runDirectory === undefined, "capture-does-not-read-original-run");
}
export function parseEvidenceArguments(args) {
  if (args.length === 1 && args[0] === "--help") return {help: true};
  const names = {"--phase": "phase", "--env": "environment", "--source-root": "sourceRoot", "--output-dir": "outputDirectory", "--run-dir": "runDirectory"};
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    need(Object.hasOwn(names, args[i]) && !Object.hasOwn(result, names[args[i]]) && typeof args[i + 1] === "string" &&
      !args[i + 1].startsWith("--"), "invalid-arguments");
    result[names[args[i]]] = args[i + 1];
  }
  validateOptions(result); return result;
}
function git(root, args) {
  try {return execFileSync("git", args, {cwd: root, encoding: "utf8", timeout: 30_000, maxBuffer: 20 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"]});}
  catch {throw new BindingEvidenceError("tool-git-read-failed");}
}
export async function readEvidenceToolBinding(root) {
  need(process.versions.node.split(".")[0] === "24", "node-24-required");
  need(git(root, ["status", "--porcelain=v1"]).trim() === "", "tool-source-not-clean");
  const gitSha = git(root, ["rev-parse", "HEAD"]).trim(), tree = git(root, ["rev-parse", "HEAD^{tree}"]).trim();
  const files = [];
  for (const entry of git(root, ["ls-tree", "-rz", "HEAD"]).split("\0").filter(Boolean)) {
    const [metadata, name] = entry.split("\t"), [mode, type, object] = metadata.split(" ");
    need(type === "blob" && ["100644", "100755"].includes(mode) && name && !path.isAbsolute(name) && !name.split("/").includes(".."), "unsupported-tool-source-entry");
    const file = path.join(root, name), stat = await lstat(file); need(stat.isFile() && !stat.isSymbolicLink(), "unsupported-tool-source-entry");
    const bytes = await readFile(file);
    need(createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex") === object, "tool-source-bytes-changed");
    files.push([name, createHash("sha256").update(bytes).digest("hex")]);
  }
  need(git(root, ["status", "--porcelain=v1"]).trim() === "" && git(root, ["rev-parse", "HEAD"]).trim() === gitSha, "tool-source-changed-during-read");
  const result = {gitSha, tree, trackedSha256: digest(files), nodeMajor: 24}; assertEvidenceToolBinding(result); return result;
}
function inputDigests(value) {
  return digest({proposal: value.proposal, review: value.review, intent: value.intent, operation: value.operation, claim: value.claim});
}
export async function runBindingEvidence(root, options, {
  readSource = (projectId, sourceRoot) => readLocalSource(sourceRoot, projectId),
  readTool = readEvidenceToolBinding,
  providerFactory = createBindingEvidenceProvider,
  loadRun = readRepairRunEvidence,
  readClaims = readBindingRepairClaimDirectories,
  initialize = initializeBindingEvidenceDirectory,
  lockDirectory = sourceRoot => sharedLockDirectory(sourceRoot),
  now = Date.now,
} = {}) {
  if (options.help) return {status: "HELP", help};
  validateOptions(options);
  const claims = lockDirectory(options.sourceRoot);
  const protectedRuns = await assertOutputBoundary(root, options, claims, readClaims);
  const aliases = JSON.parse(await readFile(path.join(options.sourceRoot, ".firebaserc"), "utf8"));
  const projectId = validateFirebaseAlias(aliases, options.environment);
  validateFirebaseAlias(JSON.parse(await readFile(path.join(root, ".firebaserc"), "utf8")), options.environment);
  const toolBinding = await readTool(root), source = await readSource(projectId, options.sourceRoot);
  assertEvidenceToolBinding(toolBinding); assertRepairSource(source, projectId);
  let original, comparisonKey, report;
  if (options.phase === "reconcile") original = await loadRun({runDirectory: options.runDirectory, lockDirectory: claims});
  const provider = providerFactory({projectId, region: "europe-west2"});
  if (options.phase === "capture") {
    comparisonKey = randomBytes(32);
    const snapshot = await provider.snapshot();
    const provenance = await provider.provenance({snapshot});
    report = captureBindingEvidence({environment: options.environment, source, toolBinding, snapshot, provenance, comparisonKey, now});
  } else {
    report = await reconcileBindingEvidence({environment: options.environment, original, originalRunDirectory: options.runDirectory,
      originalSource: source, toolBinding, provider, now});
  }
  need(digest((await readSource(projectId, options.sourceRoot)).binding) === digest(source.binding), "application-source-changed-during-evidence");
  need(digest(await readTool(root)) === digest(toolBinding), "tool-source-changed-during-evidence");
  if (original) {
    const latest = await loadRun({runDirectory: options.runDirectory, lockDirectory: claims});
    need(inputDigests(latest) === inputDigests(original) && Buffer.isBuffer(latest.comparisonKey) && latest.comparisonKey.length === 32 &&
      timingSafeEqual(latest.comparisonKey, original.comparisonKey), "original-records-changed-during-evidence");
  }
  await assertOutputBoundary(root, options, claims, readClaims, protectedRuns);
  const written = await initialize(options.outputDirectory, options.phase === "capture" ? {report, comparisonKey} : {report});
  return {status: report.status, projectId, target: report.target, reportPath: path.join(written.outputDirectory, "report.json"),
    reportSha256: written.reportSha256, originalContractAccepted: false, releaseAuthorized: false, productionAuthorized: false,
    providerWrites: 0, privateComparisonKeyCreated: written.comparisonKeyPresent};
}
export async function runEvidenceCommand(args, {
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), deps,
  stdout = text => console.log(text), stderr = text => console.error(text),
} = {}) {
  try {
    const options = parseEvidenceArguments(args), result = await runBindingEvidence(root, options, deps);
    stdout(options.help ? result.help : JSON.stringify(result, null, 2));
    if (result.status === "BLOCKED_DRIFT") return 1;
    return ["HELP", "CAPTURED_OBSERVATION_NOT_APPROVAL"].includes(result.status) ? 0 : 3;
  } catch (error) {
    const known = error instanceof BindingEvidenceError || error instanceof BindingEvidenceProviderError ||
      error instanceof BindingRepairError || error instanceof BindingRepairProviderError;
    const code = known && /^[a-z0-9-]+$/.test(error.code ?? "") ? error.code : "invalid-input-or-local-state";
    stderr(`Binding evidence blocked: ${code}.`); return 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runEvidenceCommand(process.argv.slice(2));
}
