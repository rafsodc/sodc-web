import http from "node:http";
import https from "node:https";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  handlerDependency: vi.fn(() => { throw new Error("The reconciliation handler must not run in a deployment-metadata test"); }),
  network: vi.fn(() => { throw new Error("Network access is forbidden in a deployment-metadata test"); }),
  secretValue: vi.fn(() => { throw new Error("Secret values must not be resolved during metadata inspection"); }),
}));

// Keep the real Firebase Functions onCall and defineSecret implementations.
// Only handler dependencies are replaced, so inspecting the SDK-generated
// endpoint cannot query Data Connect, reconcile a payment or send any email.
vi.mock("../../paymentReconciliationService", () => ({
  reconcilePaidCheckoutSessionOrders: boundary.handlerDependency,
}));
vi.mock("../../helpers", () => ({
  requireEnabled: boundary.handlerDependency,
  validateUUID: boundary.handlerDependency,
}));
vi.mock("../../rateLimiter", () => ({
  enforceRateLimit: boundary.handlerDependency,
}));

let callable: typeof import("../../paymentReconciliationCallable").reconcileMyCheckoutSessionOrders;

describe("member reconciliation deployment secret declarations", () => {
  beforeAll(async () => {
    vi.stubGlobal("fetch", boundary.network);
    vi.spyOn(http, "request").mockImplementation(boundary.network);
    vi.spyOn(http, "get").mockImplementation(boundary.network);
    vi.spyOn(https, "request").mockImplementation(boundary.network);
    vi.spyOn(https, "get").mockImplementation(boundary.network);

    const { stripeSecret } = await import("../../paymentConfig");
    const { govNotifySecrets } = await import("../../govNotifyDeliveryMode");
    for (const secret of [stripeSecret, ...govNotifySecrets]) {
      vi.spyOn(secret, "value").mockImplementation(boundary.secretValue);
    }
    ({ reconcileMyCheckoutSessionOrders: callable } = await import("../../paymentReconciliationCallable"));
  });

  afterAll(() => {
    try {
      expect(boundary.handlerDependency).not.toHaveBeenCalled();
      expect(boundary.network).not.toHaveBeenCalled();
      expect(boundary.secretValue).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });

  it.each([
    "STRIPE_SECRET",
    "GOV_NOTIFY_LIVE_API_KEY",
    "GOV_NOTIFY_TEST_API_KEY",
    "GOV_NOTIFY_TEAM_API_KEY",
  ])("includes %s in the real SDK deployment metadata", (key) => {
    expect(callable.__endpoint.secretEnvironmentVariables).toContainEqual({ key });
  });

  it("binds exactly Stripe and all three Notify modes, without unrelated or duplicate secrets", () => {
    const keys = callable.__endpoint.secretEnvironmentVariables?.map(({ key }) => key).sort();
    expect(keys).toEqual([
      "GOV_NOTIFY_LIVE_API_KEY",
      "GOV_NOTIFY_TEAM_API_KEY",
      "GOV_NOTIFY_TEST_API_KEY",
      "STRIPE_SECRET",
    ]);
  });

  it("preserves the regional Gen 2 callable transport", () => {
    expect(callable.__endpoint.platform).toBe("gcfv2");
    expect(callable.__endpoint.region).toEqual(["europe-west2"]);
    expect(callable.__endpoint.callableTrigger).toEqual({});
    expect(callable.__endpoint.httpsTrigger).toBeUndefined();
    expect(callable.__endpoint.eventTrigger).toBeUndefined();
    expect(callable.__endpoint.scheduleTrigger).toBeUndefined();
  });
});
