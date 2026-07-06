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

  it("shows template name derived from section and subject", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    expect(screen.getByLabelText("Template name")).toHaveTextContent("BULK: Alpha Section — …");

    await user.type(screen.getByLabelText("Template subject"), "Spring Dinner");

    expect(screen.getByLabelText("Template name")).toHaveTextContent("BULK: Alpha Section — Spring Dinner");
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

    // The guide shows the suggested name in a <code> element
    const codeEls = screen.getAllByText(/BULK: Alpha Section/);
    expect(codeEls.some((el) => el.tagName === "CODE")).toBe(true);
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
  });

  it("shows live preview when body is typed", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    await user.type(screen.getByLabelText("Template body"), "Hello world");

    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getAllByText("Hello world").length).toBeGreaterThan(0);
  });

  it("shows subject in preview without BULK: prefix", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    await user.type(screen.getByLabelText("Template subject"), "Spring Dinner");
    await user.type(screen.getByLabelText("Template body"), "Body text");

    // Preview shows plain subject
    expect(screen.getByText("Spring Dinner")).toBeInTheDocument();
    // Template name (not preview subject) has the prefix
    expect(screen.getByLabelText("Template name")).toHaveTextContent("BULK: Alpha Section — Spring Dinner");
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

  it("renders all toolbar buttons", () => {
    render(<TemplateEditor sectionName="Alpha Section" />);

    expect(screen.getByRole("button", { name: "Heading 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heading 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bullet point" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Numbered list" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inset text" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link [text](url)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Personalisation var" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Optional content" })).toBeInTheDocument();
  });

  it("toolbar inserts H1 prefix at cursor", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    const bodyField = screen.getByLabelText("Template body");
    await user.click(bodyField);
    await user.click(screen.getByRole("button", { name: "Heading 1" }));

    expect((bodyField as HTMLTextAreaElement).value).toContain("# Heading");
  });

  it("toolbar inserts bullet point", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    const bodyField = screen.getByLabelText("Template body");
    await user.click(bodyField);
    await user.click(screen.getByRole("button", { name: "Bullet point" }));

    expect((bodyField as HTMLTextAreaElement).value).toContain("* item");
  });

  it("toolbar inserts link syntax", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    const bodyField = screen.getByLabelText("Template body");
    await user.click(bodyField);
    await user.click(screen.getByRole("button", { name: "Link [text](url)" }));

    expect((bodyField as HTMLTextAreaElement).value).toContain("[link text](url)");
  });

  it("toolbar inserts personalisation variable", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    const bodyField = screen.getByLabelText("Template body");
    await user.click(bodyField);
    await user.click(screen.getByRole("button", { name: "Personalisation var" }));

    expect((bodyField as HTMLTextAreaElement).value).toContain("((firstName))");
  });

  it("shows copy buttons when subject or body has content", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    await user.type(screen.getByLabelText("Template subject"), "My subject");
    await user.type(screen.getByLabelText("Template body"), "My body");

    expect(screen.getAllByRole("button", { name: "Copy subject" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Copy template name" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Copy body" }).length).toBeGreaterThan(0);
  });

  it("copy subject writes plain subject to clipboard", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    const spy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    await user.type(screen.getByLabelText("Template subject"), "Spring Dinner");
    await user.type(screen.getByLabelText("Template body"), "My body");

    const copyBtns = screen.getAllByRole("button", { name: "Copy subject" });
    await user.click(copyBtns[copyBtns.length - 1]);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith("Spring Dinner");
    });
  });

  it("copy template name writes BULK: prefixed name to clipboard", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    const spy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    await user.type(screen.getByLabelText("Template subject"), "Spring Dinner");
    await user.type(screen.getByLabelText("Template body"), "My body");

    const copyBtns = screen.getAllByRole("button", { name: "Copy template name" });
    await user.click(copyBtns[copyBtns.length - 1]);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith("BULK: Alpha Section — Spring Dinner");
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
});
