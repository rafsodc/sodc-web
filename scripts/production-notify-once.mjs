#!/usr/bin/env node
import {readFile, lstat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {digest} from "./functions-config-guard-lib.mjs";
import {validateFirebaseAlias} from "./deploy-environment-lib.mjs";
import {readEvidenceToolBinding, resolveEvidenceFilesystemPath, isCanonicalEvidenceDirectory} from "./notify-binding-evidence.mjs";
import {readLocalSource, sharedLockDirectory} from "./notify-secret-binding-repair.mjs";
import {readProspectiveJsonInput, readBindingRepairClaimDirectories, openProductionOperatorStore} from "./notify-secret-binding-repair-store.mjs";
import {createBindingRepairProvider} from "./notify-secret-binding-repair-provider.mjs";
import {PROJECT, TARGET_NAME, validateProductionOperatorPlan, validateProductionOperatorReview,
  productionOperatorIntent, productionOperatorAcknowledgement} from "./production-notify-once-lib.mjs";

const need = (condition, code) => {if (!condition) throw Object.assign(new Error(code), {code});};
const contextNames = ["captureReportSha256", "limitsBaselineSha256", "requestSha256", "sourceBindingSha256", "comparisonToolBindingSha256"];
const help = `Usage: node scripts/production-notify-once.mjs --run-dir <prepared-private-directory>

Requires the exact approved Production plan and review.json, a fresh matching
GET-only comparison, and durable claim/intent records before one fixed PATCH.
No retry, unlock, rollback, alternate project, target, bindings or URL option.
Acknowledgement is not verification. Exit3 requires separate GET-only verification
or unknown-outcome investigation. Preparation/help never authorizes a change.`;

export function parseProductionOnceArguments(args) {
  if (args.length === 1 && args[0] === "--help") return {help: true};
  need(args.length === 2 && args[0] === "--run-dir" && isCanonicalEvidenceDirectory(args[1]), "invalid-production-operator-arguments");
  return {runDirectory: args[1]};
}
async function reviewedBefore(verifierRoot, options) {
  const module = await import(pathToFileURL(path.join(verifierRoot, "scripts/notify-binding-prospective.mjs")).href);
  return module.runProspectiveComparison(verifierRoot, options);
}
async function assertBoundaries(root, plan, legacyLocks, operatorLocks, readClaims, previous = []) {
  const claims = await readClaims(legacyLocks);
  need(Array.isArray(claims) && claims.length <= 2 && claims.every(isCanonicalEvidenceDirectory), "invalid-operator-protected-claims");
  const kept = [...new Set([...previous, ...claims])], p = plan.paths;
  const protectedPaths = [root, p.verifierRoot, p.sourceRoot, p.captureDirectory, path.dirname(p.limitsBaselineFile),
    legacyLocks, operatorLocks, ...kept];
  const nested = (a, b) => a === b || b.startsWith(a + path.sep);
  const overlap = (a, b) => nested(a, b) || nested(b, a);
  const run = await resolveEvidenceFilesystemPath(p.runDirectory), before = await resolveEvidenceFilesystemPath(p.beforeOutputDirectory);
  need(!overlap(run, before), "operator-output-overlaps-run");
  for (const protectedPath of await Promise.all(protectedPaths.map(resolveEvidenceFilesystemPath))) {
    need(!overlap(protectedPath, run) && !overlap(protectedPath, before), "operator-path-overlaps-protected-input");
  }
  let legacyClaimExists = true;
  try {await lstat(path.join(legacyLocks, `${PROJECT}.json`));}
  catch (error) {if (error.code === "ENOENT") legacyClaimExists = false; else throw error;}
  need(!legacyClaimExists, "legacy-production-claim-present");
  return kept;
}

/** Supervised transport only: the caller must supply an actual approved review.
 * No provider mutation is reachable from help or preparation records. */
export async function runProductionNotifyOnce(root, options, {
  readJson = readProspectiveJsonInput, readTool = readEvidenceToolBinding,
  readSource = sourceRoot => readLocalSource(sourceRoot, PROJECT), before = reviewedBefore,
  openStore = openProductionOperatorStore, writerFactory = createBindingRepairProvider,
  legacyLockDirectory = sharedLockDirectory, readClaims = readBindingRepairClaimDirectories, now = Date.now,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (options.help) return {status: "HELP", help};
  need(Object.keys(options).length === 1, "invalid-production-operator-arguments");
  parseProductionOnceArguments(["--run-dir", options.runDirectory]);
  const runDirectory = options.runDirectory, planFile = path.join(runDirectory, "plan.json"), reviewFile = path.join(runDirectory, "review.json");
  const plan = validateProductionOperatorPlan(await readJson(planFile));
  const review = structuredClone(await readJson(reviewFile)), reviewSha256 = digest(review), planSha256 = digest(plan);
  const legacyLocks = legacyLockDirectory(root), operatorLocks = path.join(path.dirname(legacyLocks), "production-notify-once-locks");
  let protectedRuns = await assertBoundaries(root, plan, legacyLocks, operatorLocks, readClaims);
  need(validateFirebaseAlias(JSON.parse(await readFile(path.join(root, ".firebaserc"), "utf8")), "prod") === PROJECT,
    "operator-production-alias-mismatch");
  async function current() {
    const [operatorToolBinding, verifierToolBinding, source] = await Promise.all([
      readTool(root), readTool(plan.paths.verifierRoot), readSource(plan.paths.sourceRoot),
    ]);
    const [freshPlan, freshReview] = await Promise.all([readJson(planFile), readJson(reviewFile)]);
    need(digest(freshPlan) === planSha256 && digest(freshReview) === reviewSha256,
      "operator-plan-or-review-changed");
    need(digest(source.binding) === plan.context.sourceBindingSha256,
      "operator-application-source-changed");
    // The clock and review are checked after every source/tool wait.
    validateProductionOperatorReview({plan, review: freshReview, runDirectory, operatorToolBinding, verifierToolBinding, now: now()});
  }
  await current();
  const store = await openStore({runDirectory, lockDirectory: operatorLocks, plan, reviewSha256});
  await store.assertUnclaimed();
  const result = await before(plan.paths.verifierRoot, {phase: "before", captureDirectory: plan.paths.captureDirectory,
    sourceRoot: plan.paths.sourceRoot, limitsBaselineFile: plan.paths.limitsBaselineFile, outputDirectory: plan.paths.beforeOutputDirectory});
  need(result.status === "BASELINE_MATCH" && result.reportPath === path.join(plan.paths.beforeOutputDirectory, "report.json"),
    "operator-fresh-baseline-required");
  const report = await readJson(result.reportPath);
  need(digest(report) === result.reportSha256 && report.schemaVersion === "sodc-notify-binding-prospective/v1" &&
    report.status === "BASELINE_MATCH" && report.phase === "before" && report.readOnly === true &&
    report.productionAuthorized === false && report.releaseAuthorized === false && report.originalContractAccepted === false &&
    contextNames.every(name => report[name] === plan.context[name]), "operator-baseline-context-mismatch");
  protectedRuns = await assertBoundaries(root, plan, legacyLocks, operatorLocks, readClaims, protectedRuns);
  await store.assertUnclaimed();
  await current();
  const intent = productionOperatorIntent(plan, now());
  await store.beginIntent(intent); // Retained exclusive project claim, then durable intent.
  await assertBoundaries(root, plan, legacyLocks, operatorLocks, readClaims, protectedRuns);
  await current(); // A withdrawn/expired approval cannot dispatch after the intent wait.
  const request = structuredClone(plan.request);
  let admitted = false;
  const provider = writerFactory({projectId: PROJECT, region: "europe-west2", fetchImpl: async (url, options) => {
    need(!admitted && url === request.url && options?.method === "PATCH" && options.redirect === "error" &&
      typeof options.body === "string" && digest(JSON.parse(options.body)) === digest(request.body), "operator-http-request-outside-plan");
    admitted = true; // Reserve the sole HTTP attempt before the asynchronous recheck.
    // Authentication may itself wait. Check the actual dispatch boundary too.
    await current();
    need(options.signal instanceof AbortSignal && !options.signal.aborted, "operator-request-deadline-expired");
    return fetchImpl(url, options);
  }});
  try {
    // Every reviewed reference uses the literal project ID. The existing
    // provider validates those without a project-number inventory initialization.
    const acknowledgement = productionOperatorAcknowledgement(await provider.patchBindings({name: TARGET_NAME,
      bindings: request.body.serviceConfig.secretEnvironmentVariables}));
    await store.writeOperation(acknowledgement);
    return {status: "ACKNOWLEDGED_VERIFY_REQUIRED", projectId: PROJECT, operationName: acknowledgement.name,
      planSha256, providerWritesAttempted: 1, verificationComplete: false, releaseAuthorized: false};
  } catch {
    // The retained claim/intent are never removed, even for a definite rejection.
    return {status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED", projectId: PROJECT, planSha256,
      providerWritesAttempted: 1, verificationComplete: false, releaseAuthorized: false};
  }
}

export async function runProductionNotifyCommand(args, {root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), deps,
  stdout = text => console.log(text), stderr = text => console.error(text)} = {}) {
  try {
    const result = await runProductionNotifyOnce(root, parseProductionOnceArguments(args), deps);
    stdout(result.status === "HELP" ? result.help : JSON.stringify(result, null, 2));
    return result.status === "HELP" ? 0 : 3;
  } catch (error) {
    const code = /^[a-z0-9-]{1,100}$/.test(error?.code ?? "") ? error.code : "invalid-operator-input-or-state";
    stderr(`Production operator blocked: ${code}. Retain any claim/intent; do not resubmit.`);
    return 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runProductionNotifyCommand(process.argv.slice(2));
}
