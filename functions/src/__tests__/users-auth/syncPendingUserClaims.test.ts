import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), setCustomUserClaims: vi.fn(), notify: vi.fn() }));
vi.mock("firebase-admin", () => ({ auth: () => mocks }));
vi.mock("firebase-functions/v2/https", () => ({
  onCall: (_options: unknown, handler: unknown) => handler,
  HttpsError: class extends Error { constructor(public code: string, message: string) { super(message); } },
}));
vi.mock("../../rateLimiter", () => ({ enforceRateLimit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../mailer", () => ({ govNotifySecrets: [] }));
vi.mock("../../pendingApprovalAdminAlert", () => ({ notifyAdminsUserPendingApproval: mocks.notify }));

import { getUserSecurityState } from "../../securityRepository";
import { requireEnabled } from "../../helpers";
import { syncPendingUserClaims } from "../../users";

const invoke = syncPendingUserClaims as unknown as (request: unknown) => Promise<{ success: boolean }>;
const request = { auth: { uid: "new-member", token: {} }, data: {} };

describe("onboarding approval notification without security-claim ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ uid: "new-member", emailVerified: true, customClaims: {} });
    mocks.notify.mockResolvedValue(undefined);
    vi.mocked(getUserSecurityState).mockResolvedValue({ data: { userSecurityState: null } } as never);
  });

  it("cannot overwrite an approval that completes after its last authority read", async () => {
    let finishRead!: (value: unknown) => void;
    vi.mocked(getUserSecurityState).mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve; }) as never);
    let claims: Record<string, unknown> = {};
    mocks.setCustomUserClaims.mockImplementation(async (_uid, next) => { claims = next; });
    const pending = invoke(request);
    await vi.waitFor(() => expect(getUserSecurityState).toHaveBeenCalledOnce());
    // Approval commits READY and publishes its claims while onboarding still
    // holds the pre-approval Auth snapshot and an absent-state read result.
    claims = { enabled: true, admin: false, securityVersion: 2, unrelated: "preserved" };
    finishRead({ data: { userSecurityState: null } });
    await expect(pending).resolves.toEqual({ success: true });
    expect(mocks.setCustomUserClaims).not.toHaveBeenCalled();
    expect(claims).toEqual({ enabled: true, admin: false, securityVersion: 2, unrelated: "preserved" });
    expect(mocks.notify).toHaveBeenCalledOnce();
  });

  it("preserves the pending-approval notification input without granting missing authority", async () => {
    await expect(invoke(request)).resolves.toEqual({ success: true });
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: "new-member", emailVerified: true }));
    expect(mocks.setCustomUserClaims).not.toHaveBeenCalled();
    await expect(requireEnabled(request as never)).rejects.toMatchObject({ code: "permission-denied" });
  });

  it.each(["READY", "PENDING"])("does not mutate or notify an account already owned by %s authority", async syncStatus => {
    vi.mocked(getUserSecurityState).mockResolvedValue({ data: { userSecurityState: { syncStatus, securityVersion: 2 } } } as never);
    await expect(invoke(request)).resolves.toEqual({ success: true });
    expect(mocks.setCustomUserClaims).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("preserves the existing admin no-op", async () => {
    mocks.getUser.mockResolvedValue({ customClaims: { admin: true, enabled: true, securityVersion: 3 } });
    await expect(invoke(request)).resolves.toEqual({ success: true });
    expect(getUserSecurityState).not.toHaveBeenCalled();
    expect(mocks.setCustomUserClaims).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
