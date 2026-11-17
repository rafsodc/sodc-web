import { RESULT_STATUS, normalizeResourceName } from "./deployment-check-lib.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME = /^[a-z][a-zA-Z0-9]*$/;
const FUNCTION_NAME = /^[a-zA-Z][a-zA-Z0-9]*$/;
const BINDING_LIMIT = 1001;
export const NOTIFY_BINDINGS_QUERY = `query NotifyTemplateReadiness {
  notifyTemplateBindings(limit: ${BINDING_LIMIT}) { templateKey notifyTemplateId }
}`;

export function templateFallbackEnvironmentKey(key) {
  return `GOV_NOTIFY_TEMPLATE_${key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}`;
}

export function validTemplateReadinessContract(contract) {
  if (contract?.schemaVersion !== "sodc-notify-template-contract/v1" ||
    !Array.isArray(contract.templates) || !contract.templates.length) return false;
  const keys = new Set();
  return contract.templates.every((entry) => {
    if (!entry || typeof entry.key !== "string" || !NAME.test(entry.key) || keys.has(entry.key) ||
      !Array.isArray(entry.functions) || !entry.functions.length ||
      !entry.functions.every((name) => typeof name === "string" && FUNCTION_NAME.test(name)) ||
      new Set(entry.functions.map((name) => name.toLowerCase())).size !== entry.functions.length) return false;
    keys.add(entry.key);
    return true;
  });
}

/** Checks ID configuration only. Does not read secrets or contact Notify, and
 * never treats review-version drift as permission to block transactional mail. */
export function assessNotifyTemplateReadiness({ contract, functions, bindings }) {
  const failure = (reason) => ({ status: RESULT_STATUS.FAIL,
    summary: "Transactional email template ID configuration could not be verified.", details: { reason } });
  if (!validTemplateReadinessContract(contract)) return failure("invalid-template-contract");
  if (!Array.isArray(functions)) return failure("functions-metadata-unavailable");
  if (!Array.isArray(bindings) || bindings.length >= BINDING_LIMIT || bindings.some((row) =>
    !row || typeof row.templateKey !== "string" || typeof row.notifyTemplateId !== "string")) {
    return failure("bindings-incomplete-or-invalid");
  }
  const entries = [];
  for (const template of contract.templates) {
    const matchingBindings = bindings.filter((row) => row.templateKey === template.key);
    for (const functionName of template.functions) {
      const matchingFunctions = functions.filter((fn) => normalizeResourceName(fn?.name) === functionName.toLowerCase());
      let issue, source;
      if (matchingFunctions.length !== 1) {
        issue = matchingFunctions.length ? "duplicate-function-metadata" : "missing-function";
      } else if (matchingFunctions[0].state !== "ACTIVE") {
        issue = "function-not-active";
      } else if (matchingBindings.length > 1) {
        issue = "duplicate-saved-binding";
      } else if (matchingBindings.length === 1) {
        // A present binding takes precedence even when invalid. The runtime
        // does not fall through to an env ID when this value is non-null.
        if (UUID.test(matchingBindings[0].notifyTemplateId)) source = "saved-binding";
        else issue = "invalid-saved-binding";
      } else {
        const value = matchingFunctions[0].serviceConfig?.environmentVariables?.[templateFallbackEnvironmentKey(template.key)];
        // The configured mailer preserves nonempty env values, including their
        // whitespace; do not pass a value the provider would receive untrimmed.
        if (typeof value === "string" && UUID.test(value)) source = "environment-fallback";
        else issue = value === undefined || (typeof value === "string" && !value.trim())
          ? "missing-binding-and-fallback" : "invalid-environment-fallback";
      }
      entries.push({ templateKey: template.key, functionName, ...(issue ? { issue } : { source }) });
    }
  }
  const issues = entries.filter((entry) => entry.issue);
  return {
    status: issues.length ? RESULT_STATUS.FAIL : RESULT_STATUS.PASS,
    summary: issues.length
      ? "Active transactional email paths have missing or invalid template ID configuration."
      : "Every checked transactional email path has a saved template ID or a configured fallback ID.",
    details: { templateCount: contract.templates.length, senderPathCount: entries.length,
      savedBindingPathCount: entries.filter((entry) => entry.source === "saved-binding").length,
      fallbackPathCount: entries.filter((entry) => entry.source === "environment-fallback").length,
      issues,
      limits: "ID configuration only; provider existence, name, content, version review and delivery are not verified." },
  };
}

/** The only database operation in this audit is the service-level read endpoint.
 * Return only fields needed for resolution; error bodies are never reported. */
export async function readNotifyTemplateBindings({ projectId, region, service, accessToken, fetchImpl = fetch }) {
  if (![projectId, service].every((part) => typeof part === "string" && /^[a-z][a-z0-9-]+$/.test(part)) ||
    typeof region !== "string" || !/^[a-z]+-[a-z]+[0-9]+$/.test(region)) {
    throw new Error("invalid-template-read-target");
  }
  try {
    const token = await accessToken();
    const response = await fetchImpl(
      `https://firebasedataconnect.googleapis.com/v1/projects/${projectId}/locations/${region}/services/${service}:executeGraphqlRead`,
      { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${token}`,
        "content-type": "application/json", "x-goog-user-project": projectId },
      body: JSON.stringify({ query: NOTIFY_BINDINGS_QUERY }), signal: AbortSignal.timeout(30_000) },
    );
    if (!response.ok) throw new Error();
    const body = await response.json();
    const bindings = body?.data?.notifyTemplateBindings;
    if ((Object.hasOwn(body ?? {}, "errors") && (!Array.isArray(body.errors) || body.errors.length)) ||
      !Array.isArray(bindings) || bindings.length >= BINDING_LIMIT) throw new Error();
    return bindings;
  } catch {
    throw new Error("template-bindings-read-failed");
  }
}

/** Fail closed if the DB cannot be read: an unknown saved value may override
 * even a valid env fallback. No attempt is made to send or repair anything. */
export async function checkNotifyTemplateReadiness({ contract, functions, loadBindings }) {
  if (!validTemplateReadinessContract(contract)) return assessNotifyTemplateReadiness({ contract });
  if (!Array.isArray(functions)) return assessNotifyTemplateReadiness({ contract, functions });
  let bindings;
  try { bindings = await loadBindings(); }
  catch { return { status: RESULT_STATUS.FAIL, summary: "Saved transactional template bindings could not be read; readiness is unverified.",
    details: { reason: "template-bindings-read-failed" } }; }
  return assessNotifyTemplateReadiness({ contract, functions, bindings });
}
