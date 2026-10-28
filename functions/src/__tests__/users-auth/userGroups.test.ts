import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import * as sdk from "@dataconnect/admin-generated";
import * as security from "../../securityRepository";
import { subscribeToUserGroup, registerForSectionCallable } from "../../userGroups";

const groupId = "00000000-0000-4000-8000-000000000652";
const subscribe = vi.spyOn(sdk, "subscribeToUserGroup");
const register = vi.spyOn(sdk, "registerForSection");
const authority = vi.spyOn(security, "getUserSecurityState");
const readyState = () => ({ data: { userSecurityState: {
  userId: "caller", securityVersion: 1, accessReady: true, syncStatus: "READY", membershipStatus: "REGULAR", adminReady: false,
  user: { membershipStatus: "REGULAR" },
} } });
const request = (data: Record<string, unknown> = {}) => ({
  auth: { uid: "caller", token: { sub: "caller", enabled: true, securityVersion: 1 } },
  data: { userGroupId: groupId, ...data },
});
beforeEach(() => {
  vi.clearAllMocks();
  subscribe.mockReset().mockResolvedValue({ data: {} } as never);
  register.mockReset().mockResolvedValue({ data: {} } as never);
  authority.mockReset().mockImplementation(async () => readyState() as never);
});

for (const { name, callable, mutation, other } of [
  { name: "subscription", callable: subscribeToUserGroup, mutation: subscribe, other: register },
  { name: "section registration", callable: registerForSectionCallable, mutation: register, other: subscribe },
]) describe(name + " verified identity boundary", () => {
  it("uses only the verified caller UID/version, ignoring forged body and nested identity fields", async () => {
    const req = request({ userId: "victim", uid: "victim", securityVersion: 999, auth: { uid: "victim" } });
    await expect(callable.run(req as never)).resolves.toEqual({ success: true });
    expect(authority).toHaveBeenCalledWith({ userId: "caller" });
    expect(mutation).toHaveBeenCalledExactlyOnceWith({ userId: "caller", userGroupId: groupId, securityVersion: 1 });
    expect(other).not.toHaveBeenCalled();
  });
  it("takes the request authentication UID even when token payload names another identity", async () => {
    const req = request(); req.auth.token.sub = "untrusted-token-field";
    await callable.run(req as never);
    expect(mutation).toHaveBeenCalledExactlyOnceWith({ userId: "caller", userGroupId: groupId, securityVersion: 1 });
  });
  it("rejects an unauthenticated caller before the mutation", async () => {
    await expect(callable.run({ data: { userGroupId: groupId, userId: "victim" } } as never)).rejects.toMatchObject({ code: "unauthenticated" });
    expect(mutation).not.toHaveBeenCalled();
  });
  it("rejects disabled claims even for an admin token", async () => {
    await expect(callable.run({ ...request(), auth: { uid: "caller", token: { enabled: false, admin: true, securityVersion: 1 } } } as never)).rejects.toMatchObject({ code: "permission-denied", details: { code: "ACCESS_REVOKED" } });
    expect(authority).not.toHaveBeenCalled(); expect(mutation).not.toHaveBeenCalled();
  });
  for (const kind of ["disabled", "pending", "membership mismatch", "missing", "stale"] as const) it("rejects " + kind + " current authority before the mutation", async () => {
    const state = readyState();
    if (kind === "disabled") state.data.userSecurityState.accessReady = false;
    if (kind === "pending") state.data.userSecurityState.syncStatus = "PENDING";
    if (kind === "membership mismatch") state.data.userSecurityState.user.membershipStatus = "LOST";
    if (kind === "stale") state.data.userSecurityState.securityVersion = 2;
    authority.mockResolvedValueOnce(kind === "missing" ? { data: { userSecurityState: null } } as never : state as never);
    await expect(callable.run(request() as never)).rejects.toMatchObject({ details: { code: kind === "stale" ? "SESSION_VERSION_STALE" : "ACCESS_REVOKED" } });
    expect(mutation).not.toHaveBeenCalled();
  });
  it("rejects an invalid group identifier without writing", async () => {
    await expect(callable.run(request({ userGroupId: "invalid" }) as never)).rejects.toMatchObject({ code: "invalid-argument" });
    expect(mutation).not.toHaveBeenCalled();
  });
  for (const [marker, code] of [
    ["USER_GROUP_NOT_FOUND", "not-found"], ["USER_GROUP_NOT_SUBSCRIBABLE", "permission-denied"],
    ["SESSION_VERSION_STALE", "unauthenticated"], ["ACCESS_REVOKED", "permission-denied"],
  ]) it("preserves the transactional " + marker + " refusal without replaying a join", async () => {
    mutation.mockRejectedValueOnce(new Error("Data Connect transaction rejected: " + marker));
    await expect(callable.run(request() as never)).rejects.toMatchObject({
      code,
      ...(marker === "USER_GROUP_NOT_SUBSCRIBABLE" ? { message: `This group does not allow ${name === "subscription" ? "self-subscription" : "self-registration"}` } : {}),
    });
    expect(mutation).toHaveBeenCalledTimes(1);
  });
  it("preserves deliberate callable errors and sanitizes unexpected connector failures", async () => {
    const deliberate = new HttpsError("unavailable", "Try again later");
    mutation.mockRejectedValueOnce(deliberate);
    await expect(callable.run(request() as never)).rejects.toBe(deliberate);
    mutation.mockRejectedValueOnce(new Error("internal connector diagnostic"));
    await expect(callable.run(request() as never)).rejects.toMatchObject({ code: "internal", message: "Internal server error" });
    expect(mutation).toHaveBeenCalledTimes(2);
  });
});
