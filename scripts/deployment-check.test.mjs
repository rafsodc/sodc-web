import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RESULT_STATUS,
  assessAppCheckEnforcement,
  assessAuthConfiguration,
  assessDefinitionsFreshness,
  assessGovNotifyReplyToConfiguration,
  assessFunctionInvokerPolicies,
  assessServiceAccountProjectScope,
  assessStorageRulesContent,
  assessUnauthenticatedStorageProbe,
  compareExpected,
  createReport,
  discoverFunctionContracts,
  emitReport,
  exitCodeFor,
  isPublicInvokerPolicy,
  parseArguments,
  parseJsonOutput,
  redact,
  resolveTarget,
  result,
  safeErrorMessage,
  unwrapFirebaseResult,
} from "./deployment-check-lib.mjs";

const fixtureDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__/functions"
);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("deployment check configuration", () => {
  const configuration = {
    region: "europe-west2",
    environments: {
      dev: {
        projectId: "example-dev",
        viteMode: "development",
        hostingSite: "example-dev",
        hostingUrl: "https://example-dev.web.app",
        storageBucket: "example-dev.firebasestorage.app",
      },
    },
  };

  it("resolves an alias only when .firebaserc and expectations agree", () => {
    expect(resolveTarget({ projects: { dev: "example-dev" } }, configuration, "dev")).toMatchObject({
      alias: "dev",
      projectId: "example-dev",
      region: "europe-west2",
    });

    expect(() =>
      resolveTarget({ projects: { dev: "wrong-project" } }, configuration, "dev")
    ).toThrow(/not expected project/);
  });

  it("rejects unknown or incomplete CLI targets", () => {
    expect(() => parseArguments([])).toThrow(/--env is required/);
    expect(() => parseArguments(["--env", "production"])).toThrow(/dev, beta, or prod/);
    expect(parseArguments(["--env", "prod", "--json", "--expected-sha", "abc"])).toEqual({
      authenticated: false,
      env: "prod",
      expectedSha: "abc",
      json: true,
    });
  });

  it("parses --out for retaining the JSON report as a file", () => {
    expect(parseArguments(["--env", "beta", "--out", "report.json"])).toEqual({
      authenticated: false,
      env: "beta",
      json: false,
      out: "report.json",
    });
  });
});

describe("deployment check parsing and comparison", () => {
  it("parses clean JSON and Firebase JSON preceded by a warning", () => {
    expect(parseJsonOutput('{"status":"success","result":[]}')).toEqual({
      status: "success",
      result: [],
    });
    expect(parseJsonOutput('warning from CLI\n{"result":[{"id":"one"}]}')).toEqual({
      result: [{ id: "one" }],
    });
    expect(unwrapFirebaseResult({ result: ["one"] })).toEqual(["one"]);
  });

  it("compares expected resources case-insensitively", () => {
    expect(compareExpected(["One", "Two"], ["one", "THREE"])).toEqual(["Two"]);
  });

  it("assesses deployed GOV.UK Notify reply-to UUID configuration", () => {
    const replyToId = "11111111-1111-4111-8111-111111111111";
    expect(assessGovNotifyReplyToConfiguration([
      {
        name: "projects/example/locations/europe-west2/functions/one",
        serviceConfig: { environmentVariables: { GOV_NOTIFY_EMAIL_REPLY_TO_ID: replyToId } },
      },
      {
        name: "projects/example/locations/europe-west2/functions/two",
        serviceConfig: { environmentVariables: { GOV_NOTIFY_EMAIL_REPLY_TO_ID: ` ${replyToId} ` } },
      },
    ])).toEqual({
      configuredFunctions: ["one", "two"],
      missingFunctions: [],
      invalidFunctions: [],
      distinctValueCount: 1,
    });

    expect(assessGovNotifyReplyToConfiguration([
      { name: "configured", serviceConfig: { environmentVariables: { GOV_NOTIFY_EMAIL_REPLY_TO_ID: replyToId } } },
      { name: "missing", serviceConfig: { environmentVariables: {} } },
      { name: "invalid", serviceConfig: { environmentVariables: { GOV_NOTIFY_EMAIL_REPLY_TO_ID: "not-a-uuid" } } },
    ])).toEqual({
      configuredFunctions: ["configured"],
      missingFunctions: ["missing"],
      invalidFunctions: ["invalid"],
      distinctValueCount: 1,
    });

    expect(assessGovNotifyReplyToConfiguration([
      { name: "one", serviceConfig: { environmentVariables: { GOV_NOTIFY_EMAIL_REPLY_TO_ID: replyToId } } },
      { name: "two", serviceConfig: { environmentVariables: { GOV_NOTIFY_EMAIL_REPLY_TO_ID: "22222222-2222-4222-8222-222222222222" } } },
    ]).distinctValueCount).toBe(2);
  });

  it("redacts sensitive fields and URL credentials from reports", () => {
    expect(
      redact({
        accessToken: "top-secret",
        message: "Authorization: Bearer abc.def and ?code=private-value",
      })
    ).toEqual({
      accessToken: "[REDACTED]",
      message: "Authorization: Bearer [REDACTED] and ?code=[REDACTED]",
    });

    expect(
      redact(
        "https://storage.example/object?X-Goog-Credential=service%40example&X-Goog-Signature=signature-value&X-Amz-Security-Token=session-value"
      )
    ).toBe(
      "https://storage.example/object?X-Goog-Credential=[REDACTED]&X-Goog-Signature=[REDACTED]&X-Amz-Security-Token=[REDACTED]"
    );
  });

  it("normalises thrown values and redacts summaries as defence in depth", () => {
    expect(safeErrorMessage(new Error("Bearer secret-token"))).toBe("Bearer [REDACTED]");
    expect(safeErrorMessage("request failed?signature=private-value")).toBe(
      "request failed?signature=[REDACTED]"
    );
    expect(safeErrorMessage({ reason: "no message" })).toBe("Unknown error");
    expect(
      result(
        "safe-summary",
        RESULT_STATUS.FAIL,
        "request failed with Bearer secret-token"
      ).summary
    ).toBe("request failed with Bearer [REDACTED]");
  });

  it("discovers deployed Function and Secret contracts from source fixtures", async () => {
    await expect(discoverFunctionContracts(fixtureDirectory)).resolves.toEqual({
      functions: ["sampleCallable", "sampleTask", "sampleWebhook"],
      publicInvokerFunctions: ["sampleCallable", "sampleWebhook"],
      secrets: ["SAMPLE_SECRET"],
    });
  });

  it("keeps the reviewed public-invoker allowlist aligned with HTTP and callable exports", async () => {
    const [contracts, configuration] = await Promise.all([
      discoverFunctionContracts(path.join(repositoryRoot, "functions/src")),
      readFile(path.join(repositoryRoot, "config/deployment-check.json"), "utf8").then(JSON.parse),
    ]);

    expect(configuration.expectedPublicInvokerFunctions).toEqual(
      contracts.publicInvokerFunctions
    );
  });

  it("recognises only public invoker principals on invoker roles", () => {
    expect(
      isPublicInvokerPolicy({
        bindings: [{ role: "roles/run.invoker", members: ["allUsers"] }],
      })
    ).toBe(true);
    expect(
      isPublicInvokerPolicy({
        bindings: [{ role: "roles/run.viewer", members: ["allUsers"] }],
      })
    ).toBe(false);
    expect(
      isPublicInvokerPolicy({
        bindings: [
          { role: "roles/run.invoker", members: ["serviceAccount:runtime@example.test"] },
        ],
      })
    ).toBe(false);
  });

  it("reports unexpected public, unexpectedly private, unreadable, and missing IAM audits", () => {
    expect(
      assessFunctionInvokerPolicies(
        [
          { functionName: "expectedPublic", publiclyInvokable: true },
          { functionName: "unexpectedPublic", publiclyInvokable: true },
          { functionName: "expectedPrivate", publiclyInvokable: false },
          { functionName: "unreadable", error: "permission denied" },
        ],
        ["expectedPublic", "expectedButPrivate", "missingFunction"]
      )
    ).toEqual({
      unreadable: ["unreadable"],
      unexpectedlyPublic: ["unexpectedPublic"],
      unexpectedlyPrivate: [],
      missingAudits: ["expectedButPrivate", "missingFunction"],
    });

    expect(
      assessFunctionInvokerPolicies(
        [{ functionName: "expectedButPrivate", publiclyInvokable: false }],
        ["expectedButPrivate"]
      ).unexpectedlyPrivate
    ).toEqual(["expectedButPrivate"]);
  });

  it("uses failures—not warnings or skipped checks—to determine the exit code", () => {
    expect(exitCodeFor([{ status: RESULT_STATUS.WARN }, { status: RESULT_STATUS.SKIP }])).toBe(0);
    expect(exitCodeFor([{ status: RESULT_STATUS.PASS }, { status: RESULT_STATUS.FAIL }])).toBe(1);
  });

  it("builds a machine-readable summary without leaking detail fields", () => {
    const report = createReport(
      { alias: "dev", projectId: "example-dev" },
      [
        { status: RESULT_STATUS.PASS, summary: "ok" },
        { status: RESULT_STATUS.WARN, summary: "review", details: { secretValue: "hidden" } },
      ]
    );
    expect(report.schemaVersion).toBe("sodc-deployment-check-report/v1");
    expect(report.summary).toEqual({ pass: 1, fail: 0, warn: 1, skip: 0 });
    expect(report.results[1].details.secretValue).toBe("[REDACTED]");
  });

  it("prints only, without writing a file, when --out is omitted", async () => {
    const report = createReport({ alias: "dev", projectId: "example-dev" }, [
      { status: RESULT_STATUS.PASS, summary: "ok" },
    ]);
    const logged = [];
    await emitReport(report, { json: true }, { log: (line) => logged.push(line) });
    expect(logged).toHaveLength(1);
    expect(JSON.parse(logged[0])).toEqual(report);
  });

  it("writes the exact JSON report to --out in addition to printing it", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "deployment-check-"));
    const outPath = path.join(directory, "report.json");
    try {
      const report = createReport({ alias: "beta", projectId: "example-beta" }, [
        { status: RESULT_STATUS.FAIL, summary: "broken" },
      ]);
      const logged = [];
      await emitReport(report, { json: false, out: outPath }, { log: (line) => logged.push(line) });

      expect(logged).toHaveLength(1);
      expect(logged[0]).not.toBe(JSON.stringify(report, null, 2)); // human form on stdout when json isn't set
      expect(JSON.parse(await readFile(outPath, "utf8"))).toEqual(report);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails App Check audit when no services are registered", () => {
    expect(assessAppCheckEnforcement([]).status).toBe(RESULT_STATUS.FAIL);
  });

  it("fails when any configured App Check service is absent from the provider response", () => {
    const outcome = assessAppCheckEnforcement(
      [{ name: "projects/1/services/firebasestorage.googleapis.com", enforcementMode: "ENFORCED" }],
      ["firebasestorage.googleapis.com", "identitytoolkit.googleapis.com"],
    );
    expect(outcome.status).toBe(RESULT_STATUS.FAIL);
    expect(outcome.details.missingServices).toEqual(["identitytoolkit.googleapis.com"]);
  });

  it("warns when App Check is registered but not fully enforced", () => {
    const services = [
      { name: "projects/1/services/firebasestorage.googleapis.com", enforcementMode: "ENFORCED" },
      { name: "projects/1/services/identitytoolkit.googleapis.com", enforcementMode: "UNENFORCED" },
    ];
    const outcome = assessAppCheckEnforcement(
      services,
      ["firebasestorage.googleapis.com", "identitytoolkit.googleapis.com"],
    );
    expect(outcome.status).toBe(RESULT_STATUS.WARN);
    expect(outcome.details.services).toEqual([
      { name: "firebasestorage.googleapis.com", enforcementMode: "ENFORCED" },
      { name: "identitytoolkit.googleapis.com", enforcementMode: "UNENFORCED" },
    ]);
  });

  it("passes App Check audit once every checked service is enforced", () => {
    expect(
      assessAppCheckEnforcement(
        [{ name: "projects/1/services/firebasestorage.googleapis.com", enforcementMode: "ENFORCED" }],
        ["firebasestorage.googleapis.com"],
      ).status
    ).toBe(RESULT_STATUS.PASS);
  });

  it("fails auth audit for disabled sign-in, missing domains, or stray localhost", () => {
    expect(
      assessAuthConfiguration(
        { signIn: { email: { enabled: false } }, authorizedDomains: ["example.web.app"] },
        ["example.web.app"],
        false
      ).status
    ).toBe(RESULT_STATUS.FAIL);

    const missingDomain = assessAuthConfiguration(
      { signIn: { email: { enabled: true } }, authorizedDomains: ["example.web.app"] },
      ["example.web.app", "example.firebaseapp.com"],
      false
    );
    expect(missingDomain.status).toBe(RESULT_STATUS.FAIL);
    expect(missingDomain.summary).toMatch(/example\.firebaseapp\.com/);

    expect(
      assessAuthConfiguration(
        {
          signIn: { email: { enabled: true } },
          authorizedDomains: ["example.web.app", "localhost"],
        },
        ["example.web.app"],
        false
      ).status
    ).toBe(RESULT_STATUS.FAIL);
  });

  it("passes auth audit when localhost is explicitly allowed", () => {
    expect(
      assessAuthConfiguration(
        {
          signIn: { email: { enabled: true } },
          authorizedDomains: ["example.web.app", "localhost"],
        },
        ["example.web.app"],
        true
      ).status
    ).toBe(RESULT_STATUS.PASS);
  });

  it("compares deployed and checked-in Storage rules ignoring trailing whitespace", () => {
    expect(assessStorageRulesContent("allow read;\n", "allow read;  \n").status).toBe(
      RESULT_STATUS.PASS
    );
    expect(assessStorageRulesContent("allow read;", "allow read, write;").status).toBe(
      RESULT_STATUS.FAIL
    );
  });

  it.each([401, 403])("passes the Storage probe only for an explicit HTTP %s denial", (status) => {
    expect(assessUnauthenticatedStorageProbe(status).status).toBe(RESULT_STATUS.PASS);
  });

  it.each([200, 404, 429, 500, 503])(
    "fails the Storage probe for HTTP %s instead of treating it as denied",
    (status) => {
      expect(assessUnauthenticatedStorageProbe(status).status).toBe(RESULT_STATUS.FAIL);
    }
  );

  it("fails service-account project scope audit when any project-level role exists", () => {
    const outcome = assessServiceAccountProjectScope("scanner@example.iam.gserviceaccount.com", [
      "roles/editor",
    ]);
    expect(outcome.status).toBe(RESULT_STATUS.FAIL);
    expect(outcome.summary).toMatch(/roles\/editor/);
  });

  it("passes service-account project scope audit when no project-level roles exist", () => {
    expect(assessServiceAccountProjectScope("scanner@example.iam.gserviceaccount.com", []).status).toBe(
      RESULT_STATUS.PASS
    );
  });

  it("fails definitions freshness audit for a disabled schedule, failed attempt, or stale attempt", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    expect(
      assessDefinitionsFreshness({
        schedulerState: "PAUSED",
        lastAttemptTime: "2026-01-01T11:00:00Z",
        lastAttemptFailed: false,
        now,
        maxAgeHours: 3,
      }).status
    ).toBe(RESULT_STATUS.FAIL);

    expect(
      assessDefinitionsFreshness({
        schedulerState: "ENABLED",
        lastAttemptTime: "2026-01-01T11:00:00Z",
        lastAttemptFailed: true,
        now,
        maxAgeHours: 3,
      }).status
    ).toBe(RESULT_STATUS.FAIL);

    expect(
      assessDefinitionsFreshness({
        schedulerState: "ENABLED",
        lastAttemptTime: "2026-01-01T08:00:00Z",
        lastAttemptFailed: false,
        now,
        maxAgeHours: 3,
      }).status
    ).toBe(RESULT_STATUS.FAIL);
  });

  it("passes definitions freshness audit for an enabled schedule with a recent successful attempt", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    expect(
      assessDefinitionsFreshness({
        schedulerState: "ENABLED",
        lastAttemptTime: "2026-01-01T10:00:00Z",
        lastAttemptFailed: false,
        now,
        maxAgeHours: 3,
      }).status
    ).toBe(RESULT_STATUS.PASS);
  });
});
