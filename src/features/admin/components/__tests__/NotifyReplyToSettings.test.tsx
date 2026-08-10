import { describe, beforeEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../../../../test-utils";
import NotifyReplyToSettings from "../NotifyReplyToSettings";
import * as notifyConfiguration from "../../../../shared/utils/firebaseFunctions/notifyReplyToConfiguration";

vi.mock("../../../../shared/utils/firebaseFunctions/notifyReplyToConfiguration", () => ({
  getNotifyReplyToAdminConfiguration: vi.fn(),
  createNotifyReplyToAddress: vi.fn(),
  updateNotifyReplyToAddress: vi.fn(),
  sendNotifyReplyToVerificationTest: vi.fn(),
  confirmNotifyReplyToVerification: vi.fn(),
  updateNotifyReplyToAvailability: vi.fn(),
  changeNotifyReplyToDefault: vi.fn(),
  setNotifyTemplateReplyToOverride: vi.fn(),
}));

const emptyConfiguration: notifyConfiguration.NotifyReplyToAdminConfiguration = {
  configuration: { version: 1, defaultAddressId: null },
  addresses: [],
  templateOverrides: [],
  templateKeys: [],
  environmentFallbackConfigured: false,
  audits: [],
};

describe("NotifyReplyToSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notifyConfiguration.getNotifyReplyToAdminConfiguration).mockResolvedValue(emptyConfiguration);
  });

  it("keeps the entered address visible when creation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(notifyConfiguration.createNotifyReplyToAddress).mockRejectedValue(new Error("save failed"));
    render(<NotifyReplyToSettings />);

    await user.type(await screen.findByLabelText("Display label"), "Membership");
    await user.type(screen.getByLabelText("Email address"), "members@example.com");
    await user.type(screen.getByLabelText("GOV.UK Notify reply-to UUID"), "notify-uuid");
    await user.click(screen.getByRole("button", { name: "Add address" }));

    await waitFor(() => expect(notifyConfiguration.createNotifyReplyToAddress).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Display label")).toHaveValue("Membership");
    expect(screen.getByLabelText("Email address")).toHaveValue("members@example.com");
    expect(screen.getByLabelText("GOV.UK Notify reply-to UUID")).toHaveValue("notify-uuid");
    expect(screen.getByText("We could not complete the email configuration operation. Please try again.")).toBeInTheDocument();
  });
});
