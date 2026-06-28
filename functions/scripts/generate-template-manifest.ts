/**
 * Reads all .md files from email-templates/ and generates
 * src/generatedEmailTemplateManifest.ts for use by the Cloud Function.
 * Run automatically as part of `npm run build` via the `prebuild` script.
 */
import * as fs from "fs";
import * as path from "path";

const TEMPLATES_DIR = path.resolve(__dirname, "../email-templates");
const OUT_FILE = path.resolve(__dirname, "../src/generatedEmailTemplateManifest.ts");

interface ParsedTemplate {
  templateKey: string;
  subject: string;
  variables: string[];
  body: string;
}

function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Missing or malformed YAML frontmatter");
  }
  const rawMeta = match[1];
  const body = match[2].trim();

  const meta: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let inList = false;

  for (const line of rawMeta.split("\n")) {
    const listMatch = line.match(/^\s+-\s+(.+)$/);
    const keyMatch = line.match(/^(\w+):\s*(.*)$/);

    if (listMatch && inList && currentKey) {
      (meta[currentKey] as string[]).push(listMatch[1].trim());
    } else if (keyMatch) {
      currentKey = keyMatch[1];
      const value = keyMatch[2].trim();
      if (value === "") {
        meta[currentKey] = [];
        inList = true;
      } else {
        meta[currentKey] = value.replace(/^["']|["']$/g, "");
        inList = false;
      }
    }
  }

  return { meta, body };
}

function loadTemplates(): ParsedTemplate[] {
  const files = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".md") && f !== "README.md");
  return files.map((file) => {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, file), "utf-8");
    const { meta, body } = parseFrontmatter(content);
    const templateKey = meta.templateKey as string;
    const subject = meta.subject as string;
    const variables = (meta.variables as string[]) ?? [];
    if (!templateKey) throw new Error(`${file}: missing templateKey in frontmatter`);
    if (!subject) throw new Error(`${file}: missing subject in frontmatter`);
    return { templateKey, subject, variables, body };
  });
}

function generate(): void {
  const templates = loadTemplates();

  const entries = templates
    .map(({ templateKey, subject, variables, body }) => {
      const varsArray = variables.map((v) => `    "${v}"`).join(",\n");
      return `  ${templateKey}: {
    subject: ${JSON.stringify(subject)},
    variables: [\n${varsArray}\n    ],
    body: ${JSON.stringify(body)},
  }`;
    })
    .join(",\n");

  const output = `// AUTO-GENERATED — do not edit directly.
// Source: functions/email-templates/*.md
// Regenerate by running: npm run build (or npm run generate:templates)

export interface EmailTemplateDefinition {
  subject: string;
  variables: string[];
  body: string;
}

export const EMAIL_TEMPLATE_MANIFEST: Record<string, EmailTemplateDefinition> = {
${entries},
};
`;

  fs.writeFileSync(OUT_FILE, output, "utf-8");
  console.log(`Generated ${OUT_FILE} (${templates.length} templates)`);
}

generate();
