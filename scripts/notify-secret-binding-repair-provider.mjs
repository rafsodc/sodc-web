import { execFileSync } from "node:child_process";

const TARGET = "reconcileMyCheckoutSessionOrders";
const SECRETS = ["STRIPE_SECRET", "GOV_NOTIFY_LIVE_API_KEY", "GOV_NOTIFY_TEST_API_KEY", "GOV_NOTIFY_TEAM_API_KEY"];
const MAX_PAGES = 10;
const MAX_ITEMS = 1000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const NUMERIC_VERSION = /^[1-9][0-9]*$/;

export class BindingRepairProviderError extends Error {
  constructor(code) {
    super(`Notify secret binding repair blocked: ${code}.`);
    this.name = "BindingRepairProviderError";
    this.code = code;
  }
}

function requireProvider(value, code) {
  if (!value) throw new BindingRepairProviderError(code);
}

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function defaultTokenProvider() {
  try {
    return execFileSync("gcloud", ["auth", "print-access-token"], {
      encoding: "utf8", timeout: 30_000, maxBuffer: 64 * 1024, stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new BindingRepairProviderError("provider-authentication-failed");
  }
}

async function readJson(response) {
  requireProvider(!response.headers?.get("content-length") ||
    (Number.isSafeInteger(Number(response.headers.get("content-length"))) &&
      Number(response.headers.get("content-length")) <= MAX_BODY_BYTES), "provider-response-too-large");
  requireProvider(response.body?.getReader, "invalid-provider-response");
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      requireProvider(bytes <= MAX_BODY_BYTES, "provider-response-too-large");
      chunks.push(Buffer.from(value));
    }
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requireProvider(plainObject(result), "invalid-provider-response");
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function mapBounded(values, visit) {
  let next = 0;
  const output = new Array(values.length);
  await Promise.all(Array.from({ length: Math.min(8, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      output[index] = await visit(values[index]);
    }
  }));
  return output;
}

// This provider exposes only the exact repair PATCH plus bounded metadata GETs.
// It does not read application dotenv, Secret Manager payloads, or mutate IAM.
// It intentionally never retries a PATCH, including when the response is lost.
export function createBindingRepairProvider({ projectId, region, tokenProvider = defaultTokenProvider,
  fetchImpl = globalThis.fetch } = {}) {
  requireProvider(typeof projectId === "string" && /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId), "invalid-provider-project");
  requireProvider(typeof region === "string" && /^[a-z]+(?:-[a-z0-9]+)+[0-9]$/.test(region), "invalid-provider-region");
  requireProvider(typeof tokenProvider === "function" && typeof fetchImpl === "function", "invalid-provider-dependency");
  const prefix = `projects/${projectId}/locations/${region}`;
  const targetName = `${prefix}/functions/${TARGET}`;
  let projectNumber;
  let defaultToken;
  let defaultTokenExpires = 0;

  async function request(host, resource, { method = "GET", body } = {}) {
    // URLs are constructed solely by the allowlisted methods below; no arbitrary URL enters here.
    try {
      // The default gcloud token is held only in this closure and refreshed long
      // before expiry. Injected providers remain responsible for their own cache.
      if (tokenProvider === defaultTokenProvider && Date.now() >= defaultTokenExpires) {
        defaultToken = defaultTokenProvider();
        defaultTokenExpires = Date.now() + 60_000;
      }
      const token = tokenProvider === defaultTokenProvider ? defaultToken : await tokenProvider();
      requireProvider(typeof token === "string" && /^[^\s]+$/.test(token) && token.length <= 16_384, "provider-authentication-failed");
      const response = await fetchImpl(`https://${host}${resource}`, {
        method, redirect: "error", headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": projectId,
          ...(body ? { "Content-Type": "application/json" } : {}) },
        signal: AbortSignal.timeout(30_000), ...(body ? { body: JSON.stringify(body) } : {}),
      });
      requireProvider(response.ok, method === "PATCH" ? "provider-patch-response-uncertain" : "provider-metadata-read-failed");
      return await readJson(response);
    } catch (error) {
      // Never include response bodies, bearer tokens, CLI stderr, or provider messages.
      if (error instanceof BindingRepairProviderError) throw error;
      throw new BindingRepairProviderError(method === "PATCH" ? "provider-patch-response-uncertain" : "provider-metadata-read-failed");
    }
  }

  async function list(host, resource, key) {
    const output = [];
    const seenTokens = new Set();
    let pageToken;
    for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber++) {
      const suffix = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
      const page = await request(host, `${resource}${suffix}`);
      requireProvider(Array.isArray(page[key] ?? []) &&
        (page.unreachable === undefined || (Array.isArray(page.unreachable) && page.unreachable.length === 0)), "incomplete-provider-list");
      output.push(...(page[key] ?? []));
      requireProvider(output.length <= MAX_ITEMS, "provider-list-limit-exceeded");
      pageToken = page.nextPageToken;
      if (pageToken === undefined || pageToken === "") return output;
      requireProvider(typeof pageToken === "string" && pageToken.length <= 4096 && !seenTokens.has(pageToken), "invalid-provider-pagination");
      seenTokens.add(pageToken);
    }
    throw new BindingRepairProviderError("provider-pagination-limit-exceeded");
  }

  function sameProject(value) {
    return value === projectId || (projectNumber !== undefined && value === projectNumber);
  }

  function inventoryNames(items, resourceType, namePattern) {
    const seen = new Set();
    for (const item of items) {
      const start = `${prefix}/${resourceType}/`;
      requireProvider(plainObject(item) && typeof item.name === "string" && item.name.startsWith(start) &&
        namePattern.test(item.name.slice(start.length)) && !seen.has(item.name), "invalid-provider-inventory");
      seen.add(item.name);
    }
  }

  function runServicePath(service) {
    requireProvider(typeof service === "string", "invalid-cloud-run-service");
    const match = /^projects\/([^/]+)\/locations\/([^/]+)\/services\/([a-z0-9][a-z0-9-]*)$/.exec(service);
    requireProvider(match && sameProject(match[1]) && match[2] === region, "invalid-cloud-run-service");
    return `/v1/${service}:getIamPolicy?options.requestedPolicyVersion=3`;
  }

  function selectedSecretVersions(functions) {
    return Object.fromEntries(SECRETS.map((secret) => {
      const versions = new Set();
      for (const fn of functions) {
        const bindings = fn.serviceConfig?.secretEnvironmentVariables ?? [];
        requireProvider(Array.isArray(bindings), "invalid-provider-secret-bindings");
        for (const binding of bindings) {
          if (binding?.secret !== secret && binding?.key !== secret) continue;
          requireProvider(plainObject(binding) && binding.key === secret && binding.secret === secret &&
            sameProject(binding.projectId) && typeof binding.version === "string" && NUMERIC_VERSION.test(binding.version),
          "invalid-provider-secret-reference");
          versions.add(binding.version);
        }
      }
      requireProvider(versions.size === 1, "missing-or-ambiguous-secret-version");
      return [secret, [...versions][0]];
    }));
  }

  return {
    async snapshot() {
      const project = await request("cloudresourcemanager.googleapis.com", `/v1/projects/${projectId}`);
      requireProvider(project.projectId === projectId && typeof project.projectNumber === "string" &&
        NUMERIC_VERSION.test(project.projectNumber), "provider-project-mismatch");
      projectNumber = project.projectNumber;
      const [functions, schedulers] = await Promise.all([
        list("cloudfunctions.googleapis.com", `/v2/${prefix}/functions?pageSize=1000`, "functions"),
        list("cloudscheduler.googleapis.com", `/v1/${prefix}/jobs?pageSize=500`, "jobs"),
      ]);
      inventoryNames(functions, "functions", /^[A-Za-z][A-Za-z0-9_-]*$/);
      inventoryNames(schedulers, "jobs", /^[A-Za-z0-9_-]+$/);
      const versions = selectedSecretVersions(functions);
      const invokerEntries = await mapBounded(functions, async (fn) => [fn.name.split("/").at(-1),
        await request("run.googleapis.com", runServicePath(fn.serviceConfig?.service))]);
      const secretEntries = await mapBounded(SECRETS, async (secret) => {
        const resource = `/v1/projects/${projectId}/secrets/${secret}`;
        const [numeric, latest, policy] = await Promise.all([
          request("secretmanager.googleapis.com", `${resource}/versions/${versions[secret]}`),
          request("secretmanager.googleapis.com", `${resource}/versions/latest`),
          request("secretmanager.googleapis.com", `${resource}:getIamPolicy?options.requestedPolicyVersion=3`),
        ]);
        return [secret, { numeric, latest, policy }];
      });
      return { project: { projectId, projectNumber }, functions, schedulers,
        invokerPolicies: Object.fromEntries(invokerEntries),
        secretVersions: Object.fromEntries(secretEntries.map(([secret, { numeric, latest }]) => [secret, { numeric, latest }])),
        secretPolicies: Object.fromEntries(secretEntries.map(([secret, { policy }]) => [secret, policy])) };
    },

    async patchBindings({ name, bindings } = {}) {
      requireProvider(name === targetName, "invalid-repair-target");
      requireProvider(Array.isArray(bindings) && bindings.length === SECRETS.length &&
        new Set(bindings.map((binding) => binding?.key)).size === SECRETS.length, "invalid-repair-bindings");
      for (const binding of bindings) {
        requireProvider(plainObject(binding) && Object.keys(binding).sort().join(",") === "key,projectId,secret,version" &&
          SECRETS.includes(binding.key) && binding.secret === binding.key && sameProject(binding.projectId) &&
          typeof binding.version === "string" && NUMERIC_VERSION.test(binding.version), "invalid-repair-bindings");
      }
      // Capture the reviewed values before authentication or network waits. A
      // caller retaining its input object cannot alter the eventual PATCH body.
      const intended = bindings.map(({ key, projectId: secretProjectId, secret, version }) =>
        ({ key, projectId: secretProjectId, secret, version }));
      return request("cloudfunctions.googleapis.com", `/v2/${name}?updateMask=serviceConfig.secretEnvironmentVariables`, {
        method: "PATCH", body: { name, serviceConfig: { secretEnvironmentVariables: intended } },
      });
    },

    async operation(name) {
      requireProvider(typeof name === "string" && name.startsWith(`${prefix}/operations/`) &&
        /^[A-Za-z0-9_-]+$/.test(name.slice(`${prefix}/operations/`.length)), "invalid-repair-operation");
      return request("cloudfunctions.googleapis.com", `/v2/${name}`);
    },
  };
}
