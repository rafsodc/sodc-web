import path from "node:path";
import {canonical, digest} from "./functions-config-guard-lib.mjs";
import {assertEvidenceToolBinding} from "./notify-binding-evidence-lib.mjs";

export const PROJECT = "sodc-web-production";
export const TARGET_NAME = `projects/${PROJECT}/locations/europe-west2/functions/reconcileMyCheckoutSessionOrders`;
export const REVIEWED_VERIFIER_COMMIT = "d58417688d8253449de8025b801d0df38bbc4d8e";
const freeze = value => {for (const child of Object.values(value)) if (child && typeof child === "object") freeze(child); return Object.freeze(value);};
export const EXPECTED_REQUEST = freeze({method: "PATCH",
  url: `https://cloudfunctions.googleapis.com/v2/${TARGET_NAME}?updateMask=serviceConfig.secretEnvironmentVariables`,
  updateMask: "serviceConfig.secretEnvironmentVariables", body: {name: TARGET_NAME, serviceConfig: {secretEnvironmentVariables: [
    ["STRIPE_SECRET", "2"], ["GOV_NOTIFY_LIVE_API_KEY", "1"], ["GOV_NOTIFY_TEAM_API_KEY", "1"], ["GOV_NOTIFY_TEST_API_KEY", "2"],
  ].map(([key, version]) => ({key, secret: key, projectId: PROJECT, version}))}}});

const CONTEXT_KEYS = ["captureReportSha256", "limitsBaselineSha256", "requestSha256", "sourceBindingSha256", "comparisonToolBindingSha256"];
const PATH_KEYS = ["verifierRoot", "sourceRoot", "captureDirectory", "limitsBaselineFile", "beforeOutputDirectory", "runDirectory"];
const REVIEW_KEYS = ["schemaVersion", "planSha256", "decision", "reviewedBy", "reason", "reviewedAt", "expiresAt",
  "acceptUnprovenSourceAndExecutableEquality", "acceptLiveApplicationMailEffect"];
class OperatorProtocolError extends Error {constructor(code) {super(code); this.code = code;}}
const need = (value, code) => {if (!value) throw new OperatorProtocolError(code);};
const safe = fn => {try {return fn();} catch (error) {if (error instanceof OperatorProtocolError) throw error; throw new OperatorProtocolError("invalid-production-operator-input");}};
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys) => object(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const same = (a, b) => digest(a) === digest(b);
const exactValue = (value, expected) => Array.isArray(expected) ? Array.isArray(value) && value.length === expected.length &&
  expected.every((child, index) => exactValue(value[index], child)) : object(expected) ? exact(value, Object.keys(expected)) &&
    Object.entries(expected).every(([name, child]) => exactValue(value[name], child)) : value === expected;
const timestamp = value => typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
const directory = value => typeof value === "string" && value.length <= 4096 && !value.includes("\0") &&
  path.isAbsolute(value) && path.normalize(value) === value && value !== path.parse(value).root && !value.endsWith(path.sep);
const clock = now => {const value = typeof now === "function" ? now() : now; need(Number.isFinite(value) && Number.isFinite(new Date(value).getTime()), "invalid-production-operator-clock"); return value;};
function tool(value, kind) {try {assertEvidenceToolBinding(value);} catch {throw new OperatorProtocolError(`invalid-${kind}-tool-binding`);}}
function meaningful(value, minimum) {
  return typeof value === "string" && value.trim().length >= minimum && value.length <= 2000 &&
    !/^(?:REPLACE(?:[_ -].*)?|TODO|TBD|REVIEWER|REASON|YOUR[ _-]?NAME|N\/?A)$/i.test(value.trim());
}

/** Validate and detach the reviewed plan before any caller awaits provider work. */
export function validateProductionOperatorPlan(plan) {
  return safe(() => {
    need(exact(plan, ["schemaVersion", "createdAt", "projectId", "target", "request", "context", "paths", "operatorToolBinding",
      "verifierToolBinding", "provenanceBoundary", "liveMailEffect"]) && plan.schemaVersion === "sodc-production-notify-operator-plan/v1" &&
      plan.projectId === PROJECT && plan.target === TARGET_NAME && timestamp(plan.createdAt), "invalid-production-operator-plan");
    need(exactValue(plan.request, EXPECTED_REQUEST), "production-operator-request-mismatch");
    need(exact(plan.context, CONTEXT_KEYS) && CONTEXT_KEYS.every(key => typeof plan.context[key] === "string" && /^[a-f0-9]{64}$/.test(plan.context[key])) &&
      plan.context.requestSha256 === digest(EXPECTED_REQUEST), "invalid-production-operator-context");
    need(exact(plan.paths, PATH_KEYS) && PATH_KEYS.every(key => directory(plan.paths[key])) &&
      /^[A-Za-z0-9_.-]+\.json$/.test(path.basename(plan.paths.limitsBaselineFile)), "invalid-production-operator-paths");
    tool(plan.operatorToolBinding, "operator"); tool(plan.verifierToolBinding, "verifier");
    need(plan.verifierToolBinding.gitSha === REVIEWED_VERIFIER_COMMIT, "production-operator-verifier-commit-mismatch");
    need(plan.context.comparisonToolBindingSha256 === digest(plan.verifierToolBinding), "production-operator-verifier-context-mismatch");
    need(plan.provenanceBoundary === "ARCHIVE_AND_EXECUTABLE_EQUALITY_UNPROVEN" &&
      plan.liveMailEffect === "NORMAL_APPLICATION_MAIL_MAY_RESUME", "production-operator-risk-boundary-mismatch");
    return canonical(structuredClone(plan));
  });
}

export function productionOperatorReviewTemplate(plan) {
  return safe(() => ({schemaVersion: "sodc-production-notify-operator-review/v1", planSha256: digest(validateProductionOperatorPlan(plan)),
    decision: "REVIEW_REQUIRED", reviewedBy: "", reason: "", reviewedAt: null, expiresAt: null,
    acceptUnprovenSourceAndExecutableEquality: false, acceptLiveApplicationMailEffect: false}));
}

export function validateProductionOperatorReview(options = {}) {
  return safe(() => {
    need(exact(options, ["plan", "review", "operatorToolBinding", "verifierToolBinding", "runDirectory", "now"]) ||
      exact(options, ["plan", "review", "operatorToolBinding", "verifierToolBinding", "runDirectory"]), "invalid-production-operator-review-input");
    const plan = validateProductionOperatorPlan(options.plan), review = options.review, now = clock(options.now ?? Date.now);
    need(exact(review, REVIEW_KEYS) && review.schemaVersion === "sodc-production-notify-operator-review/v1" &&
      review.decision === "APPROVED" && review.planSha256 === digest(plan) && meaningful(review.reviewedBy, 3) && meaningful(review.reason, 12),
    "missing-or-invalid-production-operator-review");
    need(timestamp(review.reviewedAt) && timestamp(review.expiresAt) && Date.parse(review.reviewedAt) >= Date.parse(plan.createdAt) &&
      Date.parse(review.reviewedAt) <= now && Date.parse(review.expiresAt) > now &&
      Date.parse(review.expiresAt) <= Date.parse(review.reviewedAt) + 60 * 60 * 1000, "production-operator-review-expired-or-clock-invalid");
    need(review.acceptUnprovenSourceAndExecutableEquality === true && review.acceptLiveApplicationMailEffect === true,
      "production-operator-risk-acceptance-required");
    tool(options.operatorToolBinding, "operator"); tool(options.verifierToolBinding, "verifier");
    need(same(options.operatorToolBinding, plan.operatorToolBinding) && same(options.verifierToolBinding, plan.verifierToolBinding) &&
      options.runDirectory === plan.paths.runDirectory, "production-operator-review-binding-drift");
  });
}

export function productionOperatorIntent(plan, now = Date.now) {
  return safe(() => {
    const checked = validateProductionOperatorPlan(plan), value = clock(now);
    need(value >= Date.parse(checked.createdAt), "production-operator-intent-before-plan");
    return {schemaVersion: "sodc-notify-binding-operator-intent/v1", projectId: PROJECT, target: TARGET_NAME,
      ...checked.context, startedAt: new Date(value).toISOString()};
  });
}

/** Retain only the acknowledged name; a completed error still needs read-only verification. */
export function productionOperatorAcknowledgement(value) {
  return safe(() => {
    need(object(value) && typeof value.name === "string" && value.name.length <= 512 &&
      /^projects\/sodc-web-production\/locations\/europe-west2\/operations\/[A-Za-z0-9_-]+$/.test(value.name) &&
      (value.done === undefined || typeof value.done === "boolean") && object(value.metadata) &&
      [TARGET_NAME, TARGET_NAME.replace(PROJECT, "688739640159")].includes(value.metadata.target) && value.metadata.verb === "update",
    "invalid-production-operator-acknowledgement");
    return {name: value.name};
  });
}
