import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockUser } from "../../../../test-utils/mocks/firebase";
import { captureSession, createSessionLifecycle, installSessionRuntime, SessionChangedError } from "../../../../shared/appShell/sessionLifecycle";
import { reconcileMyEmail } from "../../../../shared/utils/firebaseFunctions";
import { reconcileVerifiedIdentity, VERIFIED_IDENTITY_TIMEOUT_MS } from "../reconcileVerifiedIdentity";
import { OperationTimeoutError } from "../../../../shared/utils/withTimeout";

const mockAuth = vi.hoisted(() => ({ currentUser: null as { uid: string; emailVerified: boolean } | null }));
vi.mock("../../../../config/firebase", () => ({ auth: mockAuth }));
vi.mock("../../../../shared/utils/firebaseFunctions", () => ({ reconcileMyEmail: vi.fn() }));
let uninstall: (() => void) | undefined;
function setup() {
  const lifecycle = createSessionLifecycle(); lifecycle.observe("A");
  uninstall = installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() });
  const user = createMockUser({ uid: "A", emailVerified: true });
  mockAuth.currentUser = user;
  return { user, lifecycle, session: captureSession("A") };
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(reconcileMyEmail).mockResolvedValue("verified@example.org"); });
afterEach(() => { uninstall?.(); vi.useRealTimers(); });
describe("verified identity reconciliation", () => {
  it.each([1, undefined])("refreshes stale/missing token version %s to hold v2, releases to v3, then fetches new claims", async initialVersion => {
    const { user, session } = setup();
    let tokenVersion = initialVersion; let serverVersion = 2;
    const order: string[] = [];
    vi.mocked(reconcileMyEmail).mockImplementation(async () => {
      expect(tokenVersion).toBe(2); order.push("reconcile"); serverVersion = 3; return "verified@example.org";
    });
    vi.mocked(user.getIdToken).mockImplementation(async force => {
      expect(force).toBe(true); tokenVersion = serverVersion; order.push(`token:${tokenVersion}`); return `version-${tokenVersion}`;
    });
    await reconcileVerifiedIdentity(user, session);
    expect(order).toEqual(["token:2", "reconcile", "token:3"]);
    expect(tokenVersion).toBe(3);
  });
  it("accepts the backend's no-profile success without constructing authority on the client", async () => {
    const { user, session } = setup();
    vi.mocked(user.getIdToken).mockResolvedValue("still-disabled-onboarding-token");
    await reconcileVerifiedIdentity(user, session);
    expect(reconcileMyEmail).toHaveBeenCalledExactlyOnceWith();
    expect(user.getIdToken).toHaveBeenCalledTimes(2);
    expect(user.getIdToken).toHaveBeenNthCalledWith(1, true); expect(user.getIdToken).toHaveBeenNthCalledWith(2, true);
  });
  it("does not start reconciliation for a replacement actual Auth UID", async () => {
    const { user, session } = setup(); mockAuth.currentUser = { uid: "B", emailVerified: true };
    await expect(reconcileVerifiedIdentity(user, session)).rejects.toBeInstanceOf(SessionChangedError);
    expect(reconcileMyEmail).not.toHaveBeenCalled(); expect(user.getIdToken).not.toHaveBeenCalled();
  });
  it.each(["actual-uid", "retirement", "request"])("ignores a late reconciliation after %s invalidation", async kind => {
    const { user, session, lifecycle } = setup();
    let resolve!: (email: string) => void; let requestCurrent = true;
    vi.mocked(reconcileMyEmail).mockReturnValue(new Promise(done => { resolve = done; }));
    const pending = reconcileVerifiedIdentity(user, session, () => requestCurrent).catch(error => error);
    await vi.waitFor(() => expect(reconcileMyEmail).toHaveBeenCalledOnce());
    if (kind === "actual-uid") mockAuth.currentUser = { uid: "B", emailVerified: true };
    if (kind === "retirement") lifecycle.retire();
    if (kind === "request") requestCurrent = false;
    resolve("old@example.org");
    await expect(pending).resolves.toBeInstanceOf(SessionChangedError);
    expect(user.getIdToken).toHaveBeenCalledOnce();
  });
  it("bounds a stalled reconciliation without retrying the mutation or refreshing old claims", async () => {
    vi.useFakeTimers();
    const { user, session } = setup();
    vi.mocked(reconcileMyEmail).mockReturnValue(new Promise(() => undefined));
    const pending = reconcileVerifiedIdentity(user, session).catch(error => error);
    await vi.advanceTimersByTimeAsync(VERIFIED_IDENTITY_TIMEOUT_MS + 1);
    await expect(pending).resolves.toBeInstanceOf(OperationTimeoutError);
    expect(reconcileMyEmail).toHaveBeenCalledOnce(); expect(user.getIdToken).toHaveBeenCalledOnce();
  });
});
