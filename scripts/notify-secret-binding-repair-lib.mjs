import {createHmac, timingSafeEqual} from "node:crypto";
import {canonical, digest, assertSupportedManifest} from "./functions-config-guard-lib.mjs";

export const TARGET = "reconcileMyCheckoutSessionOrders";
export const REGION = "europe-west2";
export const NOTIFY_KEYS = Object.freeze(["GOV_NOTIFY_LIVE_API_KEY", "GOV_NOTIFY_TEAM_API_KEY", "GOV_NOTIFY_TEST_API_KEY"]);
const KEYS = [...NOTIFY_KEYS, "STRIPE_SECRET"].sort();
const PROJECTS = {dev: "sodc-web", prod: "sodc-web-production"};
const SCHEMA = "sodc-notify-binding-repair/v1";
const REVIEW_SCHEMA = "sodc-notify-binding-repair-review/v1";
const TTL = 60 * 60 * 1000;

export class BindingRepairError extends Error {
  constructor(code) {super(`Notify binding repair blocked: ${code}.`); this.code = code;}
}
const need = (condition, code) => {if (!condition) throw new BindingRepairError(code);};
const same = (a, b) => digest(a) === digest(b);
const sorted = values => [...values].sort();
const at = now => typeof now === "function" ? now() : now ?? Date.now();
const iso = now => new Date(at(now)).toISOString();
function fingerprint(value, key) {
  need(Buffer.isBuffer(key) && key.length === 32, "invalid-comparison-key");
  return createHmac("sha256", key).update(JSON.stringify(canonical(value))).digest("hex");
}
function sameFingerprint(a, b) {
  return typeof a === "string" && typeof b === "string" && /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b) &&
    timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
function projectFor(environment) {need(Object.hasOwn(PROJECTS, environment), "unsupported-environment"); return PROJECTS[environment];}
function targetName(projectId) {return `projects/${projectId}/locations/${REGION}/functions/${TARGET}`;}
function sortedBindings(bindings, project) {
  need(Array.isArray(bindings), "invalid-secret-bindings");
  const result = bindings.map(binding => {
    need(binding && same(sorted(Object.keys(binding)), ["key", "projectId", "secret", "version"]) &&
      /^[A-Z_][A-Z0-9_]*$/.test(binding.key) && binding.key === binding.secret &&
      [project.projectId, project.projectNumber].includes(binding.projectId) && /^[1-9]\d*$/.test(binding.version), "unsupported-secret-reference");
    return {...binding, projectId: project.projectId};
  }).sort((a, b) => a.key.localeCompare(b.key));
  need(new Set(result.map(x => x.key)).size === result.length, "duplicate-secret-binding");
  return result;
}
function policySemantics(policy) {
  need(policy && [1, 3].includes(policy.version ?? 1) && Array.isArray(policy.bindings ?? []), "invalid-iam-policy");
  const result = structuredClone(policy); delete result.etag;
  need((result.bindings ?? []).every(binding => binding && typeof binding.role === "string" &&
    Array.isArray(binding.members) && binding.members.every(member => typeof member === "string")), "invalid-iam-policy");
  result.bindings = (result.bindings ?? []).map(binding => ({...binding, members: sorted(binding.members ?? [])}))
    .sort((a, b) => digest(a).localeCompare(digest(b)));
  return result;
}
function validateSource(source, projectId) {
  need(source?.binding && /^[a-f0-9]{40}$/.test(source.binding.gitSha ?? "") &&
    /^[a-f0-9]{40}$/.test(source.binding.tree ?? "") &&
    [source.binding.trackedSha256, source.binding.buildSha256, source.binding.manifestSha256,
      source.binding.sdk?.binarySha256, source.binding.sdk?.packageSha256].every(value => /^[a-f0-9]{64}$/.test(value ?? "")) &&
    source.binding.sdk?.version === "7.2.5" && source.binding.manifestSha256 === digest(source.manifest), "invalid-source-binding");
  try {assertSupportedManifest(source.manifest, REGION);} catch {throw new BindingRepairError("unsupported-source-manifest");}
  const parameters = new Set((source.manifest.params ?? []).map(value => value.name));
  const used = new Set();
  for (const endpoint of Object.values(source.manifest.endpoints)) {
    need(Array.isArray(endpoint.secretEnvironmentVariables ?? []) && (endpoint.secretEnvironmentVariables ?? []).every(value =>
      value && same(Object.keys(value), ["key"]) && typeof value.key === "string" && parameters.has(value.key)),
    "unsupported-source-secret-descriptor");
    for (const value of endpoint.secretEnvironmentVariables ?? []) used.add(value.key);
  }
  need(parameters.size === (source.manifest.params ?? []).length && same(sorted(parameters), sorted(used)), "unsupported-source-secret-parameter");
  const target = source.manifest.endpoints[TARGET];
  need(target && Object.hasOwn(target, "callableTrigger") && same(target.callableTrigger, {}) &&
    same(sorted((target.secretEnvironmentVariables ?? []).map(x => x.key)), KEYS), "candidate-target-secret-declaration-mismatch");
  need(Object.keys(target).every(key => key !== "environmentVariables"), "unsupported-source-environment");
  need(typeof projectId === "string", "invalid-project");
}
function collect(snapshot, comparisonKey, projectId, manifest, {after = false} = {}) {
  need(snapshot?.project?.projectId === projectId && /^[1-9]\d*$/.test(String(snapshot.project.projectNumber)), "wrong-project");
  const project = {...snapshot.project, projectNumber: String(snapshot.project.projectNumber)};
  need(Array.isArray(snapshot.functions) && Array.isArray(snapshot.schedulers) && snapshot.schedulers.length > 0, "incomplete-inventory");
  const names = snapshot.functions.map(fn => fn.name?.split("/").at(-1));
  need(new Set(names).size === names.length && same(sorted(names), sorted(Object.keys(manifest.endpoints))), "endpoint-inventory-mismatch");
  const functions = {}, invokers = {};
  let target;
  for (const fn of snapshot.functions) {
    const name = fn.name.split("/").at(-1);
    need(fn.name === `projects/${projectId}/locations/${REGION}/functions/${name}` && fn.environment === "GEN_2" && fn.state === "ACTIVE" &&
      fn.buildConfig?.runtime === "nodejs24" && fn.buildConfig.entryPoint === name && fn.serviceConfig?.allTrafficOnLatestRevision === true,
    "function-not-active-or-contract-invalid");
    const refs = sortedBindings(fn.serviceConfig.secretEnvironmentVariables ?? [], project);
    const declared = sorted((manifest.endpoints[name].secretEnvironmentVariables ?? []).map(x => x.key));
    if (name !== TARGET) need(same(declared, refs.map(x => x.key)), "unrelated-source-secret-delta");
    const value = structuredClone(fn);
    if (name === TARGET) {
      target = fn;
      need(fn.labels?.["deployment-callable"] === "true" && !fn.eventTrigger &&
        fn.serviceConfig.serviceAccountEmail === `${project.projectNumber}-compute@developer.gserviceaccount.com` &&
        fn.serviceConfig.maxInstanceCount === 20 && (fn.stateMessages ?? []).length === 0, "target-runtime-contract-invalid");
      need(same(refs.map(x => x.key), after ? KEYS : ["STRIPE_SECRET"]), "target-secret-binding-mismatch");
      delete value.updateTime; delete value.stateMessages;
      delete value.serviceConfig.revision; delete value.serviceConfig.secretEnvironmentVariables;
    }
    functions[name] = fingerprint(value, comparisonKey);
    invokers[name] = fingerprint(policySemantics(snapshot.invokerPolicies?.[name]), comparisonKey);
  }
  need(target, "missing-target");
  need(typeof target.serviceConfig.revision === "string" && target.serviceConfig.revision.length > 0 &&
    Number.isFinite(Date.parse(target.updateTime)), "missing-target-revision-observation");
  const jobs = {};
  for (const job of snapshot.schedulers) {
    need(typeof job.name === "string" && job.name.startsWith(`projects/${projectId}/locations/${REGION}/jobs/`) &&
      job.state === "ENABLED" && !Object.hasOwn(jobs, job.name), "invalid-scheduler-inventory");
    const value = structuredClone(job);
    for (const key of ["lastAttemptTime", "scheduleTime", "status"]) delete value[key];
    jobs[job.name] = fingerprint(value, comparisonKey);
  }
  const versions = {}, policies = {}, desired = [];
  for (const key of KEYS) {
    const refs = snapshot.functions.flatMap(fn => sortedBindings(fn.serviceConfig.secretEnvironmentVariables ?? [], project))
      .filter(ref => ref.key === key);
    need(refs.length > 0 && new Set(refs.map(ref => ref.version)).size === 1, "missing-or-mixed-existing-secret-version");
    const version = refs[0].version;
    const pair = snapshot.secretVersions?.[key];
    const validVersion = value => value && [projectId, project.projectNumber].some(id => value.name === `projects/${id}/secrets/${key}/versions/${version}`) && value.state === "ENABLED";
    need(validVersion(pair?.numeric) && validVersion(pair?.latest), "secret-version-state-or-latest-drift");
    versions[key] = {secret: key, version, state: "ENABLED"};
    const policy = policySemantics(snapshot.secretPolicies?.[key]);
    need(policy.bindings.some(binding => binding.role === "roles/secretmanager.secretAccessor" &&
      !Object.hasOwn(binding, "condition") && binding.members.includes(`serviceAccount:${target.serviceConfig.serviceAccountEmail}`)),
    "runtime-secret-access-not-proven");
    policies[key] = fingerprint(policy, comparisonKey);
    desired.push({...refs[0]});
  }
  return {project: {projectId, projectNumber: project.projectNumber}, functions, invokers, schedulers: jobs,
    versions, policies, targetObservation: {revision: target.serviceConfig.revision, updateTime: target.updateTime},
    targetBindings: sortedBindings(target.serviceConfig.secretEnvironmentVariables, project), desiredBindings: desired};
}
function baselineOf(value) {
  const result = structuredClone(value); delete result.targetBindings; delete result.desiredBindings; return result;
}
function validateProposal(proposal) {
  const projectId = projectFor(proposal?.environment);
  need(same(sorted(Object.keys(proposal)), ["action", "after", "baseline", "before", "createdAt", "environment", "expiresAt",
    "limits", "projectId", "providerWrites", "schemaVersion", "sourceBinding", "target", "updateMask"]) &&
    proposal.schemaVersion === SCHEMA && proposal.action === "add-existing-notify-secret-bindings" &&
    proposal.projectId === projectId && proposal.target === targetName(projectId) &&
    proposal.updateMask === "serviceConfig.secretEnvironmentVariables" && proposal.providerWrites === 0 &&
    Number.isFinite(Date.parse(proposal.createdAt)) && Date.parse(proposal.expiresAt) - Date.parse(proposal.createdAt) === TTL,
  "invalid-proposal");
  const project = proposal.baseline?.project;
  need(project?.projectId === projectId && /^[1-9]\d*$/.test(project.projectNumber), "invalid-proposal-project");
  const before = sortedBindings(proposal.before, project), after = sortedBindings(proposal.after, project);
  need(same(before.map(x => x.key), ["STRIPE_SECRET"]) && same(after.map(x => x.key), KEYS) &&
    same(before[0], after.find(x => x.key === "STRIPE_SECRET")), "invalid-proposal-secret-scope");
  return projectId;
}
export function prepareRepair({environment, source, snapshot, comparisonKey, now}) {
  const projectId = projectFor(environment);
  validateSource(source, projectId);
  const view = collect(snapshot, comparisonKey, projectId, source.manifest);
  const createdAt = at(now);
  return canonical({schemaVersion: SCHEMA, action: "add-existing-notify-secret-bindings", environment, projectId,
    target: targetName(projectId), updateMask: "serviceConfig.secretEnvironmentVariables", createdAt: new Date(createdAt).toISOString(),
    expiresAt: new Date(createdAt + TTL).toISOString(), sourceBinding: source.binding,
    baseline: baselineOf(view), before: view.targetBindings, after: view.desiredBindings, providerWrites: 0,
    limits: ["No atomic read/compare/PATCH precondition is available; coordinate all concurrent administration.",
      "Only exact metadata read-back can establish success; an unknown request outcome is never replayed.",
      "No build/source change is accepted. Configuration-only behaviour must be established in Dev before Production."]});
}
export function reviewTemplate(proposal) {
  validateProposal(proposal);
  return {schemaVersion: REVIEW_SCHEMA, proposalSha256: digest(proposal), decision: "REVIEW_REQUIRED",
    reviewedBy: "REPLACE_AFTER_REVIEW", reason: "REPLACE_AFTER_REVIEW"};
}
export function assertReview(proposal, review, now) {
  validateProposal(proposal);
  need(at(now) >= Date.parse(proposal.createdAt) && at(now) <= Date.parse(proposal.expiresAt), "proposal-expired-or-clock-invalid");
  need(review && same(sorted(Object.keys(review)), ["decision", "proposalSha256", "reason", "reviewedBy", "schemaVersion"]) &&
    review.schemaVersion === REVIEW_SCHEMA && review.decision === "APPROVED" && review.proposalSha256 === digest(proposal) &&
    [review.reviewedBy, review.reason].every(value => typeof value === "string" && value.trim() &&
      value.trim().toUpperCase() !== "REPLACE_AFTER_REVIEW"), "missing-or-invalid-exact-review");
}
async function currentSource(proposal, readSource) {
  const source = await readSource(); validateSource(source, proposal.projectId);
  need(same(source.binding, proposal.sourceBinding), "source-or-build-drift"); return source;
}
function compare(proposal, snapshot, comparisonKey, source, after) {
  const view = collect(snapshot, comparisonKey, proposal.projectId, source.manifest, {after});
  need(same(view.desiredBindings, proposal.after), "unverified-desired-secret-version");
  need(same(view.targetBindings, after ? proposal.after : proposal.before), "target-secret-binding-drift");
  const baseline = baselineOf(view);
  const expected = structuredClone(proposal.baseline);
  if (after) {delete baseline.targetObservation; delete expected.targetObservation;}
  // HMAC protects arbitrary environment and IAM values. The comparison key stays
  // in a separate private local file and is never part of the shared proposal.
  need(sameFingerprint(fingerprint(baseline, comparisonKey), fingerprint(expected, comparisonKey)), "provider-baseline-drift");
}
export const assertRepairSource = validateSource;
function operationName(name, projectId) {
  return typeof name === "string" && new RegExp(`^projects/${projectId}/locations/${REGION}/operations/[A-Za-z0-9_-]+$`).test(name);
}
function assertOperation(operation, proposal, requireScope = false) {
  need(operationName(operation?.name, proposal.projectId), "invalid-operation-acknowledgement");
  need(operation.done === undefined || typeof operation.done === "boolean", "invalid-operation-state");
  if (operation.metadata === undefined && !requireScope) return;
  const aliases = [proposal.target, proposal.target.replace(`projects/${proposal.projectId}/`, `projects/${proposal.baseline.project.projectNumber}/`)];
  need(aliases.includes(operation.metadata?.target) && operation.metadata?.verb === "update", "operation-target-or-verb-mismatch");
}
export async function applyRepair({proposal, review, comparisonKey, provider, readSource, store, now}) {
  validateProposal(proposal); assertReview(proposal, review, now);
  need(await store.read("intent.json") === null, "application-already-started-use-verify");
  const source = await currentSource(proposal, readSource);
  compare(proposal, await provider.snapshot(), comparisonKey, source, false);
  await currentSource(proposal, readSource);
  assertReview(proposal, review, now);
  const intent = {schemaVersion: SCHEMA, proposalSha256: digest(proposal), reviewSha256: digest(review), startedAt: iso(now)};
  await store.writeOnce("intent.json", intent);
  assertReview(proposal, review, now);
  // No catch before the durable write: a failed fsync must prevent the PATCH.
  let operation;
  try {
    operation = await provider.patchBindings({name: proposal.target, bindings: structuredClone(proposal.after)});
    assertOperation(operation, proposal);
    await store.writeOnce("operation.json", {name: operation.name});
  } catch {
    // The request may have committed even on timeout/invalid JSON/disk failure.
    // The persisted intent makes every subsequent apply stop before a new PATCH.
    return {status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED", proposalSha256: digest(proposal)};
  }
  return {status: "APPLY_ACCEPTED_VERIFY_REQUIRED", operationName: operation.name, proposalSha256: digest(proposal)};
}
export async function verifyRepair({proposal, comparisonKey, provider, readSource, store, now}) {
  validateProposal(proposal);
  const intent = await store.read("intent.json");
  need(intent?.schemaVersion === SCHEMA && intent.proposalSha256 === digest(proposal) &&
    Date.parse(intent.startedAt) >= Date.parse(proposal.createdAt) && Date.parse(intent.startedAt) <= Date.parse(proposal.expiresAt), "missing-or-invalid-apply-intent");
  const source = await currentSource(proposal, readSource);
  const ack = await store.read("operation.json");
  if (!ack) return {status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED", proposalSha256: digest(proposal)};
  need(operationName(ack.name, proposal.projectId), "invalid-operation-reference");
  const operation = await provider.operation(ack.name);
  need(operation?.name === ack.name, "operation-reference-drift");
  assertOperation(operation, proposal, operation.done === true);
  if (operation.done !== true) return {status: "PENDING", operationName: ack.name};
  if (operation.error) return {status: "OPERATION_FAILED_OPERATOR_REVIEW_REQUIRED", operationName: ack.name,
    errorCode: Number.isSafeInteger(operation.error.code) ? operation.error.code : null};
  compare(proposal, await provider.snapshot(), comparisonKey, source, true);
  await currentSource(proposal, readSource);
  return {status: "PASS", proposalSha256: digest(proposal), operationName: ack.name, verifiedAt: iso(now),
    functionsPreserved: Object.keys(proposal.baseline.functions).length, schedulersPreserved: Object.keys(proposal.baseline.schedulers).length,
    target: proposal.target, secretBindings: proposal.after, secretPayloadsRead: false, emailSends: 0,
    limits: ["Point-in-time metadata acceptance, not key validity or email-delivery proof.", "Normal Functions guard/full preflight must be collected afresh; this is not their receipt."]};
}
