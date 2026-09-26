import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), updateUser: vi.fn(), revokeRefreshTokens: vi.fn(),
  getUserById: vi.fn(), acquireUserEmailLease: vi.fn(), releaseUserEmailLease: vi.fn(), updateUserEmailFromAuth: vi.fn(),
  enforceRateLimit: vi.fn(), requestEmailVerificationForUser: vi.fn(),
}));
vi.mock("firebase-admin", () => ({ auth: () => mocks }));
vi.mock("@dataconnect/admin-generated", () => mocks);
vi.mock("../../rateLimiter", () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock("../../authEmailActions", async (original) => ({
  ...await original<typeof import("../../authEmailActions")>(),
  requestEmailVerificationForUser: mocks.requestEmailVerificationForUser,
}));
vi.mock("../../mailer", () => ({ govNotifySecrets: [], createConfiguredGovNotifyMailer: vi.fn() }));

import { updateUserEmail } from "../../adminUserEmail";
import { withUserEmailLease } from "../../userEmailSync";
import { reconcileMyEmail } from "../../authEmailActions";

const data = { userId: "member", email: " New@Example.org ", expectedEmail: "old@example.org" };
const auth = { uid: "admin", token: { admin: true, enabled: true } };
function run(input = data, caller: unknown = auth) {
  return updateUserEmail.run({ data: input, auth: caller } as Parameters<typeof updateUserEmail.run>[0]);
}

describe("administrator email changes", () => {
  let account: { uid: string; email: string; emailVerified: boolean };
  beforeEach(() => {
    vi.resetAllMocks();
    account = { uid: "member", email: "old@example.org", emailVerified: true };
    mocks.getUser.mockImplementation(async () => ({ ...account }));
    mocks.updateUser.mockImplementation(async (_uid, changes) => {
      account = { ...account, ...changes };
      return { ...account };
    });
    mocks.getUserById.mockResolvedValue({ data: { user: { id: "member" } } });
  });

  it("normalises the address, changes Auth without changing identity/claims, revokes sessions and synchronises the profile", async () => {
    const result = await run();
    expect(result).toEqual({ success: true, email: "new@example.org", verificationRequired: true, verificationEmailSent: true });
    expect(mocks.updateUser).toHaveBeenCalledWith("member", { email: "new@example.org", emailVerified: false });
    expect(mocks.revokeRefreshTokens).toHaveBeenCalledWith("member");
    expect(mocks.updateUserEmailFromAuth).toHaveBeenCalledWith({ userId: "member", email: "new@example.org", changedBy: "admin", leaseId: expect.any(String) });
    expect(mocks.requestEmailVerificationForUser).toHaveBeenCalledWith("new@example.org", expect.any(Object));
    expect(mocks.releaseUserEmailLease).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith("admin user-email update started", { actorUid: "admin", userId: "member", outcome: "started" });
    expect(logger.info).toHaveBeenCalledWith("admin user-email update completed", {
      actorUid: "admin", userId: "member", outcome: "changed", verificationEmailSent: true,
    });
  });

  it.each([
    [undefined, "unauthenticated"],
    [{ uid: "member", token: { enabled: true } }, "permission-denied"],
    [{ uid: "admin", token: { admin: true, enabled: false } }, "permission-denied"],
  ])("rejects callers without enabled administrator access", async (caller, code) => {
    // Explicit undefined must not fall through the helper's default argument.
    await expect(updateUserEmail.run({ data, auth: caller } as Parameters<typeof updateUserEmail.run>[0])).rejects.toMatchObject({ code });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.acquireUserEmailLease).not.toHaveBeenCalled();
  });

  it("validates before any write", async () => {
    await expect(run({ ...data, email: "invalid" })).rejects.toMatchObject({ code: "invalid-argument" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.acquireUserEmailLease).not.toHaveBeenCalled();
  });

  it("does not mutate Auth without an existing profile", async () => {
    mocks.getUserById.mockResolvedValue({ data: { user: null } });
    await expect(run()).rejects.toMatchObject({ code: "not-found" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("reports missing Auth accounts and releases the lease", async () => {
    mocks.getUser.mockRejectedValue({ code: "auth/user-not-found" });
    await expect(run()).rejects.toMatchObject({ code: "not-found" });
    expect(mocks.releaseUserEmailLease).toHaveBeenCalledOnce();
  });

  it("rejects a stale administrator form", async () => {
    account.email = "someone-else@example.org";
    await expect(run()).rejects.toMatchObject({ details: { code: "EMAIL_CHANGE_CONFLICT" } });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects a duplicate email without writing the attempted address to the profile", async () => {
    mocks.updateUser.mockRejectedValue({ code: "auth/email-already-exists" });
    await expect(run()).rejects.toMatchObject({ code: "already-exists" });
    expect(mocks.updateUserEmailFromAuth).toHaveBeenCalledWith(expect.objectContaining({ email: "old@example.org" }));
    expect(mocks.revokeRefreshTokens).not.toHaveBeenCalled();
    expect(mocks.requestEmailVerificationForUser).not.toHaveBeenCalled();
  });

  it("does not reset verification or revoke sessions for an unchanged verified address", async () => {
    const result = await run({ ...data, email: "old@example.org" });
    expect(result.verificationRequired).toBe(false);
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.revokeRefreshTokens).not.toHaveBeenCalled();
    expect(mocks.requestEmailVerificationForUser).not.toHaveBeenCalled();
    expect(mocks.updateUserEmailFromAuth).toHaveBeenCalledWith(expect.objectContaining({ email: "old@example.org" }));
  });

  it("repairs a transient profile failure and explicitly requests a retry", async () => {
    mocks.updateUserEmailFromAuth.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(run()).rejects.toMatchObject({ details: { code: "EMAIL_CHANGE_INCOMPLETE" } });
    expect(mocks.updateUserEmailFromAuth).toHaveBeenCalledTimes(2);
    expect(account.email).toBe("new@example.org");
    expect(mocks.requestEmailVerificationForUser).not.toHaveBeenCalled();
    await expect(run()).resolves.toMatchObject({ success: true });
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
  });

  it("does not report success if both the profile write and repair fail; the same request can recover", async () => {
    mocks.updateUserEmailFromAuth.mockRejectedValue(new Error("database unavailable"));
    await expect(run()).rejects.toMatchObject({ details: { code: "EMAIL_CHANGE_INCOMPLETE" } });
    mocks.updateUserEmailFromAuth.mockResolvedValue({});
    await expect(run()).resolves.toMatchObject({ email: "new@example.org" });
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
  });

  it("recovers an Auth update whose successful response was lost", async () => {
    mocks.updateUser.mockImplementationOnce(async () => {
      account.email = "new@example.org";
      account.emailVerified = false;
      throw new Error("response lost");
    });
    await expect(run()).rejects.toMatchObject({ details: { code: "EMAIL_CHANGE_INCOMPLETE" } });
    await expect(run()).resolves.toMatchObject({ success: true });
    expect(mocks.revokeRefreshTokens).toHaveBeenCalledWith("member");
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
  });

  it("requires revocation to succeed and retries it after a partial update", async () => {
    mocks.revokeRefreshTokens.mockRejectedValueOnce(new Error("unavailable"));
    await expect(run()).rejects.toMatchObject({ details: { code: "EMAIL_CHANGE_INCOMPLETE" } });
    await expect(run()).resolves.toMatchObject({ success: true });
    expect(mocks.revokeRefreshTokens).toHaveBeenCalledTimes(2);
  });

  it("returns a delivery warning without misreporting the completed email update as a failure", async () => {
    mocks.requestEmailVerificationForUser.mockRejectedValue(new Error("mail unavailable"));
    await expect(run()).resolves.toMatchObject({ success: true, verificationRequired: true, verificationEmailSent: false });
  });

  it("serialises competing writes and does not release another invocation's lease", async () => {
    mocks.acquireUserEmailLease.mockRejectedValue(new Error("EMAIL_CHANGE_BUSY"));
    await expect(run()).rejects.toMatchObject({ details: { code: "EMAIL_CHANGE_BUSY" } });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.releaseUserEmailLease).not.toHaveBeenCalled();
  });

  it("reconciles a concurrent external Auth change without claiming the requested change succeeded", async () => {
    mocks.getUser.mockResolvedValueOnce({ ...account }).mockResolvedValue({ ...account, email: "external@example.org" });
    await expect(run()).rejects.toMatchObject({ details: { code: "EMAIL_CHANGE_CONFLICT" } });
    expect(mocks.updateUserEmailFromAuth).toHaveBeenLastCalledWith(expect.objectContaining({ email: "external@example.org" }));
  });

  it("does not hide a completed update when lease release fails", async () => {
    mocks.releaseUserEmailLease.mockRejectedValue(new Error("unavailable"));
    await expect(run()).resolves.toMatchObject({ success: true });
  });

  it("member reconciliation uses the same guarded writer and releases its lease on failure", async () => {
    await expect(withUserEmailLease("member", async (write) => {
      await write("verified@example.org", "member");
      throw new HttpsError("failed-precondition", "test failure");
    })).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mocks.updateUserEmailFromAuth).toHaveBeenCalledWith(expect.objectContaining({ changedBy: "member", leaseId: expect.any(String) }));
    expect(mocks.releaseUserEmailLease).toHaveBeenCalledOnce();
  });

  it("member reconciliation copies fresh verified Auth state, ignoring stale token email", async () => {
    account.email = "verified-new@example.org";
    const result = await reconcileMyEmail.run({
      data: {}, auth: { uid: "member", token: { email: "stale@example.org" } },
    } as Parameters<typeof reconcileMyEmail.run>[0]);
    expect(result).toEqual({ success: true, email: "verified-new@example.org" });
    expect(mocks.updateUserEmailFromAuth).toHaveBeenCalledWith(expect.objectContaining({ email: "verified-new@example.org", changedBy: "member" }));
  });

  it("does not reconcile an unverified email based on stale token verification", async () => {
    account.emailVerified = false;
    await expect(reconcileMyEmail.run({
      data: {}, auth: { uid: "member", token: { email_verified: true } },
    } as Parameters<typeof reconcileMyEmail.run>[0])).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mocks.updateUserEmailFromAuth).not.toHaveBeenCalled();
    expect(mocks.releaseUserEmailLease).toHaveBeenCalledOnce();
  });
});
