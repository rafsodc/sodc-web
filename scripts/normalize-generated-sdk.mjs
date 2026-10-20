#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeGeneratedRuntime } from "./normalize-generated-sdk-lib.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// firebase-tools emits trailing whitespace and superfluous variables arguments for
// queries without variables. Normalize only runtime bundles; leave documentation
// and examples untouched.
const generatedRuntimeFiles = [
  "src/dataconnect-generated/esm/index.esm.js",
  "src/dataconnect-generated/index.cjs.js",
];

await Promise.all(generatedRuntimeFiles.map(async (relativePath) => {
  const filePath = path.join(repositoryRoot, relativePath);
  const original = await readFile(filePath, "utf8");
  const normalized = normalizeGeneratedRuntime(original);
  if (normalized !== original) await writeFile(filePath, normalized, "utf8");
}));
