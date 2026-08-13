import { readdir, stat } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const functionsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(functionsDirectory, "lib");

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat();
}

const entryPoint = resolve(outputDirectory, "index.js");
try {
  if (!(await stat(entryPoint)).isFile()) throw new Error("not a file");
} catch {
  throw new Error(`Functions build is missing its entry point: ${entryPoint}`);
}

const forbidden = (await filesUnder(outputDirectory))
  .map((path) => relative(outputDirectory, path))
  .filter((path) =>
    path.split(sep).includes("__tests__") ||
    /\.test\.js(?:\.map)?$/.test(path)
  );

if (forbidden.length > 0) {
  throw new Error(`Functions build contains test artifacts:\n${forbidden.join("\n")}`);
}
