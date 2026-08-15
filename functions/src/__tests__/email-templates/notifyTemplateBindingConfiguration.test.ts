import { beforeEach, describe, expect, it, vi } from "vitest";

const dataConnectMocks = vi.hoisted(() => ({
  getNotifyTemplateBindings: vi.fn(),
}));

vi.mock("@dataconnect/admin-generated", () => ({
  getNotifyTemplateBindings: dataConnectMocks.getNotifyTemplateBindings,
}));

import { resolveNotifyTemplateId } from "../../notifyTemplateBindingConfiguration";

describe("Notify template binding resolution", () => {
  beforeEach(() => {
    dataConnectMocks.getNotifyTemplateBindings.mockReset();
  });

  it("returns the saved database binding for a template key", async () => {
    dataConnectMocks.getNotifyTemplateBindings.mockResolvedValue({
      data: {
        notifyTemplateBindings: [{
          templateKey: "emailVerification",
          notifyTemplateId: "database-template-id",
        }],
      },
    });

    await expect(resolveNotifyTemplateId("emailVerification"))
      .resolves.toBe("database-template-id");
  });

  it("returns undefined when the template has no saved binding", async () => {
    dataConnectMocks.getNotifyTemplateBindings.mockResolvedValue({
      data: { notifyTemplateBindings: [] },
    });

    await expect(resolveNotifyTemplateId("emailVerification"))
      .resolves.toBeUndefined();
  });

  it("returns undefined when the binding lookup fails", async () => {
    dataConnectMocks.getNotifyTemplateBindings.mockRejectedValue(new Error("unavailable"));

    await expect(resolveNotifyTemplateId("emailVerification"))
      .resolves.toBeUndefined();
  });
});
