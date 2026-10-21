import { beforeEach, describe, expect, it, vi } from "vitest";
import * as firebaseAdmin from "firebase-admin";
import { getUserSecurityState } from "../../securityRepository";
import * as dc from "@dataconnect/admin-generated";
import { authorizePrivilegedNotificationRecipient, readCurrentRecipientState, selectPrivilegedNotificationRecipientIds,
  PrivilegedRecipientLookupError, type CurrentRecipientState } from "../../privilegedNotificationRecipient";

function state(): CurrentRecipientState {
  return { auth: { uid: "staff", disabled: false, emailVerified: true, email: "staff@example.com",
    customClaims: { enabled: true, admin: true, securityVersion: 1 } }, profile: { membershipStatus: "REGULAR", email: "staff@example.com" }, security: {userId: "staff", securityVersion: 1, membershipStatus: "REGULAR", desiredEnabled: true, desiredAdmin: true, accessReady: true, adminReady: true, verificationEmail: null, operationId: "op-1", syncStatus: "READY", user: {membershipStatus: "REGULAR"}} };
}
const adminScope = { kind: "ADMIN" } as const;
const bookingScope = { kind: "BOOKING", sectionId: "section-A" } as const;

describe("current privileged notification eligibility", () => {
  it.each(["REGULAR", "RETIRED", "RESERVE", "INDUSTRY", "CIVIL_SERVICE"])("accepts verified enabled admin with %s status", async (status) => {
    const current = state(); current.profile!.membershipStatus = status; current.security!.membershipStatus = status as never; current.security!.user.membershipStatus = status as never;
    expect(await authorizePrivilegedNotificationRecipient("staff", adminScope, { readCurrentState: async () => current }))
      .toEqual({ eligible: true, recipientUserId: "staff", email: "staff@example.com" });
  });
  it.each([
    ["deleted Auth user", (s: CurrentRecipientState) => { s.auth = null; }, "RECIPIENT_NOT_FOUND"],
    ["different UID", (s: CurrentRecipientState) => { s.auth!.uid = "someone-else"; }, "RECIPIENT_NOT_FOUND"],
    ["disabled", (s: CurrentRecipientState) => { s.auth!.disabled = true; }, "RECIPIENT_DISABLED"],
    ["unverified", (s: CurrentRecipientState) => { s.auth!.emailVerified = false; }, "RECIPIENT_UNVERIFIED"],
    ["email missing", (s: CurrentRecipientState) => { s.auth!.email = ""; }, "RECIPIENT_UNVERIFIED"],
    ["enabled false", (s: CurrentRecipientState) => { s.auth!.customClaims!.enabled = false; }, "RECIPIENT_NOT_ENABLED"],
    ["claims absent", (s: CurrentRecipientState) => { s.auth!.customClaims = undefined; }, "RECIPIENT_NOT_ENABLED"],
    ["profile missing", (s: CurrentRecipientState) => { s.profile = null; }, "RECIPIENT_PROFILE_MISSING"],
    ["admin removed", (s: CurrentRecipientState) => { s.auth!.customClaims!.admin = false; }, "RECIPIENT_AUTHORITY_REVOKED"],
  ] as const)("rejects %s", async (_, change, reason) => {
    const current = state(); change(current);
    expect(await authorizePrivilegedNotificationRecipient("staff", adminScope, { readCurrentState: async () => current }))
      .toEqual({ eligible: false, reason });
  });
  it.each(["PENDING", "RESIGNED", "LOST", "DECEASED", "", "UNKNOWN"])("denies DB %s even with stale enabled/admin claims", async (status) => {
    const current = state(); current.profile!.membershipStatus = status;
    expect(await authorizePrivilegedNotificationRecipient("staff", adminScope, { readCurrentState: async () => current }))
      .toEqual({ eligible: false, reason: "RECIPIENT_RESTRICTED" });
  });
  it.each([
    null,
    {...state().security!, accessReady: false},
    {...state().security!, syncStatus: "PENDING"},
    {...state().security!, securityVersion: 2},
    {...state().security!, verificationEmail: "new@example.com"},
  ])("denies missing, pending, revoked or mismatched DB authority despite fresh enabled/admin Auth flags", async security => {
    const current = state(); current.security = security as never;
    expect(await authorizePrivilegedNotificationRecipient("staff", adminScope, {readCurrentState: async () => current}))
      .toEqual({eligible: false, reason: "RECIPIENT_AUTHORITY_REVOKED"});
  });
  it("uses current DB admin readiness rather than a still-true Auth mirror for privileged mail", async () => {
    const current = state(); current.security!.adminReady = false;
    expect(await authorizePrivilegedNotificationRecipient("staff", adminScope, {readCurrentState: async () => current}))
      .toEqual({eligible: false, reason: "RECIPIENT_AUTHORITY_REVOKED"});
  });
  it.each([true, false])("uses exact section moderator authority (allowed=%s)", async (allowed) => {
    const current = state(); current.auth!.customClaims!.admin = false;
    const canModerate = vi.fn(async () => allowed);
    const result = await authorizePrivilegedNotificationRecipient("staff", bookingScope, { readCurrentState: async () => current, canModerate });
    expect(result.eligible).toBe(allowed);
    expect(canModerate).toHaveBeenCalledWith("section-A", "staff");
  });
  it("does not permit section moderators to receive applicant alerts", async () => {
    const current = state(); current.auth!.customClaims!.admin = false;
    const canModerate = vi.fn(async () => true);
    expect((await authorizePrivilegedNotificationRecipient("staff", adminScope, { readCurrentState: async () => current, canModerate })).eligible).toBe(false);
    expect(canModerate).not.toHaveBeenCalled();
  });
  it("uses the original UID's newly verified address, never its old/reassigned address", async () => {
    const current = state(); current.auth!.email = "NEW@EXAMPLE.COM"; current.profile!.email = "new@example.com";
    expect(await authorizePrivilegedNotificationRecipient("staff", adminScope, { readCurrentState: async (uid) => {
      expect(uid).toBe("staff"); return current;
    } })).toMatchObject({ recipientUserId: "staff", email: "new@example.com" });
  });
  it("fails closed but retryably on Auth/DB email synchronization drift", async () => {
    const current = state(); current.auth!.email = "new@example.com";
    await expect(authorizePrivilegedNotificationRecipient("staff", adminScope, { readCurrentState: async () => current }))
      .rejects.toMatchObject({ code: "RECIPIENT_EMAIL_OUT_OF_SYNC" });
  });
  it("distinguishes a missing section from a temporary scope lookup outage", async () => {
    const current = state(); current.auth!.customClaims!.admin = false;
    const readCurrentState = async () => current;
    expect((await authorizePrivilegedNotificationRecipient("staff", bookingScope, { readCurrentState,
      canModerate: async () => { throw { code: "not-found" }; } })).eligible).toBe(false);
    await expect(authorizePrivilegedNotificationRecipient("staff", bookingScope, { readCurrentState,
      canModerate: async () => { throw new Error("timeout with private details"); } }))
      .rejects.toThrow("RECIPIENT_AUTHORIZATION_LOOKUP_FAILED");
  });
  it("does not expose backend errors or turn temporary state failures into permanent denials", async () => {
    await expect(authorizePrivilegedNotificationRecipient("staff", adminScope, { readCurrentState: async () => { throw new Error("private database contents"); } }))
      .rejects.toMatchObject({ message: "RECIPIENT_AUTHORIZATION_LOOKUP_FAILED" });
  });
  it("deduplicates selected UIDs, removes definitive denials and retains outages for ledger retry", async () => {
    const authorize = vi.fn(async (uid: string) => {
      if (uid === "outage") throw new PrivilegedRecipientLookupError();
      return uid === "ok" ? { eligible: true as const, recipientUserId: uid, email: "ok@example.com" }
        : { eligible: false as const, reason: "RECIPIENT_DISABLED" as const };
    });
    expect(await selectPrivilegedNotificationRecipientIds(["ok", "ok", "denied", "outage"], adminScope, authorize))
      .toEqual(["ok", "outage"]);
  });
});

describe("uncached production recipient state reader", () => {
  const getUser = vi.fn();
  beforeEach(() => {
    vi.spyOn(firebaseAdmin, "auth").mockReturnValue({ getUser } as never);
    vi.spyOn(dc, "getUserMembershipStatus").mockResolvedValue({ data: { user: state().profile } } as never);
    vi.mocked(getUserSecurityState).mockResolvedValue({data: {userSecurityState: state().security}} as never);
    getUser.mockReset().mockResolvedValue(state().auth);
  });
  it("reads Auth and profile for every call", async () => {
    await readCurrentRecipientState("staff"); await readCurrentRecipientState("staff");
    expect(getUser).toHaveBeenCalledTimes(2);
    expect(getUserSecurityState).toHaveBeenCalledWith({userId: "staff"});
    expect(dc.getUserMembershipStatus).toHaveBeenCalledWith({ id: "staff" });
  });
  it("treats only explicit Auth user-not-found as definitive absence", async () => {
    getUser.mockRejectedValueOnce({ code: "auth/user-not-found" });
    expect((await readCurrentRecipientState("staff")).auth).toBeNull();
    getUser.mockRejectedValueOnce({ code: "auth/internal-error", message: "private details" });
    await expect(readCurrentRecipientState("staff")).rejects.toThrow("RECIPIENT_AUTHORIZATION_LOOKUP_FAILED");
  });
  it("preserves profile lookup errors as retryable", async () => {
    vi.mocked(dc.getUserMembershipStatus).mockRejectedValueOnce(new Error("database unavailable"));
    await expect(readCurrentRecipientState("staff")).rejects.toBeInstanceOf(PrivilegedRecipientLookupError);
  });
  it("preserves authority lookup failures as retryable without returning private errors", async () => {
    vi.mocked(getUserSecurityState).mockRejectedValueOnce(new Error("private database detail"));
    await expect(readCurrentRecipientState("staff")).rejects.toMatchObject({message: "RECIPIENT_AUTHORIZATION_LOOKUP_FAILED"});
  });

});
