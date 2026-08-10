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

function address(
  overrides: Partial<notifyConfiguration.NotifyReplyToAddress> = {},
): notifyConfiguration.NotifyReplyToAddress {
  return {
    id: "address-1",
    displayLabel: "Membership",
    emailAddress: "members@example.com",
    notifyUuid: "notify-uuid",
    enabled: false,
    announcementSelectable: false,
    verificationStatus: "UNVERIFIED",
    version: 1,
    createdAt: "2026-08-10T10:00:00Z",
    updatedAt: "2026-08-10T10:00:00Z",
    createdBy: "admin-1",
    updatedBy: "admin-1",
    ...overrides,
  };
}

function configuration(
  replyToAddress: notifyConfiguration.NotifyReplyToAddress,
  overrides: Partial<notifyConfiguration.NotifyReplyToAdminConfiguration> = {},
): notifyConfiguration.NotifyReplyToAdminConfiguration {
  return {
    ...emptyConfiguration,
    addresses: [replyToAddress],
    ...overrides,
  };
}

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

  it("renders the saved configuration and resets the edit form after a successful update", async () => {
    const user = userEvent.setup();
    const existingAddress = address();
    const updatedAddress = address({ displayLabel: "Updated Membership", version: 2 });
    vi.mocked(notifyConfiguration.getNotifyReplyToAdminConfiguration).mockResolvedValue(
      configuration(existingAddress),
    );
    vi.mocked(notifyConfiguration.updateNotifyReplyToAddress).mockResolvedValue(
      configuration(updatedAddress),
    );
    render(<NotifyReplyToSettings />);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByRole("heading", { name: "Edit reply-to address" })).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Display label"));
    await user.type(screen.getByLabelText("Display label"), "Updated Membership");
    await user.click(screen.getByRole("button", { name: "Save and reverify" }));

    expect(await screen.findByText("Updated Membership")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Add reply-to address" })).toBeInTheDocument();
    expect(screen.getByLabelText("Display label")).toHaveValue("");
    expect(notifyConfiguration.updateNotifyReplyToAddress).toHaveBeenCalledWith({
      addressId: "address-1",
      expectedVersion: 1,
      displayLabel: "Updated Membership",
      emailAddress: "members@example.com",
      notifyUuid: "notify-uuid",
    });
  });

  it("renders provider verification progress after testing and confirming an address", async () => {
    const user = userEvent.setup();
    const acceptedAddress = address({
      verificationStatus: "PROVIDER_ACCEPTED",
      providerAcceptedAt: "2026-08-10T10:05:00Z",
      verificationMode: "TEAM_TEST",
    });
    const verifiedAddress = address({
      verificationStatus: "VERIFIED",
      verifiedAt: "2026-08-10T10:06:00Z",
      version: 2,
    });
    vi.mocked(notifyConfiguration.getNotifyReplyToAdminConfiguration).mockResolvedValue(
      configuration(acceptedAddress),
    );
    vi.mocked(notifyConfiguration.sendNotifyReplyToVerificationTest).mockResolvedValue(
      configuration(acceptedAddress),
    );
    vi.mocked(notifyConfiguration.confirmNotifyReplyToVerification).mockResolvedValue(
      configuration(verifiedAddress),
    );
    render(<NotifyReplyToSettings />);

    await user.click(await screen.findByRole("button", { name: "Send test" }));
    await waitFor(() => {
      expect(notifyConfiguration.sendNotifyReplyToVerificationTest).toHaveBeenCalledWith({
        addressId: "address-1",
        expectedVersion: 1,
      });
    });
    await user.click(screen.getByRole("button", { name: "Confirm Reply-To" }));

    expect(await screen.findByText("Verified")).toBeInTheDocument();
    expect(notifyConfiguration.confirmNotifyReplyToVerification).toHaveBeenCalledWith({
      addressId: "address-1",
      expectedVersion: 1,
    });
  });

  it("renders availability, default, and announcement changes returned by the server", async () => {
    const user = userEvent.setup();
    let current = address({ verificationStatus: "VERIFIED", enabled: true });
    let defaultAddressId: string | null = null;
    const currentConfiguration = () => configuration(current, {
      configuration: {
        version: current.version,
        defaultAddressId,
      },
    });
    vi.mocked(notifyConfiguration.getNotifyReplyToAdminConfiguration).mockResolvedValue(currentConfiguration());
    vi.mocked(notifyConfiguration.updateNotifyReplyToAvailability).mockImplementation(async (request) => {
      current = address({
        ...current,
        enabled: request.enabled,
        announcementSelectable: request.announcementSelectable,
        version: current.version + 1,
      });
      if (request.clearDefault) defaultAddressId = null;
      return currentConfiguration();
    });
    vi.mocked(notifyConfiguration.changeNotifyReplyToDefault).mockImplementation(async (request) => {
      current = address({ ...current, version: current.version + 1 });
      defaultAddressId = request.clearDefault ? null : current.id;
      return currentConfiguration();
    });
    render(<NotifyReplyToSettings />);

    await user.click(await screen.findByRole("button", { name: "Allow for announcements" }));
    expect(await screen.findByText("Announcements")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Make default" }));
    expect(await screen.findByText("System default")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear system default" }));
    await waitFor(() => expect(screen.queryByText("System default")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Disable" }));
    expect(await screen.findByRole("button", { name: "Enable" })).toBeInTheDocument();
    expect(screen.queryByText("Enabled")).not.toBeInTheDocument();
  });

  it("renders a newly enabled address and applies a template override", async () => {
    const user = userEvent.setup();
    const disabledAddress = address({ verificationStatus: "VERIFIED" });
    const enabledAddress = address({ verificationStatus: "VERIFIED", enabled: true, version: 2 });
    const enabledConfiguration = configuration(enabledAddress, { templateKeys: ["WELCOME"] });
    vi.mocked(notifyConfiguration.getNotifyReplyToAdminConfiguration).mockResolvedValue(
      configuration(disabledAddress, { templateKeys: ["WELCOME"] }),
    );
    vi.mocked(notifyConfiguration.updateNotifyReplyToAvailability).mockResolvedValue(enabledConfiguration);
    vi.mocked(notifyConfiguration.setNotifyTemplateReplyToOverride).mockResolvedValue({
      ...enabledConfiguration,
      templateOverrides: [{
        templateKey: "WELCOME",
        addressId: "address-1",
        updatedAt: "2026-08-10T10:10:00Z",
        updatedBy: "admin-1",
      }],
    });
    render(<NotifyReplyToSettings />);

    await user.click(await screen.findByRole("button", { name: "Enable" }));
    expect(await screen.findByText("Enabled")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "WELCOME" }));
    await user.click(await screen.findByRole("option", { name: "Membership — members@example.com" }));

    await waitFor(() => {
      expect(notifyConfiguration.setNotifyTemplateReplyToOverride).toHaveBeenCalledWith({
        templateKey: "WELCOME",
        addressId: "address-1",
      });
    });
  });

  it("renders recent configuration audit details", async () => {
    vi.mocked(notifyConfiguration.getNotifyReplyToAdminConfiguration).mockResolvedValue({
      ...emptyConfiguration,
      audits: [{
        id: "audit-1",
        action: "DEFAULT_CHANGED",
        templateKey: "WELCOME",
        changedBy: "admin@example.com",
        reason: "New membership mailbox",
        changedAt: "2026-08-10T10:15:00Z",
      }],
    });

    render(<NotifyReplyToSettings />);

    expect(await screen.findByText("DEFAULT CHANGED")).toBeInTheDocument();
    expect(screen.getByText(/admin@example.com.*WELCOME/)).toBeInTheDocument();
    expect(screen.getByText("New membership mailbox")).toBeInTheDocument();
  });
});
