import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserSecurityState } from "../../securityRepository";
import { requireCurrentAuthorization, currentAuthorization } from "../../currentAuthorization";
const lookup = vi.mocked(getUserSecurityState);
function row(overrides = {}) {
  return {userId: "member", securityVersion: 4, membershipStatus: "REGULAR", accessReady: true,
    adminReady: true, syncStatus: "READY", user: {membershipStatus: "REGULAR"}, ...overrides};
}
function request(version: unknown = 4, admin = true) {
  return {auth: {uid: "member", token: {enabled: true, admin, securityVersion: version}}} as never;
}
function returns(value: unknown) {lookup.mockResolvedValueOnce({data: {userSecurityState: value}} as never);}
beforeEach(() => vi.clearAllMocks());
describe("current authorization", () => {
  it.each([null, row({accessReady: false}), row({syncStatus: "PENDING"}), row({user: {membershipStatus: "LOST"}}), row({membershipStatus: "RESIGNED"})])("denies missing, pending, restricted or drifting authority despite enabled JWT claims", async state => {
    returns(state);
    await expect(requireCurrentAuthorization(request())).rejects.toMatchObject({details: {code: "ACCESS_REVOKED"}});
  });
  it.each([undefined, 1, 3, 5, "4", 4.5])("rejects non-current version %s", async version => {
    returns(row());
    const req = {auth: {uid: "member", token: {enabled: true, admin: true, securityVersion: version}}} as never;
    await expect(requireCurrentAuthorization(req)).rejects.toMatchObject({details: {code: "SESSION_VERSION_STALE"}});
  });
  it("does not grant an admin bypass from old role claims", async () => {
    returns(row({adminReady: false}));
    await expect(requireCurrentAuthorization(request(), true)).rejects.toMatchObject({code: "permission-denied"});
  });
  it("allows a refreshed member after admin revocation without granting administrator access", async () => {
    returns(row({adminReady: false}));
    expect(await requireCurrentAuthorization(request(4, false))).toMatchObject({isAdmin: false, securityVersion: 4});
  });
  it("fails closed when the authority cannot be read", async () => {
    lookup.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(requireCurrentAuthorization(request())).rejects.toMatchObject({code: "unavailable"});
  });
  it("does not reuse a successful check across requests with the same UID and token", async () => {
    returns(row()); await requireCurrentAuthorization(request());
    returns(row({accessReady: false}));
    await expect(requireCurrentAuthorization(request())).rejects.toMatchObject({details: {code: "ACCESS_REVOKED"}});
    expect(lookup).toHaveBeenCalledTimes(2);
  });
  it("requires an awaited check before accessing downstream effective permissions", async () => {
    const req = request();
    expect(() => currentAuthorization(req)).toThrow("not checked");
    returns(row()); await requireCurrentAuthorization(req);
    expect(currentAuthorization(req).isAdmin).toBe(true);
    await requireCurrentAuthorization(req, true);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
  it("rejects an absent identity", async () => {
    await expect(requireCurrentAuthorization({} as never)).rejects.toMatchObject({code: "unauthenticated"});
    expect(lookup).not.toHaveBeenCalled();
  });
});
