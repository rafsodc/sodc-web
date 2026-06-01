#!/usr/bin/env node
/**
 * Firebase Data Connect admin CJS SDK omits semicolons after enum blocks before exports.
 * Run after `firebase dataconnect:sdk:generate` to satisfy CodeQL js/semicolon-insertion.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(__dirname, "../src/dataconnect-admin-generated/index.cjs.js");

let text = fs.readFileSync(target, "utf8");
const fixed = text.replace(/^}(\r?\nexports\.)/gm, "};$1");
if (fixed === text) {
  console.log("fix-dataconnect-admin-cjs-semicolons: no changes needed");
  process.exit(0);
}
fs.writeFileSync(target, fixed);
console.log("fix-dataconnect-admin-cjs-semicolons: updated", target);
