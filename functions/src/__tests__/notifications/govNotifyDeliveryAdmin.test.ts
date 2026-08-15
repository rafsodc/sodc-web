import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import {
  getGovNotifyDeliveryAdminConfiguration,
  updateGovNotifyDeliveryMode,
} from "../../govNotifyDeliveryAdmin";

const getConfiguration = vi.spyOn(admin, "getGovNotifyDeliveryConfiguration");
const listAudits = vi.spyOn(admin, "listGovNotifyDeliveryModeAudits");
const changeMode = vi.spyOn(admin, "changeGovNotifyDeliveryMode");

const adminRequest = (data: Record<string, unknown> = {}) => ({
  auth: { uid: "admin-1", token: { admin: true, enabled: true } },
  data,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOV_NOTIFY_DELIVERY_MODE", "LIVE");
  getConfiguration.mockResolvedValue({
    data: {
      govNotifyDeliveryConfiguration: {
        mode: "SIMULATION",
        version: 3,
        updatedAt: "2026-07-27T08:00:00.000Z",
        updatedBy: "admin-0",
      },
    },
  } as never);
  listAudits.mockResolvedValue({ data: { govNotifyDeliveryModeAudits: [] } } as never);
  changeMode.mockResolvedValue({ data: { changed: 1 } } as never);
});

describe("GOV.UK Notify delivery administration", () => {
  it("rejects a non-admin reader", async () => {
    await expect(getGovNotifyDeliveryAdminConfiguration.run({
      auth: { uid: "member-1", token: { admin: false, enabled: true } },
      data: {},
    } as never)).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("returns runtime mode, deployment ceiling, and effective site mode", async () => {
    await expect(
      getGovNotifyDeliveryAdminConfiguration.run(adminRequest() as never),
    ).resolves.toMatchObject({
      runtimeMode: "SIMULATION",
      deploymentCeiling: "LIVE",
      effectiveSiteMode: "SIMULATION",
      version: 3,
    });
  });

  it("rejects a mode above the deployment ceiling", async () => {
    vi.stubEnv("GOV_NOTIFY_DELIVERY_MODE", "TEAM_TEST");
    await expect(updateGovNotifyDeliveryMode.run(adminRequest({
      mode: "LIVE",
      expectedVersion: 3,
      reason: "Production launch",
    }) as never)).rejects.toMatchObject({ code: "failed-precondition" });
    expect(changeMode).not.toHaveBeenCalled();
  });

  it("rejects a stale version", async () => {
    await expect(updateGovNotifyDeliveryMode.run(adminRequest({
      mode: "TEAM_TEST",
      expectedVersion: 2,
      reason: "Team verification",
    }) as never)).rejects.toMatchObject({ code: "aborted" });
  });

  it("changes mode with actor, reason, ceiling, and compare-and-swap version", async () => {
    getConfiguration
      .mockResolvedValueOnce({
        data: {
          govNotifyDeliveryConfiguration: {
            mode: "SIMULATION",
            version: 3,
            updatedAt: "2026-07-27T08:00:00.000Z",
            updatedBy: "admin-0",
          },
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          govNotifyDeliveryConfiguration: {
            mode: "TEAM_TEST",
            version: 4,
            updatedAt: "2026-07-27T09:00:00.000Z",
            updatedBy: "admin-1",
          },
        },
      } as never);

    await updateGovNotifyDeliveryMode.run(adminRequest({
      mode: "TEAM_TEST",
      expectedVersion: 3,
      reason: "Team verification",
    }) as never);

    expect(changeMode).toHaveBeenCalledWith(expect.objectContaining({
      expectedVersion: 3,
      previousMode: "SIMULATION",
      newMode: "TEAM_TEST",
      deploymentCeiling: "LIVE",
      changedBy: "admin-1",
      reason: "Team verification",
    }));
  });
});
