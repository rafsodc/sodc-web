import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { executeQuery, getDataConnect, type DataConnect } from "firebase/data-connect";
import type { User } from "firebase/auth";
import { getCurrentUserRef, MembershipStatus } from "@dataconnect/generated";
import { createMockUser } from "../../../../test-utils/mocks/firebase";
import { createSessionLifecycle, installSessionRuntime } from "../../../../shared/appShell/sessionLifecycle";
import type { UserData } from "../../../../types";
import { useUserData } from "../useUserData";

// Use the installed SDK's actual query cache and the generated query reference.
// Only the transport and app Auth configuration are test doubles; no live calls.
vi.unmock("firebase/data-connect");
const fixture = vi.hoisted(() => ({
  dataConnect: null as DataConnect | null,
  auth: { currentUser: null as User | null },
}));
vi.mock("../../../../config/firebase", () => ({
  get dataConnect() { return fixture.dataConnect; },
  auth: fixture.auth,
}));

type TransportResult = { data: { user: UserData }; extensions: object };
type TestDataConnect = DataConnect & {
  _transportClass: new () => { invokeQuery: (name: string, variables: unknown) => Promise<TransportResult> };
};
const apps: FirebaseApp[] = [];
const cleanups: Array<() => void> = [];
let nextApp = 0;
function profile(id: string, firstName: string): UserData {
  return { id, firstName, lastName: "Member", email: `${id}@example.invalid`, serviceNumber: "123", membershipStatus: MembershipStatus.REGULAR, createdAt: "2026-10-30T00:00:00Z", updatedAt: "2026-10-30T00:00:00Z" };
}
function context(initialProfile: UserData) {
  const app = initializeApp({ projectId: "profile-sdk-test", apiKey: "fake" }, `profile-sdk-${nextApp++}`);
  apps.push(app);
  const dc = getDataConnect(app, { connector: "test", service: "test", location: "europe-west2" }) as TestDataConnect;
  let currentProfile = initialProfile;
  const transport = vi.fn(async (): Promise<TransportResult> => ({ data: { user: currentProfile }, extensions: {} }));
  dc._transportClass = class { invokeQuery = transport; };
  fixture.dataConnect = dc;
  return { dc, transport, update: (value: UserData) => { currentProfile = value; } };
}
function enabledSession(uid: string) {
  const user = createMockUser({ uid, email: `${uid}@example.invalid` });
  fixture.auth.currentUser = user;
  const lifecycle = createSessionLifecycle();
  lifecycle.observe(uid);
  const uninstall = installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() });
  cleanups.push(() => { lifecycle.retire(); uninstall(); });
  return user;
}
afterEach(async () => {
  cleanup();
  cleanups.splice(0).reverse().forEach(release => release());
  fixture.auth.currentUser = null;
  fixture.dataConnect = null;
  await Promise.all(apps.splice(0).map(deleteApp));
});

describe("useUserData with the installed Data Connect SDK", () => {
  it("loads B from the server even when the same SDK context contains A's GetCurrentUser cache", async () => {
    // This tests the hook's defensive boundary, not whether normal logout
    // reuses a document. Production logout deliberately replaces the document.
    const a = profile("A", "First account"), b = profile("B", "Second account");
    const { dc, transport, update } = context(a);
    await executeQuery(getCurrentUserRef(dc));
    update(b);
    const cached = await executeQuery(getCurrentUserRef(dc));
    expect(cached.source).toBe("CACHE");
    expect(cached.data.user).toEqual(a);
    expect(transport).toHaveBeenCalledOnce();
    const user = enabledSession("B");
    const { result } = renderHook(() => useUserData(user, true));
    expect(result.current.userData).toBeNull();
    await waitFor(() => expect(result.current.userData).toEqual(b));
    expect(transport).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("refreshes an initial same-UID profile instead of accepting its cached old name", async () => {
    const oldProfile = profile("B", "Previous name"), currentProfile = profile("B", "Current name");
    const { dc, transport, update } = context(oldProfile);
    await executeQuery(getCurrentUserRef(dc));
    update(currentProfile);
    expect((await executeQuery(getCurrentUserRef(dc))).data.user?.firstName).toBe("Previous name");
    const user = enabledSession("B");
    const { result } = renderHook(() => useUserData(user, true));
    await waitFor(() => expect(result.current.userData).toEqual(currentProfile));
    expect(transport).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ loading: false, error: null });
  });
});
