import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../../../../test-utils";
import * as deliveryApi from "../../../../shared/utils/firebaseFunctions/govNotifyDeliveryConfiguration";
import EmailDeliverySettingsPage from "../EmailDeliverySettingsPage";

vi.mock("../../../../shared/utils/firebaseFunctions/govNotifyDeliveryConfiguration", () => ({
  getGovNotifyDeliveryAdminConfiguration: vi.fn(),
  updateGovNotifyDeliveryMode: vi.fn(),
}));

const configuration: deliveryApi.GovNotifyDeliveryAdminConfiguration = {
  runtimeMode: "SIMULATION",
  deploymentCeiling: "LIVE",
  effectiveSiteMode: "SIMULATION",
  version: 2,
  updatedAt: "2026-07-27T08:00:00.000Z",
  updatedBy: "admin-0",
  audits: [],
};

describe("EmailDeliverySettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deliveryApi.getGovNotifyDeliveryAdminConfiguration)
      .mockResolvedValue(configuration);
    vi.mocked(deliveryApi.updateGovNotifyDeliveryMode).mockResolvedValue({
      ...configuration,
      runtimeMode: "TEAM_TEST",
      effectiveSiteMode: "TEAM_TEST",
      version: 3,
    });
  });

  it("shows the runtime mode and deployment ceiling", async () => {
    render(<EmailDeliverySettingsPage onBack={vi.fn()} />);
    expect(await screen.findByText(/Current effective site mode:/)).toHaveTextContent(
      "Simulation",
    );
    expect(screen.getByText(/The deployment ceiling is/)).toHaveTextContent("Live");
  });

  it("requires confirmation before increasing delivery scope", async () => {
    const user = userEvent.setup();
    render(<EmailDeliverySettingsPage onBack={vi.fn()} />);

    await user.click(await screen.findByRole("radio", { name: /Team test/ }));
    await user.type(screen.getByLabelText("Reason for delivery mode change"), "Team verification");
    await user.click(screen.getByRole("button", { name: "Save delivery mode" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Increase email delivery scope?");
    expect(deliveryApi.updateGovNotifyDeliveryMode).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm change" }));

    await waitFor(() => expect(deliveryApi.updateGovNotifyDeliveryMode).toHaveBeenCalledWith(
      "TEAM_TEST",
      2,
      "Team verification",
    ));
  });

  it("disables modes above the deployment ceiling", async () => {
    vi.mocked(deliveryApi.getGovNotifyDeliveryAdminConfiguration).mockResolvedValue({
      ...configuration,
      deploymentCeiling: "TEAM_TEST",
    });
    render(<EmailDeliverySettingsPage onBack={vi.fn()} />);
    expect(await screen.findByRole("radio", { name: /Live/ })).toBeDisabled();
  });
});
