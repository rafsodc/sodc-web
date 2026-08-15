import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const testsDirectory = path.resolve(process.cwd(), "src/__tests__");
const documentedDomains = new Set([
  "announcements",
  "bookings",
  "cross-cutting",
  "email-templates",
  "guest-tickets",
  "legacy-user-migration",
  "notifications",
  "payments",
  "sections",
  "users-auth",
]);

function testFiles(directory: string, relativeDirectory = ""): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      return testFiles(path.join(directory, entry.name), relativePath);
    }
    return entry.name.endsWith(".test.ts") || entry.name.endsWith(".spec.ts")
      ? [relativePath]
      : [];
  });
}

describe("Functions test layout", () => {
  it("keeps every test in a documented domain folder", () => {
    const files = testFiles(testsDirectory);

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const segments = file.split(path.sep);
      expect(segments.length, `${file} must not live at the test root`).toBeGreaterThan(1);
      expect(documentedDomains, `${file} is in an undocumented domain`).toContain(segments[0]);
    }
  });

  it("keeps shared setup at the discoverable test root", () => {
    expect(fs.existsSync(path.join(testsDirectory, "setup.ts"))).toBe(true);
  });
});
