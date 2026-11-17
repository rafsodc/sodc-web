import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { assessNotifyTemplateReadiness, checkNotifyTemplateReadiness, NOTIFY_BINDINGS_QUERY,
  readNotifyTemplateBindings, templateFallbackEnvironmentKey } from "./notify-template-readiness-lib.mjs";
import { runTemplateReadinessAudit } from "./notify-template-readiness.mjs";
import { applyFromStage, createDeploymentPlan, runDeploymentPlan } from "./deploy-environment-lib.mjs";
import { discoverFunctionContracts, exitCodeFor } from "./deployment-check-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const contract = { schemaVersion: "sodc-notify-template-contract/v1", templates: [
  { key: "bookingApproved", functions: ["reviewBookingRevision", "recoverNotificationDeliveries"] },
] };
const fn = (name, value, state = "ACTIVE") => ({ name: `projects/sodc-web/locations/europe-west2/functions/${name}`, state,
  serviceConfig: { environmentVariables: value === undefined ? {} : { GOV_NOTIFY_TEMPLATE_BOOKING_APPROVED: value } } });
const functions = (value) => [fn("reviewBookingRevision", value), fn("recoverNotificationDeliveries", value)];
const binding = (value = id) => ({ templateKey: "bookingApproved", notifyTemplateId: value });
const assess = (overrides = {}) => assessNotifyTemplateReadiness({ contract, functions: functions(), bindings: [], ...overrides });
const directories = [];
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});

describe("transactional template ID readiness", () => {
  it("accepts a saved ID without requiring fallback on either sender and ignores version-review markers", () => {
    expect(assess({ bindings: [{ ...binding(), reviewedVersion: 1, currentLiveVersion: 7 }] })).toMatchObject({ status: "pass",
      details: { savedBindingPathCount: 2, fallbackPathCount: 0, issues: [] } });
    expect(assess({ bindings: [binding()], functions: functions("INVALID_UNUSED_ENV_VALUE") }).status).toBe("pass");
  });

  it("accepts fallback-only configuration only when each actual sender has an ID", () => {
    expect(assess({ functions: functions(id) })).toMatchObject({ status: "pass", details: { fallbackPathCount: 2 } });
    const outcome = assess({ functions: [fn("reviewBookingRevision", id), fn("recoverNotificationDeliveries"), fn("unrelated", id)] });
    expect(outcome).toMatchObject({ status: "fail", details: { issues: [{ templateKey: "bookingApproved",
      functionName: "recoverNotificationDeliveries", issue: "missing-binding-and-fallback" }] } });
    expect(exitCodeFor([outcome])).toBe(1);
  });

  it("reproduces the four missing booking templates on their callable and recovery paths", async () => {
    const full = JSON.parse(await readFile(path.join(root, "config/notify-template-readiness.json"), "utf8"));
    const keys = ["bookingApproved", "bookingChangesRequested", "bookingPendingApproval", "bookingPendingApprovalModerator"];
    const scoped = { ...full, templates: full.templates.filter((t) => keys.includes(t.key)) };
    const senders = [...new Set(scoped.templates.flatMap((t) => t.functions))].map((name) => fn(name));
    const outcome = assessNotifyTemplateReadiness({ contract: scoped, functions: senders, bindings: [] });
    expect(outcome.status).toBe("fail");
    expect(outcome.details.issues).toHaveLength(8);
    expect(new Set(outcome.details.issues.map((issue) => issue.templateKey))).toEqual(new Set(keys));
    expect(outcome.details.issues.every((issue) => issue.issue === "missing-binding-and-fallback")).toBe(true);
    expect(assessNotifyTemplateReadiness({ contract: scoped, functions: senders,
      bindings: keys.map((templateKey) => ({ templateKey, notifyTemplateId: id })) }).status).toBe("pass");
  });

  it.each(["", " ", "not-an-id", ` ${id}`, `${id}\n`])("rejects a present invalid saved binding despite valid fallbacks (%j)", (value) => {
    const outcome = assess({ bindings: [binding(value)], functions: functions(otherId) });
    expect(outcome.status).toBe("fail");
    expect(outcome.details.issues.every((issue) => issue.issue === "invalid-saved-binding")).toBe(true);
    expect(JSON.stringify(outcome)).not.toContain(otherId);
  });

  it.each([undefined, "", " \t ", null, 0, "PRIVATE_ENV_VALUE", ` ${id} `])("rejects missing or invalid fallback values without reporting them (%j)", (value) => {
    const outcome = assess({ functions: functions(value) });
    expect(outcome.status).toBe("fail");
    expect(outcome.details.issues).toHaveLength(2);
    expect(JSON.stringify(outcome)).not.toContain(id);
    expect(JSON.stringify(outcome)).not.toContain("PRIVATE_ENV_VALUE");
  });

  it("does not pass missing, duplicate or inactive sender metadata even with a saved ID", () => {
    expect(assess({ functions: [], bindings: [binding()] }).details.issues.map((r) => r.issue)).toEqual(["missing-function", "missing-function"]);
    expect(assess({ functions: [...functions(), fn("reviewBookingRevision")], bindings: [binding()] }).details.issues[0].issue).toBe("duplicate-function-metadata");
    expect(assess({ functions: [fn("reviewBookingRevision", undefined, "FAILED"), fn("recoverNotificationDeliveries")], bindings: [binding()] }).details.issues[0].issue).toBe("function-not-active");
  });

  it("rejects ambiguous and incomplete binding reads", () => {
    expect(assess({ bindings: [binding(), binding(otherId)] }).details.issues[0].issue).toBe("duplicate-saved-binding");
    for (const bindings of [undefined, null, [{}], Array.from({ length: 1001 }, () => binding())]) {
      expect(assess({ bindings })).toMatchObject({ status: "fail", details: { reason: "bindings-incomplete-or-invalid" } });
    }
  });

  it.each([undefined, {}, { ...contract, templates: [] }, { ...contract, templates: [contract.templates[0], contract.templates[0]] },
    { ...contract, templates: [{ key: "private/key", functions: ["f"] }] },
    { ...contract, templates: [{ key: "test", functions: ["One", "one"] }] }])("fails a malformed audit contract before reading bindings", async (invalid) => {
    const loadBindings = vi.fn();
    const outcome = await checkNotifyTemplateReadiness({ contract: invalid, functions: functions(id), loadBindings });
    expect(outcome).toMatchObject({ status: "fail", details: { reason: "invalid-template-contract" } });
    expect(loadBindings).not.toHaveBeenCalled();
  });

  it("fails closed and sanitizes unreadable bindings even if every fallback is configured", async () => {
    const outcome = await checkNotifyTemplateReadiness({ contract, functions: functions(id), loadBindings: async () => {
      throw new Error("Bearer PRIVATE_TOKEN recipient@example.invalid");
    } });
    expect(outcome).toMatchObject({ status: "fail", details: { reason: "template-bindings-read-failed" } });
    expect(JSON.stringify(outcome)).not.toMatch(/PRIVATE_TOKEN|recipient@example/);
  });
});

describe("read-only binding provider", () => {
  const target = { projectId: "sodc-web", region: "europe-west2", service: "sodc-web-service" };
  it("uses only executeGraphqlRead on the explicit target and selects binding metadata only", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ data: { notifyTemplateBindings: [binding()] } }) }));
    expect(await readNotifyTemplateBindings({ ...target, accessToken: async () => "PRIVATE_TOKEN", fetchImpl })).toEqual([binding()]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://firebasedataconnect.googleapis.com/v1/projects/sodc-web/locations/europe-west2/services/sodc-web-service:executeGraphqlRead");
    expect(options).toMatchObject({ method: "POST", redirect: "error", headers: { Authorization: "Bearer PRIVATE_TOKEN", "x-goog-user-project": "sodc-web" } });
    expect(JSON.parse(options.body)).toEqual({ query: NOTIFY_BINDINGS_QUERY });
    expect(options.body).not.toMatch(/mutation|recipient|recoveryPayload|updatedBy|secret|notifyTemplateBindingAudit/i);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    { ok: false, json: async () => ({ error: { message: "PRIVATE_PROVIDER_BODY" } }) },
    { ok: true, json: async () => ({ errors: [{ message: "PRIVATE_PROVIDER_BODY" }], data: { notifyTemplateBindings: [] } }) },
    { ok: true, json: async () => ({ errors: { message: "PRIVATE_PROVIDER_BODY" }, data: { notifyTemplateBindings: [] } }) },
    { ok: true, json: async () => ({ data: {} }) },
    { ok: true, json: async () => ({ data: { notifyTemplateBindings: Array.from({ length: 1001 }, () => binding()) } }) },
  ])("rejects partial/error/bounded responses with a fixed error", async (response) => {
    await expect(readNotifyTemplateBindings({ ...target, accessToken: async () => "token", fetchImpl: async () => response }))
      .rejects.toThrow(/^template-bindings-read-failed$/);
  });

  it("does not follow unsafe targets or retry a failed network request", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("PRIVATE_TRANSPORT_ERROR"); });
    await expect(readNotifyTemplateBindings({ ...target, projectId: "other/project", accessToken: async () => "token", fetchImpl }))
      .rejects.toThrow("invalid-template-read-target");
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(readNotifyTemplateBindings({ ...target, accessToken: async () => "token", fetchImpl })).rejects.toThrow("template-bindings-read-failed");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("reviewed contract and release integration", () => {
  it("provides offline help and rejects an unknown environment before any audit", () => {
    const script = path.join(root, "scripts/notify-template-readiness.mjs");
    const help = spawnSync(process.execPath, [script, "--help"], { encoding: "utf8", timeout: 5000 });
    expect(help.status).toBe(0);expect(help.stdout).toContain("deployment:template-readiness");
    const invalid = spawnSync(process.execPath, [script, "--env", "production"], { encoding: "utf8", timeout: 5000 });
    expect(invalid.status).toBe(2);expect(invalid.stderr).toContain("--env <dev|beta|prod>");
  });

  it("covers every source template and references only exported senders, including recovery and admin test sends", async () => {
    const actual = JSON.parse(await readFile(path.join(root, "config/notify-template-readiness.json"), "utf8"));
    const files = (await readdir(path.join(root, "functions/email-templates"))).filter((f) => f.endsWith(".md") && f !== "README.md");
    const keys = await Promise.all(files.map(async (f) => (await readFile(path.join(root, "functions/email-templates", f), "utf8")).match(/^templateKey:\s*(\w+)$/m)?.[1]));
    expect(keys.every(Boolean)).toBe(true);
    expect(actual.templates.map((t) => t.key).sort()).toEqual(keys.sort());
    const exported = await discoverFunctionContracts(path.join(root, "functions/src"));
    for (const entry of actual.templates) for (const sender of entry.functions) expect(exported.functions.map((n) => n.toLowerCase())).toContain(sender.toLowerCase());
    expect(actual.templates.find((t) => t.key === "emailVerification").functions).toContain("sendNotifyReplyToVerificationTest");
    expect(actual.templates.find((t) => t.key === "emailVerification").functions).toContain("updateUserEmail");
    expect(actual.templates.find((t) => t.key === "bookingPendingApprovalModerator").functions).toEqual(["submitEventBooking", "recoverNotificationDeliveries"]);
    for (const entry of actual.templates) expect(templateFallbackEnvironmentKey(entry.key)).toMatch(/^GOV_NOTIFY_TEMPLATE_[A-Z_]+$/);
  });

  it("resolves the pinned alias before either provider is used and sanitizes provider failures", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "notify-readiness-")); directories.push(directory);
    await mkdir(path.join(directory, "config"));
    await writeFile(path.join(directory, ".firebaserc"), JSON.stringify({ projects: { dev: "wrong-project" } }));
    const configuration = JSON.parse(await readFile(path.join(root, "config/deployment-check.json"), "utf8"));
    await writeFile(path.join(directory, "config/deployment-check.json"), JSON.stringify(configuration));
    await writeFile(path.join(directory, "config/notify-template-readiness.json"), JSON.stringify(contract));
    const provider = { functions: vi.fn(async () => functions()), bindings: vi.fn(async () => [binding()]) };
    await expect(runTemplateReadinessAudit(directory, "dev", provider)).rejects.toThrow(/not expected project/);
    expect(provider.functions).not.toHaveBeenCalled();expect(provider.bindings).not.toHaveBeenCalled();
    await writeFile(path.join(directory, ".firebaserc"), JSON.stringify({ projects: { dev: "sodc-web" } }));
    expect((await runTemplateReadinessAudit(directory, "dev", provider)).summary.fail).toBe(0);
    provider.functions.mockRejectedValue(new Error("PRIVATE_GCLOUD_OUTPUT"));
    const report = await runTemplateReadinessAudit(directory, "dev", provider);
    expect(report.summary.fail).toBe(1);expect(JSON.stringify(report)).not.toContain("PRIVATE_GCLOUD_OUTPUT");
  });

  it("checks the administrator email-correction verification sender, not just the public verification callable", async () => {
    const full = JSON.parse(await readFile(path.join(root, "config/notify-template-readiness.json"), "utf8"));
    const senders = new Map();
    for (const template of full.templates) for (const name of template.functions) {
      if (!senders.has(name)) senders.set(name, fn(name));
      senders.get(name).serviceConfig.environmentVariables[templateFallbackEnvironmentKey(template.key)] = id;
    }
    expect(senders.has("updateUserEmail")).toBe(true);
    delete senders.get("updateUserEmail").serviceConfig.environmentVariables.GOV_NOTIFY_TEMPLATE_EMAIL_VERIFICATION;
    const outcome = assessNotifyTemplateReadiness({ contract: full, functions: [...senders.values()], bindings: [] });
    expect(outcome).toMatchObject({ status: "fail", details: { issues: [{ templateKey: "emailVerification",
      functionName: "updateUserEmail", issue: "missing-binding-and-fallback" }] } });
    expect(assessNotifyTemplateReadiness({ contract: full, functions: [...senders.values()],
      bindings: [{ templateKey: "emailVerification", notifyTemplateId: otherId }] }).status).toBe("pass");
  });

  it("runs the actual provider with only project-scoped metadata commands and the read-only database endpoint", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "notify-readiness-provider-")); directories.push(directory);
    await mkdir(path.join(directory, "config"));
    await writeFile(path.join(directory, ".firebaserc"), JSON.stringify({ projects: { dev: "sodc-web" } }));
    await writeFile(path.join(directory, "config/deployment-check.json"), await readFile(path.join(root, "config/deployment-check.json")));
    await writeFile(path.join(directory, "config/notify-template-readiness.json"), JSON.stringify(contract));
    const metadata = functions();
    await writeFile(path.join(directory, "gcloud"), `#!/usr/bin/env node
const args = process.argv.slice(2);
if (JSON.stringify(args) === JSON.stringify(["functions","list","--v2","--regions=europe-west2","--project","sodc-web","--format=json"])) console.log(${JSON.stringify(JSON.stringify(metadata))});
else if (JSON.stringify(args) === JSON.stringify(["auth","print-access-token"])) console.log("PRIVATE_TOKEN");
else process.exit(2);
`, { mode: 0o755 });
    vi.stubEnv("PATH", `${directory}${path.delimiter}${process.env.PATH}`);
    const transport = vi.fn(async () => ({ ok: true, json: async () => ({ data: { notifyTemplateBindings: [binding()] } }) }));
    vi.stubGlobal("fetch", transport);
    const report = await runTemplateReadinessAudit(directory, "dev");
    expect(report.summary.fail).toBe(0);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toBe("https://firebasedataconnect.googleapis.com/v1/projects/sodc-web/locations/europe-west2/services/sodc-web-service:executeGraphqlRead");
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE_TOKEN|11111111/);
  });

  it.each([undefined, "dataconnect", "functions", "hosting"])("blocks remote deployment when readiness fails, including resume %s", async (from) => {
    const visited = [];
    const execute = async (step) => { visited.push(step.id); if (step.id === "notify-template-readiness") throw new Error("missing-template"); return { stdout: "" }; };
    const plan = applyFromStage(createDeploymentPlan("prod", "abc123"), from);
    await expect(runDeploymentPlan(plan, execute)).rejects.toThrow("missing-template");
    expect(visited.at(-1)).toBe("notify-template-readiness");
    expect(visited).not.toContain("deploy-dataconnect");expect(visited).not.toContain("deploy-functions");expect(visited).not.toContain("deploy-hosting");
    const step = plan.find((s) => s.id === "notify-template-readiness");
    expect(step.args).toEqual(["scripts/notify-template-readiness.mjs", "--env", "prod"]);
  });
});
