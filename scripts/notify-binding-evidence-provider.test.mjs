import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {execFileSync} from "node:child_process";
import {BindingEvidenceProviderError, createBindingEvidenceProvider} from "./notify-binding-evidence-provider.mjs";

vi.mock("node:child_process", () => ({execFileSync: vi.fn()}));
const projectId = "sodc-web", projectNumber = "123456789", region = "europe-west2";
const target = "reconcileMyCheckoutSessionOrders", service = target.toLowerCase();
const prefix = `projects/${projectId}/locations/${region}`;
const serviceName = `${prefix}/services/${service}`;
const currentRevision = `${service}-00110-new`, previousRevision = `${service}-00109-old`;
const buildId = "11111111-2222-3333-4444-555555555555", otherBuildId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const buildName = `projects/${projectNumber}/locations/${region}/builds/${buildId}`;
const operationName = `${prefix}/operations/operation-fixture`;
const keys = ["STRIPE_SECRET", "GOV_NOTIFY_LIVE_API_KEY", "GOV_NOTIFY_TEAM_API_KEY", "GOV_NOTIFY_TEST_API_KEY"];
const storage = {bucket: `gcf-v2-sources-${projectNumber}-${region}`, object: `${target}/function-source.zip`, generation: "123456"};
const sourceUri = `gs://${storage.bucket}/${storage.object}`;
const image = `${region}-docker.pkg.dev/${projectId}/gcf-artifacts/function@sha256:${"a".repeat(64)}`;
const sha = Buffer.alloc(32, 7).toString("base64");
const clone = value => structuredClone(value);
const json = value => Response.json(value);

function fixture({fetchOverride, tokenProvider, defaults = false} = {}) {
  const targetFunction = {name: `${prefix}/functions/${target}`, buildConfig: {build: buildName, source: {storageSource: clone(storage)},
    environmentVariables: {PRIVATE_ENV: "PRIVATE_FUNCTION_ENV"}}, serviceConfig: {service: serviceName, revision: currentRevision,
    secretEnvironmentVariables: keys.map(key => ({key, secret: key, projectId, version: "1"}))}};
  const second = {name: `${prefix}/functions/existingSender`, serviceConfig: {service: `${prefix}/services/existingsender`, secretEnvironmentVariables: []}};
  const data = {project: {projectId, projectNumber}, functions: [targetFunction, second], schedulers: [{name: `${prefix}/jobs/fixture`, state: "ENABLED"}],
    operation: {name: operationName, done: true, metadata: {target: targetFunction.name, verb: "update", buildName,
      requestResource: {PRIVATE_OPERATION_REQUEST: "PRIVATE_OPERATION_REQUEST"}, sourceToken: "PRIVATE_SOURCE_TOKEN"},
      response: {PRIVATE_OPERATION_RESPONSE: "PRIVATE_OPERATION_RESPONSE"}},
    revision: {createTime: "2026-11-18T14:33:00Z", annotations: {"run.googleapis.com/build-id": buildId,
      "run.googleapis.com/build-function-target": target, "run.googleapis.com/build-source-location": `${sourceUri}#${storage.generation}`,
      "PRIVATE_ANNOTATION": "PRIVATE_ANNOTATION", "run.googleapis.com/build-name": "PRIVATE_SERVICE_ONLY_ANNOTATION"},
      containers: [{name: "worker", image, env: [{name: "PRIVATE_ENV", value: "PRIVATE_CONTAINER_ENV"}]}]},
    build: {name: buildName, id: buildId, status: "SUCCESS", createTime: "2026-11-18T14:31:00Z", startTime: "2026-11-18T14:31:01Z",
      finishTime: "2026-11-18T14:32:00Z", source: {storageSource: clone(storage)},
      sourceProvenance: {resolvedStorageSource: clone(storage), fileHashes: {[`${sourceUri}#${storage.generation}`]: {fileHash: [{type: "SHA256", value: sha}]}}},
      results: {images: [{name: image, digest: `sha256:${"a".repeat(64)}`}]}, steps: [{env: ["PRIVATE_BUILD_ENV"]}],
      substitutions: {PRIVATE_SUBSTITUTION: "PRIVATE_SUBSTITUTION"}, secrets: ["PRIVATE_BUILD_SECRET"], logUrl: "PRIVATE_LOG_URL"},
    object: {...storage, name: storage.object, size: "100", md5Hash: Buffer.alloc(16, 1).toString("base64"), crc32c: Buffer.alloc(4, 2).toString("base64"),
      metadata: {PRIVATE_CUSTOM_METADATA: "PRIVATE_CUSTOM_METADATA"}, mediaLink: "PRIVATE_SOURCE_DOWNLOAD", owner: {email: "private-owner@example.invalid"}}};
  const routes = url => {
    if (url === `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`) return data.project;
    if (url === `https://cloudfunctions.googleapis.com/v2/${prefix}/functions?pageSize=1000`) return {functions: data.functions};
    if (url === `https://cloudscheduler.googleapis.com/v1/${prefix}/jobs?pageSize=500`) return {jobs: data.schedulers};
    if (url.includes("run.googleapis.com/v1/") && url.endsWith(":getIamPolicy?options.requestedPolicyVersion=3")) return {version: 3, bindings: []};
    const key = keys.find(name => url.startsWith(`https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${name}`));
    if (key && url.endsWith(":getIamPolicy?options.requestedPolicyVersion=3")) return {version: 3, bindings: []};
    if (key && /\/versions\/(1|latest)$/.test(url)) return {name: `projects/${projectNumber}/secrets/${key}/versions/1`, state: "ENABLED"};
    if (url === `https://cloudfunctions.googleapis.com/v2/${operationName}`) return data.operation;
    if (url.startsWith(`https://run.googleapis.com/v2/${serviceName}/revisions/`)) return {...clone(data.revision), name: url.slice("https://run.googleapis.com/v2/".length)};
    if (url === `https://cloudbuild.googleapis.com/v1/${buildName}`) return data.build;
    if (url.startsWith(`https://storage.googleapis.com/storage/v1/b/${storage.bucket}/o/`)) return data.object;
    throw new Error("Unexpected offline route");
  };
  const fetchImpl = vi.fn(async (url, options) => {
    expect(options.method).toBe("GET");
    const value = await fetchOverride?.(url, options, data);
    return value instanceof Response ? value : json(value ?? routes(url));
  });
  const auth = tokenProvider ?? vi.fn(async () => "PRIVATE_TOKEN");
  const provider = createBindingEvidenceProvider({projectId, region, fetchImpl, ...(defaults ? {} : {tokenProvider: auth})});
  const load = async () => {const snapshot = await provider.snapshot(); const operation = await provider.operation(operationName); fetchImpl.mockClear();
    return {snapshot, operation, read: extra => provider.provenance({snapshot, operation, previousRevision, ...extra})};};
  return {data, fetchImpl, provider, load, tokenProvider: auth};
}

beforeEach(() => {vi.stubGlobal("fetch", vi.fn(() => {throw new Error("Unexpected real network");}));});
afterEach(() => {expect(globalThis.fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals();});

describe("GET-only evidence provider boundary", () => {
  it("exposes no mutation methods and delegates the bounded inventory via GET only", async () => {
    const f = fixture();
    expect(Object.keys(f.provider).sort()).toEqual(["operation", "provenance", "snapshot"]);
    expect(f.provider.patchBindings).toBeUndefined();
    const snapshot = await f.provider.snapshot();
    expect(snapshot.project).toEqual(f.data.project);
    expect(snapshot.functions).toEqual(f.data.functions);
    expect(f.fetchImpl.mock.calls.every(([url, options]) => options.method === "GET" && !options.body && !/:access|generateDownloadUrl|generateUploadUrl|setIamPolicy|:cancel/.test(url))).toBe(true);
  });

  it("holds default gcloud authentication only in a lazy memory cache", async () => {
    execFileSync.mockReturnValue("PRIVATE_TOKEN\n");
    const f = fixture({defaults: true}); expect(execFileSync).not.toHaveBeenCalled();
    const current = await f.load(); await current.read();
    expect(execFileSync).toHaveBeenCalledExactlyOnceWith("gcloud", ["auth", "print-access-token"], expect.objectContaining({stdio: ["ignore", "pipe", "pipe"], timeout: 30_000}));
    expect(JSON.stringify(f.provider)).not.toContain("PRIVATE_TOKEN");
  });

  it("sanitizes default authentication failures before network access", async () => {
    execFileSync.mockImplementation(() => {throw new Error("PRIVATE_CLI_STDERR");});
    const f = fixture({defaults: true});
    await expect(f.provider.snapshot()).rejects.toThrow(/^Notify binding evidence blocked: provider-authentication-failed\.$/);
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });

  it("projects only bounded operation identity, scope, build and numeric error code", async () => {
    const f = fixture(); await f.provider.snapshot();
    f.data.operation.error = {code: 7, message: "PRIVATE_OPERATION_ERROR", details: ["PRIVATE_DETAILS"]};
    expect(await f.provider.operation(operationName)).toEqual({name: operationName, done: true,
      metadata: {target: `${prefix}/functions/${target}`, verb: "update", buildName}, error: {code: 7}});
    expect(f.fetchImpl.mock.calls.at(-1)[1]).toMatchObject({method: "GET", redirect: "error"});
  });

  it.each(["provenance", "operation"])("requires a verified snapshot before %s", async method => {
    const f = fixture();
    await expect(method === "operation" ? f.provider.operation(operationName) : f.provider.provenance({snapshot: {project: f.data.project}}))
      .rejects.toThrow("verified-snapshot-required");
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    {projectId: "sodc-web-beta", region}, {projectId: "foreign-project", region}, {projectId, region: "us-central1"},
    {projectId: `${projectId}/../foreign`, region}, {projectId, region, tokenProvider: "PRIVATE_TOKEN"}, {projectId, region, fetchImpl: "fetch"},
  ])("rejects unsupported provider scope/dependencies without I/O", options => {
    expect(() => createBindingEvidenceProvider(options)).toThrow(BindingEvidenceProviderError);
  });

  it.each([operationName.replace(projectId, "foreign-project"), `${operationName}:cancel`, `${operationName}?token=PRIVATE`, `${operationName}/../other`, `${operationName}${"a".repeat(512)}`, ""])(
    "rejects malformed operation references before GET (%s)", async name => {
      const f = fixture(); await f.provider.snapshot(); f.fetchImpl.mockClear();
      await expect(f.provider.operation(name)).rejects.toThrow("invalid-evidence-operation-reference"); expect(f.fetchImpl).not.toHaveBeenCalled();
    });

  it.each([
    data => {data.operation.name += "-other";}, data => {data.operation.done = "true";},
    data => {data.operation.metadata.target = `${prefix}/functions/foreign`;}, data => {data.operation.metadata.verb = "create";},
    data => {data.operation.metadata.buildName = buildName.replace(projectNumber, "987654321");},
    data => {data.operation.metadata.buildName = "https://private.invalid/?token=PRIVATE";},
    data => {delete data.operation.metadata.target;}, data => {data.operation.error = {code: "PRIVATE_ERROR"};},
  ])("fails closed on malformed or foreign operation response fields", async modify => {
    const f = fixture(); await f.provider.snapshot(); modify(f.data);
    await expect(f.provider.operation(operationName)).rejects.toThrow(/^Notify binding evidence blocked: [a-z-]+\.$/);
  });
});

describe("allowlisted rebuild provenance", () => {
  it("projects metadata, associates only the resolved archive SHA256, and emits no canary values", async () => {
    const f = fixture(); const c = await f.load(); const result = await c.read();
    expect(Object.keys(result).sort()).toEqual(["currentRevision", "functionBuild", "operationBuild", "previousRevision", "sourceObject"]);
    expect(Object.values(result).every(value => value.state === "AVAILABLE")).toBe(true);
    expect(result.currentRevision.value).toEqual({name: `${serviceName}/revisions/${currentRevision}`, createTime: "2026-11-18T14:33:00Z",
      images: [{name: "worker", image}], buildAnnotations: {"run.googleapis.com/build-id": buildId, "run.googleapis.com/build-function-target": target,
        "run.googleapis.com/build-source-location": `${sourceUri}#${storage.generation}`}});
    expect(result.functionBuild.value).toEqual({name: buildName, id: buildId, status: "SUCCESS", createTime: "2026-11-18T14:31:00Z",
      startTime: "2026-11-18T14:31:01Z", finishTime: "2026-11-18T14:32:00Z", source: storage, resolvedSource: storage,
      archiveSha256: Buffer.alloc(32, 7).toString("hex"), images: [{name: image, digest: `sha256:${"a".repeat(64)}`} ]});
    expect(result.sourceObject.value).toEqual({bucket: storage.bucket, name: storage.object, generation: storage.generation, size: "100",
      md5Hash: f.data.object.md5Hash, crc32c: f.data.object.crc32c});
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|private-owner|sourceToken|environmentVariables|substitutions|steps|logUrl|mediaLink/);
    expect(f.fetchImpl).toHaveBeenCalledTimes(4); // two revisions, one shared build, one pinned object
    for (const [url, options] of f.fetchImpl.mock.calls) {
      expect(options).toMatchObject({method: "GET", redirect: "error", headers: {Authorization: "Bearer PRIVATE_TOKEN", "x-goog-user-project": projectId}});
      expect(options.signal).toBeInstanceOf(AbortSignal); expect(options.body).toBeUndefined();
      expect(url).not.toMatch(/alt=media|generateDownloadUrl|sourceToken|:access/);
    }
    const [url] = f.fetchImpl.mock.calls.find(([value]) => value.includes("storage.googleapis.com"));
    const parsed = new URL(url); expect(parsed.searchParams.get("generation")).toBe(storage.generation);
    expect(parsed.searchParams.get("fields")).toBe("bucket,name,generation,size,md5Hash,crc32c");
    expect(parsed.pathname).toContain(encodeURIComponent(storage.object));
  });

  it("uses explicit gaps for missing/unsupported metadata instead of inventing build/source proof", async () => {
    const f = fixture(); const c = await f.load();
    delete c.snapshot.functions[0].buildConfig.build;
    c.snapshot.functions[0].buildConfig.source = {repoSource: {PRIVATE_URL: "PRIVATE"}};
    delete c.snapshot.functions[0].serviceConfig.revision;
    const result = await c.read({operation: undefined, previousRevision: undefined});
    expect(result).toEqual({currentRevision: {state: "UNAVAILABLE", reason: "current-revision-reference-missing"},
      previousRevision: {state: "NOT_REQUESTED", reason: "previous-revision-reference-missing"},
      functionBuild: {state: "UNAVAILABLE", reason: "function-build-reference-missing"},
      operationBuild: {state: "NOT_REQUESTED", reason: "operation-build-reference-missing"},
      sourceObject: {state: "UNSUPPORTED", reason: "storage-source-reference-missing-or-unsupported"}});
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });

  it("captures the observed managed-build shape with absent source/results as unknown evidence", async () => {
    const f = fixture(); const c = await f.load(); delete f.data.build.source; delete f.data.build.sourceProvenance; delete f.data.build.results;
    f.data.revision.annotations = {"cloudfunctions.googleapis.com/trigger-type": "callable"};
    const result = await c.read();
    expect(result.functionBuild).toMatchObject({state: "AVAILABLE", value: {source: null, resolvedSource: null, archiveSha256: null, images: []}});
    expect(result.currentRevision.value.buildAnnotations).toEqual({});
  });

  it("allows metadata without container names, checksums or a generation-pinned annotation without asserting identity", async () => {
    const f = fixture(); const c = await f.load(); delete f.data.revision.containers[0].name;
    f.data.revision.annotations["run.googleapis.com/build-source-location"] = sourceUri;
    delete f.data.object.md5Hash; delete f.data.object.crc32c;
    const result = await c.read();
    expect(result.currentRevision.value.images[0].name).toBeNull();
    expect(result.sourceObject.value).toMatchObject({md5Hash: null, crc32c: null});
  });

  it("pins the metadata timeout and treats mid-provenance authentication failures as a block", async () => {
    const f = fixture(); const c = await f.load(); const timeout = vi.spyOn(AbortSignal, "timeout");
    await c.read();
    expect(timeout).toHaveBeenCalledTimes(4);
    expect(timeout.mock.calls.every(([milliseconds]) => milliseconds === 30_000)).toBe(true);
    f.tokenProvider.mockRejectedValue(new Error("PRIVATE_AUTH_FAILURE")); f.fetchImpl.mockClear();
    await expect(c.read()).rejects.toThrow(/^Notify binding evidence blocked: provider-authentication-failed\.$/);
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });

  it("reports an unpinned source as unsupported and never fetches latest object data", async () => {
    const f = fixture(); const c = await f.load(); c.snapshot.functions[0].buildConfig.source.storageSource.generation = "0";
    const result = await c.read();
    expect(result.sourceObject.state).toBe("UNSUPPORTED");
    expect(f.fetchImpl.mock.calls.some(([url]) => url.includes("storage.googleapis.com"))).toBe(false);
  });

  it("allows only the exact documented upload bucket for this project number and region", async () => {
    const f = fixture(); const c = await f.load();
    const ref = c.snapshot.functions[0].buildConfig.source.storageSource;
    ref.bucket = `gcf-v2-uploads-${projectNumber}-${region}.cloudfunctions.appspot.com`; ref.object = "uploaded-source.zip";
    f.fetchImpl.mockImplementation(async (url, options) => {
      expect(options.method).toBe("GET");
      if (url.includes("storage.googleapis.com")) return json({...f.data.object, bucket: ref.bucket, name: ref.object});
      if (url.includes("cloudbuild.googleapis.com")) return json(f.data.build);
      return json({...f.data.revision, name: url.slice("https://run.googleapis.com/v2/".length)});
    });
    expect((await c.read()).sourceObject).toMatchObject({state: "AVAILABLE", value: {bucket: ref.bucket, name: "uploaded-source.zip"}});
    ref.bucket = ref.bucket.replace(`-${region}.`, `.${region}.`); f.fetchImpl.mockClear();
    await expect(c.read()).rejects.toThrow("invalid-provenance-storage-reference");
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    c => {c.snapshot.project.projectNumber = "987654321";}, c => {c.snapshot.functions.push(clone(c.snapshot.functions[0]));},
    c => {c.snapshot.functions[0].serviceConfig.service = serviceName.replace(projectId, "foreign-project");},
    c => {c.snapshot.functions[0].serviceConfig.service = `${prefix}/services/other`;},
    c => {c.snapshot.functions[0].serviceConfig.revision = `${currentRevision}/../other`;},
    c => {c.snapshot.functions[0].buildConfig.build = buildName.replace(region, "us-central1");},
    c => {c.snapshot.functions[0].buildConfig.source.storageSource.bucket = "private-foreign-bucket";},
    c => {c.snapshot.functions[0].buildConfig.source.storageSource.object = "../private.zip";},
    c => {c.snapshot.functions[0].buildConfig.source.storageSource.object = "private.env";},
    c => {c.snapshot.functions[0].buildConfig.source.storageSource.generation = "latest";},
    c => {c.snapshot.functions[0].buildConfig.source.storageSource.generation = 42;},
    c => {c.snapshot.functions[0].buildConfig.source.storageSource.generation = "1".repeat(21);},
    c => {c.snapshot.functions[0].buildConfig.source.repoSource = {url: "PRIVATE"};},
    c => {c.operation.metadata.buildName = buildName.replace(projectNumber, "987654321");},
    c => {c.operation.metadata.target = `${prefix}/functions/other`;},
  ])("validates every provenance reference before any extra HTTP", async modify => {
    const f = fixture(); const c = await f.load(); modify(c);
    await expect(c.read()).rejects.toThrow(/^Notify binding evidence blocked: [a-z-]+\.$/); expect(f.fetchImpl).not.toHaveBeenCalled();
  });

  it.each([null, "other-revision", `${previousRevision}?token=PRIVATE`])("handles absent or rejects malformed historical revisions (%j)", async previous => {
    const f = fixture(); const c = await f.load();
    if (previous === null) expect((await c.read({previousRevision: previous})).previousRevision.state).toBe("UNAVAILABLE");
    else {await expect(c.read({previousRevision: previous})).rejects.toThrow("invalid-provenance-revision-reference"); expect(f.fetchImpl).not.toHaveBeenCalled();}
  });

  it.each(["missing", "unrelated", "md5-only", "ambiguous", "wrong-generation"])("does not upgrade %s source hashes into archive SHA256", async variant => {
    const f = fixture(); const c = await f.load(); const values = f.data.build.sourceProvenance.fileHashes;
    if (variant === "missing") delete f.data.build.sourceProvenance.fileHashes;
    if (variant === "unrelated") {delete values[`${sourceUri}#${storage.generation}`]; values["gs://other-bucket/unrelated.zip#1"] = {fileHash: [{type: "SHA256", value: sha}]};}
    if (variant === "md5-only") values[`${sourceUri}#${storage.generation}`].fileHash = [{type: "MD5", value: f.data.object.md5Hash}];
    if (variant === "ambiguous") values[sourceUri] = {fileHash: [{type: "SHA256", value: Buffer.alloc(32, 8).toString("base64")}]};
    if (variant === "wrong-generation") {delete values[`${sourceUri}#${storage.generation}`]; values[`${sourceUri}#999`] = {fileHash: [{type: "SHA256", value: sha}]};}
    expect((await c.read()).functionBuild.value.archiveSha256).toBeNull();
  });

  it("accepts exactly matched unversioned hash paths only with a resolved immutable input", async () => {
    const f = fixture(); const c = await f.load(); const hashes = f.data.build.sourceProvenance.fileHashes;
    hashes[sourceUri] = hashes[`${sourceUri}#${storage.generation}`]; delete hashes[`${sourceUri}#${storage.generation}`];
    expect((await c.read()).functionBuild.value.archiveSha256).toBe(Buffer.alloc(32, 7).toString("hex"));
    delete f.data.build.sourceProvenance.resolvedStorageSource;
    expect((await c.read()).functionBuild.value.archiveSha256).toBeNull();
  });

  it.each([
    data => {data.revision.name = "foreign";}, data => {data.revision.containers[0].image = "https://private.invalid/?token=PRIVATE";},
    data => {data.revision.annotations = "PRIVATE_ANNOTATION_MAP";},
    data => {data.revision.annotations["run.googleapis.com/build-function-target"] = "other";},
    data => {data.build.id = otherBuildId;}, data => {data.build.name = buildName.replace(projectNumber, "987654321");},
    data => {data.build.sourceProvenance.fileHashes[`${sourceUri}#${storage.generation}`].fileHash[0].value = "PRIVATE";},
    data => {data.object.generation = "999";}, data => {data.object.name = "other.zip";}, data => {data.object.md5Hash = "PRIVATE";},
    data => {data.object.size = "1".repeat(21);}, data => {data.revision.createTime = "Wed, 18 Nov 2026 14:33:00 GMT (PRIVATE_COMMENT)";},
    data => {data.build.results.images[0].digest = `sha256:${"b".repeat(64)}`;},
  ])("fails closed on contradictory response identities or invalid public projections", async modify => {
    const f = fixture(); const c = await f.load(); modify(f.data);
    // Revision identity is normally built by the route; force that one field explicitly.
    if (f.data.revision.name) f.fetchImpl.mockImplementation(async (url, options) => {
      expect(options.method).toBe("GET");
      if (url.includes("run.googleapis.com/v2/")) return json(f.data.revision);
      if (url.includes("cloudbuild.googleapis.com")) return json(f.data.build);
      if (url.includes("storage.googleapis.com")) return json(f.data.object);
      throw new Error("Unexpected route");
    });
    await expect(c.read()).rejects.toThrow(/^Notify binding evidence blocked: [a-z-]+\.$/);
  });

  it.each([403, 404, 500])("records artifact HTTP %i as an explicit unavailable gap without leaking bodies or retrying", async status => {
    const f = fixture({fetchOverride: url => url.includes("run.googleapis.com/v2/") ? new Response("PRIVATE_HTTP_BODY", {status}) : undefined});
    const c = await f.load(); const value = await c.read();
    expect(value.currentRevision).toEqual({state: "UNAVAILABLE", reason: "metadata-not-readable"});
    expect(value.previousRevision).toEqual({state: "UNAVAILABLE", reason: "metadata-not-readable"});
    expect(f.fetchImpl.mock.calls.filter(([url]) => url.includes("run.googleapis.com/v2/"))).toHaveLength(2);
    expect(JSON.stringify(value)).not.toContain("PRIVATE");
  });

  it.each(["network", "json", "shape", "header-cap", "stream-cap"])("bounds/sanitizes %s artifact failures", async kind => {
    const f = fixture({fetchOverride: url => {
      if (!url.includes("run.googleapis.com/v2/")) return undefined;
      if (kind === "network") throw new Error("PRIVATE_NETWORK_ERROR");
      if (kind === "json") return new Response("PRIVATE_JSON");
      if (kind === "shape") return json(["PRIVATE_ARRAY"]);
      if (kind === "header-cap") return new Response("PRIVATE_BODY", {headers: {"content-length": String(5 * 1024 * 1024 + 1)}});
      return new Response(new Uint8Array(5 * 1024 * 1024 + 1));
    }});
    const c = await f.load(); const value = await c.read();
    expect(value.currentRevision.state).toBe("UNAVAILABLE");
    expect(value.currentRevision.reason).toBe(kind.endsWith("cap") ? "metadata-response-too-large" : "metadata-read-failed");
    expect(JSON.stringify(value)).not.toContain("PRIVATE");
  });
});
