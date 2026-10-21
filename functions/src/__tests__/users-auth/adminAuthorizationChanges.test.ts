import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
const mocks = vi.hoisted(() => ({transition: vi.fn(), adminRoster: vi.fn()}));
vi.mock("../../currentAuthorizationTransitions", async original => ({...await original<typeof import("../../currentAuthorizationTransitions")>(), transitionUserSecurity: mocks.transition}));
vi.mock("../../rateLimiter", () => ({enforceRateLimit: vi.fn()}));
import { grantAdmin, revokeAdmin } from "../../admin";
import { securityRequestAuthority, securityRequestOperationId, securityIntentHash } from "../../currentAuthorizationTransitions";
const auth = {uid: "actor", token: {admin: true, enabled: true, securityVersion: 1}};
const operationId = "interactive-operation-reference";
beforeEach(() => vi.resetAllMocks());
describe("interactive role changes", () => {
  it.each([grantAdmin, revokeAdmin])("requires a stable operation ID and performs no role work without it", async endpoint => {
    await expect(endpoint.run({auth, data: {uid: "target"}} as never)).rejects.toMatchObject({code: "invalid-argument"});
    expect(mocks.transition).not.toHaveBeenCalled();
  });
  it.each([[grantAdmin, true, "GRANT_ADMIN"], [revokeAdmin, false, "REVOKE_ADMIN"]] as const)("binds the actual actor, current token version and requested role", async (endpoint, admin, reason) => {
    await endpoint.run({auth, data: {uid: "target", operationId, actorId: "forged", actorKind: "OPERATOR", actorSecurityVersion: 99}} as never);
    expect(mocks.transition).toHaveBeenCalledExactlyOnceWith({userId: "target", actorId: "actor", actorKind: "ADMIN", actorSecurityVersion: 1, operationId, admin, reason});
  });
  it("preserves actionable last-admin refusal without reporting success", async () => {
    mocks.transition.mockRejectedValue(new HttpsError("failed-precondition", "Another verified administrator must be ready.", {code: "LAST_ADMIN_REQUIRED"}));
    await expect(revokeAdmin.run({auth, data: {uid: "actor", operationId}} as never)).rejects.toMatchObject({details: {code: "LAST_ADMIN_REQUIRED"}});
  });
  it.each([undefined, "short", "unsafe reference with spaces", "x".repeat(129)])("rejects malformed operation references: %s", value => {
    expect(() => securityRequestOperationId({data: {operationId: value}} as never)).toThrow();
  });
  it("rejects a missing security version rather than accepting a claimed actor kind from data", () => {
    expect(() => securityRequestAuthority({auth: {token: {}}, data: {actorKind: "OPERATOR"}} as never)).toThrow("Refresh your sign-in");
  });
  it("canonical intent binds every mutable input and the trusted actor kind", () => {
    const input = {userId: "target", actorId: "actor", actorKind: "ADMIN" as const, reason: "EMAIL_REVERIFICATION", expectedEmail: "old@example.invalid", verificationEmail: "new@example.invalid"};
    const hash = securityIntentHash(input);
    expect(securityIntentHash({...input, verificationEmail: " NEW@EXAMPLE.INVALID "})).toBe(hash);
    for (const update of [{actorId: "other"}, {userId: "other"}, {expectedEmail: "other@example.invalid"}, {authDisabled: false}, {releaseEmailVerification: true}, {admin: false}, {membershipStatus: "RESERVE" as const}, {actorKind: "OPERATOR" as const}, {reviewToken: "new-review"}]) expect(securityIntentHash({...input, ...update})).not.toBe(hash);
  });
});
