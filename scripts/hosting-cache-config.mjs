import { cp, lstat, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateFirebaseAlias } from "./deploy-environment-lib.mjs";

export const IMMUTABLE_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
const fingerprintedAsset = /^\/assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8}\.(js|css)$/;

/** Use literal, current-file rules. A filename-shaped wildcard also gives old,
 * missing chunks a year-long cached 404, which can prevent rollback recovery. */
export function makeImmutableHostingConfig(hosting, assetPaths, publicDirectory) {
  if (!hosting || Array.isArray(hosting) || typeof hosting !== "object" || !path.isAbsolute(publicDirectory)) {
    throw new Error("Expected a single Hosting configuration and an absolute public directory.");
  }
  if (hosting.headers?.some(rule => rule.headers?.some(header =>
    header.key.toLowerCase() === "cache-control" && /\bimmutable\b/i.test(header.value)))) {
    throw new Error("Build-specific immutable headers must be generated from the original Hosting configuration.");
  }
  for (const asset of assetPaths) {
    if (typeof asset !== "string" || !fingerprintedAsset.test(asset)) {
      throw new Error("Expected a flat fingerprinted JS/CSS asset path.");
    }
  }
  const assets = [...new Set(assetPaths)].filter(asset => !(hosting.ignore ?? []).some(pattern =>
    path.matchesGlob(asset.slice(1), pattern))).sort();
  if (!assets.length) throw new Error("No deployable fingerprinted JS/CSS assets were found.");
  const result = structuredClone(hosting);
  result.public = publicDirectory;
  result.headers = [...(result.headers ?? []), ...assets.map(source => ({
    source,
    headers: [{ key: "Cache-Control", value: IMMUTABLE_ASSET_CACHE_CONTROL }],
  }))];
  return result;
}

async function publicFiles(directory, relative = "") {
  const current = path.join(directory, relative);
  if ((await lstat(current)).isSymbolicLink()) throw new Error("Hosting build must not contain symbolic links.");
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const next = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Hosting build must not contain symbolic links.");
    if (entry.isDirectory()) files.push(...await publicFiles(directory, next));
    else if (entry.isFile()) files.push(next.split(path.sep).join("/"));
    else throw new Error("Hosting build contains an unsupported file type.");
  }
  return files;
}

async function contentFingerprint(directory, files) {
  return JSON.stringify(await Promise.all([...files].sort().map(async file => [
    file, createHash("sha256").update(await readFile(path.join(directory, file))).digest("hex"),
  ])));
}

/** Freeze the public build and its matching headers together. The temporary
 * configuration contains Hosting only; it cannot deploy another product. */
export async function createHostingSnapshot(repositoryRoot, { environment, gitSha }) {
  const [config, firebaseRcText] = await Promise.all([
    readFile(path.join(repositoryRoot, "firebase.json"), "utf8").then(JSON.parse),
    readFile(path.join(repositoryRoot, ".firebaserc"), "utf8"),
  ]);
  validateFirebaseAlias(JSON.parse(firebaseRcText), environment);
  if (!config.hosting || Array.isArray(config.hosting) || typeof config.hosting.public !== "string") {
    throw new Error("Expected a single Hosting public directory.");
  }
  const root = await realpath(repositoryRoot);
  const publicDirectory = path.resolve(root, config.hosting.public);
  if (!publicDirectory.startsWith(root + path.sep)) throw new Error("Hosting public directory must be inside the repository.");
  if (await realpath(publicDirectory) !== publicDirectory) throw new Error("Hosting build must not contain symbolic links.");
  const files = await publicFiles(publicDirectory);
  const fingerprint = await contentFingerprint(publicDirectory, files);
  const manifest = JSON.parse(await readFile(path.join(publicDirectory, "deployment-manifest.json"), "utf8"));
  if (!gitSha?.trim() || manifest.schemaVersion !== "sodc-deployment-manifest/v1" ||
    manifest.environment !== environment || manifest.gitSha !== gitSha.trim()) {
    throw new Error("Hosting build manifest does not match the deployment environment and revision. Rebuild first.");
  }
  const assetPaths = files.map(file => "/" + file).filter(file => fingerprintedAsset.test(file));
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), "sodc-hosting-snapshot-")));
  try {
    const frozenPublic = path.join(directory, "public");
    await cp(publicDirectory, frozenPublic, { recursive: true, dereference: false });
    // Check the copy as well, so a symlink introduced during copying cannot be uploaded.
    const copiedFiles = await publicFiles(frozenPublic);
    if (fingerprint !== await contentFingerprint(frozenPublic, copiedFiles) ||
      fingerprint !== await contentFingerprint(publicDirectory, await publicFiles(publicDirectory))) {
      throw new Error("Hosting build changed while its snapshot was being prepared.");
    }
    const hosting = makeImmutableHostingConfig(config.hosting, assetPaths, frozenPublic);
    const configPath = path.join(directory, "firebase.json");
    await writeFile(configPath, JSON.stringify({ hosting }, null, 2) + "\n", { mode: 0o600 });
    await writeFile(path.join(directory, ".firebaserc"), firebaseRcText, { mode: 0o600 });
    return {
      directory, configPath, publicDirectory: frozenPublic, assetPaths: hosting.headers
        .filter(rule => rule.headers.some(header => header.value === IMMUTABLE_ASSET_CACHE_CONTROL))
        .map(rule => rule.source),
      remove: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
