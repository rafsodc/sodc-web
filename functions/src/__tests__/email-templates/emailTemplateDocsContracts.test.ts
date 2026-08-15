import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { EMAIL_TEMPLATE_MANIFEST } from "../../generatedEmailTemplateManifest";

const repoRoot = path.resolve(process.cwd(), "..");
const DOCS_PATH = "docs/operations/govuk-notify-template-copy.md";
const REGISTRY_PATH = "functions/email-templates/template-registry.json";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

/**
 * functions/email-templates/*.md (compiled into EMAIL_TEMPLATE_MANIFEST) is the single source
 * consumed by getTemplateSyncStatus. docs/operations/govuk-notify-template-copy.md is an index
 * and tone guide rather than a hand-maintained duplicate. These checks catch a template added
 * to either side without the corresponding source or index entry.
 */
describe("GOV Notify template docs parity (#378)", () => {
  const docs = readRepoFile(DOCS_PATH);
  const registry = JSON.parse(readRepoFile(REGISTRY_PATH)) as Record<string, unknown>;
  const manifestKeys = Object.keys(EMAIL_TEMPLATE_MANIFEST);
  const documentedKeys = [...docs.matchAll(/^### `([a-zA-Z0-9]+)`/gm)].map((match) => match[1]);

  it("finds template keys in both the manifest and the docs to compare", () => {
    expect(manifestKeys.length).toBeGreaterThan(0);
    expect(documentedKeys.length).toBeGreaterThan(0);
  });

  for (const key of manifestKeys) {
    it(`documents ${key} (present in functions/email-templates/) in ${DOCS_PATH}`, () => {
      expect(documentedKeys, `${key} exists in functions/email-templates/ but has no "### \`${key}\`" heading in ${DOCS_PATH}`).toContain(key);
    });

    it(`registers ${key} in ${REGISTRY_PATH}`, () => {
      expect(
        registry,
        `${key} exists in the generated manifest but has no registry entry`,
      ).toHaveProperty(key);
    });
  }

  for (const key of documentedKeys) {
    it(`has a functions/email-templates/${key}.md source for the "${key}" section documented in ${DOCS_PATH}`, () => {
      expect(manifestKeys, `${DOCS_PATH} documents ${key} but functions/email-templates/${key}.md doesn't exist (or isn't in the generated manifest — run npm run generate:templates)`).toContain(key);
    });
  }
});
