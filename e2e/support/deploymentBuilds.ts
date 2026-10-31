import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import { build, loadConfigFromFile, mergeConfig, type InlineConfig, type Plugin } from "vite";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixture = path.join(repository, "e2e/fixtures/deployment-recovery");
const demoDefines = Object.fromEntries(Object.entries({
  VITE_FIREBASE_API_KEY: "demo-deployment-recovery",
  VITE_FIREBASE_AUTH_DOMAIN: "localhost",
  VITE_FIREBASE_PROJECT_ID: "demo-sodc-deployment-recovery",
  VITE_FIREBASE_APP_ID: "1:000000000000:web:deployment-recovery",
  VITE_FIREBASE_STORAGE_BUCKET: "demo-sodc-deployment-recovery.invalid",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  VITE_FIREBASE_MEASUREMENT_ID: "",
  VITE_RECAPTCHA_SITE_KEY: "",
  VITE_USE_FIREBASE_EMULATORS: "false",
}).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]));

export interface BuiltDeployment {
  directories: Record<"A" | "B", string>;
  featureAssets: Record<"A" | "B", string>;
  entries: Record<"A" | "B", string>;
  remove(): Promise<void>;
}

/** Two actual Vite production builds, not a mocked preload-error event.
 * Test-only markers make an otherwise unvisited lazy chunk's URL change.
 * An empty envDir and explicit demo-only defines prevent reading site config.
 */
export async function buildDeployments(kind: "app" | "fixture"): Promise<BuiltDeployment> {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "sodc-deployment-e2e-"));
  const envDir = path.join(temporary, "empty-env");
  await mkdir(envDir);
  const configResult = await loadConfigFromFile({ command: "build", mode: "deployment-e2e", isSsrBuild: false, isPreview: false }, path.join(repository, "vite.config.ts"));
  if (!configResult) throw new Error("Could not load the actual application Vite configuration");
  const directories = { A: path.join(temporary, "A"), B: path.join(temporary, "B") };
  const featureAssets = { A: "", B: "" };
  const entries = { A: "", B: "" };
  for (const version of ["A", "B"] as const) {
    const marker: Plugin = {
      name: "test-only-deployment-marker",
      enforce: "pre",
      transform(source, id) {
        if (kind === "app" && id.replaceAll("\\", "/").endsWith("/PasswordResetRequestPage.tsx")) {
          if (!source.includes("Reset your password")) throw new Error("Actual lazy route marker target changed");
          return source.replace("Reset your password", `Reset your password — build ${version}`);
        }
        if (kind === "fixture" && id.includes("/e2e/fixtures/deployment-recovery/")) {
          return source.replaceAll("__DEPLOYMENT_FIXTURE_VERSION__", version);
        }
        return undefined;
      },
    };
    const options: InlineConfig = {
      configFile: false,
      root: kind === "app" ? repository : fixture,
      envDir,
      publicDir: false,
      define: demoDefines,
      logLevel: "error",
      plugins: [marker],
      build: { outDir: directories[version], emptyOutDir: true },
    };
    await build(mergeConfig(configResult.config, options));
    const assets = await readdir(path.join(directories[version], "assets"));
    const feature = assets.filter(name => name.startsWith(kind === "app" ? "PasswordResetRequestPage-" : "LazyFeature-") && name.endsWith(".js"));
    if (feature.length !== 1) throw new Error(`Expected one actual lazy feature chunk, received ${feature.length}`);
    featureAssets[version] = "/assets/" + feature[0];
    const html = await readFile(path.join(directories[version], "index.html"), "utf8");
    const entry = html.match(/<script\b[^>]*\bsrc="([^"]+\.js)"/);
    if (!entry) throw new Error("Built HTML has no JavaScript entry");
    entries[version] = entry[1];
  }
  if (featureAssets.A === featureAssets.B || entries.A === entries.B) throw new Error("A and B must have distinct real entry and lazy asset URLs");
  return { directories, featureAssets, entries, async remove() { await rm(temporary, { recursive: true, force: true }); } };
}
