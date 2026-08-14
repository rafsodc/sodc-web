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
let entryPointStat;
try {
  entryPointStat = await stat(entryPoint);
} catch (error) {
  throw new Error(`Could not read Functions build entry point: ${entryPoint}`, { cause: error });
}
if (!entryPointStat.isFile()) {
  throw new Error(`Functions build entry point is not a file: ${entryPoint}`);
}

const forbidden = (await filesUnder(outputDirectory))
  .map((path) => relative(outputDirectory, path))
  .filter((path) =>
    path.split(sep).includes("__tests__") ||
    /\.(?:test|spec)\.js(?:\.map)?$/.test(path)
  );

if (forbidden.length > 0) {
  throw new Error(`Functions build contains test artifacts:\n${forbidden.join("\n")}`);
}
