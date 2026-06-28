import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const TEMPLATES_DIR = path.resolve(__dirname, "../../email-templates");

const UNSUPPORTED_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "bold (**text**)", pattern: /\*\*[^*]+\*\*/ },
  { name: "bold (__text__)", pattern: /__[^_]+__/ },
  { name: "italic (*text*) — single asterisk not used as a bullet", pattern: /(?<!\*)\*(?!\*)(?!\s)([^*\n]+)(?<!\s)\*(?!\*)/ },
  { name: "italic (_text_)", pattern: /(?<!_)_(?!_)(?!\s)([^_\n]+)(?<!\s)_(?!_)/ },
  { name: "strikethrough (~~text~~)", pattern: /~~[^~]+~~/ },
  { name: "inline code (`code`)", pattern: /`[^`]+`/ },
  { name: "fenced code block (```)", pattern: /^```/m },
  { name: "blockquote (> text)", pattern: /^> /m },
  { name: "image (![alt](url))", pattern: /!\[[^\]]*\]\([^)]+\)/ },
  { name: "HTML tag (<tag>)", pattern: /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/ },
];

function readTemplateBody(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf8");
  // Strip YAML frontmatter
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1] : content;
}

describe("GOV Notify email templates", () => {
  const templateFiles = fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((f) => ({ name: f, filePath: path.join(TEMPLATES_DIR, f) }));

  it("should find template files to test", () => {
    expect(templateFiles.length).toBeGreaterThan(0);
  });

  for (const { name, filePath } of templateFiles) {
    describe(name, () => {
      const body = readTemplateBody(filePath);

      for (const { name: patternName, pattern } of UNSUPPORTED_PATTERNS) {
        it(`must not use ${patternName}`, () => {
          expect(body).not.toMatch(pattern);
        });
      }
    });
  }
});
