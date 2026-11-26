#!/usr/bin/env node
import {readFile, lstat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {digest} from "./functions-config-guard-lib.mjs";
import {validateFirebaseAlias} from "./deploy-environment-lib.mjs";
import {assertEvidenceToolBinding} from "./notify-binding-evidence-lib.mjs";
import {readEvidenceToolBinding, isCanonicalEvidenceDirectory} from "./notify-binding-evidence.mjs";
import {prospectiveBindingRequest} from "./notify-binding-prospective-lib.mjs";
import {readLocalSource, sharedLockDirectory} from "./notify-secret-binding-repair.mjs";
import {readProspectiveJsonInput, readBindingRepairClaimDirectories, initializeProductionOperatorRun} from "./notify-secret-binding-repair-store.mjs";
import {PROJECT, TARGET_NAME, EXPECTED_REQUEST, REVIEWED_VERIFIER_COMMIT, validateProductionOperatorPlan} from "./production-notify-once-lib.mjs";
import {runReviewedProductionBefore, assertProductionOperatorBoundaries} from "./production-notify-once.mjs";

const need = (value, code) => {if (!value) throw Object.assign(new Error(code), {code});};
const names = {"--verifier-root": "verifierRoot", "--source-root": "sourceRoot", "--capture-dir": "captureDirectory",
  "--limits-baseline": "limitsBaselineFile", "--check-output-dir": "checkOutputDirectory", "--before-output-dir": "beforeOutputDirectory",
  "--run-dir": "runDirectory"};
const help = `Usage: node scripts/prepare-production-notify-once.mjs
  --verifier-root <clean-reviewed-GET-only-tool> --source-root <clean-built-application>
  --capture-dir <private-capture> --limits-baseline <private-json-sidecar>
  --check-output-dir <new-preparation-report> --before-output-dir <new-future-execution-report>
  --run-dir <new-private-operator-directory>

Runs a fresh reviewed GET-only comparison and prepares unapproved, key-free
Production records. No PATCH, runtime call, email, claim or intent is submitted.
Preparation is not Production authorization. Every output must be a fresh path.`;

export function parsePrepareProductionArguments(args) {
  if (args.length === 1 && args[0] === "--help") return {help: true};
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    need(Object.hasOwn(names, args[index]) && !Object.hasOwn(result, names[args[index]]) &&
      typeof args[index + 1] === "string" && !args[index + 1].startsWith("--"), "invalid-production-preparation-arguments");
    result[names[args[index]]] = args[index + 1];
  }
  need(Object.keys(result).length === Object.keys(names).length && Object.values(result).every(isCanonicalEvidenceDirectory) &&
    /^[A-Za-z0-9_.-]+\.json$/.test(path.basename(result.limitsBaselineFile)), "invalid-production-preparation-arguments");
  return result;
}
async function requireAbsent(directories) {
  for (const directory of directories) {
    let exists = true;
    try {await lstat(directory);} catch (error) {if (error.code === "ENOENT") exists = false; else throw error;}
    need(!exists, "production-preparation-output-already-exists");
  }
}
async function aliases(roots) {
  for (const root of new Set(roots)) need(validateFirebaseAlias(JSON.parse(await readFile(path.join(root, ".firebaserc"), "utf8")), "prod") === PROJECT,
    "production-preparation-alias-mismatch");
}
function inputContext(capture, limitsBaseline, source, operatorToolBinding, verifierToolBinding) {
  assertEvidenceToolBinding(operatorToolBinding); assertEvidenceToolBinding(verifierToolBinding);
  need(verifierToolBinding.gitSha === REVIEWED_VERIFIER_COMMIT, "production-preparation-verifier-not-reviewed");
  const request = prospectiveBindingRequest(capture);
  need(digest(request) === digest(EXPECTED_REQUEST), "production-preparation-request-mismatch");
  const context = {captureReportSha256: digest(capture), limitsBaselineSha256: digest(limitsBaseline), requestSha256: digest(request),
    sourceBindingSha256: digest(source.binding), comparisonToolBindingSha256: digest(verifierToolBinding)};
  return {request, context};
}

/** Read-only provider work followed only by exclusive, unapproved local records. */
export async function runPrepareProductionNotifyOnce(root, options, {
  readJson = readProspectiveJsonInput, readTool = readEvidenceToolBinding,
  readSource = sourceRoot => readLocalSource(sourceRoot, PROJECT), before = runReviewedProductionBefore,
  initialize = initializeProductionOperatorRun, legacyLockDirectory = sharedLockDirectory, readClaims = readBindingRepairClaimDirectories,
  boundaries = assertProductionOperatorBoundaries, now = Date.now,
} = {}) {
  if (options.help) return {status: "HELP", help};
  need(options && !Array.isArray(options) && Object.keys(options).length === Object.keys(names).length &&
    Object.keys(options).every(name => Object.values(names).includes(name)), "invalid-production-preparation-arguments");
  parsePrepareProductionArguments(Object.entries(names).flatMap(([flag, name]) => [flag, options[name]]));
  const {checkOutputDirectory, ...paths} = structuredClone(options), planShape = {paths};
  const legacyLocks = legacyLockDirectory(root), operatorLocks = path.join(path.dirname(legacyLocks), "production-notify-once-locks");
  const protectedRuns = await boundaries(root, planShape, legacyLocks, operatorLocks, readClaims, [], [checkOutputDirectory]);
  await requireAbsent([paths.runDirectory, paths.beforeOutputDirectory, checkOutputDirectory]);
  await requireAbsent([path.join(operatorLocks, `${PROJECT}.json`)]);
  await aliases([root, paths.verifierRoot, paths.sourceRoot]);
  const captureFile = path.join(paths.captureDirectory, "report.json");
  const readInputs = async () => {
    const [capture, limitsBaseline, source, operatorToolBinding, verifierToolBinding] = await Promise.all([
      readJson(captureFile), readJson(paths.limitsBaselineFile), readSource(paths.sourceRoot), readTool(root), readTool(paths.verifierRoot),
    ]);
    return {capture, limitsBaseline, source, operatorToolBinding, verifierToolBinding};
  };
  const initial = structuredClone(await readInputs());
  const {request, context} = inputContext(initial.capture, initial.limitsBaseline, initial.source, initial.operatorToolBinding, initial.verifierToolBinding);
  const result = await before(paths.verifierRoot, {phase: "before", captureDirectory: paths.captureDirectory, sourceRoot: paths.sourceRoot,
    limitsBaselineFile: paths.limitsBaselineFile, outputDirectory: checkOutputDirectory});
  need(result?.status === "BASELINE_MATCH" && result.reportPath === path.join(checkOutputDirectory, "report.json"),
    "production-preparation-fresh-baseline-required");
  const report = await readJson(result.reportPath);
  need(digest(report) === result.reportSha256 && report.schemaVersion === "sodc-notify-binding-prospective/v1" && report.status === "BASELINE_MATCH" &&
    report.projectId === PROJECT && report.phase === "before" && report.readOnly === true && report.providerWrites === 0 &&
    report.productionAuthorized === false && report.releaseAuthorized === false && report.originalContractAccepted === false &&
    Object.entries(context).every(([name, hash]) => report[name] === hash), "production-preparation-baseline-context-mismatch");
  const latest = await readInputs();
  need(digest(latest) === digest(initial), "production-preparation-inputs-changed");
  need(digest(await readJson(result.reportPath)) === digest(report), "production-preparation-report-changed");
  await aliases([root, paths.verifierRoot, paths.sourceRoot]);
  await boundaries(root, planShape, legacyLocks, operatorLocks, readClaims, protectedRuns, [checkOutputDirectory]);
  await requireAbsent([paths.runDirectory, paths.beforeOutputDirectory]);
  await requireAbsent([path.join(operatorLocks, `${PROJECT}.json`)]);
  const timestamp = now();
  need(Number.isFinite(timestamp) && Number.isFinite(new Date(timestamp).getTime()), "production-preparation-clock-invalid");
  const plan = validateProductionOperatorPlan({schemaVersion: "sodc-production-notify-operator-plan/v1", createdAt: new Date(timestamp).toISOString(),
    projectId: PROJECT, target: TARGET_NAME, request, context, paths, operatorToolBinding: initial.operatorToolBinding,
    verifierToolBinding: initial.verifierToolBinding, provenanceBoundary: "ARCHIVE_AND_EXECUTABLE_EQUALITY_UNPROVEN",
    liveMailEffect: "NORMAL_APPLICATION_MAIL_MAY_RESUME"});
  const written = await initialize(paths.runDirectory, {plan});
  need(written?.runDirectory === paths.runDirectory && written.planSha256 === digest(plan), "production-preparation-record-mismatch");
  return {status: "PREPARED_FOR_REVIEW_NOT_AUTHORIZED", projectId: PROJECT, planSha256: written.planSha256,
    planPath: path.join(paths.runDirectory, "plan.json"), requestPath: path.join(paths.runDirectory, "request.json"),
    reviewTemplatePath: path.join(paths.runDirectory, "review-template.json"), checkReportPath: result.reportPath,
    command: ["node", path.join(root, "scripts/production-notify-once.mjs"), "--run-dir", paths.runDirectory],
    providerWrites: 0, productionAuthorized: false, releaseAuthorized: false};
}

export async function runPrepareProductionNotifyCommand(args, {root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), deps,
  stdout = text => console.log(text), stderr = text => console.error(text)} = {}) {
  try {
    const result = await runPrepareProductionNotifyOnce(root, parsePrepareProductionArguments(args), deps);
    stdout(result.status === "HELP" ? result.help : JSON.stringify(result, null, 2)); return 0;
  } catch (error) {
    const code = /^[a-z0-9-]{1,100}$/.test(error?.code ?? "") ? error.code : "invalid-production-preparation-input-or-state";
    stderr(`Production preparation blocked: ${code}. Keep any GET-only reports; no mutation is authorized.`); return 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runPrepareProductionNotifyCommand(process.argv.slice(2));
}
