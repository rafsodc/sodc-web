import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import TemplateEditor from "../TemplateEditor";

describe("TemplateEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders subject and body fields", () => {
    render(<TemplateEditor sectionName="Alpha Section" />);
    expect(screen.getByLabelText("Template subject")).toBeInTheDocument();
    expect(screen.getByLabelText("Template body")).toBeInTheDocument();
  });

  it("shows BULK: prefix adornment in subject field", () => {
    render(<TemplateEditor sectionName="Alpha Section" />);
    // The adornment sits inside the MUI input wrapper alongside the actual input
    const subjectInput = screen.getByLabelText("Template subject");
    const inputWrapper = subjectInput.closest(".MuiInputBase-root");
    expect(inputWrapper).toHaveTextContent("BULK:");
  });

  it("shows collapsible guide on click", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    expect(screen.getByText(/Log into the GOV Notify/i)).not.toBeVisible();

    await user.click(screen.getByText("How to create a GOV Notify template"));

    expect(screen.getByText(/Log into the GOV Notify/i)).toBeVisible();
  });

  it("shows suggested template name in guide", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);
    await user.click(screen.getByText("How to create a GOV Notify template"));

    expect(screen.getByText(/BULK: Alpha Section/)).toBeVisible();
  });

  it("hides guide when collapsed again", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    await user.click(screen.getByText("How to create a GOV Notify template"));
    expect(screen.getByText(/Log into the GOV Notify/i)).toBeVisible();

    await user.click(screen.getByText("How to create a GOV Notify template"));
    await waitFor(() => {
      expect(screen.getByText(/Log into the GOV Notify/i)).not.toBeVisible();
    });
  });

  it("shows optional content syntax in guide", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);
    await user.click(screen.getByText("How to create a GOV Notify template"));

    expect(screen.getByText(/Optional content/i)).toBeVisible();
    expect(screen.getByText(/\(\(show_extra\?\?/)).toBeVisible();
  });

  it("shows live preview when body is typed", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    await user.type(screen.getByLabelText("Template body"), "Hello world");

    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getAllByText("Hello world").length).toBeGreaterThan(0);
  });

  it("shows BULK: prefix in preview subject line", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    await user.type(screen.getByLabelText("Template subject"), "Spring Dinner");
    await user.type(screen.getByLabelText("Template body"), "Body text");

    expect(screen.getByText("BULK: Spring Dinner")).toBeInTheDocument();
  });

  it("does not show preview when body is empty", () => {
    render(<TemplateEditor sectionName="Alpha Section" />);
    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
  });

  it("shows warning for unsupported bold syntax", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    await user.type(screen.getByLabelText("Template body"), "This is **bold**");

    expect(screen.getByText(/Unsupported GOV Notify syntax detected/i)).toBeInTheDocument();
    expect(screen.getByText(/bold \(\*\*text\*\*\)/)).toBeInTheDocument();
  });

  it("shows warning for H3+ headings", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    await user.type(screen.getByLabelText("Template body"), "### Too deep");

    expect(screen.getByText(/Unsupported GOV Notify syntax detected/i)).toBeInTheDocument();
    expect(screen.getByText(/heading H3 or deeper/i)).toBeInTheDocument();
  });

  it("does not show warning for valid GOV Notify markdown", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    await user.type(screen.getByLabelText("Template body"), "# Heading");

    expect(screen.queryByText(/Unsupported/i)).not.toBeInTheDocument();
  });

  it("does not show warning for H2 headings", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    await user.type(screen.getByLabelText("Template body"), "## Sub heading");

    expect(screen.queryByText(/Unsupported/i)).not.toBeInTheDocument();
  });

  it("shows copy buttons when both subject and body have content", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    await user.type(screen.getByLabelText("Template subject"), "My subject");
    await user.type(screen.getByLabelText("Template body"), "My body");

    expect(screen.getAllByRole("button", { name: "Copy subject" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Copy body" }).length).toBeGreaterThan(0);
  });

  it("copy subject includes BULK: prefix", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    const spy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    await user.type(screen.getByLabelText("Template subject"), "My subject");
    await user.type(screen.getByLabelText("Template body"), "My body");

    const copyBtns = screen.getAllByRole("button", { name: "Copy subject" });
    await user.click(copyBtns[copyBtns.length - 1]);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith("BULK: My subject");
    });
  });

  it("copy body includes body text and footer", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    const spy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    await user.type(screen.getByLabelText("Template subject"), "Subj");
    await user.type(screen.getByLabelText("Template body"), "My body text");

    const copyBodyBtns = screen.getAllByRole("button", { name: "Copy body" });
    await user.click(copyBodyBtns[copyBodyBtns.length - 1]);

    await waitFor(() => {
      const calledWith = spy.mock.calls[0]?.[0] as string;
      expect(calledWith).toContain("My body text");
      expect(calledWith).toContain("SODC");
      expect(calledWith).toContain("((unsubscribeUrl))");
    });
  });

  it("appends standard footer to preview content", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    await user.type(screen.getByLabelText("Template body"), "My announcement");

    expect(screen.getByText("SODC")).toBeInTheDocument();
  });

  it("shows warning when subject contains unsupported syntax", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    await user.type(screen.getByLabelText("Template subject"), "**bold subject**");
    await user.type(screen.getByLabelText("Template body"), "Normal body");

    expect(screen.getByText(/Unsupported GOV Notify syntax detected/i)).toBeInTheDocument();
  });
});
