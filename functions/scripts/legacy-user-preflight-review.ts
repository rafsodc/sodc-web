#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  buildLegacyMigrationApprovalStub,
  buildLegacyPreflightReviewWorksheet,
  parseLegacyPreflightReport,
} from "../src/legacyUserPreflightReview";

interface CliOptions {
  inputPath: string;
  projectId: string;
  outputPath?: string;
  approvalOutputPath?: string;
}

function usage(): never {
  console.error(`Usage:
  npm run legacy-user-preflight-review -- \\
    --input ../secure/legacy-user-preflight.json \\
    --project sodc-web \\
    --output ../secure/legacy-user-preflight-worksheet.md \\
    --approval-output ../secure/legacy-user-migration-approval-stub.json

Reads a non-PII sodc-api preflight report and renders it as a Markdown review
worksheet structured around issue #420's acceptance criteria, plus an
approval-artifact stub for legacy-user-import.ts's --approval flag. Both
outputs are non-PII; --output/--approval-output are optional and default to
printing to stdout.`);
  process.exit(2);
}

function parseArguments(argv: string[]): CliOptions {
  const values = new Map<string, string>();
  const valueOptions = new Set(["--input", "--project", "--output", "--approval-output"]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") usage();
    if (!valueOptions.has(argument)) usage();
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) usage();
    values.set(argument, value);
    index += 1;
  }
  const inputPath = values.get("--input");
  const projectId = values.get("--project");
  if (!inputPath || !projectId) usage();
  return {
    inputPath,
    projectId,
    outputPath: values.get("--output"),
    approvalOutputPath: values.get("--approval-output"),
  };
}

function writeFile(outputPath: string, content: string): void {
  const directory = path.dirname(outputPath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = `${outputPath}.tmp`;
  fs.writeFileSync(temporaryPath, content, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(temporaryPath, 0o600);
  fs.renameSync(temporaryPath, outputPath);
  fs.chmodSync(outputPath, 0o600);
}

function main(): void {
  const options = parseArguments(process.argv.slice(2));
  const raw: unknown = JSON.parse(fs.readFileSync(options.inputPath, "utf8"));
  const report = parseLegacyPreflightReport(raw);

  const worksheet = buildLegacyPreflightReviewWorksheet(report);
  console.log(worksheet);
  if (options.outputPath) writeFile(options.outputPath, worksheet);

  const approvalStub = buildLegacyMigrationApprovalStub(report, options.projectId);
  const approvalJson = `${JSON.stringify(approvalStub, null, 2)}\n`;
  if (options.approvalOutputPath) {
    writeFile(options.approvalOutputPath, approvalJson);
    console.log(`\nApproval stub written to ${options.approvalOutputPath}`);
  } else {
    console.log("\nApproval artifact stub:");
    console.log(approvalJson);
  }
}

try {
  main();
} catch (error: unknown) {
  console.error(
    `Legacy user preflight review stopped: ${error instanceof Error ? error.message : "unknown error"}`
  );
  process.exitCode = 1;
}
