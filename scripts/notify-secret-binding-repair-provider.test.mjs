import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { createBindingRepairProvider } from "./notify-secret-binding-repair-provider.mjs";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

const projectId = "sodc-web";
const projectNumber = "123456789";
const region = "europe-west2";
const prefix = `projects/${projectId}/locations/${region}`;
const target = `${prefix}/functions/reconcileMyCheckoutSessionOrders`;
const operationName = `${prefix}/operations/repair-123`;
const secrets = ["STRIPE_SECRET", "GOV_NOTIFY_LIVE_API_KEY", "GOV_NOTIFY_TEST_API_KEY", "GOV_NOTIFY_TEAM_API_KEY"];
const binding = (secret, version = "2") => ({ key: secret, projectId, secret, version });
const bindings = () => secrets.map((secret) => binding(secret));
const functionRecord = (name, secretBindings = []) => ({ name: `${prefix}/functions/${name}`, state: "ACTIVE",
  buildConfig: { runtime: "nodejs24", environmentVariables: { INTERNAL_VALUE: "PRIVATE_ENV_VALUE" } },
  serviceConfig: { service: `${prefix}/services/${name.toLowerCase()}`, secretEnvironmentVariables: secretBindings } });

function fixture({ count = 85, modify, fetchOverride, tokenProvider } = {}) {
  const functions = [functionRecord("reconcileMyCheckoutSessionOrders", [binding("STRIPE_SECRET")]),
    functionRecord("existingSender", bindings()),
    ...Array.from({ length: Math.max(0, count - 2) }, (_, index) => functionRecord(`function${index}`))];
  const schedulers = Array.from({ length: 5 }, (_, index) => ({ name: `${prefix}/jobs/job-${index}`, state: "ENABLED" }));
  const input = { project: { projectId, projectNumber }, functions, schedulers };
  modify?.(input);
  const routes = (url, options) => {
    if (url === `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`) return input.project;
    if (url === `https://cloudfunctions.googleapis.com/v2/${prefix}/functions?pageSize=1000`) return { functions: input.functions };
    if (url === `https://cloudscheduler.googleapis.com/v1/${prefix}/jobs?pageSize=500`) return { jobs: input.schedulers };
    if (url.startsWith(`https://run.googleapis.com/v1/${prefix}/services/`) && url.endsWith(":getIamPolicy?options.requestedPolicyVersion=3")) {
      return { version: 3, etag: "policy-etag", bindings: [{ role: "roles/run.invoker", members: ["allUsers"] }] };
    }
    const secret = secrets.find((name) => url.startsWith(`https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${name}`));
    if (secret && url.endsWith(":getIamPolicy?options.requestedPolicyVersion=3")) return { version: 3, bindings: [] };
    if (secret && /\/versions\/(2|latest)$/.test(url)) return { name: `projects/${projectNumber}/secrets/${secret}/versions/2`, state: "ENABLED" };
    if (url === `https://cloudfunctions.googleapis.com/v2/${target}?updateMask=serviceConfig.secretEnvironmentVariables` && options.method === "PATCH") {
      return { name: operationName, done: false, metadata: { target } };
    }
    if (url === `https://cloudfunctions.googleapis.com/v2/${operationName}`) return { name: operationName, done: true, response: { name: target } };
    throw new Error("Unexpected route in offline provider test");
  };
  const fetchImpl = vi.fn(async (url, options) => {
    const custom = await fetchOverride?.(url, options, routes);
    return custom instanceof Response ? custom : Response.json(custom ?? routes(url, options));
  });
  const token = tokenProvider ?? vi.fn(async () => "PRIVATE_TOKEN");
  return { ...input, routes, fetchImpl, tokenProvider: token,
    provider: createBindingRepairProvider({ projectId, region, tokenProvider: token, fetchImpl }) };
}

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("Notify secret binding repair metadata provider", () => {
  it("reads all 85 Functions, all 5 jobs, every invoker policy and only four secrets' metadata", async () => {
    const f = fixture();
    const result = await f.provider.snapshot();
    expect(result.project).toEqual({ projectId, projectNumber });
    expect(result.functions).toEqual(f.functions);
    expect(result.schedulers).toEqual(f.schedulers);
    expect(Object.keys(result.invokerPolicies)).toHaveLength(85);
    expect(Object.keys(result.secretVersions)).toEqual(secrets);
    expect(Object.keys(result.secretPolicies)).toEqual(secrets);
    for (const name of secrets) {
      expect(result.secretVersions[name]).toEqual({ numeric: { name: `projects/${projectNumber}/secrets/${name}/versions/2`, state: "ENABLED" },
        latest: { name: `projects/${projectNumber}/secrets/${name}/versions/2`, state: "ENABLED" } });
    }
    expect(f.fetchImpl).toHaveBeenCalledTimes(100); // project + two lists + 85 IAM + twelve secret metadata reads
    for (const [url, options] of f.fetchImpl.mock.calls) {
      expect(options).toMatchObject({ method: "GET", redirect: "error", headers: {
        Authorization: "Bearer PRIVATE_TOKEN", "x-goog-user-project": projectId } });
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(options.body).toBeUndefined();
      expect(url).not.toMatch(/:access|:setIamPolicy|notify\.gov|executeGraphql|\.env/);
      if (url.includes(":getIamPolicy")) expect(url).toContain("options.requestedPolicyVersion=3");
    }
  });

  it("is lazy about default gcloud authentication and keeps the token in memory during a snapshot", async () => {
    const f = fixture({ count: 2 });
    execFileSync.mockReturnValue("PRIVATE_TOKEN\n");
    const provider = createBindingRepairProvider({ projectId, region, fetchImpl: f.fetchImpl });
    expect(execFileSync).not.toHaveBeenCalled();
    await provider.snapshot();
    expect(execFileSync).toHaveBeenCalledExactlyOnceWith("gcloud", ["auth", "print-access-token"], {
      encoding: "utf8", timeout: 30_000, maxBuffer: 64 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    expect(JSON.stringify(provider)).not.toContain("PRIVATE_TOKEN");
  });

  it.each(["functions", "schedulers"])("reads every %s page and safely encodes page tokens", async (kind) => {
    const records = kind === "functions" ? [functionRecord("reconcileMyCheckoutSessionOrders", [binding("STRIPE_SECRET")]), functionRecord("existingSender", bindings())]
      : [{ name: `${prefix}/jobs/a` }, { name: `${prefix}/jobs/b` }];
    const key = kind === "functions" ? "functions" : "jobs";
    const endpoint = kind === "functions" ? "/functions?pageSize=1000" : "/jobs?pageSize=500";
    const f = fixture({ count: 2, fetchOverride: (url) => {
      if (!url.includes(endpoint)) return undefined;
      return url.endsWith("pageToken=one%2F%26%3F%23%2B") ? { [key]: [records[1]] } : { [key]: [records[0]], nextPageToken: "one/&?#+" };
    } });
    const result = await f.provider.snapshot();
    expect(result[kind]).toEqual(records);
    expect(f.fetchImpl.mock.calls.filter(([url]) => url.includes(endpoint))).toHaveLength(2);
  });

  it.each(["functions", "jobs"])("rejects repeated tokens, malformed tokens, unreachable and non-array %s pages", async (key) => {
    for (const response of [{ [key]: [], nextPageToken: "repeat" }, { [key]: [], nextPageToken: 7 },
      { [key]: [], nextPageToken: null }, { [key]: [], unreachable: ["location"] }, { [key]: [], unreachable: "location" }, { [key]: {} }]) {
      const f = fixture({ fetchOverride: (url) => url.includes(`/${key}?`) ? response : undefined });
      await expect(f.provider.snapshot()).rejects.toThrow(/invalid-provider-pagination|incomplete-provider-list/);
      expect(f.fetchImpl.mock.calls.filter(([, options]) => options.method !== "GET")).toEqual([]);
    }
  });

  it("bounds both page count and total inventory size", async () => {
    let page = 0;
    const manyPages = fixture({ fetchOverride: (url) => url.includes("/functions?") ? { functions: [], nextPageToken: `page${++page}` } : undefined });
    await expect(manyPages.provider.snapshot()).rejects.toThrow("provider-pagination-limit-exceeded");
    expect(page).toBe(10);
    const manyItems = fixture({ fetchOverride: (url) => url.includes("/functions?") ? { functions: Array(1001).fill({}) } : undefined });
    await expect(manyItems.provider.snapshot()).rejects.toThrow("provider-list-limit-exceeded");
  });

  it.each([
    (f) => { f.project.projectId = "other-project"; },
    (f) => { f.project.projectNumber = 123; },
    (f) => { f.functions[0].name = "projects/other-project/locations/europe-west2/functions/a"; },
    (f) => { f.functions[0].name = `${prefix}/functions/a/../../other`; },
    (f) => { f.functions.push(f.functions[0]); },
    (f) => { f.schedulers[0].name = `${prefix}/jobs/a?x=y`; },
    (f) => { f.schedulers.push(f.schedulers[0]); },
    (f) => { f.functions[0].serviceConfig.service = "projects/other-project/locations/europe-west2/services/a"; },
    (f) => { f.functions[0].serviceConfig.service = `projects/${projectId}/locations/us-central1/services/a`; },
    (f) => { f.functions[0].serviceConfig.service = `${prefix}/services/a:getIamPolicy?injected=true`; },
    (f) => { delete f.functions[0].serviceConfig.service; },
  ])("fails closed for a malformed or out-of-scope project, inventory, or service", async (modify) => {
    const f = fixture({ count: 2, modify });
    await expect(f.provider.snapshot()).rejects.toThrow(/provider-project-mismatch|invalid-provider-inventory|invalid-cloud-run-service/);
    expect(f.fetchImpl.mock.calls.every(([url]) => !url.includes("other-project") && !url.includes("us-central1"))).toBe(true);
  });

  it("accepts service and secret references using the verified project number", async () => {
    const f = fixture({ count: 2, modify: ({ functions }) => {
      functions[0].serviceConfig.service = `projects/${projectNumber}/locations/${region}/services/reconcile`;
      for (const fn of functions) for (const ref of fn.serviceConfig.secretEnvironmentVariables) ref.projectId = projectNumber;
    }, fetchOverride: (url) => url.startsWith(`https://run.googleapis.com/v1/projects/${projectNumber}/`) ? { version: 3, bindings: [] } : undefined });
    await expect(f.provider.snapshot()).resolves.toHaveProperty("project.projectNumber", projectNumber);
  });

  it.each(["latest", "0", "02", "-1", 2, "2/access", undefined])("rejects an unpinned or invalid globally bound version (%j)", async (version) => {
    const f = fixture({ count: 2, modify: ({ functions }) => { functions[1].serviceConfig.secretEnvironmentVariables[1].version = version; } });
    await expect(f.provider.snapshot()).rejects.toThrow("invalid-provider-secret-reference");
    expect(f.fetchImpl.mock.calls.some(([url]) => url.includes("secretmanager"))).toBe(false);
  });

  it.each([
    (f) => { f.functions[1].serviceConfig.secretEnvironmentVariables.pop(); },
    (f) => { f.functions[0].serviceConfig.secretEnvironmentVariables.push(binding("GOV_NOTIFY_LIVE_API_KEY", "3")); },
    (f) => { f.functions[1].serviceConfig.secretEnvironmentVariables[1].projectId = "other-project"; },
    (f) => { f.functions[1].serviceConfig.secretEnvironmentVariables[1].key = "UNEXPECTED"; },
    (f) => { f.functions[1].serviceConfig.secretEnvironmentVariables[1].secret = "OTHER_SECRET"; },
    (f) => { f.functions[1].serviceConfig.secretEnvironmentVariables = {}; },
  ])("rejects absent, mixed, foreign or malformed secret references before secret reads", async (modify) => {
    const f = fixture({ count: 2, modify });
    await expect(f.provider.snapshot()).rejects.toThrow(/missing-or-ambiguous-secret-version|invalid-provider-secret-reference|invalid-provider-secret-bindings/);
    expect(f.fetchImpl.mock.calls.some(([url]) => url.includes("secretmanager"))).toBe(false);
  });

  it.each([
    () => { throw new Error("PRIVATE_BODY PRIVATE_TOKEN"); },
    () => new Response("PRIVATE_BODY", { status: 403 }),
    () => new Response("PRIVATE_BODY", { status: 200 }),
    () => Response.json(["PRIVATE_BODY"]),
  ])("sanitizes network, HTTP, JSON and shape failures without retrying", async (failure) => {
    const f = fixture({ fetchOverride: failure });
    await expect(f.provider.snapshot()).rejects.toThrow(/^Notify secret binding repair blocked: (provider-metadata-read-failed|invalid-provider-response)\.$/);
    expect(f.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("bounds metadata response bytes before reading or while streaming", async () => {
    const header = fixture({ fetchOverride: () => new Response("PRIVATE_BODY", { headers: { "content-length": String(6 * 1024 * 1024) } }) });
    await expect(header.provider.snapshot()).rejects.toThrow("provider-response-too-large");
    const streamed = fixture({ fetchOverride: () => new Response(new Uint8Array(5 * 1024 * 1024 + 1)) });
    await expect(streamed.provider.snapshot()).rejects.toThrow("provider-response-too-large");
  });

  it("sanitizes token provider failures before any network call", async () => {
    const f = fixture({ tokenProvider: async () => { throw new Error("PRIVATE_TOKEN"); } });
    await expect(f.provider.snapshot()).rejects.toThrow(/^Notify secret binding repair blocked: provider-metadata-read-failed\.$/);
    expect(f.fetchImpl).not.toHaveBeenCalled();
    execFileSync.mockImplementation(() => { throw new Error("PRIVATE_CLI_STDERR"); });
    const provider = createBindingRepairProvider({ projectId, region, fetchImpl: f.fetchImpl });
    await expect(provider.snapshot()).rejects.toThrow(/^Notify secret binding repair blocked: provider-authentication-failed\.$/);
  });
});

describe("Notify secret binding repair mutation and operation boundaries", () => {
  it("sends exactly one narrowly masked PATCH with the complete binding list and no other Function fields", async () => {
    const f = fixture();
    const intended = bindings();
    await expect(f.provider.patchBindings({ name: target, bindings: intended })).resolves.toEqual({ name: operationName, done: false, metadata: { target } });
    expect(f.fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = f.fetchImpl.mock.calls[0];
    expect(url).toBe(`https://cloudfunctions.googleapis.com/v2/${target}?updateMask=serviceConfig.secretEnvironmentVariables`);
    expect(options).toMatchObject({ method: "PATCH", redirect: "error", headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(options.body)).toEqual({ name: target, serviceConfig: { secretEnvironmentVariables: intended } });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.body).not.toMatch(/buildConfig|environmentVariables|serviceAccountEmail|updateTime|etag|requestId/);
  });

  it("captures the validated binding list before an asynchronous authentication wait", async () => {
    let release;
    const token = new Promise((resolve) => { release = resolve; });
    const f = fixture({ tokenProvider: () => token });
    const intended = bindings();
    const expected = structuredClone(intended);
    const pending = f.provider.patchBindings({ name: target, bindings: intended });
    intended[1].version = "latest";
    intended.pop();
    release("PRIVATE_TOKEN");
    await pending;
    expect(JSON.parse(f.fetchImpl.mock.calls[0][1].body).serviceConfig.secretEnvironmentVariables).toEqual(expected);
  });

  it.each(["another", `${target}/extra`, target.replace(projectId, "other-project"), target.replace(region, "us-central1"), undefined])(
    "rejects any target other than the single reviewed callable (%s)", async (name) => {
      const f = fixture();
      await expect(f.provider.patchBindings({ name, bindings: bindings() })).rejects.toThrow("invalid-repair-target");
      expect(f.fetchImpl).not.toHaveBeenCalled();
    });

  it.each([
    (b) => b.slice(1),
    (b) => [...b, binding("UNRELATED")],
    (b) => [b[0], b[0], b[2], b[3]],
    (b) => { b[1].version = "latest"; return b; },
    (b) => { b[1].version = 2; return b; },
    (b) => { b[1].projectId = "other-project"; return b; },
    (b) => { b[1].secret = "OTHER_SECRET"; return b; },
    (b) => { b[1].extra = "PRIVATE_VALUE"; return b; },
    (b) => { delete b[1].projectId; return b; },
    () => undefined,
    () => [null, null, null, null],
  ])("rejects incomplete, duplicate, foreign, unpinned or extended binding requests before HTTP", async (modify) => {
    const f = fixture();
    await expect(f.provider.patchBindings({ name: target, bindings: modify(bindings()) })).rejects.toThrow("invalid-repair-bindings");
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    () => { throw new Error("PRIVATE_PATCH_RESPONSE"); },
    () => new Response("PRIVATE_PATCH_RESPONSE", { status: 500 }),
    () => new Response("PRIVATE_PATCH_RESPONSE", { status: 200 }),
  ])("never retries an uncertain PATCH or falls back to another deploy/IAM API", async (failure) => {
    const f = fixture({ fetchOverride: failure });
    await expect(f.provider.patchBindings({ name: target, bindings: bindings() })).rejects.toThrow(/^Notify secret binding repair blocked: provider-patch-response-uncertain\.$/);
    expect(f.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("polls only the exact project's and region's Operation resource with GET", async () => {
    const f = fixture();
    await expect(f.provider.operation(operationName)).resolves.toMatchObject({ name: operationName, done: true });
    expect(f.fetchImpl).toHaveBeenCalledExactlyOnceWith(`https://cloudfunctions.googleapis.com/v2/${operationName}`, expect.objectContaining({ method: "GET", redirect: "error" }));
  });

  it.each([operationName.replace(projectId, "other-project"), operationName.replace(region, "us-central1"), `${operationName}:cancel`,
    `${operationName}/extra`, `${operationName}?token=PRIVATE`, `${prefix}/operations/../functions/a`, undefined, ""]) (
    "rejects foreign or malformed operation resources before HTTP (%s)", async (name) => {
      const f = fixture();
      await expect(f.provider.operation(name)).rejects.toThrow("invalid-repair-operation");
      expect(f.fetchImpl).not.toHaveBeenCalled();
    });

  it.each([
    { projectId: "sodc-web/../../foreign", region }, { projectId: "SODC-WEB", region },
    { projectId, region: "europe-west2/../../other" }, { projectId, region: "" },
    { projectId, region, tokenProvider: "token" }, { projectId, region, fetchImpl: "fetch" },
  ])("rejects invalid provider dependencies and resource scopes", (options) => {
    expect(() => createBindingRepairProvider(options)).toThrow(/invalid-provider/);
  });
});
