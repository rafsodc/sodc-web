import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { AUTHORIZATION_PROJECTS, prepareAuthorizationRollout } from "./prepare-authorization-rollout.mjs";

const MANIFEST = "AUTHORIZATION-MIGRATION-ARTIFACT.json";
const SCHEMA_VERSION = "sodc-authorization-migration-artifact/v1";
const MAX_AGE_MS = 48 * 3600_000;
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const CURRENT_AUTHORITY = /userSecurityState|currentAuthorization|securityVersion|security_version|adminSafetyControl|securityTransition|SESSION_VERSION_STALE|ACCESS_REVOKED/i;

function canonical(value, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object" || ancestors.has(value)) throw new Error("Canonical hashing requires finite JSON values");
  const next = new Set(ancestors).add(value);
  if (Array.isArray(value)) return value.map(item => canonical(item, next));
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error("Canonical hashing requires plain JSON objects");
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key], next)]));
}

export function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function safeRelative(file) {
  if (typeof file !== "string" || !file || file.includes("\\") || path.posix.isAbsolute(file) ||
      !/^[A-Za-z0-9_./-]+$/.test(file) || file.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error("Unsafe artifact source path");
  }
  return file;
}

function normalizeFiles(files) {
  const entries = Array.isArray(files) ? files : files && typeof files === "object"
    ? Object.entries(files).map(([file, content]) => ({ path: file, content })) : [];
  if (!entries.length) throw new Error("Nonempty source files are required");
  const seen = new Set();
  return entries.map(file => {
    const name = safeRelative(file?.path);
    const content = file.content ?? file.source;
    if (!name.endsWith(".gql") || typeof content !== "string" || !content.trim() || seen.has(name)) throw new Error("Invalid or duplicate GraphQL source file");
    seen.add(name);
    return { path: name, content };
  }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

/** A small lexical scanner so comments/quoted text cannot impersonate operations or directives. */
function tokens(source) {
  const result = [];
  const stack = [];
  let index = 0;
  while (index < source.length) {
    const start = index;
    const char = source[index];
    if (/\s|,/.test(char)) { index++; continue; }
    if (char === "#") { while (index < source.length && source[index] !== "\n") index++; continue; }
    if (char === '"') {
      if (source.startsWith('"""', index)) throw new Error("Block strings are not a reviewed onboarding source pattern");
      index++;
      while (index < source.length && source[index] !== '"') {
        if (source[index] === "\\") index++;
        index++;
      }
      if (index >= source.length) throw new Error("Unterminated GraphQL string");
      index++;
      let value;
      try { value = JSON.parse(source.slice(start, index)); } catch { throw new Error("Invalid GraphQL string"); }
      result.push({ value, string: true, start, end: index, depth: stack.length });
      continue;
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(index));
    if (name) {
      index += name[0].length;
      result.push({ value: name[0], start, end: index, depth: stack.length });
      continue;
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(index));
    if (number) {
      index += number[0].length;
      result.push({ value: number[0], start, end: index, depth: stack.length });
      continue;
    }
    if (!"!$():=@[]{|}&.".includes(char)) throw new Error("Unknown GraphQL source syntax");
    const token = { value: char, start, end: ++index, depth: stack.length };
    if ("([{".includes(char)) stack.push(result.length);
    else if (")]}".includes(char)) {
      const opening = stack.pop();
      if (opening === undefined || "([{".indexOf(result[opening].value) !== ")]}".indexOf(char)) throw new Error("Unbalanced GraphQL source");
      token.opening = opening;
      result[opening].closing = result.length;
    }
    result.push(token);
  }
  if (stack.length) throw new Error("Unbalanced GraphQL source");
  return result;
}

function onboarding(source) {
  const parsed = tokens(source);
  const definitions = parsed.filter(token => token.depth === 0 && ["query", "mutation", "fragment", "subscription"].includes(token.value));
  const starts = definitions.filter(token => token.value === "mutation" && parsed[parsed.indexOf(token) + 1]?.value === "CreateUserProfile");
  if (starts.length !== 1) return null;
  const start = parsed.indexOf(starts[0]);
  const end = definitions.find(token => token.start > starts[0].start)?.start ?? source.length;
  const body = parsed.findIndex((token, index) => index > start && token.start < end && token.depth === 0 && token.value === "{");
  if (body < 0 || parsed[body].closing === undefined) throw new Error("Unknown CreateUserProfile body");
  const auth = [];
  for (let index = start + 2; index < body; index++) {
    if (parsed[index].value !== "@" || parsed[index].depth !== 0) continue;
    const name = parsed[index + 1]?.value;
    if (!["auth", "transaction"].includes(name)) throw new Error("Unknown CreateUserProfile directive");
    if (name === "transaction") continue;
    const open = index + 2;
    if (parsed[open]?.value !== "(" || parsed[open].closing === undefined) throw new Error("Unknown onboarding authorization");
    const args = parsed.slice(open + 1, parsed[open].closing);
    const denied = args.length === 3 && args[0].value === "level" && args[1].value === ":" && args[2].value === "NO_ACCESS" && !args[2].string;
    const verified = args.length === 3 && args[0].value === "expr" && args[1].value === ":" && args[2].string && args[2].value.trim() === "auth.token.email_verified == true";
    if (!denied && !verified) throw new Error("Unknown onboarding authorization");
    auth.push({ start: parsed[index].start, end: parsed[parsed[open].closing].end, denied });
  }
  if (auth.length !== 1) throw new Error("Exactly one reviewed onboarding authorization is required");
  const content = parsed.slice(body + 1, parsed[body].closing);
  if (content[0]?.value !== "user_insert" || content[1]?.value !== "(" || content[1].closing === undefined) throw new Error("Unknown onboarding insertion");
  const insertionEnd = parsed[body + 2].closing;
  if (insertionEnd !== parsed[body].closing - 1) throw new Error("Unknown additional onboarding writes or selections");
  const data = parsed.slice(body + 3, insertionEnd);
  if (data[0]?.value !== "data" || data[1]?.value !== ":" || data[2]?.value !== "{" || data.at(-1)?.value !== "}") throw new Error("Unknown onboarding data");
  const fields = new Map();
  const allowed = new Set(["id_expr", "email_expr", "membershipStatus", "firstName", "lastName", "serviceNumber", "mobileNumber", "postNominals", "requestedMembershipStatus", "isRegular", "isReserve", "isCivilServant", "isIndustry", "rank", "shareContactInfo"]);
  for (let index = 3; index < data.length - 1;) {
    const key = data[index]?.value;
    if (!allowed.has(key) || fields.has(key) || data[index + 1]?.value !== ":") throw new Error("Unknown onboarding data field");
    const value = data[index + 2];
    if (value?.value === "$") {
      if (data[index + 3]?.value !== key) throw new Error("Unknown onboarding variable binding");
      fields.set(key, { variable: true });
      index += 4;
    } else {
      fields.set(key, value);
      index += 3;
    }
  }
  if (!fields.get("id_expr")?.string || fields.get("id_expr").value !== "auth.uid" ||
      !fields.get("email_expr")?.string || fields.get("email_expr").value !== "auth.token.email" ||
      fields.get("membershipStatus")?.string || fields.get("membershipStatus")?.value !== "PENDING") throw new Error("Unknown onboarding ownership or membership boundary");
  return auth[0];
}

function publicOperationSource(source) {
  const parsed = tokens(source);
  const definitions = parsed.filter(token => token.depth === 0 && ["query", "mutation", "fragment", "subscription"].includes(token.value));
  let result = "";
  let cursor = 0;
  for (const definition of definitions) {
    const start = parsed.indexOf(definition);
    const body = parsed.findIndex((token, index) => index > start && token.depth === 0 && token.value === "{");
    if (body < 0 || parsed[body].closing === undefined) throw new Error("Unknown GraphQL operation boundary");
    const header = parsed.slice(start, body);
    let authCount = 0;
    let noAccessCount = 0;
    for (let index = 0; index < header.length; index++) {
      if (header[index].depth !== 0 || header[index].value !== "@" || header[index + 1]?.value !== "auth") continue;
      authCount++;
      const values = header.slice(index + 2, index + 7).map(token => token.value);
      if (JSON.stringify(values) === JSON.stringify(["(", "level", ":", "NO_ACCESS", ")"]) && !header[index + 5]?.string) noAccessCount++;
    }
    const end = parsed[parsed[body].closing].end;
    if (authCount === 1 && noAccessCount === 1) {
      result += source.slice(cursor, definition.start);
      cursor = end;
    }
  }
  return result + source.slice(cursor);
}

export function classifyApi(files) {
  const normalized = normalizeFiles(files);
  // Service-only operations and the historical NO_ACCESS Potential Lost writer
  // can mention version rows without enforcing current client authorization.
  // Any marker remaining in public operations selects strict conservatively.
  if (normalized.some(file => CURRENT_AUTHORITY.test(publicOperationSource(file.content)))) return "strict";
  denyOnboarding(normalized);
  return "legacy";
}

export function denyOnboarding(files) {
  let count = 0;
  const result = normalizeFiles(files).map(file => {
    const auth = onboarding(file.content);
    if (!auth) return file;
    count++;
    return { ...file, content: auth.denied ? file.content : file.content.slice(0, auth.start) + "@auth(level: NO_ACCESS)" + file.content.slice(auth.end) };
  });
  if (count !== 1) throw new Error("Exactly one reviewed CreateUserProfile mutation is required");
  return result;
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function validateTarget(projectId, gitSha) {
  if (!AUTHORIZATION_PROJECTS.includes(projectId) || !SHA.test(gitSha ?? "")) throw new Error("An explicit supported project and full reviewed Git SHA are required");
}

function sourcePath(file, section) {
  let name = file;
  for (const prefix of [`dataconnect/${section}/`, `${section}/`]) if (name.startsWith(prefix)) { name = name.slice(prefix.length); break; }
  return safeRelative(name);
}

async function writeNew(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, { flag: "wx", mode: 0o400 });
}

async function inventory(directory, relative = "") {
  const files = {};
  for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    safeRelative(name);
    const stat = await lstat(path.join(directory, name));
    if (stat.isSymbolicLink()) throw new Error("Artifact symlinks are forbidden");
    if (stat.isDirectory()) Object.assign(files, await inventory(directory, name));
    else if (stat.isFile()) {
      if (name !== MANIFEST) files[name] = createHash("sha256").update(await readFile(path.join(directory, name))).digest("hex");
    } else throw new Error("Unsupported artifact filesystem entry");
  }
  return files;
}

async function rejectSourceSymlinks(directory) {
  const info = await lstat(directory);
  if (info.isSymbolicLink()) throw new Error("Source symlinks are forbidden");
  if (info.isDirectory()) {
    for (const entry of await readdir(directory)) {
      if (entry !== ".dataconnect") await rejectSourceSymlinks(path.join(directory, entry));
    }
  } else if (!info.isFile()) throw new Error("Unsupported source filesystem entry");
}

async function seal(directory, metadata) {
  const files = await inventory(directory);
  const payload = { schemaVersion: SCHEMA_VERSION, ...metadata, files };
  const manifest = { ...payload, manifestHash: stableHash(payload) };
  await writeNew(path.join(directory, MANIFEST), JSON.stringify(manifest, null, 2) + "\n");
  return { directory, configPath: path.join(directory, "firebase.json"), manifest };
}

/** Prepare source-only freeze artifacts; this never authenticates or deploys. */
export async function prepareMigrationSources({ repositoryRoot, artifactDirectory, projectId, gitSha, installation, liveSchemaFiles, liveApiFiles, now = new Date() }) {
  validateTarget(projectId, gitSha);
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error("A valid preparation time is required");
  const classification = classifyApi(liveApiFiles);
  if (!["strict", "legacy"].includes(installation) || installation !== classification) throw new Error("Installation classification differs from live API; never downgrade strict sources");
  const schema = normalizeFiles(liveSchemaFiles);
  const api = denyOnboarding(liveApiFiles);
  if (!path.isAbsolute(artifactDirectory ?? "")) throw new Error("A new absolute artifact directory outside the checkout is required");
  const root = await realpath(repositoryRoot);
  await rejectSourceSymlinks(path.join(root, "dataconnect"));
  if (installation === "legacy") await rejectSourceSymlinks(path.join(root, "scripts/authorization-compatibility/member-review.gql"));
  const parent = await realpath(path.dirname(artifactDirectory));
  const output = path.join(parent, path.basename(artifactDirectory));
  if (inside(root, output) || inside(output, root)) throw new Error("Artifact directory must be outside the checkout");
  await mkdir(output); // Exclusive new root; do not overwrite reviewed artifacts.
  const liveDirectory = path.join(output, "live-frozen");
  await mkdir(liveDirectory);
  const service = await readFile(path.join(root, "dataconnect/dataconnect.yaml"), "utf8");
  if ((service.match(/^connectorDirs:.*$/gm) ?? []).length !== 1 || !/^connectorDirs:\s*\[[^\n]*\]\s*$/m.test(service)) throw new Error("Unknown service connector configuration");
  await writeNew(path.join(liveDirectory, "dataconnect/dataconnect.yaml"), service.replace(/^connectorDirs:.*$/m, 'connectorDirs: ["./api"]'));
  await writeNew(path.join(liveDirectory, "dataconnect/api/connector.yaml"), "connectorId: api\n");
  for (const file of schema) await writeNew(path.join(liveDirectory, "dataconnect/schema", sourcePath(file.path, "schema")), file.content);
  for (const file of api) await writeNew(path.join(liveDirectory, "dataconnect/api", sourcePath(file.path, "api")), file.content);
  await writeNew(path.join(liveDirectory, "firebase.json"), JSON.stringify({ dataconnect: { source: "dataconnect" } }, null, 2) + "\n");
  const metadata = { projectId, gitSha, repositoryRoot: root, installation, createdAt: date.toISOString(), expiresAt: new Date(date.getTime() + MAX_AGE_MS).toISOString() };
  const liveFrozen = await seal(liveDirectory, { ...metadata, kind: "live-frozen" });
  const strictDirectory = path.join(output, "strict-frozen");
  await mkdir(strictDirectory);
  await cp(path.join(root, "dataconnect"), path.join(strictDirectory, "dataconnect"), { recursive: true,
    filter: source => !source.split(path.sep).includes(".dataconnect") });
  await rejectSourceSymlinks(path.join(strictDirectory, "dataconnect"));
  // The pinned Firebase CLI otherwise defaults SQL diff to STRICT and migrate
  // to COMPATIBLE. Bind both reviewed and applied additive SQL to the same mode.
  const candidateService = path.join(strictDirectory, "dataconnect/dataconnect.yaml");
  const configuration = await readFile(candidateService, "utf8");
  if ((configuration.match(/^ {4}postgresql:\s*$/gm) ?? []).length !== 1) throw new Error("Unknown PostgreSQL datasource configuration");
  await writeFile(candidateService, /^ {6}schemaValidation:.*$/m.test(configuration)
    ? configuration.replace(/^ {6}schemaValidation:.*$/m, "      schemaValidation: COMPATIBLE")
    : configuration.replace(/^ {4}postgresql:\s*$/m, "    postgresql:\n      schemaValidation: COMPATIBLE"));
  for (const connector of ["api", "booking-service", "authorization-service"]) {
    await writeFile(path.join(strictDirectory, "dataconnect", connector, "connector.yaml"), `connectorId: ${connector}\n`);
  }
  const strictApiNames = (await readdir(path.join(strictDirectory, "dataconnect/api"))).filter(name => name.endsWith(".gql"));
  const strictApi = await Promise.all(strictApiNames.map(async file => ({ path: file, content: await readFile(path.join(strictDirectory, "dataconnect/api", file), "utf8") })));
  if (classifyApi(strictApi) !== "strict") throw new Error("Reviewed candidate API must enforce strict authorization");
  for (const file of denyOnboarding(strictApi)) await writeFile(path.join(strictDirectory, "dataconnect/api", file.path), file.content);
  await writeNew(path.join(strictDirectory, "firebase.json"), JSON.stringify({ dataconnect: { source: "dataconnect" } }, null, 2) + "\n");
  const strictFrozen = await seal(strictDirectory, { ...metadata, kind: "strict-frozen" });
  // Reuse the reviewed, SDK-free candidate configuration. Opening deploys from
  // this sealed artifact so CLI SDK generation cannot modify the checkout.
  const strictOpenDirectory = path.join(output, "strict-open");
  await mkdir(strictOpenDirectory);
  await cp(path.join(strictDirectory, "dataconnect"), path.join(strictOpenDirectory, "dataconnect"), { recursive: true });
  await rejectSourceSymlinks(path.join(strictOpenDirectory, "dataconnect"));
  const candidateApiFiles = {};
  for (const file of strictApi) {
    await writeFile(path.join(strictOpenDirectory, "dataconnect/api", file.path), file.content);
    candidateApiFiles[file.path] = createHash("sha256").update(file.content).digest("hex");
  }
  await writeNew(path.join(strictOpenDirectory, "firebase.json"), JSON.stringify({ dataconnect: { source: "dataconnect" } }, null, 2) + "\n");
  const strictOpen = await seal(strictOpenDirectory, { ...metadata, kind: "strict-open", candidateApiFiles });
  let compatibilityFrozen = null;
  if (installation === "legacy") {
    const directory = path.join(output, "compatibility-frozen");
    await prepareAuthorizationRollout({ repositoryRoot: root, output: directory, projectId, now: date, expiresAt: metadata.expiresAt });
    const files = (await readdir(path.join(directory, "dataconnect/api"))).filter(name => name.endsWith(".gql"));
    const denied = denyOnboarding(await Promise.all(files.map(async file => ({ path: file, content: await readFile(path.join(directory, "dataconnect/api", file), "utf8") }))));
    for (const file of denied) await writeFile(path.join(directory, "dataconnect/api", file.path), file.content);
    compatibilityFrozen = await seal(directory, { ...metadata, kind: "compatibility-frozen" });
  }
  return { directory: output, installation, liveFrozen, compatibilityFrozen, strictFrozen, strictOpen };
}

export async function verifyMigrationArtifact({ directory, projectId, gitSha, now = new Date() }) {
  validateTarget(projectId, gitSha);
  if (!path.isAbsolute(directory ?? "") || (await lstat(directory)).isSymbolicLink()) throw new Error("Artifact directory must be absolute and not a symlink");
  const root = await realpath(directory);
  const manifestPath = path.join(root, MANIFEST);
  if (!(await lstat(manifestPath)).isFile() || (await lstat(manifestPath)).isSymbolicLink()) throw new Error("Invalid artifact manifest");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const { manifestHash, ...payload } = manifest;
  const created = new Date(manifest.createdAt).getTime();
  const expires = new Date(manifest.expiresAt).getTime();
  const current = new Date(now).getTime();
  if (manifest.schemaVersion !== SCHEMA_VERSION || manifest.projectId !== projectId || manifest.gitSha !== gitSha ||
      !["live-frozen", "compatibility-frozen", "strict-frozen", "strict-open"].includes(manifest.kind) || !["legacy", "strict"].includes(manifest.installation) ||
      (manifest.kind === "compatibility-frozen" && manifest.installation !== "legacy") || !Number.isFinite(created) ||
      !Number.isFinite(expires) || !Number.isFinite(current) || current < created || current >= expires || expires <= created || expires - created > MAX_AGE_MS ||
      !HASH.test(manifestHash ?? "") || stableHash(payload) !== manifestHash) throw new Error("Artifact identity, expiry or manifest integrity failed");
  if (typeof manifest.repositoryRoot !== "string" || inside(await realpath(manifest.repositoryRoot), root)) throw new Error("Artifact resolves inside the checkout");
  if (!manifest.files || Array.isArray(manifest.files) || typeof manifest.files !== "object" || !Object.keys(manifest.files).length) throw new Error("Invalid artifact file inventory");
  for (const [file, hash] of Object.entries(manifest.files)) {
    safeRelative(file);
    if (!HASH.test(hash)) throw new Error("Invalid artifact file hash");
  }
  const actual = await inventory(root);
  if (stableHash(actual) !== stableHash(manifest.files)) throw new Error("Artifact source tamper or unexpected files detected");
  const config = JSON.parse(await readFile(path.join(root, "firebase.json"), "utf8"));
  if (stableHash(config) !== stableHash({ dataconnect: { source: "dataconnect" } })) throw new Error("Artifact must contain Data Connect configuration only");
  for (const file of Object.keys(actual).filter(file => file.endsWith("connector.yaml"))) {
    if (!/^connectorId: [a-z-]+\s*$/.test(await readFile(path.join(root, file), "utf8"))) throw new Error("SDK generation is forbidden in migration artifacts");
  }
  const apiFiles = await Promise.all(Object.keys(actual).filter(file => file.startsWith("dataconnect/api/") && file.endsWith(".gql")).map(async file => ({ path: file, content: await readFile(path.join(root, file), "utf8") })));
  const frozenApi = denyOnboarding(apiFiles);
  if (manifest.kind !== "strict-open" && stableHash(frozenApi) !== stableHash(normalizeFiles(apiFiles))) throw new Error("Artifact onboarding is not frozen");
  if (manifest.kind === "strict-open") {
    const candidateHashes = manifest.candidateApiFiles;
    if (!candidateHashes || typeof candidateHashes !== "object" || Array.isArray(candidateHashes) || !Object.keys(candidateHashes).length) throw new Error("Reviewed candidate API hashes are required");
    for (const [file, hash] of Object.entries(candidateHashes)) {
      if (!safeRelative(file).endsWith(".gql") || !HASH.test(hash)) throw new Error("Invalid reviewed candidate API hash");
    }
    const artifactHashes = Object.fromEntries(Object.entries(actual).filter(([file]) => file.startsWith("dataconnect/api/") && file.endsWith(".gql")).map(([file, hash]) => [file.slice("dataconnect/api/".length), hash]));
    const reviewedHashes = Object.fromEntries(Object.entries(await inventory(path.join(manifest.repositoryRoot, "dataconnect/api"))).filter(([file]) => file.endsWith(".gql")));
    if (stableHash(candidateHashes) !== stableHash(artifactHashes) || stableHash(candidateHashes) !== stableHash(reviewedHashes)) throw new Error("Open artifact differs from the reviewed candidate API");
  }
  const classification = classifyApi(apiFiles);
  if ((["strict-frozen", "strict-open"].includes(manifest.kind) && classification !== "strict") ||
      (manifest.kind === "compatibility-frozen" && classification !== "legacy") ||
      (manifest.kind === "live-frozen" && classification !== manifest.installation)) throw new Error("Artifact authorization classification changed");
  return { directory: root, configPath: path.join(root, "firebase.json"), manifest };
}
