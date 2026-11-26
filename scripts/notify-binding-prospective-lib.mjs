import {createHmac} from "node:crypto";
import {canonical, digest} from "./functions-config-guard-lib.mjs";
import {assertRepairSource, collectBindingRepairSnapshot, TARGET, REGION} from "./notify-secret-binding-repair-lib.mjs";
import {assertEvidenceToolBinding} from "./notify-binding-evidence-lib.mjs";

const PROJECT = "sodc-web-production";
const TARGET_NAME = `projects/${PROJECT}/locations/${REGION}/functions/${TARGET}`;
const KEYS = ["GOV_NOTIFY_LIVE_API_KEY", "GOV_NOTIFY_TEAM_API_KEY", "GOV_NOTIFY_TEST_API_KEY", "STRIPE_SECRET"].sort();
const MAINTENANCE = new Set(["reconcilePendingSecurityTransitions", "reconcileSectionFiles", "recoverNotificationDeliveries"]);
const OPTIONS = new Set(["phase", "capture", "comparisonKey", "source", "toolBinding", "snapshot", "provenance", "limitsBaseline", "limitsObservation", "intent", "operation", "acknowledgement", "expectedBindings", "now"]);
const same = (a, b) => digest(a) === digest(b);
const need = (value, code) => {if (!value) throw Object.assign(new Error(code), {code, prospectiveCode: code});};
const sorted = values => [...values].sort();
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const timestamp = value => typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
const hmac = (value, key) => createHmac("sha256", key).update(JSON.stringify(canonical(value))).digest("hex");
const normalizedBuild = (name, number) => {
  need(typeof name === "string" && new RegExp(`^projects/(?:${PROJECT}|${number})/locations/${REGION}/builds/[a-f0-9-]{36}$`).test(name), "invalid-build-reference");
  return name.replace(`projects/${number}/`, `projects/${PROJECT}/`);
};
function sourceProjection(source) {
  const b = source.binding;
  return {gitSha: b.gitSha, tree: b.tree, trackedSha256: b.trackedSha256, buildSha256: b.buildSha256,
    manifestSha256: b.manifestSha256, sdk: {version: b.sdk.version, binarySha256: b.sdk.binarySha256, packageSha256: b.sdk.packageSha256}};
}
function bindings(values, project) {
  need(Array.isArray(values) && values.length <= 100, "invalid-secret-reference-set");
  const result = values.map(value => {
    need(object(value) && same(sorted(Object.keys(value)), ["key", "projectId", "secret", "version"]) &&
      typeof value.key === "string" && /^[A-Z_][A-Z0-9_]*$/.test(value.key) && value.secret === value.key && [PROJECT, project.projectNumber].includes(value.projectId) &&
      typeof value.version === "string" && /^[1-9]\d*$/.test(value.version), "invalid-secret-reference");
    return {...value, projectId: PROJECT};
  }).sort((a, b) => a.key.localeCompare(b.key));
  need(new Set(result.map(value => value.key)).size === result.length, "duplicate-secret-reference");
  return result;
}
function policy(value) {
  need(object(value) && [1, 3].includes(value.version ?? 1) && Array.isArray(value.bindings ?? []), "invalid-policy");
  const result = structuredClone(value); delete result.etag;
  result.bindings = (result.bindings ?? []).map(binding => {
    need(object(binding) && typeof binding.role === "string" && Array.isArray(binding.members) && binding.members.every(member => typeof member === "string"), "invalid-policy");
    return {...binding, members: sorted(binding.members)};
  }).sort((a, b) => digest(a).localeCompare(digest(b)));
  return result;
}
function fingerprintFields(target, key) {
  const result = {}; let count = 0;
  const visit = (value, pointer, depth) => {
    need(depth <= 32 && ++count <= 4096, "target-components-limit");
    result[hmac(pointer, key)] = hmac({present: true, value}, key);
    if (value && typeof value === "object") for (const [name, child] of Object.entries(value)) {
      visit(child, `${pointer}/${name.replaceAll("~", "~0").replaceAll("/", "~1")}`, depth + 1);
    }
  };
  visit(target, "", 0); return result;
}
function snapshotProjection(snapshot, source, key, desired) {
  need(snapshot?.project?.projectId === PROJECT && /^[1-9]\d*$/.test(snapshot.project.projectNumber ?? ""), "wrong-project");
  const project = snapshot.project, functions = {}, invokers = {};
  need(Array.isArray(snapshot.functions) && snapshot.functions.length > 0 && Array.isArray(snapshot.schedulers) && snapshot.schedulers.length > 0, "incomplete-snapshot");
  let target;
  for (const fn of snapshot.functions) {
    const name = fn?.name?.split("/").at(-1);
    need(typeof name === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(name) && !Object.hasOwn(functions, name) &&
      fn.name === `projects/${PROJECT}/locations/${REGION}/functions/${name}` && Object.hasOwn(source.manifest.endpoints, name) &&
      fn.environment === "GEN_2" && fn.state === "ACTIVE" && fn.buildConfig?.runtime === "nodejs24" &&
      fn.buildConfig.entryPoint === name && fn.serviceConfig?.allTrafficOnLatestRevision === true, "function-contract-invalid");
    const refs = bindings(fn.serviceConfig.secretEnvironmentVariables ?? [], project);
    if (name !== TARGET) need(same(refs.map(ref => ref.key), sorted((source.manifest.endpoints[name].secretEnvironmentVariables ?? []).map(ref => ref.key))), "unrelated-source-secret-delta");
    else {
      target = fn;
      need(fn.labels?.["deployment-callable"] === "true" && !fn.eventTrigger &&
        fn.serviceConfig.serviceAccountEmail === `${project.projectNumber}-compute@developer.gserviceaccount.com` &&
        (fn.stateMessages === undefined || Array.isArray(fn.stateMessages) && fn.stateMessages.length === 0) && same(refs, desired), "target-contract-invalid");
    }
    const value = structuredClone(fn);
    if (name === TARGET) {delete value.updateTime; delete value.stateMessages; delete value.serviceConfig.revision; delete value.serviceConfig.secretEnvironmentVariables;}
    functions[name] = hmac(value, key); invokers[name] = hmac(policy(snapshot.invokerPolicies?.[name]), key);
  }
  need(target && same(sorted(Object.keys(functions)), sorted(Object.keys(source.manifest.endpoints))), "function-inventory-mismatch");
  const schedulers = {};
  for (const job of snapshot.schedulers) {
    need(typeof job?.name === "string" && job.name.startsWith(`projects/${PROJECT}/locations/${REGION}/jobs/`) && job.state === "ENABLED" && !Object.hasOwn(schedulers, job.name), "scheduler-contract-invalid");
    const value = structuredClone(job);
    for (const name of ["lastAttemptTime", "scheduleTime", "status"]) delete value[name];
    schedulers[job.name] = hmac(value, key);
  }
  const versions = {}, policies = {};
  for (const name of KEYS) {
    const refs = snapshot.functions.flatMap(fn => bindings(fn.serviceConfig.secretEnvironmentVariables ?? [], project)).filter(ref => ref.key === name);
    need(refs.length > 0 && new Set(refs.map(ref => ref.version)).size === 1, "mixed-or-missing-secret-version");
    const version = refs[0].version, pair = snapshot.secretVersions?.[name];
    const valid = value => value && [PROJECT, project.projectNumber].some(id => value.name === `projects/${id}/secrets/${name}/versions/${version}`) && value.state === "ENABLED" && !Object.hasOwn(value, "payload");
    need(valid(pair?.numeric) && valid(pair?.latest), "secret-version-state-drift");
    const normalized = policy(snapshot.secretPolicies?.[name]);
    need(normalized.bindings.some(binding => binding.role === "roles/secretmanager.secretAccessor" && !Object.hasOwn(binding, "condition") && binding.members.includes(`serviceAccount:${target.serviceConfig.serviceAccountEmail}`)), "direct-runtime-secret-grant-missing");
    versions[name] = {secret: name, version, state: "ENABLED"}; policies[name] = hmac(normalized, key);
  }
  return {target, baseline: {project: {projectId: PROJECT, projectNumber: project.projectNumber}, functions, invokers, schedulers, versions, policies,
    targetObservation: {revision: target.serviceConfig.revision, updateTime: target.updateTime}}};
}
function capMap(value, names) {
  need(value?.projectId === PROJECT && same(sorted(Object.keys(value)), ["functions", "projectId"]) && Array.isArray(value.functions), "invalid-limit-observation");
  const result = new Map();
  for (const row of value.functions) {
    need(object(row) && same(sorted(Object.keys(row)), ["allTrafficOnLatestRevision", "effectiveMaximum", "name", "ready", "revision", "revisionMaximum", "serviceMaximum"]) &&
      typeof row.name === "string" && names.includes(row.name) && !result.has(row.name) &&
      typeof row.revision === "string" && row.revision.length <= 63 && /^[a-z0-9-]+$/.test(row.revision) &&
      row.ready === true && row.allTrafficOnLatestRevision === true && ["serviceMaximum", "revisionMaximum", "effectiveMaximum"].every(field => Object.hasOwn(row, field)), "invalid-limit-observation");
    const valid = cap => cap === null || Number.isInteger(cap) && cap > 0 && cap <= 1_000_000;
    need(valid(row.serviceMaximum) && valid(row.revisionMaximum) && valid(row.effectiveMaximum), "invalid-limit-value");
    const values = [row.serviceMaximum, row.revisionMaximum].filter(cap => cap !== null);
    need(values.length > 0 && row.effectiveMaximum === Math.min(...values), "unproven-effective-limit");
    need(row.effectiveMaximum === (MAINTENANCE.has(row.name) ? 1 : 20), "unapproved-baseline-limit");
    result.set(row.name, row);
  }
  need(result.size === names.length, "incomplete-limit-inventory"); return result;
}
function checkLimits(before, after, names, target, phase, maximumOmitted) {
  const a = capMap(before, names), b = capMap(after, names);
  for (const name of names) {
    const original = a.get(name), current = b.get(name);
    if (phase === "before" || name !== TARGET) need(same(original, current), "limit-observation-drift");
    else {
      need(current.revision === target.serviceConfig.revision && current.serviceMaximum === original.serviceMaximum && current.effectiveMaximum === 20, "target-limit-drift");
      const omission = original.revisionMaximum === 20 && current.revisionMaximum === null && maximumOmitted && current.serviceMaximum === 20;
      need(current.revisionMaximum === original.revisionMaximum || omission, "target-revision-limit-drift");
      if (maximumOmitted) need(current.serviceMaximum === 20, "omitted-maximum-without-service20");
    }
  }
  return {count: names.length, maximum20: [...b.values()].filter(row => row.effectiveMaximum === 20).length,
    maximum1: [...b.values()].filter(row => row.effectiveMaximum === 1).length};
}
function comparableArtifact(envelope, kind) {
  need(envelope?.state === "AVAILABLE" && object(envelope.value), "required-provenance-unavailable");
  const value = envelope.value;
  if (kind === "build") return Object.fromEntries(["name", "id", "status", "createTime", "startTime", "finishTime", "source", "resolvedSource", "archiveSha256", "images"].map(name => [name, value[name] ?? null]));
  if (kind === "source") return Object.fromEntries(["bucket", "name", "generation", "size", "md5Hash", "crc32c"].map(name => [name, value[name] ?? null]));
  return {name: value.name, createTime: value.createTime, images: value.images ?? [], buildAnnotations: value.buildAnnotations ?? {}};
}
function artifactChecks(capture, provenance, target, project, phase, intent, operation) {
  const before = capture.artifactEvidence;
  const oldBuild = comparableArtifact(before?.functionBuild, "build"), currentBuild = comparableArtifact(provenance?.functionBuild, "build");
  const oldSource = comparableArtifact(before?.sourceObject, "source"), currentSource = comparableArtifact(provenance?.sourceObject, "source");
  const oldRevision = comparableArtifact(before?.currentRevision, "revision"), revision = comparableArtifact(provenance?.currentRevision, "revision");
  need(oldBuild.status === "SUCCESS" && currentBuild.status === "SUCCESS" && same(oldSource, currentSource) &&
    typeof oldSource.generation === "string" && /^[1-9]\d*$/.test(oldSource.generation), "build-or-source-metadata-drift");
  const source = target.buildConfig.source?.storageSource;
  need(source && same({bucket: source.bucket, name: source.object, generation: source.generation},
    {bucket: currentSource.bucket, name: currentSource.name, generation: currentSource.generation}), "source-object-context-mismatch");
  const pinned = {bucket: currentSource.bucket, object: currentSource.name, generation: currentSource.generation};
  for (const build of [oldBuild, currentBuild]) {
    for (const field of ["source", "resolvedSource"]) if (build[field] !== null) need(same(build[field], pinned), "build-source-context-mismatch");
    need(!build.archiveSha256 || build.resolvedSource && /^[a-f0-9]{64}$/.test(build.archiveSha256), "unbound-build-source-hash");
  }
  const targetBuild = normalizedBuild(target.buildConfig.build, project.projectNumber);
  need(normalizedBuild(currentBuild.name, project.projectNumber) === targetBuild && currentBuild.id === currentBuild.name.split("/").at(-1), "build-context-mismatch");
  need(revision.name?.replace(`projects/${project.projectNumber}/`, `projects/${PROJECT}/`) ===
    `projects/${PROJECT}/locations/${REGION}/services/${TARGET.toLowerCase()}/revisions/${target.serviceConfig.revision}` &&
    Array.isArray(revision.images) && revision.images.length > 0, "revision-context-mismatch");
  if (phase === "before") {
    need(same(oldBuild, currentBuild) && same(oldRevision, revision), "baseline-provenance-drift");
    return {buildChanged: false};
  }
  const changed = normalizedBuild(oldBuild.name, project.projectNumber) !== targetBuild;
  if (changed) {
    const operationBuild = comparableArtifact(provenance?.operationBuild, "build");
    need(normalizedBuild(operation.metadata.buildName, project.projectNumber) === targetBuild && same(operationBuild, currentBuild) &&
      timestamp(currentBuild.createTime) && Date.parse(currentBuild.createTime) >= Date.parse(intent.startedAt), "rebuild-not-attributed-to-intent");
  } else need(same(oldBuild, currentBuild) && same(oldRevision.images, revision.images) &&
    (!operation.metadata.buildName || normalizedBuild(operation.metadata.buildName, project.projectNumber) === targetBuild), "unchanged-build-metadata-drift");
  return {buildChanged: changed};
}
function targetFieldChecks(capture, target, key, maximumOmitted) {
  const prior = capture.targetComponents?.fieldHmacs, current = fingerprintFields(target, key);
  need(object(prior) && Object.keys(prior).length > 0 && Object.keys(prior).every(name => /^[a-f0-9]{64}$/.test(name) && /^[a-f0-9]{64}$/.test(prior[name])), "invalid-component-baseline");
  const allowed = new Set(["", "/serviceConfig", "/buildConfig", "/serviceConfig/secretEnvironmentVariables", "/serviceConfig/revision", "/updateTime", "/stateMessages", "/buildConfig/build"]);
  for (let index = 0; index < 4; index++) {
    allowed.add(`/serviceConfig/secretEnvironmentVariables/${index}`);
    for (const field of ["key", "projectId", "secret", "version"]) allowed.add(`/serviceConfig/secretEnvironmentVariables/${index}/${field}`);
  }
  if (maximumOmitted) allowed.add("/serviceConfig/maxInstanceCount");
  const hashed = new Set([...allowed].map(pointer => hmac(pointer, key)));
  for (const pointer of new Set([...Object.keys(prior), ...Object.keys(current)])) {
    if (!hashed.has(pointer)) need(prior[pointer] === current[pointer], "protected-target-component-drift");
  }
  // The allowed maximum removal is qualified against the captured actual20,
  // never against a synthesized replacement of the observed target.
  if (maximumOmitted) need(prior[hmac("/serviceConfig/maxInstanceCount", key)] === hmac({present: true, value: 20}, key), "captured-maximum-not20");
}

/** Metadata-only request description. This function never sends it. */
export function prospectiveBindingRequest(capture) {
  need(capture?.projectId === PROJECT && capture.target === TARGET_NAME && capture.baseline?.project?.projectId === PROJECT, "invalid-request-capture");
  const starting = bindings(capture.targetBindings, capture.baseline.project);
  need(starting.length === 1 && starting[0].key === "STRIPE_SECRET", "captured-starting-bindings-invalid");
  const refs = [structuredClone(capture.targetBindings[0])];
  for (const name of ["GOV_NOTIFY_LIVE_API_KEY", "GOV_NOTIFY_TEAM_API_KEY", "GOV_NOTIFY_TEST_API_KEY"]) {
    const version = capture.baseline.versions?.[name];
    need(version?.secret === name && version.state === "ENABLED" && /^[1-9]\d*$/.test(version.version ?? ""), "invalid-captured-secret-version");
    refs.push({key: name, secret: name, projectId: PROJECT, version: version.version});
  }
  const stripe = capture.baseline.versions?.STRIPE_SECRET;
  need(stripe?.state === "ENABLED" && stripe.version === starting[0].version, "stripe-binding-change-not-permitted");
  return {method: "PATCH", url: `https://cloudfunctions.googleapis.com/v2/${TARGET_NAME}?updateMask=serviceConfig.secretEnvironmentVariables`,
    updateMask: "serviceConfig.secretEnvironmentVariables", body: {name: TARGET_NAME, serviceConfig: {secretEnvironmentVariables: refs}}};
}

/** Validate durable local context before a caller constructs its GET-only provider. */
export function validateProspectiveInputs(options = {}) {
  try {
    const names = ["phase", "capture", "comparisonKey", "source", "toolBinding", "limitsBaseline", "intent", "acknowledgement", "now"];
    need(object(options) && Object.keys(options).every(name => names.includes(name)), "unsupported-comparison-option");
    const {phase, capture, comparisonKey, source, toolBinding, limitsBaseline, intent, acknowledgement} = options;
    need(["before", "after"].includes(phase), "invalid-comparison-phase");
    need(Buffer.isBuffer(comparisonKey) && comparisonKey.length === 32, "invalid-comparison-key");
    need(capture?.schemaVersion === "sodc-notify-binding-capture/v1" && capture.status === "CAPTURED_OBSERVATION_NOT_APPROVAL" &&
      capture.projectId === PROJECT && capture.target === TARGET_NAME && capture.observationOnly === true &&
      capture.productionAuthorized === false && capture.releaseAuthorized === false && capture.originalContractAccepted === false && timestamp(capture.observedAt), "invalid-prospective-capture");
    assertRepairSource(source, PROJECT); assertEvidenceToolBinding(toolBinding);
    need(same(sourceProjection(source), capture.sourceBinding), "application-source-binding-drift");
    const project = capture.baseline?.project;
    need(project?.projectId === PROJECT && /^[1-9]\d*$/.test(project.projectNumber ?? "") &&
      same(sorted(Object.keys(capture.baseline.versions ?? {})), KEYS), "invalid-captured-project-or-versions");
    const endpointNames = sorted(Object.keys(source.manifest.endpoints));
    const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
    for (const category of ["functions", "invokers"]) need(object(capture.baseline[category]) &&
      same(sorted(Object.keys(capture.baseline[category])), endpointNames) && Object.values(capture.baseline[category]).every(hash), "invalid-captured-baseline");
    for (const category of ["schedulers", "policies"]) need(object(capture.baseline[category]) &&
      Object.keys(capture.baseline[category]).length > 0 && Object.values(capture.baseline[category]).every(hash), "invalid-captured-baseline");
    need(same(sorted(Object.keys(capture.baseline.policies)), KEYS) && hash(capture.targetComponents?.fullHmac) &&
      object(capture.targetComponents.fieldHmacs) && Object.keys(capture.targetComponents.fieldHmacs).length > 0 &&
      Object.entries(capture.targetComponents.fieldHmacs).every(([name, value]) => hash(name) && hash(value)), "invalid-component-baseline");
    capMap(limitsBaseline, endpointNames);
    const request = prospectiveBindingRequest(capture);
    const context = {captureReportSha256: digest(capture), limitsBaselineSha256: digest(limitsBaseline),
      requestSha256: digest(request), sourceBindingSha256: digest(capture.sourceBinding), comparisonToolBindingSha256: digest(toolBinding)};
    if (phase === "after") {
      need(object(intent) && same(sorted(Object.keys(intent)), sorted(["schemaVersion", "projectId", "target", ...Object.keys(context), "startedAt"])) &&
        intent.schemaVersion === "sodc-notify-binding-operator-intent/v1" && intent.projectId === PROJECT && intent.target === TARGET_NAME &&
        Object.entries(context).every(([name, value]) => intent[name] === value) && timestamp(intent.startedAt) &&
        Date.parse(intent.startedAt) >= Date.parse(capture.observedAt), "invalid-or-unbound-operator-intent");
      const now = typeof options.now === "function" ? options.now() : options.now ?? Date.now();
      need(Number.isFinite(now) && Date.parse(intent.startedAt) <= now, "intent-clock-invalid");
      const operationPattern = new RegExp(`^projects/${PROJECT}/locations/${REGION}/operations/[A-Za-z0-9_-]+$`);
      need(object(acknowledgement) && same(Object.keys(acknowledgement), ["name"]) && operationPattern.test(acknowledgement.name), "missing-or-invalid-operation-acknowledgement");
    } else need(intent === undefined && acknowledgement === undefined, "unexpected-before-phase-journal");
    return canonical(context);
  } catch (error) {
    const code = typeof error?.code === "string" && /^[a-z0-9-]+$/.test(error.code) ? error.code : "invalid-comparison-input-or-state";
    need(false, code);
  }
}

/** Pure observation comparison; it cannot approve or apply a provider mutation. */
export function compareProspectiveBindingEvidence(options = {}) {
  const report = {schemaVersion: "sodc-notify-binding-prospective/v1", status: "FAIL", projectId: PROJECT,
    readOnly: true, observationOnly: true, providerWrites: 0, runtimeInvocations: 0, emailSends: 0, originalContractAccepted: false,
    productionAuthorized: false, releaseAuthorized: false, sourceArchiveEquality: "UNPROVEN", executableEquality: "UNPROVEN",
    provenanceReviewRequired: true, issues: []};
  try {
    need(object(options) && Object.keys(options).every(name => OPTIONS.has(name)), "unsupported-comparison-option");
    const {phase, capture, comparisonKey, source, toolBinding, snapshot, provenance, limitsBaseline, limitsObservation, intent, operation, acknowledgement, expectedBindings} = options;
    const context = validateProspectiveInputs({phase, capture, comparisonKey, source, toolBinding, limitsBaseline, intent, acknowledgement, now: options.now});
    report.phase = phase;
    const project = capture.baseline.project;
    const start = bindings(capture.targetBindings, project);
    const desired = bindings(prospectiveBindingRequest(capture).body.serviceConfig.secretEnvironmentVariables, project);
    if (expectedBindings !== undefined) need(same(bindings(expectedBindings, project), desired), "request-bindings-do-not-match-capture");
    if (phase === "after") {
      need(operation?.name === acknowledgement.name && (operation.done === undefined || typeof operation.done === "boolean"), "operation-does-not-match-acknowledgement");
      if (operation.metadata !== undefined) need([TARGET_NAME, TARGET_NAME.replace(`projects/${PROJECT}/`, `projects/${project.projectNumber}/`)].includes(operation.metadata.target) && operation.metadata.verb === "update", "operation-target-or-verb-mismatch");
      if (operation.done !== true) {report.status = "PENDING"; return canonical(report);}
      need(!Object.hasOwn(operation, "error"), "provider-operation-failed");
      need(operation.metadata && timestamp(intent?.startedAt), "missing-operation-scope-or-intent");
    }
    const desiredNow = phase === "before" ? start : desired;
    const view = snapshotProjection(snapshot, source, comparisonKey, desiredNow);
    need(same(view.baseline.project, project), "project-number-drift");
    for (const category of ["invokers", "schedulers", "versions", "policies"]) need(same(view.baseline[category], capture.baseline[category]), "protected-baseline-drift");
    need(same(sorted(Object.keys(view.baseline.functions)), sorted(Object.keys(capture.baseline.functions))), "function-inventory-drift");
    for (const name of Object.keys(view.baseline.functions)) if (phase === "before" || name !== TARGET) need(view.baseline.functions[name] === capture.baseline.functions[name], "protected-function-drift");
    const target = view.target;
    const omitted = !Object.hasOwn(target.serviceConfig, "maxInstanceCount");
    if (phase === "before") {
      const original = collectBindingRepairSnapshot(snapshot, comparisonKey, PROJECT, source.manifest);
      delete original.targetBindings; delete original.desiredBindings;
      need(same(original, capture.baseline) && hmac(target, comparisonKey) === capture.targetComponents.fullHmac &&
        same(fingerprintFields(target, comparisonKey), capture.targetComponents.fieldHmacs), "baseline-no-longer-current");
    } else {
      need(omitted || target.serviceConfig.maxInstanceCount === 20, "unexpected-target-maximum");
      need(target.serviceConfig.revision !== capture.baseline.targetObservation.revision &&
        typeof target.serviceConfig.revision === "string" && target.serviceConfig.revision.startsWith(TARGET.toLowerCase() + "-") &&
        /^[a-z0-9-]{1,63}$/.test(target.serviceConfig.revision) && timestamp(target.updateTime) &&
        Date.parse(target.updateTime) >= Date.parse(intent.startedAt), "target-revision-or-update-not-attributed");
      targetFieldChecks(capture, target, comparisonKey, omitted);
    }
    const names = sorted(Object.keys(view.baseline.functions));
    const counts = checkLimits(limitsBaseline, limitsObservation, names, target, phase, omitted);
    need(snapshot.functions.every(fn => limitsObservation.functions.find(row => row.name === fn.buildConfig.entryPoint)?.revision === fn.serviceConfig.revision), "limit-observation-revision-mismatch");
    const artifacts = artifactChecks(capture, provenance, target, project, phase, intent, operation);
    Object.assign(report, {status: phase === "before" ? "BASELINE_MATCH" : "METADATA_VERIFIED_WITH_PROVENANCE_LIMIT",
      ...context,
      functionCount: names.length, unchangedOtherFunctions: names.length - 1, limits: counts, targetMaximumFieldOmitted: omitted,
      buildChanged: artifacts.buildChanged, comparisonKeyVerifiedByProtectedFingerprints: true,
      limitsNotice: "Configured service/revision maxima, not instantaneous instance-count guarantees.",
      provenanceNotice: "Provider object identity and checksum metadata are not independent archive-byte or executable equality. A separate Production evidence decision is still required."});
  } catch (error) {
    report.status = "FAIL";
    report.issues = [typeof error?.prospectiveCode === "string" && /^[a-z0-9-]+$/.test(error.prospectiveCode) ? error.prospectiveCode : "invalid-comparison-input-or-state"];
  }
  return canonical(report);
}
