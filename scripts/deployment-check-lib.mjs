import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const RESULT_STATUS = Object.freeze({
  PASS: "pass",
  FAIL: "fail",
  WARN: "warn",
  SKIP: "skip",
});

export function firebaseStorageDownloadUrl(bucket, objectName) {
  return (
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}` +
    `/o/${encodeURIComponent(objectName)}?alt=media`
  );
}

export function parseJsonOutput(output) {
  const trimmed = String(output).trim();
  if (!trimmed) throw new Error("command returned no JSON");

  try {
    return JSON.parse(trimmed);
  } catch {
    const starts = [trimmed.indexOf("{"), trimmed.indexOf("[")].filter((index) => index >= 0);
    for (const start of starts.sort((a, b) => a - b)) {
      const opening = trimmed[start];
      const end = trimmed.lastIndexOf(opening === "{" ? "}" : "]");
      if (end <= start) continue;
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        // Try the next possible JSON container.
      }
    }
    throw new Error("command returned invalid JSON");
  }
}

export function unwrapFirebaseResult(value) {
  if (value && typeof value === "object" && "result" in value) return value.result;
  return value;
}

export function normalizeResourceName(value) {
  return String(value ?? "").split("/").at(-1)?.toLowerCase() ?? "";
}

export function compareExpected(expected, actual) {
  const actualSet = new Set(actual.map((value) => String(value).toLowerCase()));
  return expected.filter((value) => !actualSet.has(String(value).toLowerCase()));
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assessGovNotifyReplyToConfiguration(functions) {
  const configured = [];
  const missing = [];
  const invalid = [];

  for (const fn of functions) {
    const functionName = normalizeResourceName(fn.name);
    const rawValue = fn.serviceConfig?.environmentVariables?.GOV_NOTIFY_EMAIL_REPLY_TO_ID;
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!value) {
      missing.push(functionName);
    } else if (!UUID_PATTERN.test(value)) {
      invalid.push(functionName);
    } else {
      configured.push({ functionName, value: value.toLowerCase() });
    }
  }

  return {
    configuredFunctions: configured.map(({ functionName }) => functionName).sort(),
    missingFunctions: missing.sort(),
    invalidFunctions: invalid.sort(),
    distinctValueCount: new Set(configured.map(({ value }) => value)).size,
  };
}

export function resolveTarget(firebaseRc, configuration, alias) {
  if (!Object.hasOwn(configuration.environments, alias)) {
    throw new Error(`Unknown environment "${alias}"; expected dev, beta, or prod.`);
  }

  const target = configuration.environments[alias];
  const aliasProjectId = firebaseRc.projects?.[alias];
  if (!aliasProjectId) throw new Error(`Firebase alias "${alias}" is not defined in .firebaserc.`);
  if (aliasProjectId !== target.projectId) {
    throw new Error(
      `Firebase alias "${alias}" resolves to ${aliasProjectId}, not expected project ${target.projectId}.`
    );
  }

  return { alias, ...target, region: configuration.region };
}

export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        /(authorization|bearer|password|secret|token|private.?key)/i.test(key)
          ? "[REDACTED]"
          : redact(entry),
      ])
    );
  }
  if (typeof value !== "string") return value;
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(
      /([?&](?:key|token|code|signature|credential|x-goog-(?:signature|credential|security-token)|x-amz-(?:signature|credential|security-token))=)[^&\s]+/gi,
      "$1[REDACTED]"
    );
}

export function safeErrorMessage(error) {
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && typeof error.message === "string"
        ? error.message
        : "Unknown error";
  return redact(message);
}

export function result(id, status, summary, details) {
  return {
    id,
    status,
    summary: redact(summary),
    ...(details === undefined ? {} : { details: redact(details) }),
  };
}

export function exitCodeFor(results) {
  return results.some(({ status }) => status === RESULT_STATUS.FAIL) ? 1 : 0;
}

const PUBLIC_INVOKER_MEMBERS = new Set(["allUsers", "allAuthenticatedUsers"]);

export function isPublicInvokerPolicy(policy) {
  return (policy?.bindings ?? []).some(
    (binding) =>
      ["roles/run.invoker", "roles/cloudfunctions.invoker"].includes(binding.role) &&
      binding.members?.some((member) => PUBLIC_INVOKER_MEMBERS.has(member))
  );
}

export function assessFunctionInvokerPolicies(records, expectedPublicFunctions) {
  const expected = new Set(expectedPublicFunctions.map((name) => name.toLowerCase()));
  const audited = new Set(records.map(({ functionName }) => functionName.toLowerCase()));
  const unreadable = records
    .filter(({ error }) => error)
    .map(({ functionName }) => functionName)
    .sort();
  const unexpectedlyPublic = records
    .filter(
      ({ functionName, publiclyInvokable, error }) =>
        !error && publiclyInvokable && !expected.has(functionName.toLowerCase())
    )
    .map(({ functionName }) => functionName)
    .sort();
  const unexpectedlyPrivate = records
    .filter(
      ({ functionName, publiclyInvokable, error }) =>
        !error && !publiclyInvokable && expected.has(functionName.toLowerCase())
    )
    .map(({ functionName }) => functionName)
    .sort();
  const missingAudits = expectedPublicFunctions
    .filter((functionName) => !audited.has(functionName.toLowerCase()))
    .sort();

  return { unreadable, unexpectedlyPublic, unexpectedlyPrivate, missingAudits };
}

/**
 * Assesses Firebase App Check enforcement mode per service, matching what the read-only
 * `firebaseappcheck.googleapis.com` API can prove: FAIL when App Check was never registered
 * for any service (an empty list), WARN when registered but still in monitoring-only mode
 * (any service not ENFORCED), PASS only once every checked service is ENFORCED.
 */
export function assessAppCheckEnforcement(services, expectedServiceNames = []) {
  const entries = (services ?? []).map((service) => ({
    name: normalizeResourceName(service.name),
    enforcementMode: service.enforcementMode,
  }));
  const returnedNames = new Set(entries.map(({ name }) => name));
  const missingServices = expectedServiceNames
    .map(normalizeResourceName)
    .filter((name) => !returnedNames.has(name));
  const expectedServices = expectedServiceNames.map(normalizeResourceName);
  const returnedServices = entries.map(({ name }) => name);
  const unenforcedServices = entries
    .filter((entry) => entry.enforcementMode !== "ENFORCED")
    .map(({ name }) => name);
  const details = {
    expectedServices,
    returnedServices,
    missingServices,
    unenforcedServices,
    services: entries,
  };
  if (missingServices.length > 0) {
    return {
      status: RESULT_STATUS.FAIL,
      summary: `App Check is missing configured service(s): ${missingServices.join(", ")}.`,
      details,
    };
  }
  if (entries.length === 0) {
    return {
      status: RESULT_STATUS.FAIL,
      summary: "App Check has no services registered; enforcement is not configured.",
      details,
    };
  }
  if (unenforcedServices.length > 0) {
    return {
      status: RESULT_STATUS.WARN,
      summary: "App Check is registered but not yet enforced for all services (monitoring only).",
      details,
    };
  }
  return {
    status: RESULT_STATUS.PASS,
    summary: "App Check is registered and enforced for all checked services.",
    details,
  };
}

/**
 * Assesses Identity Platform sign-in configuration: email/password sign-in is the site's
 * only supported method, every expected canonical domain must be authorized, and `localhost`
 * must only be authorized in environments that explicitly allow it (dev).
 */
export function assessAuthConfiguration(config, expectedAuthorizedDomains, allowLocalhost) {
  const authorizedDomains = config?.authorizedDomains ?? [];
  const issues = [];
  if (config?.signIn?.email?.enabled !== true) {
    issues.push("email/password sign-in is not enabled");
  }
  const missingDomains = expectedAuthorizedDomains.filter(
    (domain) => !authorizedDomains.includes(domain)
  );
  if (missingDomains.length) {
    issues.push(`missing authorized domain(s): ${missingDomains.join(", ")}`);
  }
  if (!allowLocalhost && authorizedDomains.includes("localhost")) {
    issues.push("localhost is authorized outside of dev");
  }
  if (issues.length) {
    return {
      status: RESULT_STATUS.FAIL,
      summary: `Auth configuration audit failed: ${issues.join("; ")}.`,
      details: { authorizedDomains },
    };
  }
  return {
    status: RESULT_STATUS.PASS,
    summary: "Auth sign-in method and authorized domains are configured correctly.",
    details: { authorizedDomains },
  };
}

/**
 * Compares the deployed Firebase Storage ruleset's source against the checked-in
 * `storage.rules`, normalizing line endings/trailing whitespace so formatting-only
 * differences don't produce a false failure.
 */
export function assessStorageRulesContent(deployedContent, checkedInContent) {
  const normalize = (value) =>
    String(value ?? "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();
  if (normalize(deployedContent) !== normalize(checkedInContent)) {
    return {
      status: RESULT_STATUS.FAIL,
      summary: "Deployed Storage rules do not match the checked-in storage.rules.",
    };
  }
  return {
    status: RESULT_STATUS.PASS,
    summary: "Deployed Storage rules match the checked-in storage.rules.",
  };
}

/**
 * A Storage rules probe is only conclusive when the provider explicitly rejects the
 * unauthenticated request. Missing objects and provider failures must never be treated
 * as proof that access control is working.
 */
export function assessUnauthenticatedStorageProbe(status) {
  if (status === 401 || status === 403) {
    return {
      status: RESULT_STATUS.PASS,
      summary: `Unauthenticated Storage read was explicitly denied (HTTP ${status}).`,
    };
  }
  if (status === 200) {
    return {
      status: RESULT_STATUS.FAIL,
      summary: "Unauthenticated Storage read succeeded; deployed rules do not deny read.",
    };
  }
  return {
    status: RESULT_STATUS.FAIL,
    summary: `Unauthenticated Storage probe was inconclusive (HTTP ${status}); expected an explicit 401/403 denial.`,
  };
}

/**
 * Confirms a service account carries no project-level IAM bindings at all -- the expected
 * shape for a least-privilege service account whose only grants are the specific
 * resource-level bindings checked elsewhere (e.g. objectViewer on one bucket).
 */
export function assessServiceAccountProjectScope(serviceAccountEmail, projectRoles) {
  if (projectRoles.length > 0) {
    return {
      status: RESULT_STATUS.FAIL,
      summary: `${serviceAccountEmail} has unexpected project-level IAM role(s): ${projectRoles.join(", ")}.`,
    };
  }
  return {
    status: RESULT_STATUS.PASS,
    summary: `${serviceAccountEmail} has no project-level IAM roles beyond its explicit resource-level grants.`,
  };
}

/**
 * Assesses whether the ClamAV definitions refresh schedule is enabled and its most recent
 * attempt ran recently without error. Deliberately checks the scheduler's own execution
 * health rather than the definitions file's content timestamp: ClamAV's upstream daily.cld
 * doesn't necessarily change every time the refresh job runs, so a content-age check would
 * false-fail whenever the job runs successfully but finds nothing new to download.
 */
export function assessDefinitionsFreshness({
  schedulerState,
  lastAttemptTime,
  lastAttemptFailed,
  now,
  maxAgeHours,
}) {
  const issues = [];
  if (schedulerState !== "ENABLED") {
    issues.push(`refresh schedule is ${schedulerState ?? "unknown"}, not ENABLED`);
  }
  if (lastAttemptFailed) {
    issues.push("the most recent refresh attempt failed");
  }
  const ageHours = (now.getTime() - new Date(lastAttemptTime).getTime()) / (60 * 60 * 1000);
  if (!Number.isFinite(ageHours) || ageHours > maxAgeHours) {
    issues.push(
      `the last refresh attempt was ${Number.isFinite(ageHours) ? `${ageHours.toFixed(1)}h` : "an unknown time"} ago, older than the ${maxAgeHours}h limit`
    );
  }
  if (issues.length) {
    return {
      status: RESULT_STATUS.FAIL,
      summary: `Malware-definition refresh audit failed: ${issues.join("; ")}.`,
    };
  }
  return {
    status: RESULT_STATUS.PASS,
    summary: "Malware-definition refresh schedule is enabled and its last attempt succeeded recently.",
  };
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(entryPath)));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(entryPath);
  }
  return files;
}

export async function discoverFunctionContracts(functionsSourceDirectory) {
  const functions = new Set();
  const publicInvokerFunctions = new Set();
  const secrets = new Set();
  const files = await walk(functionsSourceDirectory);

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(
      /export const\s+(\w+)\s*=\s*on(Call|Request|Schedule|TaskDispatched)\b/g
    )) {
      functions.add(match[1]);
      if (["Call", "Request"].includes(match[2])) publicInvokerFunctions.add(match[1]);
    }
    for (const match of source.matchAll(/defineSecret\(["']([^"']+)["']\)/g)) {
      secrets.add(match[1]);
    }
  }

  return {
    functions: [...functions].sort(),
    publicInvokerFunctions: [...publicInvokerFunctions].sort(),
    secrets: [...secrets].sort(),
  };
}

export function parseArguments(argv) {
  const options = {
    json: false,
    authenticated: false,
    expectedSha: undefined,
    env: undefined,
    out: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--authenticated") options.authenticated = true;
    else if (argument === "--env") options.env = argv[++index];
    else if (argument === "--expected-sha") options.expectedSha = argv[++index];
    else if (argument === "--out") options.out = argv[++index];
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }

  if (!options.help && !options.env) throw new Error("--env is required.");
  if (options.env && !["dev", "beta", "prod"].includes(options.env)) {
    throw new Error("--env must be dev, beta, or prod.");
  }
  if (options.authenticated && !process.env.SODC_DEPLOYMENT_CHECK_AUTH_TOKEN) {
    throw new Error(
      "--authenticated requires SODC_DEPLOYMENT_CHECK_AUTH_TOKEN in the environment."
    );
  }
  return options;
}

export function formatHumanReport(report) {
  const icons = { pass: "PASS", fail: "FAIL", warn: "WARN", skip: "SKIP" };
  const lines = [
    `Deployment check: ${report.environment} (${report.projectId})`,
    `Generated: ${report.generatedAt}`,
    "",
  ];
  for (const entry of report.results) {
    lines.push(`[${icons[entry.status]}] ${entry.summary}`);
    if (entry.details) lines.push(`       ${JSON.stringify(entry.details)}`);
  }
  lines.push(
    "",
    `Summary: ${report.summary.pass} passed, ${report.summary.fail} failed, ${report.summary.warn} warnings, ${report.summary.skip} skipped.`
  );
  return lines.join("\n");
}

/**
 * Prints the report (JSON or human form per options.json) and, when options.out
 * is set, also writes the JSON form to that path so it can be retained as a
 * short-lived release artifact.
 */
export async function emitReport(report, options, { log = console.log } = {}) {
  const json = JSON.stringify(report, null, 2);
  log(options.json ? json : formatHumanReport(report));
  if (options.out) {
    await writeFile(path.resolve(options.out), json);
  }
}

export function createReport(target, results) {
  const summary = { pass: 0, fail: 0, warn: 0, skip: 0 };
  for (const entry of results) summary[entry.status] += 1;
  return {
    schemaVersion: "sodc-deployment-check-report/v1",
    generatedAt: new Date().toISOString(),
    environment: target.alias,
    projectId: target.projectId,
    results: redact(results),
    summary,
  };
}
