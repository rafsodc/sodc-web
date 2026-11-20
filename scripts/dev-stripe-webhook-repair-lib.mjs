import {createHmac, timingSafeEqual} from "node:crypto";
import {canonical, digest, assertSupportedManifest} from "./functions-config-guard-lib.mjs";

export const PROJECT_ID = "sodc-web";
export const PROJECT_NUMBER = "931675247602";
export const REGION = "europe-west2";
export const TARGET = "stripeWebhookPayments";
export const TARGET_NAME = `projects/${PROJECT_ID}/locations/${REGION}/functions/${TARGET}`;
export const SECRET_KEY = "STRIPE_WEBHOOK_SECRET_PAYMENTS";
export const ACCOUNT_ID = "acct_1SgTanEJWVZaraSf";
export const ENDPOINT_ID = "we_1TOixKEJWVZaraSfeonnSQby";
export const ENDPOINT_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${TARGET}`;
export const BEFORE_EVENTS = Object.freeze(["checkout.session.completed", "checkout.session.async_payment_failed", "checkout.session.expired", "charge.refunded", "charge.dispute.created", "charge.dispute.closed", "charge.dispute.updated"].sort());
export const REQUIRED_EVENTS = Object.freeze([...BEFORE_EVENTS, "checkout.session.async_payment_succeeded", "refund.created", "refund.updated", "refund.failed"].sort());
export const SECRET_KEYS = Object.freeze([SECRET_KEY, "STRIPE_SECRET", "GOV_NOTIFY_LIVE_API_KEY", "GOV_NOTIFY_TEAM_API_KEY", "GOV_NOTIFY_TEST_API_KEY"].sort());
export const SCHEMA = "sodc-dev-stripe-webhook-repair/v1";
export const RECORD_SCHEMA = "sodc-dev-stripe-webhook-repair-record/v1";
const REVIEW_SCHEMA = "sodc-dev-stripe-webhook-repair-review/v1";
const BACKLOG_ACCEPTANCE = "User accepts existing Dev backlog processing; Dev data disposable";
const TTL = 60 * 60 * 1000;
const SA = `${PROJECT_NUMBER}-compute@developer.gserviceaccount.com`;
const HEX = /^[a-f0-9]{64}$/;
const NUMERIC = /^[1-9]\d{0,19}$/;
const sorted = values => [...values].sort();
const same = (a, b) => digest(a) === digest(b);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const at = now => typeof now === "function" ? now() : now ?? Date.now();
const iso = now => new Date(at(now)).toISOString();
export class DevStripeWebhookRepairError extends Error {
  constructor(code) {super(`Dev Stripe webhook repair blocked: ${code}.`); this.name = "DevStripeWebhookRepairError"; this.code = code;}
}
const need = (condition, code) => {if (!condition) throw new DevStripeWebhookRepairError(code);};
const keys = (value, expected) => object(value) && same(sorted(Object.keys(value)), sorted(expected));
function hmac(value, key) {
  need(Buffer.isBuffer(key) && key.length === 32, "invalid-comparison-key");
  return createHmac("sha256", key).update(JSON.stringify(canonical(value))).digest("hex");
}
function equalHmac(a, b) {return HEX.test(a ?? "") && HEX.test(b ?? "") && timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));}
function candidate(value) {need(typeof value === "string" && /^whsec_[A-Za-z0-9]{10,250}$/.test(value), "invalid-candidate-signing-secret"); return value;}
function metadataTime(value) {return typeof value === "string" && Number.isFinite(Date.parse(value));}
function bindings(values) {
  need(Array.isArray(values), "invalid-secret-bindings");
  const result = values.map(value => {
    need(keys(value, ["key", "projectId", "secret", "version"]) && typeof value.key === "string" && value.key === value.secret &&
      typeof value.projectId === "string" && [PROJECT_ID, PROJECT_NUMBER].includes(value.projectId) && NUMERIC.test(value.version ?? ""), "invalid-secret-binding");
    return {...value};
  }).sort((a, b) => a.key.localeCompare(b.key));
  need(new Set(result.map(value => value.key)).size === result.length, "duplicate-secret-binding"); return result;
}
function policy(value) {
  need(object(value) && [1, 3].includes(value.version ?? 1) && Array.isArray(value.bindings ?? []), "invalid-iam-policy");
  const result = structuredClone(value); delete result.etag;
  result.bindings = (result.bindings ?? []).map(binding => {
    need(object(binding) && typeof binding.role === "string" && Array.isArray(binding.members) && binding.members.every(member => typeof member === "string"), "invalid-iam-policy");
    return {...binding, members: sorted(binding.members)};
  }).sort((a, b) => digest(a).localeCompare(digest(b))); return result;
}
function validateSource(source) {
  need(keys(source?.binding, ["gitSha", "tree", "trackedSha256", "buildSha256", "manifestSha256", "sdk"]) &&
    keys(source.binding.sdk, ["version", "binarySha256", "packageSha256"]) && /^[a-f0-9]{40}$/.test(source.binding.gitSha ?? "") && /^[a-f0-9]{40}$/.test(source.binding.tree ?? "") &&
    [source.binding.trackedSha256, source.binding.buildSha256, source.binding.manifestSha256, source.binding.sdk?.binarySha256,
      source.binding.sdk?.packageSha256].every(value => HEX.test(value ?? "")) && source.binding.sdk?.version === "7.2.5" &&
    source.binding.manifestSha256 === digest(source.manifest), "invalid-source-binding");
  try {assertSupportedManifest(source.manifest, REGION);} catch {throw new DevStripeWebhookRepairError("unsupported-source-manifest");}
  const endpoint = source.manifest.endpoints[TARGET];
  need(endpoint && Object.hasOwn(endpoint, "httpsTrigger") && !Object.hasOwn(endpoint, "callableTrigger") &&
    same(sorted((endpoint.secretEnvironmentVariables ?? []).map(value => value.key)), SECRET_KEYS) &&
    endpoint.secretEnvironmentVariables.every(value => keys(value, ["key"])), "target-source-declaration-mismatch");
  // Other source declarations deliberately are not compared with deployed secret
  // bindings: the already-reviewed #745 source/live difference is not this repair.
}
function version(value) {
  const allowed = ["name", "createTime", "destroyTime", "state", "replicationStatus", "etag", "clientSpecifiedPayloadChecksum"];
  need(object(value) && Object.keys(value).every(key => allowed.includes(key)) &&
    new RegExp(`^projects/(?:${PROJECT_ID}|${PROJECT_NUMBER})/secrets/${SECRET_KEY}/versions/[1-9]\\d{0,19}$`).test(value.name ?? "") &&
    ["ENABLED", "DISABLED", "DESTROYED"].includes(value.state) && metadataTime(value.createTime), "invalid-signing-version-metadata");
  return {...structuredClone(value), name: value.name.replace(`projects/${PROJECT_NUMBER}/`, `projects/${PROJECT_ID}/`)};
}
const versionId = value => value.name.split("/").at(-1);
function archive(value) {
  need(keys(value, ["bucket", "object", "generation", "sha256", "size"]) && typeof value.bucket === "string" && value.bucket.length > 0 &&
    typeof value.object === "string" && value.object.length > 0 && NUMERIC.test(value.generation ?? "") && HEX.test(value.sha256 ?? "") &&
    /^\d{1,20}$/.test(String(value.size)) && BigInt(value.size) > 0n, "source-archive-proof-required"); return structuredClone(value);
}
function storageMatches(ref, proof, requireGeneration = false) {
  return object(ref) && ref.bucket === proof.bucket && ref.object === proof.object &&
    (!requireGeneration && ref.generation === undefined || String(ref.generation) === proof.generation);
}
function buildName(value) {return typeof value === "string" && new RegExp(`^projects/(?:${PROJECT_ID}|${PROJECT_NUMBER})/locations/${REGION}/builds/[A-Za-z0-9_-]+$`).test(value);}
function sourceProof(snapshot, target) {
  const source = archive(snapshot.targetSourceArchive), input = archive(snapshot.targetBuildArchive), build = snapshot.targetBuild;
  if (Object.hasOwn(target.buildConfig ?? {}, "sourceProvenance")) {
    need(keys(target.buildConfig.sourceProvenance, ["resolvedStorageSource"]) &&
      storageMatches(target.buildConfig.sourceProvenance.resolvedStorageSource, source, true), "function-source-provenance-not-bound");
  }
  need(storageMatches(target.buildConfig?.source?.storageSource, source) && keys(build, ["name", "status", "createTime", "startTime", "finishTime", "resolvedSource"]) && buildName(build.name) &&
    build.name === target.buildConfig.build && build.status === "SUCCESS" && metadataTime(build.createTime) &&
    metadataTime(build.startTime) && metadataTime(build.finishTime) && Date.parse(build.createTime) <= Date.parse(build.startTime) &&
    Date.parse(build.startTime) <= Date.parse(build.finishTime) && storageMatches(build.resolvedSource, input, true) &&
    source.sha256 === input.sha256, "build-source-provenance-not-proven");
  return {source, build: structuredClone(build), input};
}
function endpointProjection(value) {
  const fields = ["id", "object", "api_version", "application", "created", "description", "enabled_events", "livemode", "metadata", "status", "url"];
  need(object(value) && Object.keys(value).every(key => fields.includes(key)) && value.id === ENDPOINT_ID && value.object === "webhook_endpoint" &&
    (value.description === null || value.description === "") && keys(value.metadata, []) &&
    value.url === ENDPOINT_URL && value.livemode === false && value.status === "enabled" &&
    (value.api_version === null || typeof value.api_version === "string") && Array.isArray(value.enabled_events) &&
    value.enabled_events.every(item => typeof item === "string") && new Set(value.enabled_events).size === value.enabled_events.length, "stripe-endpoint-mismatch");
  return {...structuredClone(value), enabled_events: sorted(value.enabled_events)};
}
function collect(snapshot, key) {
  need(snapshot?.project?.projectId === PROJECT_ID && String(snapshot.project.projectNumber) === PROJECT_NUMBER && Array.isArray(snapshot.functions) &&
    snapshot.functions.length > 0 && Array.isArray(snapshot.schedulers) && snapshot.schedulers.length > 0, "invalid-dev-snapshot");
  const functions = {}, invokers = {}, schedulers = {}; let target;
  for (const fn of snapshot.functions) {
    const name = fn.name?.split("/").at(-1);
    need(typeof name === "string" && fn.name === `projects/${PROJECT_ID}/locations/${REGION}/functions/${name}` && !Object.hasOwn(functions, name), "invalid-function-inventory");
    const copy = structuredClone(fn);
    if (name === TARGET) {
      target = fn;
      need(fn.environment === "GEN_2" && fn.state === "ACTIVE" && fn.buildConfig?.runtime === "nodejs24" && fn.buildConfig.entryPoint === TARGET &&
        fn.serviceConfig?.serviceAccountEmail === SA && fn.serviceConfig.maxInstanceCount === 20 && fn.serviceConfig.allTrafficOnLatestRevision === true &&
        fn.serviceConfig.environmentVariables?.GOV_NOTIFY_DELIVERY_MODE === "SIMULATION" && typeof fn.serviceConfig.revision === "string" &&
        fn.serviceConfig.revision.length > 0 && metadataTime(fn.updateTime) && (fn.stateMessages ?? []).length === 0 && !fn.eventTrigger &&
        !fn.labels?.["deployment-callable"] && !fn.labels?.["deployment-scheduled"] && !fn.labels?.["deployment-taskqueue"], "target-runtime-contract-invalid");
      const refs = bindings(fn.serviceConfig.secretEnvironmentVariables);
      need(same(refs.map(value => value.key), SECRET_KEYS), "target-secret-scope-invalid");
      copy.serviceConfig.secretEnvironmentVariables = refs.map(value => value.key === SECRET_KEY ? {...value, version: "1"} : value);
      delete copy.updateTime; delete copy.stateMessages; delete copy.serviceConfig.revision;
      // Exactly these source/build-output fields can move during Google's rebuild.
      // Their replacement is independently bound to the original archive below.
      delete copy.buildConfig.build; delete copy.buildConfig.source; delete copy.buildConfig.sourceProvenance;
    }
    functions[name] = hmac(copy, key); invokers[name] = hmac(policy(snapshot.invokerPolicies?.[name]), key);
  }
  need(target, "target-missing");
  for (const job of snapshot.schedulers) {
    need(typeof job.name === "string" && job.name.startsWith(`projects/${PROJECT_ID}/locations/${REGION}/jobs/`) && !Object.hasOwn(schedulers, job.name), "invalid-scheduler-inventory");
    const copy = structuredClone(job); for (const field of ["lastAttemptTime", "scheduleTime", "status"]) delete copy[field];
    schedulers[job.name] = hmac(copy, key);
  }
  need(object(snapshot.secretVersions) && object(snapshot.secretPolicies), "secret-baseline-missing");
  const signingVersions = (snapshot.signingVersions ?? []).map(version).sort((a, b) => versionId(a).localeCompare(versionId(b)));
  need(signingVersions.length > 0 && new Set(signingVersions.map(versionId)).size === signingVersions.length, "invalid-signing-version-inventory");
  const signingPair = snapshot.secretVersions[SECRET_KEY], signingRef = bindings(target.serviceConfig.secretEnvironmentVariables).find(value => value.key === SECRET_KEY);
  const currentSigningVersion = signingVersions.find(value => versionId(value) === signingRef.version);
  const latestSigningVersion = signingVersions.reduce((latest, value) => BigInt(versionId(value)) > BigInt(versionId(latest)) ? value : latest);
  need(keys(signingPair, ["numeric", "latest"]) && currentSigningVersion &&
    same(version(signingPair.numeric), currentSigningVersion) && same(version(signingPair.latest), latestSigningVersion), "signing-version-pair-inconsistent");
  const signingPolicy = policy(snapshot.signingPolicy);
  need(signingPolicy.bindings.some(binding => binding.role === "roles/secretmanager.secretAccessor" && !Object.hasOwn(binding, "condition") &&
    binding.members.includes(`serviceAccount:${SA}`)), "runtime-signing-secret-access-not-proven");
  const endpoint = endpointProjection(snapshot.stripe?.endpoint);
  need(snapshot.stripe?.account?.id === ACCOUNT_ID && Array.isArray(snapshot.stripe.endpoints) && snapshot.stripe.endpoints.length === 1 &&
    same(endpointProjection(snapshot.stripe.endpoints[0]), endpoint), "stripe-account-or-inventory-mismatch");
  // The signing numeric/latest pair changes at the acknowledged creation and
  // rebind stages. Its consistency is checked above; the complete version list
  // is compared against that phase below. Every other secret stays immutable.
  const otherSecretVersions = Object.fromEntries(Object.entries(snapshot.secretVersions).filter(([name]) => name !== SECRET_KEY));
  return {protected: {functions, invokers, schedulers, secretVersions: hmac(otherSecretVersions, key), secretPolicies: hmac(snapshot.secretPolicies, key),
    signingPolicy: hmac(signingPolicy, key)}, target, targetBindings: bindings(target.serviceConfig.secretEnvironmentVariables), signingVersions,
  endpoint, proof: sourceProof(snapshot, target)};
}
function validateProposal(proposal) {
  need(keys(proposal, ["schemaVersion", "action", "environment", "projectId", "projectNumber", "target", "endpointId", "accountId", "createdAt", "expiresAt",
    "sourceBinding", "baseline", "beforeBindings", "beforeStripe", "candidateSecretHmac", "acceptsExistingDevBacklog", "backlogAcceptance", "approvedEvents"]) &&
    proposal.schemaVersion === SCHEMA && proposal.action === "repair-dev-stripe-webhook-signing-and-subscriptions" && proposal.environment === "dev" &&
    proposal.projectId === PROJECT_ID && proposal.projectNumber === PROJECT_NUMBER && proposal.target === TARGET_NAME && proposal.endpointId === ENDPOINT_ID &&
    proposal.accountId === ACCOUNT_ID && metadataTime(proposal.createdAt) && Date.parse(proposal.expiresAt) - Date.parse(proposal.createdAt) === TTL &&
    HEX.test(proposal.candidateSecretHmac ?? "") && same(proposal.approvedEvents, REQUIRED_EVENTS) &&
    proposal.acceptsExistingDevBacklog === true && proposal.backlogAcceptance === BACKLOG_ACCEPTANCE &&
    bindings(proposal.beforeBindings).find(value => value.key === SECRET_KEY)?.version === "1" &&
    same(sorted(proposal.beforeStripe?.enabled_events ?? []), BEFORE_EVENTS) && object(proposal.baseline), "invalid-repair-proposal");
}
export function prepareRepair({source, snapshot, comparisonKey, candidateSecret, now}) {
  validateSource(source); candidate(candidateSecret);
  const view = collect(snapshot, comparisonKey);
  need(view.targetBindings.find(value => value.key === SECRET_KEY)?.version === "1" && same(view.endpoint.enabled_events, BEFORE_EVENTS) &&
    view.signingVersions.length === 1 && versionId(view.signingVersions[0]) === "1" && view.signingVersions[0].state === "ENABLED", "initial-signing-state-drift");
  return canonical({schemaVersion: SCHEMA, action: "repair-dev-stripe-webhook-signing-and-subscriptions", environment: "dev", projectId: PROJECT_ID,
    projectNumber: PROJECT_NUMBER, target: TARGET_NAME, endpointId: ENDPOINT_ID, accountId: ACCOUNT_ID, createdAt: iso(now), expiresAt: iso(at(now) + TTL),
    sourceBinding: source.binding, baseline: {protected: view.protected, signingVersions: view.signingVersions, sourceArchive: view.proof.source,
      build: view.proof.build, targetObservation: {revision: view.target.serviceConfig.revision, updateTime: view.target.updateTime}},
    beforeBindings: view.targetBindings, beforeStripe: view.endpoint, candidateSecretHmac: hmac(candidateSecret, comparisonKey),
    acceptsExistingDevBacklog: true, backlogAcceptance: BACKLOG_ACCEPTANCE, approvedEvents: REQUIRED_EVENTS});
}
export function reviewTemplate(proposal) {
  validateProposal(proposal); return {schemaVersion: REVIEW_SCHEMA, proposalSha256: digest(proposal), decision: "REVIEW_REQUIRED",
    reviewedBy: "REPLACE_AFTER_REVIEW", reason: "REPLACE_AFTER_REVIEW"};
}
export function assertReview(proposal, review, now) {
  validateProposal(proposal);
  need(at(now) >= Date.parse(proposal.createdAt) && at(now) <= Date.parse(proposal.expiresAt), "proposal-expired-or-clock-invalid");
  need(keys(review, ["schemaVersion", "proposalSha256", "decision", "reviewedBy", "reason"]) && review.schemaVersion === REVIEW_SCHEMA &&
    review.proposalSha256 === digest(proposal) && review.decision === "APPROVED" &&
    [review.reviewedBy, review.reason].every(value => typeof value === "string" && value.trim() && !value.includes("REPLACE")), "exact-review-required");
}
const record = (proposal, fields) => ({schemaVersion: RECORD_SCHEMA, proposalSha256: digest(proposal), ...fields});
async function readRecord(ctx, name) {
  const value = await ctx.store.read(name);
  need(value?.schemaVersion === RECORD_SCHEMA && value.proposalSha256 === digest(ctx.proposal), "missing-or-unbound-stage-record"); return value;
}
async function currentSource(ctx) {
  const source = await ctx.readSource(); validateSource(source);
  need(same(source.binding, ctx.proposal.sourceBinding), "source-or-build-drift"); return source;
}
function desiredBindings(proposal, secretVersion) {return proposal.beforeBindings.map(value => value.key === SECRET_KEY ? {...value, version: secretVersion} : {...value});}
function compare(ctx, snapshot, {secretRecord, rebound = false, subscriptions = false, functionPass} = {}) {
  const view = collect(snapshot, ctx.comparisonKey), proposal = ctx.proposal;
  need(same(view.protected, proposal.baseline.protected), "protected-baseline-drift");
  const expectedVersions = secretRecord ? [...proposal.baseline.signingVersions, version(secretRecord.metadata)] : proposal.baseline.signingVersions;
  need(same(view.signingVersions, expectedVersions.sort((a, b) => versionId(a).localeCompare(versionId(b)))), "signing-version-inventory-drift");
  need(same(view.targetBindings, rebound ? desiredBindings(proposal, secretRecord.version) : proposal.beforeBindings), "target-binding-drift");
  const expectedEndpoint = {...proposal.beforeStripe, enabled_events: subscriptions ? proposal.approvedEvents : proposal.beforeStripe.enabled_events};
  need(same(view.endpoint, expectedEndpoint), "stripe-endpoint-drift");
  need(view.proof.source.sha256 === proposal.baseline.sourceArchive.sha256 && view.proof.input.sha256 === proposal.baseline.sourceArchive.sha256, "source-archive-content-drift");
  if (functionPass) need(view.target.serviceConfig.revision === functionPass.revision && view.proof.build.name === functionPass.buildName &&
    view.proof.source.sha256 === functionPass.sourceArchiveSha256 && secretRecord?.version === functionPass.version, "function-pass-baseline-drift");
  if (!rebound) need(same(view.proof.source, proposal.baseline.sourceArchive) && same(view.proof.build, proposal.baseline.build) &&
    view.target.serviceConfig.revision === proposal.baseline.targetObservation.revision && view.target.updateTime === proposal.baseline.targetObservation.updateTime,
  "pre-update-target-provenance-drift");
  return view;
}
async function beforeMutation(ctx, phase) {
  assertReview(ctx.proposal, ctx.review, ctx.now); await currentSource(ctx);
  const view = compare(ctx, await ctx.provider.snapshot(), phase);
  await currentSource(ctx); assertReview(ctx.proposal, ctx.review, ctx.now); return view;
}
const unknown = proposal => ({status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED", proposalSha256: digest(proposal)});
export async function applySecret(ctx) {
  validateProposal(ctx.proposal); candidate(ctx.candidateSecret);
  need(equalHmac(hmac(ctx.candidateSecret, ctx.comparisonKey), ctx.proposal.candidateSecretHmac), "candidate-signing-secret-mismatch");
  need(await ctx.store.read("secret-intent.json") === null, "secret-stage-already-started");
  await beforeMutation(ctx); await ctx.store.claim(ctx.proposal);
  await ctx.store.writeOnce("secret-intent.json", record(ctx.proposal, {startedAt: iso(ctx.now), reviewSha256: digest(ctx.review)}));
  await beforeMutation(ctx);
  try {
    const metadata = version(await ctx.provider.addSecretVersion({value: ctx.candidateSecret}));
    const id = versionId(metadata);
    need(id !== "1" && metadata.state === "ENABLED" && Date.parse(metadata.createTime) >= Date.parse(ctx.proposal.createdAt), "secret-creation-acknowledgement-invalid");
    const actual = await ctx.provider.accessSecretVersion({version: id});
    need(equalHmac(hmac(candidate(actual), ctx.comparisonKey), ctx.proposal.candidateSecretHmac), "created-secret-value-mismatch");
    await ctx.store.writeOnce("secret-version.json", record(ctx.proposal, {version: id, metadata, valueVerified: true}));
    return {status: "SECRET_VERSION_CREATED", version: id, proposalSha256: digest(ctx.proposal)};
  } catch {return unknown(ctx.proposal);}
}
async function confirmedSecret(ctx) {
  await readRecord(ctx, "secret-intent.json"); const result = await readRecord(ctx, "secret-version.json");
  need(result.valueVerified === true && result.version !== "1" && NUMERIC.test(result.version ?? "") && versionId(version(result.metadata)) === result.version &&
    result.metadata.state === "ENABLED", "secret-version-acknowledgement-invalid"); return result;
}
function checkedOperation(value, {done = false} = {}) {
  need(object(value) && new RegExp(`^projects/${PROJECT_ID}/locations/${REGION}/operations/[A-Za-z0-9_-]+$`).test(value.name ?? "") &&
    (value.done === undefined || typeof value.done === "boolean"), "invalid-function-operation");
  if (value.metadata !== undefined || done) need([TARGET_NAME, TARGET_NAME.replace(PROJECT_ID, PROJECT_NUMBER)].includes(value.metadata?.target) &&
    value.metadata?.verb === "update", "function-operation-scope-mismatch");
  if (value.metadata?.buildName !== undefined) need(buildName(value.metadata.buildName), "invalid-operation-build-reference");
  return value;
}
export async function applyFunction(ctx) {
  validateProposal(ctx.proposal); const secretRecord = await confirmedSecret(ctx);
  need(await ctx.store.read("function-intent.json") === null, "function-stage-already-started");
  await beforeMutation(ctx, {secretRecord});
  const actual = await ctx.provider.accessSecretVersion({version: secretRecord.version});
  need(equalHmac(hmac(candidate(actual), ctx.comparisonKey), ctx.proposal.candidateSecretHmac), "created-secret-value-mismatch");
  await ctx.store.writeOnce("function-intent.json", record(ctx.proposal, {startedAt: iso(ctx.now), reviewSha256: digest(ctx.review), version: secretRecord.version}));
  await beforeMutation(ctx, {secretRecord});
  try {
    const operation = checkedOperation(await ctx.provider.patchFunctionBindings({name: TARGET_NAME, bindings: desiredBindings(ctx.proposal, secretRecord.version)}));
    await ctx.store.writeOnce("operation.json", record(ctx.proposal, {name: operation.name}));
    return {status: "FUNCTION_UPDATE_ACCEPTED_VERIFY_REQUIRED", operationName: operation.name, proposalSha256: digest(ctx.proposal)};
  } catch {return unknown(ctx.proposal);}
}
async function functionProof(ctx, {subscriptions = false} = {}) {
  validateProposal(ctx.proposal); const secretRecord = await confirmedSecret(ctx), intent = await readRecord(ctx, "function-intent.json");
  const ack = await ctx.store.read("operation.json");
  if (ack === null) return unknown(ctx.proposal);
  need(ack.schemaVersion === RECORD_SCHEMA && ack.proposalSha256 === digest(ctx.proposal), "unbound-function-operation");
  checkedOperation(ack); const operation = checkedOperation(await ctx.provider.operation(ack.name));
  need(operation.name === ack.name, "function-operation-reference-drift");
  if (operation.done !== true) return {status: "PENDING", operationName: ack.name};
  checkedOperation(operation, {done: true});
  if (operation.error !== undefined) return {status: "OPERATION_FAILED_OPERATOR_REVIEW_REQUIRED", operationName: ack.name};
  await currentSource(ctx); const view = compare(ctx, await ctx.provider.snapshot(), {secretRecord, rebound: true, subscriptions}); await currentSource(ctx);
  const build = view.proof.build;
  need(build.name !== ctx.proposal.baseline.build.name && Date.parse(build.createTime) >= Date.parse(intent.startedAt) &&
    Date.parse(view.target.updateTime) >= Date.parse(intent.startedAt) && view.target.serviceConfig.revision !== ctx.proposal.baseline.targetObservation.revision,
  "rebuild-chronology-not-proven");
  if (operation.metadata.buildName !== undefined) need(operation.metadata.buildName === build.name, "operation-build-not-current");
  return {status: "FUNCTION_VERIFIED", operationName: ack.name, revision: view.target.serviceConfig.revision, buildName: build.name,
    sourceArchiveSha256: view.proof.source.sha256, version: secretRecord.version, proposalSha256: digest(ctx.proposal)};
}
export async function verifyFunction(ctx) {
  const result = await functionProof(ctx); if (result.status !== "FUNCTION_VERIFIED") return result;
  const existing = await ctx.store.read("function-pass.json");
  const proof = record(ctx.proposal, {operationName: result.operationName, revision: result.revision, buildName: result.buildName,
    sourceArchiveSha256: result.sourceArchiveSha256, version: result.version});
  if (existing === null) await ctx.store.writeOnce("function-pass.json", proof);
  else need(same(existing, proof), "function-pass-record-drift");
  return result;
}
export async function applySubscriptions(ctx) {
  validateProposal(ctx.proposal); const pass = await readRecord(ctx, "function-pass.json"), secretRecord = await confirmedSecret(ctx);
  need(await ctx.store.read("stripe-intent.json") === null, "stripe-stage-already-started");
  const verified = await functionProof(ctx); need(verified.status === "FUNCTION_VERIFIED" && pass.revision === verified.revision && pass.buildName === verified.buildName, "function-verification-required");
  await beforeMutation(ctx, {secretRecord, rebound: true, functionPass: pass});
  await ctx.store.writeOnce("stripe-intent.json", record(ctx.proposal, {startedAt: iso(ctx.now), reviewSha256: digest(ctx.review)}));
  await beforeMutation(ctx, {secretRecord, rebound: true, functionPass: pass});
  try {
    const endpoint = endpointProjection(await ctx.provider.updateSubscriptions({endpointId: ENDPOINT_ID, enabledEvents: [...REQUIRED_EVENTS],
      idempotencyKey: `sodc-dev-stripe-webhook-${digest(ctx.proposal)}`}));
    need(same(endpoint, {...ctx.proposal.beforeStripe, enabled_events: REQUIRED_EVENTS}), "stripe-update-acknowledgement-mismatch");
    await ctx.store.writeOnce("stripe-ack.json", record(ctx.proposal, {endpointSha256: digest(endpoint)}));
    return {status: "SUBSCRIPTIONS_UPDATED_VERIFY_REQUIRED", proposalSha256: digest(ctx.proposal)};
  } catch {return unknown(ctx.proposal);}
}
export async function verifyRepair(ctx) {
  validateProposal(ctx.proposal); const intent = await ctx.store.read("stripe-intent.json"), ack = await ctx.store.read("stripe-ack.json");
  if (intent === null || ack === null) return unknown(ctx.proposal);
  await readRecord(ctx, "stripe-intent.json"); await readRecord(ctx, "stripe-ack.json");
  need(ack.endpointSha256 === digest({...ctx.proposal.beforeStripe, enabled_events: REQUIRED_EVENTS}), "stripe-acknowledgement-drift");
  const pass = await readRecord(ctx, "function-pass.json"), result = await functionProof(ctx, {subscriptions: true});
  if (result.status !== "FUNCTION_VERIFIED") return result;
  need(result.revision === pass.revision && result.buildName === pass.buildName, "verified-function-changed");
  return {...result, status: "PASS", verifiedAt: iso(ctx.now), environment: "dev", endpointId: ENDPOINT_ID, expectedEvents: REQUIRED_EVENTS,
    runtimeAcceptancePassed: false, productionAuthorized: false, originalNotifyRepairUnchanged: true};
}
