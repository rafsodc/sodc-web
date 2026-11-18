import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseRepairArguments, readLocalSource, runBindingRepair, runRepairCommand } from "./notify-secret-binding-repair.mjs";
import * as guardModule from "./functions-config-guard.mjs";
import { TARGET, REGION } from "./notify-secret-binding-repair-lib.mjs";
import { PROJECT, NOW, TARGET_NAME, OPERATION, fixture, approved, operationRecord } from "./test-fixtures/notify-binding-repair-fixture.mjs";

const directories = new Set();
const cliPath = fileURLToPath(new URL("./notify-secret-binding-repair.mjs", import.meta.url));
const firebaseAliases = { projects: { dev: PROJECT, prod: "sodc-web-production" } };
const json = async file => JSON.parse(await readFile(file, "utf8"));
const options = (runDirectory, phase = "prepare", environment = "dev") => ({ environment, phase, runDirectory });

async function setup() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "sodc-binding-repair-cli-test-"))); directories.add(root);
  await writeFile(path.join(root, ".firebaserc"), JSON.stringify(firebaseAliases), { mode: 0o600 });
  const f = fixture(); const runDirectory = path.join(root, "reviewed-run");
  const lockDirectory = path.join(root, "project-locks");
  const dependencies = { readSource: f.readSource, providerFactory: vi.fn(() => f.provider),
    lockDirectory: vi.fn(() => lockDirectory), now: () => NOW };
  const run = (phase, environment = "dev", directory = runDirectory, extra = {}) =>
    runBindingRepair(root, options(directory, phase, environment), { ...dependencies, ...extra });
  const prepare = () => run("prepare");
  const approve = async (directory = runDirectory, mutate = value => value) => {
    const proposal = await json(path.join(directory, "proposal.json"));
    await writeFile(path.join(directory, "review.json"), JSON.stringify(mutate(approved(proposal))), { mode: 0o600 });
    return proposal;
  };
  return { root, f, runDirectory, lockDirectory, dependencies, run, prepare, approve };
}

afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  await Promise.all([...directories].map(directory => rm(directory, { recursive: true, force: true })));
  directories.clear();
});

describe("Notify-binding repair command arguments", () => {
  it.each(["dev", "prod"].flatMap(environment => ["prepare", "apply", "verify"].map(phase => [environment, phase])))(
    "requires the explicit supported environment %s and phase %s", (environment, phase) => {
    expect(parseRepairArguments(["--env", environment, "--phase", phase, "--run-dir", "/private/tmp/exact-run"]))
      .toEqual(options("/private/tmp/exact-run", phase, environment));
    });

  it("makes help a standalone non-mutating command", async () => {
    expect(parseRepairArguments(["--help"])).toEqual({ help: true });
    const readSource = vi.fn(); const providerFactory = vi.fn();
    const result = await runBindingRepair("/does-not-exist", { help: true }, { readSource, providerFactory });
    expect(result.status).toBe("HELP");
    expect(result.help).toContain("prepare|apply|verify");
    expect(result.help).toContain("no provider write");
    expect(readSource).not.toHaveBeenCalled(); expect(providerFactory).not.toHaveBeenCalled();
  });

  it.each([
    [], ["--env", "dev"],
    ["--phase", "prepare", "--run-dir", "/private/tmp/exact-run"],
    ["--env", "beta", "--phase", "prepare", "--run-dir", "/private/tmp/exact-run"],
    ["--env", "production", "--phase", "prepare", "--run-dir", "/private/tmp/exact-run"],
    ["--env", "dev", "--phase", "deploy", "--run-dir", "/private/tmp/exact-run"],
    ["--env", "dev", "--phase", "prepare", "--run-dir", "relative-run"],
    ["--env", "dev", "--phase", "prepare", "--run-dir", "/private/tmp/../tmp/run"],
    ["--env", "dev", "--env", "prod", "--phase", "prepare", "--run-dir", "/private/tmp/exact-run"],
    ["--env", "dev", "--phase", "prepare", "--phase", "apply", "--run-dir", "/private/tmp/exact-run"],
    ["--env", "dev", "--phase", "prepare", "--run-dir", "/private/tmp/a", "--run-dir", "/private/tmp/b"],
    ["--env", "dev", "--phase", "prepare", "--run-dir"],
    ["--env", "--phase", "prepare", "--run-dir", "/private/tmp/exact-run"],
    ["--help", "--env", "dev"],
    ["--env", "dev", "--phase", "prepare", "--run-dir", "/private/tmp/exact-run", "--target", "arbitraryFunction"],
    ["--env", "dev", "--phase", "apply", "--run-dir", "/private/tmp/exact-run", "--review", "/some/other/review.json"],
    ["--env", "dev", "--phase", "apply", "--run-dir", "/private/tmp/exact-run", "--approve", "yes"],
  ])("rejects implicit, duplicate or broadened arguments %j", (...args) => {
    expect(() => parseRepairArguments(args)).toThrow();
  });

  it("runs actual process help without inspecting the checkout or cloud", () => {
    const output = execFileSync(process.execPath, [cliPath, "--help"], { encoding: "utf8", timeout: 10_000 });
    expect(output).toContain("Usage:"); expect(output).toContain("--env <dev|prod>");
    expect(output).not.toContain("comparison.key\n{");
  });

  it("sanitizes actual process argument failure without echoing supplied sensitive-looking text", () => {
    let failure;
    try { execFileSync(process.execPath, [cliPath, "--untrusted-PRIVATE_VALUE", "PRIVATE_BODY"],
      { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] }); }
    catch (error) { failure = error; }
    expect(failure?.status).toBe(1);
    expect(failure?.stdout).toBe("");
    expect(failure?.stderr).toBe("Notify binding repair blocked: invalid-arguments.\n");
  });
});

describe("metadata-only preparation with real private local storage", () => {
  it.each([
    { projects: { dev: "sodc-web-production" } },
    { projects: { dev: "foreign-project" } },
    { projects: { default: PROJECT } },
    { projects: {} },
  ])("validates Firebase aliases before constructing a provider: %j", async aliases => {
    const c = await setup();
    await writeFile(path.join(c.root, ".firebaserc"), JSON.stringify(aliases));
    await expect(c.prepare()).rejects.toThrow();
    expect(c.dependencies.providerFactory).not.toHaveBeenCalled();
    expect(c.f.readSource).not.toHaveBeenCalled();
    expect(c.f.provider.snapshot).not.toHaveBeenCalled();
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it("rejects malformed aliases before constructing a provider", async () => {
    const c = await setup(); await writeFile(path.join(c.root, ".firebaserc"), "{PRIVATE_MALFORMED");
    await expect(c.prepare()).rejects.toThrow();
    expect(c.dependencies.providerFactory).not.toHaveBeenCalled();
  });

  it.each([
    ["SDK version", f => { f.source.binding.sdk.version = "7.2.4"; }],
    ["source binding", f => { f.source.binding.trackedSha256 = "bad"; }],
    ["target declaration", f => f.updateManifest(m => { m.endpoints[TARGET].secretEnvironmentVariables.pop(); })],
    ["secret descriptor override", f => f.updateManifest(m => { m.endpoints[TARGET].secretEnvironmentVariables[0].version = "latest"; })],
  ])("rejects invalid %s before any provider metadata read", async (_label, change) => {
    const c = await setup(); change(c.f);
    await expect(c.prepare()).rejects.toThrow();
    expect(c.f.provider.snapshot).not.toHaveBeenCalled();
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
    await expect(stat(c.runDirectory)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("writes the exact proposal, private key and unapproved review template without a cloud write", async () => {
    const c = await setup(); const result = await c.prepare();
    expect(c.dependencies.providerFactory).toHaveBeenCalledExactlyOnceWith({ projectId: PROJECT, region: REGION });
    expect(c.f.readSource).toHaveBeenCalledExactlyOnceWith(PROJECT);
    expect(c.f.readSource.mock.invocationCallOrder[0]).toBeLessThan(c.f.provider.snapshot.mock.invocationCallOrder[0]);
    expect(result).toMatchObject({ status: "REVIEW_REQUIRED", projectId: PROJECT, target: TARGET, providerWrites: 0,
      reviewTemplate: path.join(c.runDirectory, "review-template.json") });
    expect(Object.keys(result)).not.toContain("comparisonKey");
    expect(await readdir(c.runDirectory)).toEqual(["comparison.key", "initialized.json", "proposal.json", "review-template.json"]);
    expect((await stat(c.runDirectory)).mode & 0o777).toBe(0o700);
    for (const file of await readdir(c.runDirectory)) expect((await stat(path.join(c.runDirectory, file))).mode & 0o777).toBe(0o600);
    const proposal = await json(path.join(c.runDirectory, "proposal.json"));
    expect(proposal.target).toBe(TARGET_NAME); expect(proposal.after).toHaveLength(4);
    expect((await readFile(path.join(c.runDirectory, "comparison.key"))).byteLength).toBe(32);
    expect(await json(path.join(c.runDirectory, "review-template.json")))
      .toMatchObject({ proposalSha256: result.proposalSha256, decision: "REVIEW_REQUIRED", reviewedBy: "REPLACE_AFTER_REVIEW" });
    for (const file of ["proposal.json", "review-template.json"]) {
      const text = await readFile(path.join(c.runDirectory, file), "utf8");
      expect(text).not.toContain("PRIVATE_ENV_VALUE_744"); expect(text).not.toContain("ops-fixture@example.invalid");
    }
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled(); expect(c.f.provider.operation).not.toHaveBeenCalled();
    expect(c.dependencies.lockDirectory).not.toHaveBeenCalled();
  });

  it("will not replace an existing run or its private approval inputs", async () => {
    const c = await setup(); await c.prepare();
    const proposal = await readFile(path.join(c.runDirectory, "proposal.json"));
    const key = await readFile(path.join(c.runDirectory, "comparison.key"));
    await expect(c.prepare()).rejects.toMatchObject({ code: "run-directory-already-exists" });
    expect(await readFile(path.join(c.runDirectory, "proposal.json"))).toEqual(proposal);
    expect(await readFile(path.join(c.runDirectory, "comparison.key"))).toEqual(key);
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
  });
});

describe("local source inspection with real Git and ignored build files", () => {
  async function localRepository() {
    const c = await setup();
    const git = (...args) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", ...args],
      { cwd: c.root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" } });
    await mkdir(path.join(c.root, "functions/lib"), { recursive: true });
    await writeFile(path.join(c.root, ".gitignore"), "functions/lib/\n");
    await writeFile(path.join(c.root, "source.txt"), "tracked original source\n");
    await writeFile(path.join(c.root, "functions/lib/index.js"), "export const built = 'original';\n");
    git("init", "--quiet"); git("add", ".");
    git("-c", "user.name=Offline binding fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false",
      "commit", "--quiet", "-m", "Offline source inspection fixture");
    const discovered = { manifest: structuredClone(c.f.source.manifest), sdk: structuredClone(c.f.source.binding.sdk) };
    return { ...c, git, discovered };
  }

  it("binds a clean real tracked source and unchanged ignored build to the discovered manifest", async () => {
    const c = await localRepository();
    const discover = vi.spyOn(guardModule, "discoverManifest").mockResolvedValue(c.discovered);
    const buildSha256 = await guardModule.hashDirectory(path.join(c.root, "functions/lib"));
    const source = await readLocalSource(c.root, PROJECT);
    expect(source.binding).toMatchObject({ gitSha: c.git("rev-parse", "HEAD").trim(),
      tree: c.git("rev-parse", "HEAD^{tree}").trim(), buildSha256, sdk: c.discovered.sdk });
    expect(source.binding.trackedSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(source.manifest).toEqual(c.discovered.manifest);
    expect(discover).toHaveBeenCalledExactlyOnceWith(path.join(c.root, "functions"), PROJECT);
    expect(c.f.provider.snapshot).not.toHaveBeenCalled();
  });

  it("rejects an ignored build that changes during SDK manifest discovery", async () => {
    const c = await localRepository();
    vi.spyOn(guardModule, "discoverManifest").mockImplementation(async () => {
      await writeFile(path.join(c.root, "functions/lib/index.js"), "export const built = 'changed during discovery';\n");
      return c.discovered;
    });
    await expect(readLocalSource(c.root, PROJECT)).rejects.toMatchObject({ code: "build-changed-during-discovery" });
    expect(c.git("status", "--porcelain=v1")).toBe("");
    expect(c.f.provider.snapshot).not.toHaveBeenCalled(); expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it("rejects a dirty tracked source before manifest discovery or provider reads", async () => {
    const c = await localRepository();
    const discover = vi.spyOn(guardModule, "discoverManifest").mockResolvedValue(c.discovered);
    await writeFile(path.join(c.root, "source.txt"), "uncommitted source change\n");
    await expect(readLocalSource(c.root, PROJECT)).rejects.toMatchObject({ code: "source-not-clean" });
    expect(discover).not.toHaveBeenCalled(); expect(c.f.provider.snapshot).not.toHaveBeenCalled();
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
  });
});

describe("exact approval and durable one-shot CLI application", () => {
  it("does not treat an edited review template as the approved review.json", async () => {
    const c = await setup(); await c.prepare();
    const proposal = await json(path.join(c.runDirectory, "proposal.json"));
    await writeFile(path.join(c.runDirectory, "review-template.json"), JSON.stringify(approved(proposal)), { mode: 0o600 });
    c.f.provider.snapshot.mockClear();
    await expect(c.run("apply")).rejects.toMatchObject({ code: "missing-or-invalid-exact-review" });
    expect(c.f.provider.snapshot).not.toHaveBeenCalled(); expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it.each([
    ["not approved", r => ({ ...r, decision: "REVIEW_REQUIRED" })],
    ["placeholder reviewer", r => ({ ...r, reviewedBy: "REPLACE_AFTER_REVIEW" })],
    ["different proposal", r => ({ ...r, proposalSha256: "0".repeat(64) })],
    ["unknown approval field", r => ({ ...r, broadApproval: true })],
  ])("refuses review.json with %s", async (_label, mutate) => {
    const c = await setup(); await c.prepare(); await c.approve(c.runDirectory, mutate);
    await expect(c.run("apply")).rejects.toMatchObject({ code: "missing-or-invalid-exact-review" });
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
    await expect(stat(path.join(c.runDirectory, "intent.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("durably records the exact approved intent before PATCH and persists an acknowledgement, not success", async () => {
    const c = await setup(); await c.prepare(); const proposal = await c.approve();
    c.f.provider.patchBindings.mockImplementation(async request => {
      const intent = await json(path.join(c.runDirectory, "intent.json"));
      expect(intent.proposalSha256).toBe((await json(path.join(c.runDirectory, "review.json"))).proposalSha256);
      expect(await json(path.join(c.lockDirectory, `${PROJECT}.json`))).toMatchObject({ runDirectory: c.runDirectory, target: TARGET_NAME });
      expect(request).toEqual({ name: TARGET_NAME, bindings: proposal.after });
      return { name: OPERATION };
    });
    const result = await c.run("apply");
    expect(result).toMatchObject({ status: "APPLY_ACCEPTED_VERIFY_REQUIRED", operationName: OPERATION });
    expect(result.status).not.toBe("PASS");
    expect(c.f.provider.patchBindings).toHaveBeenCalledTimes(1);
    expect(c.f.provider.operation).not.toHaveBeenCalled();
    expect(await json(path.join(c.runDirectory, "operation.json"))).toEqual({ name: OPERATION });
    const reports = (await readdir(c.runDirectory)).filter(name => name.startsWith("verification-"));
    expect(reports).toHaveLength(1);
    expect(await json(path.join(c.runDirectory, reports[0])))
      .toMatchObject({ phase: "apply", checkedAt: new Date(NOW).toISOString(), status: "APPLY_ACCEPTED_VERIFY_REQUIRED" });
    expect((await stat(path.join(c.runDirectory, reports[0]))).mode & 0o777).toBe(0o600);
  });

  it("cannot replay an existing run, even if its approval is rewritten", async () => {
    const c = await setup(); await c.prepare(); await c.approve(); await c.run("apply"); await c.approve();
    await expect(c.run("apply")).rejects.toMatchObject({ code: "application-already-started-use-verify" });
    expect(c.f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });

  it("locks the target across separately prepared run directories", async () => {
    const c = await setup(); const other = path.join(c.root, "other-run");
    await c.prepare(); await c.run("prepare", "dev", other); await c.approve(); await c.approve(other);
    await c.run("apply");
    await expect(c.run("apply", "dev", other)).rejects.toMatchObject({ code: "global-target-already-claimed" });
    expect(c.f.provider.patchBindings).toHaveBeenCalledTimes(1);
    await expect(stat(path.join(other, "intent.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("allows exactly one concurrent run directory to acquire the global target lock", async () => {
    const c = await setup(); const other = path.join(c.root, "concurrent-run");
    await c.prepare(); await c.run("prepare", "dev", other); await c.approve(); await c.approve(other);
    const results = await Promise.allSettled([c.run("apply"), c.run("apply", "dev", other)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")[0].reason.code).toBe("global-target-already-claimed");
    expect(c.f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });

  it.each(["apply", "verify"])("rejects cross-environment %s before any provider read or write", async phase => {
    const c = await setup(); await c.prepare(); await c.approve(); c.f.provider.snapshot.mockClear();
    await expect(c.run(phase, "prod")).rejects.toMatchObject({ code: "run-environment-mismatch" });
    expect(c.f.provider.snapshot).not.toHaveBeenCalled(); expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
    expect(c.f.provider.operation).not.toHaveBeenCalled();
  });

  it("rejects expired approvals before any metadata read or PATCH", async () => {
    const c = await setup(); await c.prepare(); await c.approve(); c.f.provider.snapshot.mockClear();
    await expect(c.run("apply", "dev", c.runDirectory, { now: () => NOW + 3_600_001 }))
      .rejects.toMatchObject({ code: "proposal-expired-or-clock-invalid" });
    expect(c.f.provider.snapshot).not.toHaveBeenCalled(); expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
  });
});

describe("read-only verification and unknown outcomes through the real run store", () => {
  it("keeps an unknown request outcome non-replayable even when the provider state looks committed", async () => {
    const c = await setup(); await c.prepare(); await c.approve();
    c.f.provider.patchBindings.mockRejectedValue(new Error("PRIVATE_TRANSPORT_BODY"));
    expect(await c.run("apply")).toMatchObject({ status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED" });
    c.f.commit();
    expect(await c.run("verify")).toMatchObject({ status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED" });
    await expect(c.run("apply")).rejects.toMatchObject({ code: "application-already-started-use-verify" });
    expect(c.f.provider.patchBindings).toHaveBeenCalledTimes(1); expect(c.f.provider.operation).not.toHaveBeenCalled();
    for (const name of (await readdir(c.runDirectory)).filter(name => name.startsWith("verification-"))) {
      expect(await readFile(path.join(c.runDirectory, name), "utf8")).not.toContain("PRIVATE_TRANSPORT_BODY");
    }
  });

  it("records PENDING for a name-only operation without reading or writing Function configuration", async () => {
    const c = await setup(); await c.prepare(); await c.approve(); await c.run("apply");
    c.f.provider.operation.mockResolvedValue({ name: OPERATION }); c.f.provider.snapshot.mockClear();
    const lock = await readFile(path.join(c.lockDirectory, `${PROJECT}.json`));
    expect(await c.run("verify")).toEqual({ status: "PENDING", operationName: OPERATION });
    expect(c.f.provider.snapshot).not.toHaveBeenCalled(); expect(c.f.provider.patchBindings).toHaveBeenCalledTimes(1);
    expect(await readFile(path.join(c.lockDirectory, `${PROJECT}.json`))).toEqual(lock);
    expect((await readdir(c.runDirectory)).filter(name => name.startsWith("verification-"))).toHaveLength(2);
  });

  it("records sanitized operation failure without replaying the PATCH", async () => {
    const c = await setup(); await c.prepare(); await c.approve(); await c.run("apply");
    c.f.provider.operation.mockResolvedValue(operationRecord({ done: true, error: { code: 7, message: "PRIVATE_PROVIDER_ERROR_BODY" } }));
    c.f.provider.snapshot.mockClear();
    const result = await c.run("verify");
    expect(result).toEqual({ status: "OPERATION_FAILED_OPERATOR_REVIEW_REQUIRED", operationName: OPERATION, errorCode: 7 });
    expect(c.f.provider.snapshot).not.toHaveBeenCalled(); expect(c.f.provider.patchBindings).toHaveBeenCalledTimes(1);
    for (const name of (await readdir(c.runDirectory)).filter(name => name.startsWith("verification-"))) {
      expect(await readFile(path.join(c.runDirectory, name), "utf8")).not.toContain("PRIVATE_PROVIDER_ERROR_BODY");
    }
  });

  it("requires known operation completion and complete preservation before recording PASS", async () => {
    const c = await setup(); await c.prepare(); await c.approve(); await c.run("apply"); c.f.commit();
    const result = await c.run("verify", "dev", c.runDirectory, { now: () => NOW + 7_200_000 });
    expect(result).toMatchObject({ status: "PASS", functionsPreserved: 2, schedulersPreserved: 5,
      target: TARGET_NAME, secretPayloadsRead: false, emailSends: 0 });
    expect(result.secretBindings).toHaveLength(4); expect(c.f.provider.patchBindings).toHaveBeenCalledTimes(1);
    const reports = await Promise.all((await readdir(c.runDirectory)).filter(name => name.startsWith("verification-")).map(name => json(path.join(c.runDirectory, name))));
    expect(reports).toEqual(expect.arrayContaining([expect.objectContaining({ phase: "verify", status: "PASS" })]));
    expect(JSON.stringify(reports)).not.toMatch(/PRIVATE_|ops-fixture/);
  });

  it("does not infer acceptance from a done operation whose target scope is absent", async () => {
    const c = await setup(); await c.prepare(); await c.approve(); await c.run("apply"); c.f.commit();
    c.f.provider.operation.mockResolvedValue({ name: OPERATION, done: true });
    await expect(c.run("verify")).rejects.toMatchObject({ code: "operation-target-or-verb-mismatch" });
    expect(c.f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });

  it("keeps preservation drift blocked instead of persisting PASS", async () => {
    const c = await setup(); await c.prepare(); await c.approve(); await c.run("apply"); c.f.commit();
    c.f.snapshot.functions[1].serviceConfig.revision = "different-unrelated-revision";
    await expect(c.run("verify")).rejects.toMatchObject({ code: "provider-baseline-drift" });
    const reports = await Promise.all((await readdir(c.runDirectory)).filter(name => name.startsWith("verification-")).map(name => json(path.join(c.runDirectory, name))));
    expect(reports.some(value => value.status === "PASS")).toBe(false);
    expect(c.f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });
});

describe("command exit status and sanitized output", () => {
  const args = (directory, phase) => ["--env", "dev", "--phase", phase, "--run-dir", directory];
  const output = () => ({ stdout: vi.fn(), stderr: vi.fn() });
  const command = (c, phase, writers) => runRepairCommand(args(c.runDirectory, phase),
    { root: c.root, deps: c.dependencies, ...writers });

  it("returns zero only for help, a completed prepare or verified PASS", async () => {
    const c = await setup(); let writers = output();
    expect(await runRepairCommand(["--help"], { root: "/does-not-exist", deps: c.dependencies, ...writers })).toBe(0);
    expect(writers.stdout).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("Usage:"));
    expect(writers.stderr).not.toHaveBeenCalled(); expect(c.dependencies.providerFactory).not.toHaveBeenCalled();
    writers = output();
    expect(await command(c, "prepare", writers)).toBe(0);
    expect(JSON.parse(writers.stdout.mock.calls[0][0])).toMatchObject({ status: "REVIEW_REQUIRED", providerWrites: 0 });
    expect(writers.stderr).not.toHaveBeenCalled();
    await c.approve(); writers = output();
    expect(await command(c, "apply", writers)).toBe(3);
    expect(JSON.parse(writers.stdout.mock.calls[0][0])).toMatchObject({ status: "APPLY_ACCEPTED_VERIFY_REQUIRED" });
    expect(writers.stderr).not.toHaveBeenCalled();
    c.f.commit(); writers = output();
    expect(await command(c, "verify", writers)).toBe(0);
    expect(JSON.parse(writers.stdout.mock.calls[0][0])).toMatchObject({ status: "PASS", emailSends: 0, secretPayloadsRead: false });
    expect(writers.stderr).not.toHaveBeenCalled();
    expect(c.f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["pending", { name: OPERATION }, "PENDING"],
    ["failed", operationRecord({ done: true, error: { code: 7, message: "PRIVATE_PROVIDER_ERROR" } }), "OPERATION_FAILED_OPERATOR_REVIEW_REQUIRED"],
  ])("returns non-success exit three for an operation that is %s", async (_label, operation, status) => {
    const c = await setup(); await c.prepare(); await c.approve(); await c.run("apply");
    c.f.provider.operation.mockResolvedValue(operation); const writers = output();
    expect(await command(c, "verify", writers)).toBe(3);
    expect(JSON.parse(writers.stdout.mock.calls[0][0])).toMatchObject({ status });
    expect(writers.stdout.mock.calls[0][0]).not.toContain("PRIVATE_PROVIDER_ERROR");
    expect(writers.stderr).not.toHaveBeenCalled(); expect(c.f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });

  it("returns non-success exit three for both unknown application and unknown read-back", async () => {
    const c = await setup(); await c.prepare(); await c.approve();
    c.f.provider.patchBindings.mockRejectedValue(new Error("PRIVATE_PROVIDER_TIMEOUT_BODY"));
    for (const phase of ["apply", "verify"]) {
      const writers = output(); expect(await command(c, phase, writers)).toBe(3);
      expect(JSON.parse(writers.stdout.mock.calls[0][0])).toMatchObject({ status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED" });
      expect(writers.stdout.mock.calls[0][0]).not.toContain("PRIVATE_PROVIDER_TIMEOUT_BODY");
      expect(writers.stderr).not.toHaveBeenCalled();
    }
    expect(c.f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });

  it("returns blocked exit one without printing a stored key or raw provider body", async () => {
    const c = await setup(); await c.prepare(); const writers = output();
    expect(await command(c, "apply", writers)).toBe(1);
    expect(writers.stdout).not.toHaveBeenCalled();
    expect(writers.stderr).toHaveBeenCalledExactlyOnceWith("Notify binding repair blocked: missing-or-invalid-exact-review.");
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it.each([
    new Error("PRIVATE_PROVIDER_MESSAGE_BODY"),
    Object.assign(new Error("PRIVATE_PROVIDER_MESSAGE_BODY"), { code: "private-provider-nonce-123" }),
    Object.assign(new Error("PRIVATE_PROVIDER_MESSAGE_BODY"), { code: "PRIVATE_PROVIDER_CODE" }),
  ])("sanitizes arbitrary provider errors and nonce-bearing codes %j", async error => {
    const c = await setup(); c.f.provider.snapshot.mockRejectedValue(error); const writers = output();
    expect(await command(c, "prepare", writers)).toBe(1);
    expect(writers.stdout).not.toHaveBeenCalled();
    expect(writers.stderr).toHaveBeenCalledExactlyOnceWith("Notify binding repair blocked: invalid-input-or-local-state.");
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it("sanitizes malformed .firebaserc without reflecting its contents", async () => {
    const c = await setup(); await writeFile(path.join(c.root, ".firebaserc"), "{PRIVATE_ALIAS_NONCE");
    const writers = output(); expect(await command(c, "prepare", writers)).toBe(1);
    expect(writers.stdout).not.toHaveBeenCalled();
    expect(writers.stderr).toHaveBeenCalledExactlyOnceWith("Notify binding repair blocked: invalid-input-or-local-state.");
    expect(c.dependencies.providerFactory).not.toHaveBeenCalled();
  });
});
