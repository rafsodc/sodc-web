import {createHmac} from "node:crypto";
import {canonical, digest} from "./functions-config-guard-lib.mjs";
import {TARGET, REGION, assertRepairSource, assertReview, reviewTemplate,
  collectBindingRepairSnapshot} from "./notify-secret-binding-repair-lib.mjs";

export class BindingEvidenceError extends Error {
  constructor(code) {super(`Binding evidence blocked: ${code}.`); this.code = code;}
}
const need = (value, code) => {if (!value) throw new BindingEvidenceError(code);};
const same = (a, b) => digest(a) === digest(b);
const sorted = values => [...values].sort();
const nowValue = now => typeof now === "function" ? now() : now ?? Date.now();
const PROJECTS = {dev: "sodc-web", prod: "sodc-web-production"};
const CAPTURE = "sodc-notify-binding-capture/v1";
const RECONCILE = "sodc-notify-binding-reconciliation/v1";
const ARTIFACTS = ["currentRevision", "previousRevision", "functionBuild", "operationBuild", "sourceObject"];
const STATES = ["AVAILABLE", "UNAVAILABLE", "NOT_REQUESTED", "UNSUPPORTED"];
const PATHS = ["/serviceConfig", "/buildConfig", "/labels", "/environment", "/state", "/updateTime", "/stateMessages",
  "/serviceConfig/environmentVariables", "/buildConfig/environmentVariables", "/serviceConfig/serviceAccountEmail",
  "/serviceConfig/availableCpu", "/serviceConfig/availableMemory", "/serviceConfig/maxInstanceRequestConcurrency",
  "/serviceConfig/ingressSettings", "/serviceConfig/timeoutSeconds", "/serviceConfig/minInstanceCount",
  "/serviceConfig/maxInstanceCount", "/serviceConfig/allTrafficOnLatestRevision", "/serviceConfig/revision",
  "/serviceConfig/secretEnvironmentVariables", "/buildConfig/build", "/buildConfig/source", "/buildConfig/sourceProvenance"];
function projectFor(environment) {
  need(Object.hasOwn(PROJECTS, environment), "unsupported-environment"); return PROJECTS[environment];
}
export function assertEvidenceToolBinding(binding) {
  need(binding && same(sorted(Object.keys(binding)), ["gitSha", "nodeMajor", "trackedSha256", "tree"]) &&
    /^[a-f0-9]{40}$/.test(binding.gitSha ?? "") && /^[a-f0-9]{40}$/.test(binding.tree ?? "") &&
    /^[a-f0-9]{64}$/.test(binding.trackedSha256 ?? "") && binding.nodeMajor === 24, "invalid-tool-binding");
}
function validateSource(source, projectId) {
  try {assertRepairSource(source, projectId);} catch {throw new BindingEvidenceError("invalid-evidence-source");}
}
function sourceProjection(source) {
  const b = source.binding;
  return {gitSha: b.gitSha, tree: b.tree, trackedSha256: b.trackedSha256, buildSha256: b.buildSha256,
    manifestSha256: b.manifestSha256, sdk: {version: b.sdk.version, binarySha256: b.sdk.binarySha256, packageSha256: b.sdk.packageSha256}};
}
function hmac(value, key) {
  need(Buffer.isBuffer(key) && key.length === 32, "invalid-comparison-key");
  return createHmac("sha256", key).update(JSON.stringify(canonical(value))).digest("hex");
}
function observationBase(schema, environment, source, toolBinding, now) {
  const projectId = projectFor(environment); validateSource(source, projectId); assertEvidenceToolBinding(toolBinding);
  return {schemaVersion: schema, projectId, target: `projects/${projectId}/locations/${REGION}/functions/${TARGET}`,
    observedAt: new Date(nowValue(now)).toISOString(), sourceBinding: sourceProjection(source), reconciliationToolBinding: {...toolBinding},
    readOnly: true, providerWrites: 0, secretPayloadsRead: false, sourceArchivesRead: false, runtimeInvocations: 0, emailSends: 0,
    originalContractAccepted: false, productionAuthorized: false, releaseAuthorized: false,
    limits: ["Observation only; not a repair approval, original verification PASS, or deployment receipt.",
      "An opaque historical fingerprint cannot supply missing historical component values.",
      "Archive identity does not establish equivalent executable images after a rebuild."]};
}
function selectedValue(object, pointer) {
  let value = object;
  for (const key of pointer.slice(1).split("/")) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, key)) return {present: false};
    value = value[key];
  }
  return {present: true, value};
}
function environmentComponents(value, key) {
  need(value === undefined || (value && typeof value === "object" && !Array.isArray(value)), "invalid-environment-map");
  const names = sorted(Object.keys(value ?? {}));
  return {keySetHmac: hmac(names, key), entries: names.map(name => ({keyHmac: hmac(name, key), valueHmac: hmac({present: true, value: value[name]}, key)}))};
}
function components(target, key) {
  const fieldHmacs = {}; let count = 0;
  const walk = (value, pointer, depth) => {
    need(depth <= 32 && ++count <= 4096, "target-components-limit");
    fieldHmacs[hmac(pointer, key)] = hmac({present: true, value}, key);
    if (value && typeof value === "object") for (const [name, child] of Object.entries(value)) {
      walk(child, `${pointer}/${name.replaceAll("~", "~0").replaceAll("/", "~1")}`, depth + 1);
    }
  };
  walk(target, "", 0);
  return {fullHmac: hmac(target, key), fieldHmacs,
    selectedHmacs: Object.fromEntries(PATHS.map(pointer => [pointer, hmac(selectedValue(target, pointer), key)])),
    environment: {service: environmentComponents(target.serviceConfig?.environmentVariables, key),
      build: environmentComponents(target.buildConfig?.environmentVariables, key)}};
}
function baseline(view) {
  const value = structuredClone(view); delete value.targetBindings; delete value.desiredBindings; return value;
}
function targetOf(snapshot, target) {return snapshot.functions.find(value => value.name === target);}
function normalizeBuild(name, project) {
  need(typeof name === "string" && [project.projectId, project.projectNumber].some(id =>
    new RegExp(`^projects/${id}/locations/${REGION}/builds/[0-9a-f-]{36}$`).test(name)), "invalid-build-reference");
  return name.replace(`projects/${project.projectNumber}/`, `projects/${project.projectId}/`);
}
function storageReference(value, project) {
  if (value == null) return null;
  need([`gcf-v2-sources-${project.projectNumber}-${REGION}`, `gcf-v2-uploads-${project.projectNumber}-${REGION}.cloudfunctions.appspot.com`].includes(value.bucket) &&
    typeof value.object === "string" && value.object.length <= 2048 && /^[A-Za-z0-9_./-]+\.zip$/.test(value.object) &&
    /^[1-9]\d*$/.test(value.generation ?? ""), "invalid-artifact-storage-reference");
  return {bucket: value.bucket, object: value.object, generation: value.generation};
}
function imageReference(image, project) {
  need(typeof image === "string" && [project.projectId, project.projectNumber].some(id =>
    new RegExp(`^[a-z0-9-]+-docker\\.pkg\\.dev/${id}/gcf-artifacts/[a-z0-9_./-]+(?:@sha256:[a-f0-9]{64}|:[a-zA-Z0-9_.-]+)?$`).test(image)),
  "invalid-artifact-image-reference");
  return image;
}
function timestamp(value) {return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : undefined;}
function artifactProjection(provenance, project) {
  const result = {};
  for (const name of ARTIFACTS) {
    const envelope = provenance?.[name] ?? {state: "NOT_REQUESTED"};
    need(STATES.includes(envelope.state), "invalid-artifact-state");
    if (envelope.state !== "AVAILABLE") {result[name] = {state: envelope.state}; continue;}
    const value = envelope.value; need(value && typeof value === "object", "invalid-artifact-value");
    let projected;
    if (name.endsWith("Revision")) {
      need(typeof value.name === "string" && [project.projectId, project.projectNumber].some(id =>
        new RegExp(`^projects/${id}/locations/${REGION}/services/${TARGET.toLowerCase()}/revisions/${TARGET.toLowerCase()}-[a-z0-9-]+$`).test(value.name)), "invalid-artifact-revision");
      const images = value.images ?? []; need(Array.isArray(images) && images.length <= 16, "invalid-artifact-images");
      projected = {name: value.name, createTime: timestamp(value.createTime), images: images.map(image => {
        need(image.name == null || (typeof image.name === "string" && /^[a-z0-9-]{1,63}$/.test(image.name)), "invalid-container-name");
        return {name: image.name, image: imageReference(image.image, project)};
      })};
      const annotations = {};
      for (const key of ["run.googleapis.com/build-id", "run.googleapis.com/build-function-target", "run.googleapis.com/build-source-location"]) {
        const text = value.buildAnnotations?.[key];
        if (text === undefined) continue;
        if (key.endsWith("build-id")) need(typeof text === "string" && /^[0-9a-f-]{36}$/.test(text), "invalid-build-annotation");
        else if (key.endsWith("build-function-target")) need(text === TARGET, "invalid-build-annotation");
        else need(typeof text === "string" && text.length <= 2200 &&
          [`gcf-v2-sources-${project.projectNumber}-${REGION}`, `gcf-v2-uploads-${project.projectNumber}-${REGION}.cloudfunctions.appspot.com`]
            .some(bucket => text.startsWith(`gs://${bucket}/`)) && /^[A-Za-z0-9_:/#.-]+$/.test(text), "invalid-source-annotation");
        annotations[key] = text;
      }
      projected.buildAnnotations = annotations;
    } else if (name.endsWith("Build")) {
      normalizeBuild(value.name, project);
      need(typeof value.id === "string" && /^[0-9a-f-]{36}$/.test(value.id) && value.name.endsWith(`/${value.id}`) &&
        ["STATUS_UNKNOWN", "PENDING", "QUEUED", "WORKING", "SUCCESS", "FAILURE", "INTERNAL_ERROR", "TIMEOUT", "CANCELLED", "EXPIRED"].includes(value.status), "invalid-build-metadata");
      const images = value.images ?? []; need(Array.isArray(images) && images.length <= 16, "invalid-artifact-images");
      projected = {name: value.name, id: value.id, status: value.status, createTime: timestamp(value.createTime),
        startTime: timestamp(value.startTime), finishTime: timestamp(value.finishTime), source: storageReference(value.source, project),
        resolvedSource: storageReference(value.resolvedSource, project), archiveSha256: /^[a-f0-9]{64}$/.test(value.archiveSha256 ?? "") ? value.archiveSha256 : null,
        images: images.map(image => {need(/^sha256:[a-f0-9]{64}$/.test(image.digest ?? ""), "invalid-build-image-digest");
          return {name: imageReference(image.name, project), digest: image.digest};})};
      need(!projected.archiveSha256 || projected.resolvedSource, "unbound-archive-hash");
    } else {
      const ref = storageReference({bucket: value.bucket, object: value.name, generation: value.generation}, project);
      need(typeof value.size === "string" && /^\d{1,20}$/.test(value.size), "invalid-source-size");
      const checksum = (text, bytes) => typeof text === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(text) &&
        Buffer.from(text, "base64").length === bytes && Buffer.from(text, "base64").toString("base64") === text ? text : null;
      projected = {bucket: ref.bucket, name: ref.object, generation: ref.generation, size: value.size,
        md5Hash: checksum(value.md5Hash, 16), crc32c: checksum(value.crc32c, 4)};
    }
    result[name] = {state: "AVAILABLE", value: projected};
  }
  return result;
}
function assertArtifactContext(artifacts, target, project, {previousRevision, operationBuild} = {}) {
  const normalize = value => value.replace(`projects/${project.projectNumber}/`, `projects/${project.projectId}/`);
  const revisionName = revision => `projects/${project.projectId}/locations/${REGION}/services/${TARGET.toLowerCase()}/revisions/${revision}`;
  if (artifacts.currentRevision.state === "AVAILABLE") need(normalize(artifacts.currentRevision.value.name) === revisionName(target.serviceConfig.revision), "artifact-context-mismatch");
  if (artifacts.previousRevision.state === "AVAILABLE") need(previousRevision && normalize(artifacts.previousRevision.value.name) === revisionName(previousRevision), "artifact-context-mismatch");
  if (artifacts.functionBuild.state === "AVAILABLE") need(target.buildConfig?.build &&
    normalizeBuild(artifacts.functionBuild.value.name, project) === normalizeBuild(target.buildConfig.build, project), "artifact-context-mismatch");
  if (artifacts.operationBuild.state === "AVAILABLE") need(operationBuild &&
    normalizeBuild(artifacts.operationBuild.value.name, project) === normalizeBuild(operationBuild, project), "artifact-context-mismatch");
  if (artifacts.sourceObject.state === "AVAILABLE") {
    const ref = storageReference(target.buildConfig?.source?.storageSource, project), observed = artifacts.sourceObject.value;
    need(ref && same(ref, {bucket: observed.bucket, object: observed.name, generation: observed.generation}), "artifact-context-mismatch");
  }
}
function summaryChecks(view) {
  return {functionCount: Object.keys(view.functions).length, invokerCount: Object.keys(view.invokers).length,
    schedulerCount: Object.keys(view.schedulers).length, targetActive: true, targetGen2: true, targetRuntime: "nodejs24",
    targetMaxInstances: 20, defaultRuntimeIdentity: true, directRuntimeSecretGrantsChecked: 4};
}
export function captureBindingEvidence({environment, source, toolBinding, snapshot, provenance, comparisonKey, now}) {
  const report = observationBase(CAPTURE, environment, source, toolBinding, now);
  const target = targetOf(snapshot, report.target); need(target, "missing-target");
  const refs = target.serviceConfig?.secretEnvironmentVariables ?? [];
  const after = refs.length !== 1 || refs[0]?.key !== "STRIPE_SECRET";
  const view = collectBindingRepairSnapshot(snapshot, comparisonKey, report.projectId, source.manifest, {after});
  const artifactEvidence = artifactProjection(provenance, view.project);
  assertArtifactContext(artifactEvidence, target, view.project);
  return canonical({...report, status: "CAPTURED_OBSERVATION_NOT_APPROVAL", observationOnly: true,
    targetBindingState: after ? "FOUR_BINDINGS" : "STRIPE_ONLY", baseline: baseline(view), targetBindings: view.targetBindings,
    targetComponents: components(target, comparisonKey), checks: summaryChecks(view), artifactEvidence});
}
function validateOriginal(original, originalSource, originalRunDirectory) {
  const {proposal, comparisonKey, review, intent, operation, claim} = original ?? {};
  need(proposal?.environment === "dev" && proposal.projectId === PROJECTS.dev, "reconciliation-dev-only");
  let hash;
  try {hash = reviewTemplate(proposal).proposalSha256;} catch {throw new BindingEvidenceError("invalid-original-proposal");}
  validateSource(originalSource, proposal.projectId);
  need(same(originalSource.binding, proposal.sourceBinding), "original-source-binding-mismatch");
  need(Buffer.isBuffer(comparisonKey) && comparisonKey.length === 32, "invalid-comparison-key");
  need(intent && same(sorted(Object.keys(intent)), ["proposalSha256", "reviewSha256", "schemaVersion", "startedAt"]) &&
    intent.schemaVersion === proposal.schemaVersion && intent.proposalSha256 === hash &&
    intent.reviewSha256 === digest(review ?? null) && Number.isFinite(Date.parse(intent.startedAt)), "invalid-original-intent");
  try {assertReview(proposal, review, Date.parse(intent.startedAt));} catch {throw new BindingEvidenceError("invalid-original-review");}
  need(claim && same(sorted(Object.keys(claim)), ["projectId", "proposalSha256", "runDirectory", "schemaVersion", "target"]) &&
    claim.schemaVersion === "sodc-notify-binding-repair-target-lock/v1" && claim.proposalSha256 === hash &&
    claim.projectId === proposal.projectId && claim.target === proposal.target && claim.runDirectory === originalRunDirectory,
  "invalid-original-claim");
  if (operation != null) need(operation && same(Object.keys(operation), ["name"]) && validOperationName(operation.name, proposal.projectId), "invalid-original-acknowledgement");
  return hash;
}
function validOperationName(name, projectId) {
  return typeof name === "string" && new RegExp(`^projects/${projectId}/locations/${REGION}/operations/[A-Za-z0-9_-]+$`).test(name);
}
function operationProjection(value, original) {
  const p = original.proposal, project = p.baseline.project;
  need(value?.name === original.operation.name && validOperationName(value.name, p.projectId) &&
    (value.done === undefined || typeof value.done === "boolean"), "invalid-operation-response");
  const result = {name: value.name, done: value.done === true};
  if (value.metadata !== undefined || result.done) {
    need([p.target, p.target.replace(`projects/${p.projectId}/`, `projects/${project.projectNumber}/`)].includes(value.metadata?.target) &&
      value.metadata?.verb === "update", "operation-scope-mismatch");
    result.target = p.target; result.verb = "update";
    if (value.metadata.buildName !== undefined) {normalizeBuild(value.metadata.buildName, project); result.buildName = value.metadata.buildName;}
  }
  if (value.error != null) result.errorCode = Number.isSafeInteger(value.error.code) ? value.error.code : null;
  return result;
}
function differences(before, after) {
  const result = {};
  for (const category of ["functions", "invokers", "schedulers", "versions", "policies"]) {
    const a = before[category], b = after[category];
    need(a && b && typeof a === "object" && typeof b === "object", "invalid-original-baseline");
    result[category] = sorted(new Set([...Object.keys(a), ...Object.keys(b)])).filter(name => !same(a[name] ?? null, b[name] ?? null));
  }
  return result;
}
function imageEquality(artifacts) {
  const a = artifacts.previousRevision, b = artifacts.currentRevision;
  if (a.state !== "AVAILABLE" || b.state !== "AVAILABLE" || !a.value.images.length || !b.value.images.length) return "UNKNOWN";
  const project = images => images.map(image => ({name: image.name, digest: /@sha256:([a-f0-9]{64})$/.exec(image.image)?.[1]}));
  const oldImages = project(a.value.images), newImages = project(b.value.images);
  if ([...oldImages, ...newImages].some(image => !image.digest)) return "UNKNOWN";
  return same(oldImages, newImages) ? "MATCHED" : "DIFFERENT";
}
export async function reconcileBindingEvidence({environment, original, originalRunDirectory, originalSource, toolBinding, provider, now}) {
  need(environment === "dev", "reconciliation-dev-only");
  const proposalHash = validateOriginal(original, originalSource, originalRunDirectory);
  const report = {...observationBase(RECONCILE, environment, originalSource, toolBinding, now),
    originalProposalSha256: proposalHash, originalSourceBindingSha256: digest(original.proposal.sourceBinding),
    originalRecordDigests: {proposal: proposalHash, review: digest(original.review), intent: digest(original.intent),
      acknowledgement: digest(original.operation ?? null), claim: digest(original.claim)},
    originalVerification: "UNCHANGED_NOT_OVERRIDDEN", historicalTargetPreservation: "UNKNOWN", sourceArchiveEquality: "UNPROVEN"};
  if (original.operation == null) return canonical({...report, status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED"});
  const snapshot = await provider.snapshot();
  const operation = operationProjection(await provider.operation(original.operation.name), original);
  if (!operation.done) return canonical({...report, status: "PENDING", operation});
  if (Object.hasOwn(operation, "errorCode")) return canonical({...report, status: "OPERATION_FAILED_OPERATOR_REVIEW_REQUIRED", operation});
  let view;
  try {view = collectBindingRepairSnapshot(snapshot, original.comparisonKey, report.projectId, originalSource.manifest, {after: true});}
  catch {return canonical({...report, status: "BLOCKED_DRIFT", operation, issues: ["current-protected-state-invalid"]});}
  const changedEntries = differences(original.proposal.baseline, view);
  const protectedDrift = !same(view.project, original.proposal.baseline.project) || !same(view.targetBindings, original.proposal.after) ||
    !same(view.desiredBindings, original.proposal.after) || changedEntries.functions.some(name => name !== TARGET) ||
    ["invokers", "schedulers", "versions", "policies"].some(name => changedEntries[name].length > 0);
  if (protectedDrift) return canonical({...report, status: "BLOCKED_DRIFT", operation, changedEntries, issues: ["protected-baseline-drift"]});
  const target = targetOf(snapshot, report.target);
  if (operation.buildName && target.buildConfig?.build && normalizeBuild(operation.buildName, view.project) !== normalizeBuild(target.buildConfig.build, view.project)) {
    return canonical({...report, status: "BLOCKED_DRIFT", operation, changedEntries, issues: ["operation-build-not-current"]});
  }
  const artifactEvidence = artifactProjection(await provider.provenance({snapshot, operation: {name: operation.name, done: true,
    metadata: {target: operation.target, verb: operation.verb, ...(operation.buildName ? {buildName: operation.buildName} : {})}},
  previousRevision: original.proposal.baseline.targetObservation.revision}), view.project);
  assertArtifactContext(artifactEvidence, target, view.project, {previousRevision: original.proposal.baseline.targetObservation.revision,
    operationBuild: operation.buildName});
  const targetMatched = changedEntries.functions.length === 0;
  const build = artifactEvidence.operationBuild;
  const rebuildConfirmed = operation.buildName && target.buildConfig?.build &&
    normalizeBuild(target.buildConfig.build, view.project) === normalizeBuild(operation.buildName, view.project) &&
    build.state === "AVAILABLE" && build.value.status === "SUCCESS" &&
    normalizeBuild(build.value.name, view.project) === normalizeBuild(operation.buildName, view.project) &&
    Date.parse(build.value.createTime) >= Date.parse(original.intent.startedAt);
  return canonical({...report, status: "REVIEW_REQUIRED_WITH_HISTORICAL_GAPS", operation, changedEntries,
    targetFingerprintMatchesOriginal: targetMatched, historicalTargetPreservation: targetMatched ? "MATCHED_OPAQUE_FINGERPRINT" : "UNKNOWN",
    sourceArchiveEquality: "UNPROVEN", providerRebuild: rebuildConfirmed ? "CONFIRMED" : "UNKNOWN", imageEquality: imageEquality(artifactEvidence),
    checks: summaryChecks(view), targetBindings: view.targetBindings, targetComponents: components(target, original.comparisonKey), artifactEvidence,
    issues: ["historical-component-baseline-not-captured", "historical-source-identity-not-established", "separate-explicit-Dev-review-required",
      ...(!target.buildConfig?.build ? ["current-build-reference-missing"] : []), ...(!operation.buildName ? ["operation-build-reference-missing"] : [])]});
}
