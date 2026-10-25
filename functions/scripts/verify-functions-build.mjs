import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const defaultFunctionsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function verifyFunctionsBuild(functionsDirectory = defaultFunctionsDirectory) {
  const outputDirectory = resolve(functionsDirectory, "lib");
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

  // TypeScript exclude controls root discovery, not transitive imports. A CLI-only
  // source imported by a Function can still be emitted, as can stale build files.
  const buildConfig = JSON.parse(await readFile(resolve(functionsDirectory, "tsconfig.build.json"), "utf8"));
  const excludedModules = buildConfig.exclude
    .filter((path) => /^src\/[^*?]+\.ts$/.test(path))
    .map((path) => path.slice("src/".length, -".ts".length));
  const forbidden = (await readdir(outputDirectory, { recursive: true, withFileTypes: true }))
    .filter((entry) => !entry.isDirectory())
    .map((entry) => relative(outputDirectory, resolve(entry.parentPath, entry.name)).split(sep).join("/"))
    .filter((path) =>
      path.split("/").includes("__tests__") ||
      /\.(?:test|spec)\.js(?:\.map)?$/.test(path) ||
      excludedModules.some((module) => [".js", ".js.map"].some((extension) =>
        path === module + extension || path.endsWith("/" + module + extension)
      ))
    );

  if (forbidden.length > 0) {
    throw new Error(`Functions build contains excluded artifacts:\n${forbidden.sort().join("\n")}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyFunctionsBuild();
}
