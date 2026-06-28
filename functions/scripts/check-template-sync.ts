/**
 * Checks live GOV Notify templates against the local .md files.
 * Used by CI — always exits 0 (never blocks merges).
 *
 * Env vars:
 *   GOV_NOTIFY_API_KEY  — required; skip check gracefully if absent
 *   CHECK_ENV           — "dev" | "beta" | "production" (default: "dev")
 *   DRIFT_OUTPUT_FILE   — path to write a Markdown summary (optional)
 */
import * as fs from "fs";
import * as path from "path";
import { NotifyClient } from "notifications-node-client";

type Environment = "dev" | "beta" | "production";

const TEMPLATES_DIR = path.resolve(__dirname, "../email-templates");
const REGISTRY_PATH = path.resolve(__dirname, "../email-templates/template-registry.json");
const ENV = (process.env.CHECK_ENV ?? "dev") as Environment;
const API_KEY = process.env.GOV_NOTIFY_API_KEY ?? "";
const OUTPUT_FILE = process.env.DRIFT_OUTPUT_FILE ?? "";

if (!API_KEY) {
  console.log("GOV_NOTIFY_API_KEY not set — skipping template drift check");
  process.exit(0);
}

interface RegistryEntry {
  dev?: string;
  beta?: string;
  production?: string;
}

function loadRegistry(): Record<string, RegistryEntry> {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as Record<string, RegistryEntry>;
}

function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error("Missing or malformed YAML frontmatter");
  const meta: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let inList = false;
  for (const line of match[1].split("\n")) {
    const listMatch = line.match(/^\s+-\s+(.+)$/);
    const keyMatch = line.match(/^(\w+):\s*(.*)$/);
    if (listMatch && inList && currentKey) {
      (meta[currentKey] as string[]).push(listMatch[1].trim());
    } else if (keyMatch) {
      currentKey = keyMatch[1];
      const value = keyMatch[2].trim();
      if (value === "") { meta[currentKey] = []; inList = true; }
      else { meta[currentKey] = value.replace(/^["']|["']$/g, ""); inList = false; }
    }
  }
  return { meta, body: match[2].trim() };
}

function normalise(s: string): string {
  return s.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

type DriftResult =
  | { status: "in_sync"; templateKey: string }
  | { status: "drift"; templateKey: string; uuid: string; fields: string[] }
  | { status: "fetch_error"; templateKey: string; uuid: string; error: string }
  | { status: "not_configured"; templateKey: string };

async function run(): Promise<void> {
  const registry = loadRegistry();
  const client = new NotifyClient(API_KEY);

  const files = fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md");

  const results: DriftResult[] = await Promise.all(
    files.map(async (file): Promise<DriftResult> => {
      const content = fs.readFileSync(path.join(TEMPLATES_DIR, file), "utf-8");
      const { meta, body } = parseFrontmatter(content);
      const templateKey = meta.templateKey as string;
      const expectedSubject = meta.subject as string;
      const expectedBody = normalise(body);

      const uuid = registry[templateKey]?.[ENV]?.trim();
      if (!uuid) return { status: "not_configured", templateKey };

      try {
        const response = await client.getTemplateById(uuid);
        const data = response.data as { subject: string; body: string };
        const liveSubject = data.subject ?? "";
        const liveBody = normalise(data.body ?? "");
        const driftFields: string[] = [];
        if (liveSubject !== expectedSubject) driftFields.push("subject");
        if (liveBody !== expectedBody) driftFields.push("body");
        if (driftFields.length > 0) {
          return { status: "drift", templateKey, uuid, fields: driftFields };
        }
        return { status: "in_sync", templateKey };
      } catch (err) {
        return {
          status: "fetch_error",
          templateKey,
          uuid,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  const drifted = results.filter((r) => r.status === "drift") as Extract<DriftResult, { status: "drift" }>[];
  const errors = results.filter((r) => r.status === "fetch_error") as Extract<DriftResult, { status: "fetch_error" }>[];
  const inSync = results.filter((r) => r.status === "in_sync").length;
  const unconfigured = results.filter((r) => r.status === "not_configured").length;

  // GitHub Actions annotations
  for (const r of drifted) {
    console.log(`::warning::Template drift detected: ${r.templateKey} (${r.fields.join(", ")}) — update GOV Notify dashboard`);
  }
  for (const r of errors) {
    console.log(`::warning::Failed to fetch template ${r.templateKey} (${r.uuid}): ${r.error}`);
  }

  // Human-readable summary
  console.log(`\nTemplate sync check — environment: ${ENV}`);
  console.log(`  In sync:      ${inSync}`);
  console.log(`  Drift:        ${drifted.length}`);
  console.log(`  Fetch errors: ${errors.length}`);
  console.log(`  Unconfigured: ${unconfigured} (skipped)`);

  // Markdown summary for PR comment / issue body
  if (OUTPUT_FILE) {
    const lines: string[] = [];
    if (drifted.length === 0 && errors.length === 0) {
      lines.push(`### ✅ GOV Notify templates in sync (${ENV})`);
      lines.push(`All ${inSync} configured templates match the codebase.`);
    } else {
      lines.push(`### ⚠️ GOV Notify template drift detected (${ENV})`);
      lines.push("");
      if (drifted.length > 0) {
        lines.push("**Templates with drift** — update the GOV Notify dashboard to match the `.md` files:");
        lines.push("");
        lines.push("| Template | Drifted fields |");
        lines.push("| --- | --- |");
        for (const r of drifted) {
          lines.push(`| \`${r.templateKey}\` | ${r.fields.join(", ")} |`);
        }
        lines.push("");
      }
      if (errors.length > 0) {
        lines.push("**Fetch errors** — could not reach GOV Notify for:");
        lines.push("");
        for (const r of errors) {
          lines.push(`- \`${r.templateKey}\`: ${r.error}`);
        }
        lines.push("");
      }
      lines.push(`_${inSync} template(s) in sync. ${unconfigured} unconfigured (skipped)._`);
    }
    lines.push("");
    lines.push(`<!-- template-drift-check -->`);
    fs.writeFileSync(OUTPUT_FILE, lines.join("\n"), "utf-8");
    console.log(`\nWrote summary to ${OUTPUT_FILE}`);
  }

  // Always exit 0 — drift is informational, not a merge blocker
  process.exit(0);
}

run().catch((err) => {
  console.error("Unexpected error in template drift check:", err);
  process.exit(0);
});
