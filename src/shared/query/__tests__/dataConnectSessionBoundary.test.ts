import { describe, expect, it, vi } from "vitest";
import { initializeApp, deleteApp } from "firebase/app";
import type { DataConnect } from "firebase/data-connect";

// The installed SDK is exercised, unlike the normal global test mock. Transport
// injection is test-only: production isolation never edits SDK private state.
const sdk = await vi.importActual<typeof import("firebase/data-connect")>("firebase/data-connect");
type TestDataConnect = DataConnect & { _transportClass: new () => { invokeQuery: () => Promise<{ data: { uid: string }; extensions: object }> } };

describe("installed Data Connect document boundary", () => {
  it("new SDK contexts cannot read old cached or late results", async () => {
    const config = { connector: "test", service: "test", location: "europe-west2" };
    const a = initializeApp({ projectId: "session-test", apiKey: "fake" }, "session-a");
    const b = initializeApp({ projectId: "session-test", apiKey: "fake" }, "session-b");
    try {
      const old = sdk.getDataConnect(a, config) as TestDataConnect;
      const fresh = sdk.getDataConnect(b, config) as TestDataConnect;
      old._transportClass = class { async invokeQuery() { return { data: { uid: "A" }, extensions: {} }; } };
      let serverReads = 0;
      fresh._transportClass = class { async invokeQuery() { serverReads++; return { data: { uid: "B" }, extensions: {} }; } };
      await sdk.executeQuery(sdk.queryRef(old, "GetCurrentUser"));
      const result = await sdk.executeQuery(sdk.queryRef(fresh, "GetCurrentUser"));
      expect(result.data).toEqual({ uid: "B" });
      expect(result.source).toBe("SERVER");
      expect(serverReads).toBe(1);
      await sdk.executeQuery(sdk.queryRef(old, "GetCurrentUser"), { fetchPolicy: sdk.QueryFetchPolicy.SERVER_ONLY });
      expect((await sdk.executeQuery(sdk.queryRef(fresh, "GetCurrentUser"))).data).toEqual({ uid: "B" });
    } finally { await Promise.all([deleteApp(a), deleteApp(b)]); }
  });
});
