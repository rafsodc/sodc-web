import { createHash } from "node:crypto";

export const GUARD_SCHEMA = "sodc-functions-config-guard/v1";
export const REVIEW_SCHEMA = "sodc-functions-config-review/v1";
export const MANAGED_ENV_KEYS = Object.freeze([
  "EVENTARC_CLOUD_EVENT_SOURCE", "FIREBASE_CONFIG", "FUNCTION_SIGNATURE_TYPE",
  "FUNCTION_TARGET", "GCLOUD_PROJECT", "LOG_EXECUTION_ID",
]);

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export function digest(value) {
  requireGuard(value !== undefined, "undefined-hash-input");
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export function bytesDigest(value) {
  return createHash("sha256").update(value).digest("hex");
}

// Only static codes reach callers. Firebase parser, SDK discovery and provider failures can
// contain credentials or values; their original messages/stacks must never be propagated.
export class GuardError extends Error {
  constructor(code) {
    super(`Functions configuration guard blocked: ${code}.`);
    this.code = code;
  }
}

export function requireGuard(condition, code) {
  if (!condition) throw new GuardError(code);
}

export function environmentProjection(values) {
  return Object.fromEntries(Object.keys(values).sort().map((key) => {
    requireGuard(/^[A-Z_][A-Z0-9_]*$/.test(key) && typeof values[key] === "string", "invalid-environment-shape");
    return [key, { state: values[key] === "" ? "empty" : "set", sha256: digest(values[key]) }];
  }));
}

export function applicationEnvironment(values) {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !MANAGED_ENV_KEYS.includes(key)));
}

export function environmentDelta(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().flatMap((key) => {
    const oldValue = Object.hasOwn(before, key) ? before[key] : { state: "absent" };
    const newValue = Object.hasOwn(after, key) ? after[key] : { state: "absent" };
    return digest(oldValue) === digest(newValue) ? [] : [{ key, before: oldValue, after: newValue }];
  });
}

export function assertScheduledTarget(target, { projectId, region, endpointId, runUri, serviceAccount }) {
  const withoutRootSlash = (value) => typeof value === "string" ? value.replace(/\/$/, "") : value;
  const aliases = [withoutRootSlash(runUri), `https://${region}-${projectId}.cloudfunctions.net/${endpointId}`];
  requireGuard(target && aliases.includes(withoutRootSlash(target.uri)) && target.httpMethod === "POST" &&
    target.oidcToken?.serviceAccountEmail === serviceAccount &&
    (!target.oidcToken.audience || withoutRootSlash(target.oidcToken.audience) === withoutRootSlash(target.uri)) &&
    !target.oauthToken && !target.body, "schedule-target-or-identity-contract-change");
}

export function assertSupportedManifest(manifest, region) {
  requireGuard(manifest.specVersion === "v1alpha1" && Object.keys(manifest.endpoints ?? {}).length > 0,
    "unsupported-or-empty-sdk-manifest");
  requireGuard(Object.keys(manifest.extensions ?? {}).length === 0, "extensions-not-supported");
  requireGuard((manifest.params ?? []).every((param) => param.type === "secret" && /^[A-Z_][A-Z0-9_]*$/.test(param.name)),
    "non-secret-or-unsupported-parameter");
  for (const [id, endpoint] of Object.entries(manifest.endpoints)) {
    requireGuard(/^[a-zA-Z][a-zA-Z0-9-]*$/.test(id), "unsupported-endpoint-name");
    requireGuard(endpoint.platform === "gcfv2" && digest(endpoint.region) === digest([region]),
      "unsupported-platform-or-region");
    requireGuard(Object.keys(endpoint).every((key) => ["platform", "region", "entryPoint", "availableMemoryMb", "timeoutSeconds",
      "minInstances", "maxInstances", "ingressSettings", "concurrency", "serviceAccountEmail", "serviceAccount", "vpc", "labels",
      "callableTrigger", "httpsTrigger", "scheduleTrigger", "taskQueueTrigger", "secretEnvironmentVariables", "cpu", "omit"].includes(key)),
    "unsupported-endpoint-option");
    requireGuard(!endpoint.omit && !endpoint.vpc && !endpoint.environmentVariables && Object.keys(endpoint.labels ?? {}).length === 0 &&
      !endpoint.baseImageUri && !endpoint.command && !endpoint.args,
    "unsupported-endpoint-override");
    const trigger = ["httpsTrigger", "callableTrigger", "scheduleTrigger", "taskQueueTrigger"]
      .filter((key) => Object.hasOwn(endpoint, key));
    requireGuard(trigger.length === 1, "unsupported-trigger");
    requireGuard(Object.keys(endpoint.callableTrigger ?? {}).length === 0, "callable-options-not-supported");
    if (endpoint.taskQueueTrigger) {
      requireGuard(!Object.hasOwn(endpoint.taskQueueTrigger, "invoker") &&
        Object.keys(endpoint.taskQueueTrigger).every((key) => ["retryConfig", "rateLimits"].includes(key)),
      "task-invoker-or-unknown-options-not-supported");
    }
    if (endpoint.httpsTrigger) requireGuard(Object.keys(endpoint.httpsTrigger).every((key) => key === "invoker"), "unsupported-https-options");
    if (endpoint.scheduleTrigger) {
      requireGuard(Object.keys(endpoint.scheduleTrigger).every((key) => ["schedule", "timeZone", "retryConfig"].includes(key)) &&
        Object.keys(endpoint.scheduleTrigger.retryConfig ?? {}).length === 0,
      "schedule-retry-or-unknown-options-not-supported");
    }
    // CEL/parameter expressions in runtime options need a separately reviewed adapter.
    for (const [key, value] of Object.entries(endpoint)) {
      if (["availableMemoryMb", "maxInstances", "minInstances", "concurrency", "timeoutSeconds", "cpu"].includes(key)) {
        requireGuard(value === null || typeof value === "number" || (key === "cpu" && value === "gcf_gen1"),
          "parameterized-runtime-option-not-supported");
      }
    }
  }
}

export function assertSecretMetadata(endpoints, declaredSecrets, metadata, projectId) {
  const bindings = endpoints.flatMap((endpoint) => endpoint.secretEnvironmentVariables ?? []);
  requireGuard(declaredSecrets.every((name) => bindings.some((binding) => binding.secret === name)),
    "unbound-secret-parameter-not-supported");
  for (const secret of bindings) {
    requireGuard(secret.projectId === projectId && /^\d+$/.test(secret.version), "cross-project-or-unpinned-secret");
    const latest = metadata[secret.secret];
    requireGuard(latest?.name === `projects/${projectId}/secrets/${secret.secret}/versions/${secret.version}` &&
      latest.state === "ENABLED", "secret-latest-version-or-state-drift");
  }
  return [...new Set(bindings.map((binding) => binding.secret))].sort().map((name) => ({
    name, resource: metadata[name].name, state: metadata[name].state,
  }));
}

/** Pure decision layer. All inputs are non-secret hashes or metadata. */
export function configurationProposal({ binding, endpoints, policy, baseline, providerDefaultResets = [], endpointCreations = [] }) {
  const environmentChanges = [];
  const policyDeviations = [];
  for (const endpoint of endpoints) {
    for (const change of environmentDelta(endpoint.before, endpoint.after)) {
      environmentChanges.push({ endpoint: endpoint.name, ...change });
    }
    for (const key of policy.requiredEnvironmentKeys) {
      if (endpoint.after[key]?.state !== "set") policyDeviations.push({ endpoint: endpoint.name, key, reason: "required-nonempty" });
    }
    for (const [key, value] of Object.entries(endpoint.after)) {
      if (value.state === "empty" && !policy.allowedEmptyEnvironmentKeys.includes(key)) {
        if (!policyDeviations.some((item) => item.endpoint === endpoint.name && item.key === key)) {
          policyDeviations.push({ endpoint: endpoint.name, key, reason: "unreviewed-empty" });
        }
      }
    }
  }
  const proposal = { schemaVersion: REVIEW_SCHEMA, bindingSha256: digest(binding), baselineSha256: digest(baseline),
    environmentChanges, policyDeviations, providerDefaultResets, endpointCreations };
  return canonical(proposal);
}

export function evaluateConfiguration({ review, ...inputs }) {
  const proposal = configurationProposal(inputs);
  const { binding } = inputs;
  const { environmentChanges, policyDeviations, providerDefaultResets, endpointCreations } = proposal;
  if (review) {
    requireGuard(review.schemaVersion === REVIEW_SCHEMA && ["preserve-existing", "change-environment"].includes(review.mode) &&
      typeof review.reviewedBy === "string" && review.reviewedBy.trim().length > 0 &&
      typeof review.reason === "string" && review.reason.trim().length > 0 &&
      ![review.reviewedBy, review.reason].some((value) => value.trim().toUpperCase() === "REPLACE_AFTER_REVIEW"), "invalid-review-record");
    requireGuard(review.bindingSha256 === proposal.bindingSha256 && review.baselineSha256 === proposal.baselineSha256 &&
      digest(review.environmentChanges) === digest(environmentChanges) && digest(review.policyDeviations) === digest(policyDeviations),
    "review-does-not-match-exact-proposal");
    requireGuard(digest(review.providerDefaultResets) === digest(providerDefaultResets), "unreviewed-provider-default-resets");
    requireGuard(digest(review.endpointCreations ?? []) === digest(endpointCreations), "unreviewed-endpoint-creations");
    requireGuard(review.mode !== "preserve-existing" || environmentChanges.length === 0,
      "preservation-cannot-change-environment");
  } else {
    requireGuard(endpointCreations.length === 0, "endpoint-creations-require-explicit-review");
    requireGuard(binding.mode === "dotenv", "preservation-requires-explicit-review");
    requireGuard(environmentChanges.length === 0, "unreviewed-application-environment-change");
    requireGuard(policyDeviations.length === 0, "missing-empty-or-partial-environment");
    requireGuard(providerDefaultResets.length === 0, "provider-default-resets-require-review");
  }
  return proposal;
}

export function verifyGuardReceipt(saved, current) {
  requireGuard(saved?.schemaVersion === GUARD_SCHEMA && saved.status === "PASS", "missing-passing-guard-receipt");
  requireGuard(digest(saved.binding) === digest(current.binding), "local-inputs-changed-since-preflight");
  requireGuard(digest(saved.baseline) === digest(current.baseline), "provider-contract-changed-since-preflight");
  requireGuard(saved.reviewSha256 === current.reviewSha256, "review-changed-since-preflight");
}
