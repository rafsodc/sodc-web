import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import TemplateEditor from "../TemplateEditor";

describe("TemplateEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a collapsed toggle and fields are not visible initially", () => {
    render(<TemplateEditor sectionName="Alpha Section" />);
    expect(screen.getByText("Create a GOV Notify template")).toBeInTheDocument();
    // Fields exist in the DOM inside the Collapse but are hidden
    expect(screen.getByLabelText("Template subject")).not.toBeVisible();
  });

  it("expands to show fields when toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    await user.click(screen.getByText("Create a GOV Notify template"));

    expect(screen.getByLabelText("Template subject")).toBeVisible();
    expect(screen.getByLabelText("Template body")).toBeVisible();
  });

  it("collapses again on second click", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor sectionName="Alpha Section" />);

    await user.click(screen.getByText("Create a GOV Notify template"));
    expect(screen.getByLabelText("Template subject")).toBeVisible();

    await user.click(screen.getByText("Create a GOV Notify template"));
    await waitFor(() => {
      expect(screen.getByLabelText("Template subject")).not.toBeVisible();
    });
  });

  describe("when expanded", () => {
    async function expand() {
      const user = userEvent.setup();
      render(<TemplateEditor sectionName="Alpha Section" />);
      await user.click(screen.getByText("Create a GOV Notify template"));
      return user;
    }

    it("shows template name derived from section and subject", async () => {
      const user = await expand();

      expect(screen.getByLabelText("Template name")).toHaveTextContent("BULK: Alpha Section — …");

      await user.type(screen.getByLabelText("Template subject"), "Spring Dinner");

      expect(screen.getByLabelText("Template name")).toHaveTextContent("BULK: Alpha Section — Spring Dinner");
    });

    it("shows collapsible inner guide", async () => {
      const user = await expand();

      expect(screen.getByText(/Log into the GOV Notify/i)).not.toBeVisible();
      await user.click(screen.getByText("How to create a GOV Notify template"));
      expect(screen.getByText(/Log into the GOV Notify/i)).toBeVisible();
    });

    it("guide mentions user and system variables", async () => {
      const user = await expand();
      await user.click(screen.getByText("How to create a GOV Notify template"));

      // Guide lists user variables in a <code> block — check text content
      const guideContent = screen.getByText(/The footer uses/);
      expect(guideContent).toBeVisible();
      expect(guideContent.closest("li")?.textContent).toContain("((serviceNumber))");
    });

    it("shows live preview when body is typed", async () => {
      const user = await expand();

      await user.type(screen.getByLabelText("Template body"), "Hello world");

      expect(screen.getByText("Preview")).toBeInTheDocument();
      expect(screen.getAllByText("Hello world").length).toBeGreaterThan(0);
    });

    it("shows subject in preview without BULK: prefix", async () => {
      const user = await expand();

      await user.type(screen.getByLabelText("Template subject"), "Spring Dinner");
      await user.type(screen.getByLabelText("Template body"), "Body text");

      expect(screen.getByText("Spring Dinner")).toBeInTheDocument();
    });

    it("does not show preview when body is empty", async () => {
      await expand();
      expect(screen.queryByText("Preview")).not.toBeInTheDocument();
    });

    it("flags unsupported bold syntax", async () => {
      const user = await expand();

      await user.type(screen.getByLabelText("Template body"), "This is **bold**");

      expect(screen.getByText(/Unsupported GOV Notify syntax detected/i)).toBeInTheDocument();
    });

    it("flags H3+ headings as unsupported", async () => {
      const user = await expand();

      await user.type(screen.getByLabelText("Template body"), "### Too deep");

      expect(screen.getByText(/heading H3 or deeper/i)).toBeInTheDocument();
    });

    it("renders all block toolbar buttons", async () => {
      await expand();

      expect(screen.getByRole("button", { name: "Heading 1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Heading 2" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Bullet point" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Numbered list" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Inset text" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Link [text](url)" })).toBeInTheDocument();
    });

    it("renders variable picker and optional content buttons", async () => {
      await expand();

      expect(screen.getByRole("button", { name: "Insert variable" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Optional content" })).toBeInTheDocument();
    });

    it("variable picker opens and shows grouped User and System variables", async () => {
      const user = await expand();

      await user.click(screen.getByRole("button", { name: "Insert variable" }));

      const menuItems = screen.getAllByRole("menuitem");
      const menuText = menuItems.map((el) => el.textContent ?? "").join(" ");
      // User group
      expect(menuText).toContain("((firstName))");
      expect(menuText).toContain("((lastName))");
      expect(menuText).toContain("((email))");
      expect(menuText).toContain("((serviceNumber))");
      expect(menuText).toContain("((membershipStatus))");
      // System group
      expect(menuText).toContain("((section))");
      expect(menuText).toContain("((unsubscribeUrl))");
      // Group headings
      expect(screen.getByText("User")).toBeInTheDocument();
      expect(screen.getByText("System")).toBeInTheDocument();
    });

    it("inserting a variable from the picker adds it to the body", async () => {
      const user = await expand();

      const bodyField = screen.getByLabelText("Template body");
      await user.click(bodyField);
      await user.click(screen.getByRole("button", { name: "Insert variable" }));

      // Click the firstName menu item specifically
      const item = screen.getByRole("menuitem", { name: /firstName/ });
      await user.click(item);

      expect((bodyField as HTMLTextAreaElement).value).toContain("((firstName))");
    });

    it("toolbar H1 button inserts heading at cursor", async () => {
      const user = await expand();

      const bodyField = screen.getByLabelText("Template body");
      await user.click(bodyField);
      await user.click(screen.getByRole("button", { name: "Heading 1" }));

      expect((bodyField as HTMLTextAreaElement).value).toContain("# Heading");
    });

    it("toolbar link button inserts link syntax", async () => {
      const user = await expand();

      const bodyField = screen.getByLabelText("Template body");
      await user.click(bodyField);
      await user.click(screen.getByRole("button", { name: "Link [text](url)" }));

      expect((bodyField as HTMLTextAreaElement).value).toContain("[link text](url)");
    });

    it("copy subject writes plain subject to clipboard", async () => {
      const user = await expand();
      const spy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

      await user.type(screen.getByLabelText("Template subject"), "Spring Dinner");
      await user.type(screen.getByLabelText("Template body"), "Body");

      const btns = screen.getAllByRole("button", { name: "Copy subject" });
      await user.click(btns[btns.length - 1]);

      await waitFor(() => expect(spy).toHaveBeenCalledWith("Spring Dinner"));
    });

    it("copy template name writes BULK: prefixed name to clipboard", async () => {
      const user = await expand();
      const spy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

      await user.type(screen.getByLabelText("Template subject"), "Spring Dinner");
      await user.type(screen.getByLabelText("Template body"), "Body");

      const btns = screen.getAllByRole("button", { name: "Copy template name" });
      await user.click(btns[btns.length - 1]);

      await waitFor(() => expect(spy).toHaveBeenCalledWith("BULK: Alpha Section — Spring Dinner"));
    });

    it("copy body includes body text, footer, and section variable", async () => {
      const user = await expand();
      const spy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

      await user.type(screen.getByLabelText("Template subject"), "Subj");
      await user.type(screen.getByLabelText("Template body"), "My body text");

      const btns = screen.getAllByRole("button", { name: "Copy body" });
      await user.click(btns[btns.length - 1]);

      await waitFor(() => {
        const calledWith = spy.mock.calls[0]?.[0] as string;
        expect(calledWith).toContain("My body text");
        expect(calledWith).toContain("((section))");
        expect(calledWith).toContain("((unsubscribeUrl))");
        expect(calledWith).toContain("SODC");
      });
    });

    it("footer preview shows new footer text", async () => {
      const user = await expand();

      await user.type(screen.getByLabelText("Template body"), "My announcement");

      expect(screen.getByText(/RAF SODC/)).toBeInTheDocument();
      expect(screen.getByText("SODC")).toBeInTheDocument();
    });
  });
});
