import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "../../../../test-utils";
import * as templateApi from "../../../../shared/utils/firebaseFunctions";
import EmailTemplateSyncPage from "../EmailTemplateSyncPage";

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  getTemplateSyncStatus: vi.fn(),
  moveAllNotifyTemplateBindingsToLatestVersion: vi.fn(),
  setNotifyTemplateBinding: vi.fn(),
}));

const matchingCandidate: templateApi.NotifyTemplateCandidate = {
  id: "a1983d43-62ed-4606-a6f6-5fd62e6788f9",
  name: "bookingApproved",
  version: 6,
  subjectMatch: true,
  bodyMatch: true,
  contentMatches: true,
};

function templateResult(overrides: Partial<templateApi.TemplateSyncResult> = {}): templateApi.TemplateSyncResult {
  return {
    templateKey: "bookingApproved",
    candidates: [matchingCandidate],
    boundTemplateId: matchingCandidate.id,
    boundTemplateName: matchingCandidate.name,
    reviewedVersion: 6,
    currentLiveVersion: 6,
    versionDrift: false,
    status: "in_sync",
    expectedSubject: "Booking approved",
    expectedBody: "Your booking is approved.",
    liveSubject: "Booking approved",
    liveBody: "Your booking is approved.",
    subjectMatch: true,
    bodyMatch: true,
    ...overrides,
  };
}

function expectNoSaves() {
  expect(templateApi.setNotifyTemplateBinding).not.toHaveBeenCalled();
  expect(templateApi.moveAllNotifyTemplateBindingsToLatestVersion).not.toHaveBeenCalled();
}

describe("EmailTemplateSyncPage status explanations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(templateApi.getTemplateSyncStatus).mockResolvedValue({ results: [] });
  });

  it("explains how to load status without automatically reading or saving", () => {
    render(<EmailTemplateSyncPage onBack={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Select Refresh to load template status.");
    expect(screen.getByRole("alert")).toHaveTextContent("Loading status does not save bindings or review versions.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(templateApi.getTemplateSyncStatus).not.toHaveBeenCalled();
    expectNoSaves();
  });

  it("labels a missing saved binding without claiming its runtime fallback is ready or missing", async () => {
    const user = userEvent.setup();
    vi.mocked(templateApi.getTemplateSyncStatus).mockResolvedValue({ results: [templateResult({
      status: "not_configured",
      boundTemplateId: undefined,
      boundTemplateName: undefined,
      reviewedVersion: undefined,
      currentLiveVersion: undefined,
      subjectMatch: undefined,
      bodyMatch: undefined,
      liveSubject: undefined,
      liveBody: undefined,
    })] });
    render(<EmailTemplateSyncPage onBack={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    const row = (await screen.findByText("bookingApproved")).closest("tr")!;
    expect(within(row).getByText("No saved binding")).toBeVisible();
    expect(within(row).getByText("Runtime fallback readiness is not assessed here.")).toBeVisible();
    expect(within(row).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.queryByText(/Select Refresh to load/)).not.toBeInTheDocument();

    await user.click(within(row).getByText("bookingApproved"));
    expect(await screen.findByText(/Select an existing template named exactly/)).toHaveTextContent(
      "Only create a template using the values below if no suitable template already exists.",
    );
    await user.click(within(row).getByRole("combobox", { name: "Notify template" }));
    await user.click(screen.getByRole("option", { name: /bookingApproved — v6/ }));
    expect(within(row).getByRole("button", { name: "Save" })).toBeEnabled();
    expect(templateApi.getTemplateSyncStatus).toHaveBeenCalledTimes(1);
    expectNoSaves();
  });

  it("shows matching content with a version-review-only reminder that does not block sending", async () => {
    const user = userEvent.setup();
    vi.mocked(templateApi.getTemplateSyncStatus).mockResolvedValue({ results: [templateResult({
      reviewedVersion: 5,
      versionDrift: true,
    })] });
    render(<EmailTemplateSyncPage onBack={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    const row = (await screen.findByText("bookingApproved")).closest("tr")!;
    expect(within(row).getByText("Content matches")).toBeVisible();
    expect(within(row).getByText("Review v5 → v6")).toBeVisible();
    expect(within(row).getByText("Version review only. This reminder does not block sending.")).toBeVisible();
    expect(screen.getByText("1 version review reminder")).toBeVisible();
    expect(screen.queryByText("1 with content differences")).not.toBeInTheDocument();
    expect(within(row).queryByText("Content differs")).not.toBeInTheDocument();
    expectNoSaves();
  });

  it("keeps a real content difference separate from a simultaneous version-review reminder", async () => {
    const user = userEvent.setup();
    vi.mocked(templateApi.getTemplateSyncStatus).mockResolvedValue({ results: [templateResult({
      status: "drift",
      reviewedVersion: 5,
      versionDrift: true,
      subjectMatch: false,
      liveSubject: "Old booking subject",
      candidates: [{ ...matchingCandidate, subjectMatch: false, contentMatches: false }],
    })] });
    render(<EmailTemplateSyncPage onBack={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    const row = (await screen.findByText("bookingApproved")).closest("tr")!;
    expect(within(row).getByText("Content differs")).toBeVisible();
    expect(within(row).getByText("Review v5 → v6")).toBeVisible();
    expect(within(row).queryByText(/Version review only/)).not.toBeInTheDocument();
    expect(screen.getByText("1 with content differences")).toBeVisible();
    expect(screen.getByText("1 version review reminder")).toBeVisible();
    expect(within(row).getByRole("button", { name: "Save" })).toBeDisabled();

    await user.click(within(row).getByText("bookingApproved"));
    expect(await screen.findByText("Diff")).toBeVisible();
    expect(screen.getByText(/\+ Old booking subject/)).toBeVisible();
    expectNoSaves();
  });
});
