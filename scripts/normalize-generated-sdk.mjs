#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// firebase-tools currently emits whitespace-only blank lines in these two runtime
// bundles. The reviewed files intentionally normalize those lines; keep this list
// narrow so generated documentation and examples remain byte-for-byte untouched.
const generatedRuntimeFiles = [
  "src/dataconnect-generated/esm/index.esm.js",
  "src/dataconnect-generated/index.cjs.js",
];

await Promise.all(generatedRuntimeFiles.map(async (relativePath) => {
  const filePath = path.join(repositoryRoot, relativePath);
  const original = await readFile(filePath, "utf8");
  const normalized = original.replace(/[ \t]+$/gm, "");
  if (normalized !== original) await writeFile(filePath, normalized, "utf8");
}));
