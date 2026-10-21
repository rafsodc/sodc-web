import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(process.cwd(), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const source = read("dataconnect/authorization-service/security.gql");
function operation(name: string) {return source.split(new RegExp(`(?:mutation|query) ${name}(?:\\(| )`))[1].split(/\n(?:mutation|query) /)[0];}
describe("administrator control and supported writer boundaries", () => {
  it.each(["InitializeUserSecurityState", "InitializePendingEmailHold", "BeginSecurityTransition", "RecordSecurityNoop", "CompleteSecurityTransition", "ConfirmPotentialLostWithAdminSafety"])("serializes %s under a checked conditional control write", name => {
    const body = operation(name); expect(body).toContain("@auth(level: NO_ACCESS) @transaction");
    expect(body).toContain("version: {eq: $expectedControlVersion}"); expect(body).toContain("version_update: {inc: 1}");
    expect(body).toContain("message: \"ADMIN_CONTROL_CONFLICT\"");
    if (name !== "CompleteSecurityTransition") {expect(body).toContain("actorSecurityVersion"); expect(body).toContain("message: \"SECURITY_ACTOR_REVOKED\"");}
  });
  it("initializes an applicant email hold only as denied non-admin authority bound to its pending profile", () => {
    const body = operation("InitializePendingEmailHold");
    expect(body).toContain("response.query.target == null");
    expect(body).toContain("this.membershipStatus == 'PENDING' && this.email == vars.expectedProfileEmail");
    expect(body).toContain("membershipStatus: {eq: PENDING}, email: {eq: $expectedProfileEmail}");
    expect(body).toContain("desiredEnabled: false, desiredAdmin: false");
    expect(body).toContain("accessReady: false, adminReady: false");
    expect(body).toContain("verificationEmail: $verificationEmail");
  });
  it("derives removal and grant deltas from authoritative target/intent and preserves last-admin safety during pending work", () => {
    expect(operation("BeginSecurityTransition")).toContain("response.query.control.readyAdminCount > 1");
    expect(operation("BeginSecurityTransition")).toContain("response.query.target.adminReady ? -1 : 0");
    expect(operation("BeginSecurityTransition")).toContain("accessReady: false, adminReady: false");
    expect(operation("CompleteSecurityTransition")).toContain("syncStatus: {eq: PENDING}, adminReady: {eq: false}");
    expect(operation("CompleteSecurityTransition")).toContain("this.desiredEnabled && this.desiredAdmin");
  });
  it("retains noop readiness while recording its full durable intent", () => {
    const body = operation("RecordSecurityNoop"); expect(body).not.toContain("userSecurityState_update");
    expect(body).toContain("noOp: true"); expect(body).toContain("intentHash: $intentHash");
    expect(body).toContain("response.query.target.accessReady == vars.desiredEnabled");
  });
  it("hard fences development reset before any destructive call, including lookup failure", () => {
    const source = read("functions/scripts/cli-dev-reset.ts"); const entry = source.slice(source.indexOf("// Step 1: Delete all Firebase Auth users"));
    expect(entry.indexOf("await assertFreshDevelopmentReset()")).toBeLessThan(entry.indexOf("await deleteAllAuthUsers()"));
    const guard = read("functions/src/developmentResetSafety.ts");
    expect(guard).toContain("throw new Error(\"Online reset is forbidden");
    expect(guard).toContain("listSecurityStatesForReconciliation({limit: 1, offset: 0})");
    expect(read("functions/scripts/legacy-user-import.ts")).toContain("actorKind: \"OPERATOR\"");
  });
  it("uses the isolated guarded Potential Lost writer exclusively", () => {
    const caller = read("functions/src/potentialLost.ts"); expect(caller).not.toContain("confirmPotentialLostWithSecurityState");
    expect(caller).toContain("persistPotentialLostSecurity(intent");
    const body = operation("ConfirmPotentialLostWithAdminSafety"); expect(body).toContain("!this.desiredAdmin && !this.adminReady");
    expect(body).toContain("potentialLostReview_insert"); expect(body).toContain("expectedEmailDeliveryVersion");
    const strict = read("dataconnect/api/member-review.gql");
    expect(strict).not.toMatch(/mutation ConfirmPotentialLost(?:WithSecurityState)?\(/);
    const compatibility = read("scripts/authorization-compatibility/member-review.gql");
    expect(compatibility).toContain("mutation ConfirmPotentialLost(");
    expect(compatibility).toContain("mutation ConfirmPotentialLostWithSecurityState(");
  });
});
