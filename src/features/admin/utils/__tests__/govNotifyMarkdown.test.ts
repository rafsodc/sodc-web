import { describe, expect, it } from "vitest";
import {
  STANDARD_FOOTER,
  UNSUPPORTED_PATTERNS,
  renderGovNotifyMarkdown,
} from "../govNotifyMarkdown";

describe("UNSUPPORTED_PATTERNS", () => {
  it("detects bold **text**", () => {
    expect(/\*\*[^*]+\*\*/.test("**bold**")).toBe(true);
    const match = UNSUPPORTED_PATTERNS.find((p) => p.name.includes("bold (**"));
    expect(match?.pattern.test("**bold**")).toBe(true);
  });

  it("detects bold __text__", () => {
    const match = UNSUPPORTED_PATTERNS.find((p) => p.name.includes("__text__"));
    expect(match?.pattern.test("__bold__")).toBe(true);
  });

  it("detects italic *text*", () => {
    const match = UNSUPPORTED_PATTERNS.find((p) => p.name.includes("italic (*text*)"));
    expect(match?.pattern.test("*italic*")).toBe(true);
  });

  it("detects italic _text_", () => {
    const match = UNSUPPORTED_PATTERNS.find((p) => p.name.includes("italic (_text_)"));
    expect(match?.pattern.test("_italic_")).toBe(true);
  });

  it("detects strikethrough", () => {
    const match = UNSUPPORTED_PATTERNS.find((p) => p.name.includes("strikethrough"));
    expect(match?.pattern.test("~~strike~~")).toBe(true);
  });

  it("detects inline code", () => {
    const match = UNSUPPORTED_PATTERNS.find((p) => p.name.includes("inline code"));
    expect(match?.pattern.test("`code`")).toBe(true);
  });

  it("detects fenced code block", () => {
    const match = UNSUPPORTED_PATTERNS.find((p) => p.name.includes("fenced code"));
    expect(match?.pattern.test("```\ncode\n```")).toBe(true);
  });

  it("detects blockquote", () => {
    const match = UNSUPPORTED_PATTERNS.find((p) => p.name.includes("blockquote"));
    expect(match?.pattern.test("> quoted")).toBe(true);
  });

  it("detects image syntax", () => {
    const match = UNSUPPORTED_PATTERNS.find((p) => p.name.includes("image"));
    expect(match?.pattern.test("![alt](url)")).toBe(true);
  });

  it("detects HTML tags", () => {
    const match = UNSUPPORTED_PATTERNS.find((p) => p.name.includes("HTML tag"));
    expect(match?.pattern.test("<br>")).toBe(true);
  });

  it("does not flag supported GOV Notify markdown", () => {
    const body = "# Heading\n\n* bullet\n\n[link](https://example.com)\n\n^ inset\n\n---";
    for (const { pattern } of UNSUPPORTED_PATTERNS) {
      expect(pattern.test(body)).toBe(false);
    }
  });
});

describe("STANDARD_FOOTER", () => {
  it("contains SODC and unsubscribeUrl variable", () => {
    expect(STANDARD_FOOTER).toContain("SODC");
    expect(STANDARD_FOOTER).toContain("((unsubscribeUrl))");
    expect(STANDARD_FOOTER).toContain("---");
  });
});

describe("renderGovNotifyMarkdown", () => {
  it("renders a paragraph", () => {
    const html = renderGovNotifyMarkdown("Hello world");
    expect(html).toContain("<p");
    expect(html).toContain("Hello world");
  });

  it("renders h1 heading", () => {
    const html = renderGovNotifyMarkdown("# Main heading");
    expect(html).toContain("<h1");
    expect(html).toContain("Main heading");
  });

  it("renders h2 heading", () => {
    const html = renderGovNotifyMarkdown("## Sub heading");
    expect(html).toContain("<h2");
  });

  it("renders horizontal rule", () => {
    const html = renderGovNotifyMarkdown("---");
    expect(html).toContain("<hr");
  });

  it("renders inset text with ^ prefix", () => {
    const html = renderGovNotifyMarkdown("^ This is inset");
    expect(html).toContain("border-left");
    expect(html).toContain("This is inset");
  });

  it("renders unordered list with * bullets", () => {
    const html = renderGovNotifyMarkdown("* Item one\n* Item two");
    expect(html).toContain("<ul");
    expect(html).toContain("<li>Item one</li>");
    expect(html).toContain("<li>Item two</li>");
    expect(html).toContain("</ul>");
  });

  it("renders unordered list with - bullets", () => {
    const html = renderGovNotifyMarkdown("- Item A\n- Item B");
    expect(html).toContain("<ul");
    expect(html).toContain("<li>Item A</li>");
  });

  it("renders ordered list", () => {
    const html = renderGovNotifyMarkdown("1. First\n2. Second");
    expect(html).toContain("<ol");
    expect(html).toContain("<li>First</li>");
    expect(html).toContain("</ol>");
  });

  it("renders links", () => {
    const html = renderGovNotifyMarkdown("[Click here](https://example.com)");
    expect(html).toContain('<a href="https://example.com">Click here</a>');
  });

  it("highlights personalisation variables", () => {
    const html = renderGovNotifyMarkdown("Dear ((firstName)),");
    expect(html).toContain("<mark");
    expect(html).toContain("firstName");
  });

  it("handles personalisation variable as link target", () => {
    const html = renderGovNotifyMarkdown("[Unsubscribe](((unsubscribeUrl)))");
    expect(html).toContain('<a href="#">Unsubscribe</a>');
  });

  it("closes list when followed by a heading", () => {
    const html = renderGovNotifyMarkdown("* item\n# Heading");
    expect(html).toContain("</ul>");
    expect(html).toContain("<h1");
  });

  it("closes list when followed by inset text", () => {
    const html = renderGovNotifyMarkdown("* item\n^ note");
    expect(html).toContain("</ul>");
    expect(html).toContain("border-left");
  });

  it("closes ordered list on empty line", () => {
    const html = renderGovNotifyMarkdown("1. item\n\nnext paragraph");
    expect(html).toContain("</ol>");
    expect(html).toContain("<p");
  });

  it("closes unordered list before horizontal rule", () => {
    const html = renderGovNotifyMarkdown("* item\n---");
    expect(html).toContain("</ul>");
    expect(html).toContain("<hr");
  });

  it("escapes HTML entities", () => {
    const html = renderGovNotifyMarkdown("Tom & Jerry < > \"quoted\"");
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
  });

  it("handles empty input", () => {
    const html = renderGovNotifyMarkdown("");
    expect(html).toBe("");
  });

  it("renders a mixed document", () => {
    const md = "# Welcome\n\nDear ((firstName)),\n\n* Point one\n* Point two\n\n[Unsubscribe](((unsubscribeUrl)))";
    const html = renderGovNotifyMarkdown(md);
    expect(html).toContain("<h1");
    expect(html).toContain("firstName");
    expect(html).toContain("<ul");
    expect(html).toContain("<a href=\"#\">Unsubscribe</a>");
  });
});
