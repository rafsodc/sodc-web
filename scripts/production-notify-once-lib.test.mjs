import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {digest} from "./functions-config-guard-lib.mjs";
import {PROJECT, TARGET_NAME, REVIEWED_VERIFIER_COMMIT, EXPECTED_REQUEST, validateProductionOperatorPlan, productionOperatorReviewTemplate,
  validateProductionOperatorReview, productionOperatorIntent, productionOperatorAcknowledgement} from "./production-notify-once-lib.mjs";

const NOW = Date.parse("2026-11-26T12:05:00.000Z"), iso = offset => new Date(NOW + offset).toISOString();
const OPERATOR = {gitSha: "1".repeat(40), tree: "2".repeat(40), trackedSha256: "3".repeat(64), nodeMajor: 24};
const VERIFIER = {gitSha: "d58417688d8253449de8025b801d0df38bbc4d8e", tree: "5".repeat(40), trackedSha256: "6".repeat(64), nodeMajor: 24};
const OPERATION = `projects/${PROJECT}/locations/europe-west2/operations/once-offline-fixture`;
const clone = value => structuredClone(value);
function fixture() {
  const plan = {schemaVersion: "sodc-production-notify-operator-plan/v1", createdAt: iso(-60_000), projectId: PROJECT, target: TARGET_NAME,
    request: clone(EXPECTED_REQUEST), context: {captureReportSha256: "a".repeat(64), limitsBaselineSha256: "b".repeat(64),
      requestSha256: digest(EXPECTED_REQUEST), sourceBindingSha256: "c".repeat(64), comparisonToolBindingSha256: digest(VERIFIER)},
    paths: {verifierRoot: "/private/tmp/operator-fixture/verifier", sourceRoot: "/private/tmp/operator-fixture/source",
      captureDirectory: "/private/tmp/operator-fixture/capture", limitsBaselineFile: "/private/tmp/operator-fixture/inputs/limits.json",
      beforeOutputDirectory: "/private/tmp/operator-fixture/before-new", runDirectory: "/private/tmp/operator-fixture/operator-run"},
    operatorToolBinding: clone(OPERATOR), verifierToolBinding: clone(VERIFIER),
    provenanceBoundary: "ARCHIVE_AND_EXECUTABLE_EQUALITY_UNPROVEN", liveMailEffect: "NORMAL_APPLICATION_MAIL_MAY_RESUME"};
  const review = {...productionOperatorReviewTemplate(plan), decision: "APPROVED", reviewedBy: "Fixture reviewer",
    reason: "Reviewed the exact four references and accepted the stated Production mail and provenance boundaries.",
    reviewedAt: iso(-30_000), expiresAt: iso(30 * 60_000),
    acceptUnprovenSourceAndExecutableEquality: true, acceptLiveApplicationMailEffect: true};
  return {plan, review, operatorToolBinding: clone(OPERATOR), verifierToolBinding: clone(VERIFIER), runDirectory: plan.paths.runDirectory, now: () => NOW};
}
function blocked(fn, code) {
  let error;
  try {fn();} catch (failure) {error = failure;}
  expect(error).toBeInstanceOf(Error); expect(error.code).toBe(code); expect(error.message).toBe(code);
}
beforeEach(() => {vi.stubGlobal("fetch", vi.fn(() => {throw new Error("UNEXPECTED_NETWORK");}));});
afterEach(() => {try {expect(globalThis.fetch).not.toHaveBeenCalled();} finally {vi.restoreAllMocks(); vi.unstubAllGlobals();}});

describe("fixed Production operator plan", () => {
  it("pins the whole request and keeps the exported request immutable", () => {
    expect(PROJECT).toBe("sodc-web-production");
    expect(REVIEWED_VERIFIER_COMMIT).toBe("d58417688d8253449de8025b801d0df38bbc4d8e");
    expect(EXPECTED_REQUEST).toEqual({method: "PATCH",
      url: `https://cloudfunctions.googleapis.com/v2/${TARGET_NAME}?updateMask=serviceConfig.secretEnvironmentVariables`,
      updateMask: "serviceConfig.secretEnvironmentVariables", body: {name: TARGET_NAME, serviceConfig: {secretEnvironmentVariables: [
        {key: "STRIPE_SECRET", secret: "STRIPE_SECRET", projectId: PROJECT, version: "2"},
        {key: "GOV_NOTIFY_LIVE_API_KEY", secret: "GOV_NOTIFY_LIVE_API_KEY", projectId: PROJECT, version: "1"},
        {key: "GOV_NOTIFY_TEAM_API_KEY", secret: "GOV_NOTIFY_TEAM_API_KEY", projectId: PROJECT, version: "1"},
        {key: "GOV_NOTIFY_TEST_API_KEY", secret: "GOV_NOTIFY_TEST_API_KEY", projectId: PROJECT, version: "2"},
      ]}}});
    expect(() => {EXPECTED_REQUEST.body.serviceConfig.secretEnvironmentVariables[0].version = "9";}).toThrow(TypeError);
    expect(() => {EXPECTED_REQUEST.body.serviceConfig.secretEnvironmentVariables.reverse();}).toThrow(TypeError);
  });
  it("returns a detached snapshot before the caller can await or change its input", () => {
    const {plan} = fixture(), checked = validateProductionOperatorPlan(plan);
    plan.request.body.serviceConfig.secretEnvironmentVariables[0].version = "9";
    plan.paths.runDirectory += "-changed";
    expect(checked.request).toEqual(EXPECTED_REQUEST); expect(checked.paths.runDirectory).toBe("/private/tmp/operator-fixture/operator-run");
  });
  it("accepts object-key reordering while preserving binding-array order", () => {
    const {plan} = fixture(); plan.request = Object.fromEntries(Object.entries(plan.request).reverse());
    expect(validateProductionOperatorPlan(plan).request).toEqual(EXPECTED_REQUEST);
  });
  it.each([
    ["project", p => {p.projectId = "sodc-web";}, "invalid-production-operator-plan"],
    ["target", p => {p.target += "other";}, "invalid-production-operator-plan"],
    ["schema", p => {p.schemaVersion = "other";}, "invalid-production-operator-plan"],
    ["created time", p => {p.createdAt = "invalid";}, "invalid-production-operator-plan"],
    ["extra plan field", p => {p.force = true;}, "invalid-production-operator-plan"],
    ["method", p => {p.request.method = "POST";}, "production-operator-request-mismatch"],
    ["endpoint", p => {p.request.url += "&force=true";}, "production-operator-request-mismatch"],
    ["mask", p => {p.request.updateMask = "serviceConfig";}, "production-operator-request-mismatch"],
    ["body target", p => {p.request.body.name += "other";}, "production-operator-request-mismatch"],
    ["extra request field", p => {p.request.extra = undefined;}, "production-operator-request-mismatch"],
    ["extra service field", p => {p.request.body.serviceConfig.environmentVariables = {};}, "production-operator-request-mismatch"],
    ["binding order", p => {p.request.body.serviceConfig.secretEnvironmentVariables.reverse();}, "production-operator-request-mismatch"],
    ["Stripe version", p => {p.request.body.serviceConfig.secretEnvironmentVariables[0].version = "1";}, "production-operator-request-mismatch"],
    ["Notify version", p => {p.request.body.serviceConfig.secretEnvironmentVariables[3].version = "latest";}, "production-operator-request-mismatch"],
    ["binding project", p => {p.request.body.serviceConfig.secretEnvironmentVariables[1].projectId = "688739640159";}, "production-operator-request-mismatch"],
    ["extra binding", p => {p.request.body.serviceConfig.secretEnvironmentVariables.push(clone(p.request.body.serviceConfig.secretEnvironmentVariables[0]));}, "production-operator-request-mismatch"],
    ["missing hash", p => {delete p.context.sourceBindingSha256;}, "invalid-production-operator-context"],
    ["malformed hash", p => {p.context.sourceBindingSha256 = "PRIVATE_VALUE";}, "invalid-production-operator-context"],
    ["request hash", p => {p.context.requestSha256 = "0".repeat(64);}, "invalid-production-operator-context"],
    ["extra context", p => {p.context.force = true;}, "invalid-production-operator-context"],
    ["relative directory", p => {p.paths.sourceRoot = "relative";}, "invalid-production-operator-paths"],
    ["noncanonical directory", p => {p.paths.captureDirectory += "/../capture";}, "invalid-production-operator-paths"],
    ["root directory", p => {p.paths.runDirectory = "/";}, "invalid-production-operator-paths"],
    ["trailing directory separator", p => {p.paths.runDirectory += "/";}, "invalid-production-operator-paths"],
    ["sidecar suffix", p => {p.paths.limitsBaselineFile = "/private/tmp/limits.txt";}, "invalid-production-operator-paths"],
    ["extra path", p => {p.paths.callback = "/private/tmp/extra";}, "invalid-production-operator-paths"],
    ["operator tool", p => {p.operatorToolBinding.nodeMajor = 22;}, "invalid-operator-tool-binding"],
    ["verifier tool", p => {p.verifierToolBinding.nodeMajor = 22;}, "invalid-verifier-tool-binding"],
    ["other verifier commit", p => {p.verifierToolBinding.gitSha = "7".repeat(40); p.context.comparisonToolBindingSha256 = digest(p.verifierToolBinding);}, "production-operator-verifier-commit-mismatch"],
    ["unbound verifier tool", p => {p.verifierToolBinding.trackedSha256 = "7".repeat(64);}, "production-operator-verifier-context-mismatch"],
    ["provenance boundary", p => {p.provenanceBoundary = "PROVEN";}, "production-operator-risk-boundary-mismatch"],
    ["mail boundary", p => {p.liveMailEffect = "NO_MAIL";}, "production-operator-risk-boundary-mismatch"],
  ])("rejects changed %s", (_name, change, code) => {const {plan} = fixture(); change(plan); blocked(() => validateProductionOperatorPlan(plan), code);});
});

describe("exact Production review", () => {
  it("starts with no reviewer, expiry, acceptance or execution authority", () => {
    const {plan} = fixture(); expect(productionOperatorReviewTemplate(plan)).toEqual({schemaVersion: "sodc-production-notify-operator-review/v1",
      planSha256: digest(plan), decision: "REVIEW_REQUIRED", reviewedBy: "", reason: "", reviewedAt: null, expiresAt: null,
      acceptUnprovenSourceAndExecutableEquality: false, acceptLiveApplicationMailEffect: false});
  });
  it("accepts the exact reviewed plan, tools, path and bounded time", () => {
    const f = fixture(), before = digest(f); expect(validateProductionOperatorReview(f)).toBeUndefined(); expect(digest(f)).toBe(before);
    f.now = NOW; expect(validateProductionOperatorReview(f)).toBeUndefined();
  });
  it.each([
    ["review decision", f => {f.review.decision = "REVIEW_REQUIRED";}, "missing-or-invalid-production-operator-review"],
    ["other plan", f => {f.review.planSha256 = "0".repeat(64);}, "missing-or-invalid-production-operator-review"],
    ["extra review", f => {f.review.force = true;}, "missing-or-invalid-production-operator-review"],
    ["blank reviewer", f => {f.review.reviewedBy = " ";}, "missing-or-invalid-production-operator-review"],
    ["too short reviewer", f => {f.review.reviewedBy = "ab";}, "missing-or-invalid-production-operator-review"],
    ["too short reason", f => {f.review.reason = "brief";}, "missing-or-invalid-production-operator-review"],
    ["placeholder reviewer", f => {f.review.reviewedBy = "REPLACE_AFTER_REVIEW";}, "missing-or-invalid-production-operator-review"],
    ["placeholder reason", f => {f.review.reason = "TODO";}, "missing-or-invalid-production-operator-review"],
    ["missing reason", f => {delete f.review.reason;}, "missing-or-invalid-production-operator-review"],
    ["old reviewed time", f => {f.review.reviewedAt = iso(-60_001);}, "production-operator-review-expired-or-clock-invalid"],
    ["future reviewed time", f => {f.review.reviewedAt = iso(1);}, "production-operator-review-expired-or-clock-invalid"],
    ["expired", f => {f.review.expiresAt = iso(0);}, "production-operator-review-expired-or-clock-invalid"],
    ["long expiry", f => {f.review.expiresAt = new Date(Date.parse(f.review.reviewedAt) + 60 * 60_000 + 1).toISOString();}, "production-operator-review-expired-or-clock-invalid"],
    ["null reviewed time", f => {f.review.reviewedAt = null;}, "production-operator-review-expired-or-clock-invalid"],
    ["source risk unaccepted", f => {f.review.acceptUnprovenSourceAndExecutableEquality = false;}, "production-operator-risk-acceptance-required"],
    ["mail effect unaccepted", f => {f.review.acceptLiveApplicationMailEffect = false;}, "production-operator-risk-acceptance-required"],
    ["truthy acceptance", f => {f.review.acceptLiveApplicationMailEffect = "true";}, "production-operator-risk-acceptance-required"],
    ["other operator tool", f => {f.operatorToolBinding.gitSha = "7".repeat(40);}, "production-operator-review-binding-drift"],
    ["other verifier tool", f => {f.verifierToolBinding.gitSha = "7".repeat(40);}, "production-operator-review-binding-drift"],
    ["other run directory", f => {f.runDirectory += "-other";}, "production-operator-review-binding-drift"],
    ["invalid clock", f => {f.now = () => NaN;}, "invalid-production-operator-clock"],
    ["extra input", f => {f.force = true;}, "invalid-production-operator-review-input"],
  ])("rejects %s", (_name, change, code) => {const f = fixture(); change(f); blocked(() => validateProductionOperatorReview(f), code);});
  it("accepts exactly the one-hour expiry and review at plan creation", () => {
    const f = fixture(); f.review.reviewedAt = f.plan.createdAt; f.review.expiresAt = new Date(Date.parse(f.plan.createdAt) + 60 * 60_000).toISOString();
    expect(validateProductionOperatorReview(f)).toBeUndefined();
  });
});

describe("prospective intent and acknowledgement", () => {
  it("writes only the existing749 intent context and a fresh UTC start time", () => {
    const {plan} = fixture(); const intent = productionOperatorIntent(plan, () => NOW);
    expect(intent).toEqual({schemaVersion: "sodc-notify-binding-operator-intent/v1", projectId: PROJECT, target: TARGET_NAME,
      ...plan.context, startedAt: iso(0)});
    plan.context.sourceBindingSha256 = "0".repeat(64); expect(intent.sourceBindingSha256).toBe("c".repeat(64));
    expect(Object.keys(intent).sort()).toEqual(["schemaVersion", "projectId", "target", ...Object.keys(plan.context), "startedAt"].sort());
  });
  it("rejects an intent recorded before its plan", () => {const {plan} = fixture(); blocked(() => productionOperatorIntent(plan, NOW - 60_001), "production-operator-intent-before-plan");});
  it.each([false, true, undefined])("retains only the operation name with done=%s and ignores private response fields", done => {
    const value = {name: OPERATION, done, metadata: {target: TARGET_NAME, verb: "update", PRIVATE: "PRIVATE_METADATA"},
      response: {token: "PRIVATE_TOKEN"}, error: {code: 7, message: "PRIVATE_PROVIDER_MESSAGE"}};
    expect(productionOperatorAcknowledgement(value)).toEqual({name: OPERATION});
    expect(JSON.stringify(productionOperatorAcknowledgement(value))).not.toMatch(/PRIVATE|error|metadata|response/);
  });
  it("supports the actual numeric project spelling only in scoped metadata", () => {
    expect(productionOperatorAcknowledgement({name: OPERATION, metadata: {target: TARGET_NAME.replace(PROJECT, "688739640159"), verb: "update"}})).toEqual({name: OPERATION});
  });
  it.each([
    ["missing name", v => {delete v.name;}], ["foreign project", v => {v.name = v.name.replace(PROJECT, "sodc-web");}],
    ["foreign region", v => {v.name = v.name.replace("europe-west2", "us-central1");}], ["extra segment", v => {v.name += "/other";}],
    ["missing scope", v => {delete v.metadata;}], ["missing target", v => {delete v.metadata.target;}],
    ["foreign target", v => {v.metadata.target += "other";}], ["wrong verb", v => {v.metadata.verb = "create";}],
    ["invalid done", v => {v.done = "true";}], ["null done", v => {v.done = null;}],
  ])("rejects an acknowledgement with %s", (_name, change) => {
    const value = {name: OPERATION, metadata: {target: TARGET_NAME, verb: "update"}}; change(value);
    blocked(() => productionOperatorAcknowledgement(value), "invalid-production-operator-acknowledgement");
  });
  it("sanitizes malformed input getters rather than retaining their exception data", () => {
    const value = {get name() {throw new Error("PRIVATE_PROVIDER_MESSAGE");}};
    blocked(() => productionOperatorAcknowledgement(value), "invalid-production-operator-input");
  });
});
