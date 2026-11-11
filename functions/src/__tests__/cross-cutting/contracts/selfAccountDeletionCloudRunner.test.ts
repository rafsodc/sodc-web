import {beforeAll, describe, expect, it, vi} from "vitest";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {EventEmitter} from "node:events";

let gate: (env: Record<string, string | undefined>, args?: string[]) => {projectId: string; region: string; checkOnly: boolean};
let run: (env: Record<string, string | undefined>, args?: string[]) => Promise<void>;
let callableUrl: (name: string) => string;
let notStarted: (response: unknown, status: string, code?: string) => void;
let taskIdentity: (metadata: unknown) => string;
let failureCategory: (error: unknown) => string;
let hostedCall: (...args: any[]) => Promise<any>;
let knownOutcome: (body: unknown) => boolean;
let awaitOutcomes: (...args: any[]) => Promise<any>;
beforeAll(async () => {
  const runner = await import(pathToFileURL(resolve("scripts/validate-self-account-deletion-cloud.mjs")).href);
  gate = runner.validateSelfAccountDeletionEnvironment;
  run = runner.runSelfAccountDeletionValidation;
  callableUrl = runner.selfDeletionCallableUrl;
  notStarted = runner.requireNotStartedRefusal;
  taskIdentity = runner.validateSelfDeletionTaskWorker;
  failureCategory = runner.selfDeletionValidationErrorCategory;
  hostedCall = runner.requestSelfDeletionCallable;
  knownOutcome = runner.knownSelfDeletionOutcome;
  awaitOutcomes = runner.awaitSelfDeletionHostedOutcomes;
});
const safe = {RUN_SELF_ACCOUNT_DELETION_VALIDATION: "1", SELF_ACCOUNT_DELETION_PROJECT: "sodc-web", SELF_ACCOUNT_DELETION_CONFIRM: "sodc-web"};

describe("hosted self-deletion validation boundary", () => {
  it("requires all explicit fixed-Dev opt-ins before SDK or network access", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    try {
      for (const env of [{}, {...safe, RUN_SELF_ACCOUNT_DELETION_VALIDATION: ""}, {...safe, SELF_ACCOUNT_DELETION_CONFIRM: ""}]) {
        expect(() => gate(env, ["--check"])).toThrow("fixed Dev");
        await expect(run(env, ["--check"])).rejects.toThrow("fixed Dev");
      }
      expect(network).not.toHaveBeenCalled();
    } finally {network.mockRestore();}
  });
  it("checks targeting without needing SDK, ADC, an API key or network", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      expect(gate(safe, ["--check"])).toEqual({projectId: "sodc-web", region: "europe-west2", checkOnly: true});
      await expect(run(safe, ["--check"])).resolves.toBeUndefined();
      expect(network).not.toHaveBeenCalled();
    } finally {network.mockRestore(); log.mockRestore();}
  });
  it.each(["sodc-web-production", "sodc-web-beta", "demo-sodc-admin-safety", "other"])("rejects non-Dev project %s", project => {
    expect(() => gate({...safe, SELF_ACCOUNT_DELETION_PROJECT: project}, ["--check"])).toThrow();
    expect(() => gate({...safe, SELF_ACCOUNT_DELETION_CONFIRM: project}, ["--check"])).toThrow();
  });
  it.each([
    {GCLOUD_PROJECT: "sodc-web-production"}, {GOOGLE_CLOUD_PROJECT: "sodc-web-beta"}, {VITE_FIREBASE_PROJECT_ID: "other"}, {FIREBASE_PROJECT_ID: "other"},
    {FIREBASE_CONFIG: "{}"}, {FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099"}, {DATA_CONNECT_EMULATOR_HOST: "127.0.0.1:9399"}, {FIREBASE_EMULATORS_HUB: "127.0.0.1:4400"},
    {SELF_ACCOUNT_DELETION_ENDPOINT: "https://production.example"}, {SELF_ACCOUNT_DELETION_TRANSPORT: "local"}, {SELF_ACCOUNT_DELETION_FIXTURE_PREFIX: "existing-member"},
  ])("refuses ambiguous, emulator or externally supplied execution context %j", overrides => {
    expect(() => gate({...safe, ...overrides}, ["--check"])).toThrow();
  });
  it("does not accept arbitrary targets, commands, fixture identifiers or endpoint arguments", () => {
    for (const args of [["--project", "sodc-web"], ["--uid", "existing-member"], ["--endpoint", "https://other"], ["--check", "extra"]]) {
      expect(() => gate(safe, args)).toThrow("Only --check");
    }
    expect(() => gate(safe)).toThrow("API key");
    expect(gate({...safe, VITE_FIREBASE_API_KEY: "synthetic-test-key"})).toMatchObject({checkOnly: false});
  });
  it("allows only the two fixed Dev hosted callables", () => {
    expect(callableUrl("deleteMyAccount")).toBe("https://europe-west2-sodc-web.cloudfunctions.net/deleteMyAccount");
    expect(callableUrl("deleteAccount")).toBe("https://europe-west2-sodc-web.cloudfunctions.net/deleteAccount");
    for (const name of ["https://other.example", "deleteMyAccount?project=prod", "../deleteAccount", "other"]) expect(() => callableUrl(name)).toThrow();
  });
  it("accepts only a proven hosted not-started refusal preserving the domain code", () => {
    notStarted({error: {status: "FAILED_PRECONDITION", details: {deletionStatus: "NOT_STARTED", code: "ACCOUNT_CHANGED"}}}, "FAILED_PRECONDITION", "ACCOUNT_CHANGED");
    for (const response of [
      {error: {status: "FAILED_PRECONDITION", details: {code: "ACCOUNT_CHANGED"}}},
      {error: {status: "FAILED_PRECONDITION", details: {deletionStatus: "NOT_STARTED", code: "OTHER"}}},
      {error: {status: "PERMISSION_DENIED", details: {deletionStatus: "NOT_STARTED", code: "ACCOUNT_CHANGED"}}},
      {error: {status: "FAILED_PRECONDITION", details: {deletionStatus: "NOT_STARTED", code: "ACCOUNT_DELETION_INCOMPLETE"}}},
      {result: {deleted: true}, error: {status: "FAILED_PRECONDITION", details: {deletionStatus: "NOT_STARTED", code: "ACCOUNT_CHANGED"}}},
    ]) expect(() => notStarted(response, "FAILED_PRECONDITION", "ACCOUNT_CHANGED")).toThrow();
  });
});


describe("hosted validation task identity", () => {
  const worker = {name: "projects/sodc-web/locations/europe-west2/functions/processAnnouncementEmail", state: "ACTIVE",
    serviceConfig: {serviceAccountEmail: "931675247602-compute@developer.gserviceaccount.com"}};
  it("accepts only the active fixed Dev worker's exact runtime identity", () => {
    expect(taskIdentity(worker)).toBe("931675247602-compute@developer.gserviceaccount.com");
  });
  it.each([
    undefined, {}, {...worker, name: "projects/sodc-web-production/locations/europe-west2/functions/processAnnouncementEmail"},
    {...worker, name: "projects/sodc-web/locations/us-central1/functions/processAnnouncementEmail"},
    {...worker, name: "projects/sodc-web/locations/europe-west2/functions/deleteMyAccount"},
    {...worker, state: "DEPLOYING"}, {...worker, serviceConfig: {}},
    {...worker, serviceConfig: {serviceAccountEmail: "123456789-compute@developer.gserviceaccount.com"}},
    {...worker, serviceConfig: {serviceAccountEmail: "other@sodc-web.iam.gserviceaccount.com"}},
    {...worker, serviceConfig: {serviceAccountEmail: "931675247602-compute@developer.gserviceaccount.com.attacker.example"}},
  ])("rejects missing, unrelated or changed task metadata %j", metadata => {
    expect(() => taskIdentity(metadata)).toThrow("Fixed Dev task worker");
  });
  it("reports only bounded static failure categories", () => {
    expect(failureCategory({code: "functions/invalid-argument", message: "private provider detail"})).toBe("task-invalid-argument");
    expect(failureCategory({code: "functions/permission-denied"})).toBe("task-permission-denied");
    expect(failureCategory({code: "functions/unknown-error", message: "credential details"})).toBe("task-unknown-error");
    expect(failureCategory({code: "ERR_ASSERTION", actual: "private data"})).toBe("assertion");
    for (const error of [new Error("private credential detail"), {code: "credential-secret-value"}, {code: "__proto__"}, null]) expect(failureCategory(error)).toBe("unclassified");
  });
});


function fakeHttps() {
  const request = Object.assign(new EventEmitter(), {end: vi.fn(), setTimeout: vi.fn(), destroy: vi.fn()});
  const controller = new AbortController();
  const cancel = vi.fn();
  const deadlineFactory = vi.fn(() => ({signal: controller.signal, cancel}));
  let receive!: (response: any) => void;
  const requestImpl = vi.fn((_url: URL, _options: any, callback: (response: any) => void) => {receive = callback; return request;});
  function start(status = 200, headers: Record<string, string> = {"content-type": "application/json"}) {
    const response = Object.assign(new EventEmitter(), {statusCode: status, headers, destroy: vi.fn()});
    receive(response);
    return response;
  }
  function respond(body: unknown, status = 200) {
    const response = start(status);
    response.emit("data", Buffer.from(JSON.stringify(body)));
    response.emit("end"); response.emit("close");
    return response;
  }
  return {request, requestImpl, controller, cancel, deadlineFactory, start, respond, deps: {requestImpl, deadlineFactory}};
}

describe("long hosted callable HTTPS transport", () => {
  it("uses only the fixed Dev URL, POST, separate bearer header and a whole540-second deadline", async () => {
    const transport = fakeHttps();
    const result = hostedCall("deleteMyAccount", {apply: false}, "synthetic-token", transport.deps);
    expect(transport.deadlineFactory).toHaveBeenCalledWith(540000);
    const [url, options] = transport.requestImpl.mock.calls[0];
    expect(url.href).toBe("https://europe-west2-sodc-web.cloudfunctions.net/deleteMyAccount");
    expect(options).toMatchObject({method: "POST", agent: false, timeout: 540000, signal: transport.controller.signal,
      headers: {"Content-Type": "application/json", Authorization: "Bearer synthetic-token"}});
    expect(transport.request.setTimeout).toHaveBeenCalledWith(540000);
    expect(transport.request.end).toHaveBeenCalledWith(JSON.stringify({data: {apply: false}}));
    expect(options.headers["Content-Length"]).toBe(Buffer.byteLength(transport.request.end.mock.calls[0][0]));
    transport.respond({result: {eligible: true}});
    await expect(result).resolves.toEqual({result: {eligible: true}});
    expect(transport.cancel).toHaveBeenCalledOnce();
  });
  it("rejects arbitrary URLs and caller-selected destinations before creating a request", async () => {
    const transport = fakeHttps();
    for (const name of ["https://other.example", "deleteMyAccount?project=prod", "../deleteAccount"]) {
      await expect(hostedCall(name, {}, "token", transport.deps)).rejects.toThrow("Unsupported validation callable");
    }
    expect(transport.requestImpl).not.toHaveBeenCalled();
    expect(transport.deadlineFactory).not.toHaveBeenCalled();
  });
  it("keeps a native request open beyond300 seconds for delayed headers, and cancels its deadline on completion", async () => {
    vi.useFakeTimers();
    try {
      const transport = fakeHttps();
      const result = hostedCall("deleteMyAccount", {}, undefined, {requestImpl: transport.requestImpl});
      let finished = false;
      void result.finally(() => {finished = true;});
      await vi.advanceTimersByTimeAsync(330000);
      expect(finished).toBe(false);
      expect(transport.request.destroy).not.toHaveBeenCalled();
      expect(transport.requestImpl.mock.calls[0][1].signal.aborted).toBe(false);
      transport.respond({result: {deleted: true}});
      await expect(result).resolves.toEqual({result: {deleted: true}});
      expect(vi.getTimerCount()).toBe(0);
    } finally {vi.useRealTimers();}
  });
  it("aborts on its whole-request deadline even when the response body remains active", async () => {
    vi.useFakeTimers();
    try {
      const transport = fakeHttps();
      const result = hostedCall("deleteMyAccount", {}, undefined, {requestImpl: transport.requestImpl});
      const rejection = expect(result).rejects.toMatchObject({code: "SELF_DELETION_TRANSPORT_TIMEOUT"});
      const response = transport.start();
      response.emit("data", Buffer.from("{"));
      await vi.advanceTimersByTimeAsync(539999);
      expect(transport.request.destroy).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await rejection;
      expect(transport.request.destroy).toHaveBeenCalledOnce();
      expect(response.destroy).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    } finally {vi.useRealTimers();}
  });
  it("preserves structured callable errors and details without treating them as network failures", async () => {
    const transport = fakeHttps();
    const body = {error: {status: "FAILED_PRECONDITION", details: {deletionStatus: "NOT_STARTED", code: "ACCOUNT_CHANGED"}}};
    const result = hostedCall("deleteAccount", {}, undefined, transport.deps);
    expect(transport.requestImpl.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
    transport.respond(body, 400);
    await expect(result).resolves.toEqual(body);
    expect(transport.cancel).toHaveBeenCalledOnce();
  });
  it.each([301, 302, 307, 308])("rejects redirect status%s without issuing another request", async status => {
    const transport = fakeHttps();
    const result = hostedCall("deleteMyAccount", {}, "token", transport.deps);
    const rejection = expect(result).rejects.toMatchObject({code: "SELF_DELETION_RESPONSE_INVALID"});
    const response = transport.start(status, {"content-type": "application/json", location: "https://other.example"});
    await rejection;
    expect(response.destroy).toHaveBeenCalledOnce();
    expect(transport.requestImpl).toHaveBeenCalledOnce();
    expect(transport.cancel).toHaveBeenCalledOnce();
  });
  it("rejects unexpected MIME types, malformed JSON and ambiguous callable envelopes", async () => {
    const malformedBodies = ["not-json", "[]", "null", "{}", "{\"result\":true}", "{\"result\":{},\"error\":{\"status\":\"INTERNAL\"}}"];
    for (const body of malformedBodies) {
      const transport = fakeHttps();
      const result = hostedCall("deleteMyAccount", {}, undefined, transport.deps);
      const rejection = expect(result).rejects.toMatchObject({code: "SELF_DELETION_RESPONSE_INVALID"});
      const response = transport.start(); response.emit("data", Buffer.from(body)); response.emit("end");
      await rejection;
      expect(transport.cancel).toHaveBeenCalledOnce();
    }
    const transport = fakeHttps();
    const result = hostedCall("deleteMyAccount", {}, undefined, transport.deps);
    const rejection = expect(result).rejects.toMatchObject({code: "SELF_DELETION_RESPONSE_INVALID"});
    transport.start(200, {"content-type": "text/html"});
    await rejection;
  });
  it.each(["advertised", "streamed"])("caps %s response bytes before parsing", async mode => {
    const transport = fakeHttps();
    const result = hostedCall("deleteMyAccount", {}, undefined, transport.deps);
    const rejection = expect(result).rejects.toMatchObject({code: "SELF_DELETION_RESPONSE_TOO_LARGE"});
    const response = transport.start(200, {"content-type": "application/json", ...(mode === "advertised" ? {"content-length": "65537"} : {})});
    if (mode === "streamed") {response.emit("data", Buffer.alloc(40000)); response.emit("data", Buffer.alloc(30000));}
    await rejection;
    expect(response.destroy).toHaveBeenCalledOnce(); expect(transport.cancel).toHaveBeenCalledOnce();
  });
  it.each(["request-error", "response-error", "response-aborted", "response-close", "socket-timeout", "signal-abort"])("settles %s with only static error details", async event => {
    const transport = fakeHttps();
    const result = hostedCall("deleteMyAccount", {}, "synthetic-token", transport.deps);
    const rejection = expect(result).rejects.toMatchObject({message: "Hosted callable transport did not complete.",
      code: event === "socket-timeout" || event === "signal-abort" ? "SELF_DELETION_TRANSPORT_TIMEOUT" : "SELF_DELETION_TRANSPORT_FAILED"});
    if (event === "request-error") transport.request.emit("error", new Error("private credential must not escape"));
    else if (event === "socket-timeout") transport.request.emit("timeout");
    else if (event === "signal-abort") transport.controller.abort();
    else {
      const response = transport.start();
      response.emit(event === "response-error" ? "error" : event === "response-aborted" ? "aborted" : "close", new Error("private provider detail"));
    }
    await rejection;
    expect(transport.request.destroy).toHaveBeenCalledOnce(); expect(transport.cancel).toHaveBeenCalledOnce();
  });
  it("rejects a pre-aborted deadline or oversized request without emitting credentials", async () => {
    const transport = fakeHttps(); transport.controller.abort();
    await expect(hostedCall("deleteMyAccount", {}, "token", transport.deps)).rejects.toMatchObject({code: "SELF_DELETION_TRANSPORT_TIMEOUT"});
    expect(transport.requestImpl).not.toHaveBeenCalled(); expect(transport.cancel).toHaveBeenCalledOnce();
    const oversized = fakeHttps();
    await expect(hostedCall("deleteMyAccount", {payload: "x".repeat(20000)}, "token", oversized.deps)).rejects.toMatchObject({code: "SELF_DELETION_REQUEST_INVALID"});
    expect(oversized.requestImpl).not.toHaveBeenCalled();
  });
});

describe("known hosted long-request outcomes", () => {
  it("accepts only completed or explicit handler refusals as safe for immediate fixture cleanup", () => {
    for (const body of [{result: {deleted: true}}, {error: {status: "FAILED_PRECONDITION", details: {deletionStatus: "NOT_STARTED"}}},
      {error: {status: "FAILED_PRECONDITION", details: {code: "ACCOUNT_DELETION_INCOMPLETE"}}}]) expect(knownOutcome(body)).toBe(true);
    for (const body of [{error: {status: "INTERNAL"}}, {error: {status: "UNAVAILABLE"}}, {result: {eligible: true}}, {}, null]) expect(knownOutcome(body)).toBe(false);
  });
});


describe("uncertain hosted outcome cleanup barrier", () => {
  it.each(["transport rejection", "unproven gateway error"])("waits until the570-second runtime boundary after %s", async failure => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const unknown = failure === "transport rejection" ? Promise.reject(new Error("private transport detail")) : Promise.resolve({error: {status: "INTERNAL"}});
    await expect(awaitOutcomes([unknown, Promise.resolve({result: {deleted: true}})], 1000, {now: () => 401000, wait})).rejects.toMatchObject({code: "SELF_DELETION_OUTCOME_UNCERTAIN"});
    expect(wait).toHaveBeenCalledExactlyOnceWith(170000);
  });
  it("waits for every request to settle before calculating the cleanup barrier", async () => {
    let finish!: (body: unknown) => void;
    const second = new Promise(resolve => {finish = resolve;});
    const wait = vi.fn().mockResolvedValue(undefined);
    const result = awaitOutcomes([Promise.reject(new Error("offline")), second], 1000, {now: () => 501000, wait});
    const rejection = expect(result).rejects.toMatchObject({code: "SELF_DELETION_OUTCOME_UNCERTAIN"});
    await Promise.resolve(); await Promise.resolve();
    expect(wait).not.toHaveBeenCalled();
    finish({result: {deleted: true}});
    await rejection;
    expect(wait).toHaveBeenCalledExactlyOnceWith(70000);
  });
  it("does not add delay to known handler outcomes or an already elapsed safety boundary", async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const success = {result: {deleted: true}}, partial = {error: {status: "FAILED_PRECONDITION", details: {code: "ACCOUNT_DELETION_INCOMPLETE"}}};
    await expect(awaitOutcomes([Promise.resolve(success), Promise.resolve(partial)], 1000, {now: () => 350000, wait})).resolves.toEqual([success, partial]);
    expect(wait).not.toHaveBeenCalled();
    await expect(awaitOutcomes([Promise.resolve({error: {status: "INTERNAL"}})], 1000, {now: () => 600000, wait})).rejects.toMatchObject({code: "SELF_DELETION_OUTCOME_UNCERTAIN"});
    expect(wait).not.toHaveBeenCalled();
  });
});
