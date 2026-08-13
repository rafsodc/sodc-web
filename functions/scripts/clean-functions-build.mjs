import { rm } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const functionsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(functionsDirectory, "lib");

if (outputDirectory !== `${functionsDirectory}${sep}lib`) {
  throw new Error(`Refusing to clean unexpected build directory: ${outputDirectory}`);
}

await rm(outputDirectory, { recursive: true, force: true });
