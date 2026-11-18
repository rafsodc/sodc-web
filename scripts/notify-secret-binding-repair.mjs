#!/usr/bin/env node
import {execFileSync} from "node:child_process";
import {lstat, readFile} from "node:fs/promises";
import {createHash, randomBytes} from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {validateFirebaseAlias} from "./deploy-environment-lib.mjs";
import {digest} from "./functions-config-guard-lib.mjs";
import {discoverManifest, hashDirectory} from "./functions-config-guard.mjs";
import {createBindingRepairProvider, BindingRepairProviderError} from "./notify-secret-binding-repair-provider.mjs";
import {BindingRepairError, REGION, TARGET, assertRepairSource, prepareRepair, applyRepair, verifyRepair} from "./notify-secret-binding-repair-lib.mjs";
import {initializeRunDirectory, loadRunDirectory, openRepairStore, persistVerification} from "./notify-secret-binding-repair-store.mjs";

const help = `Usage: npm run operations:notify-bindings -- --env <dev|prod> --phase <prepare|apply|verify> --run-dir <new-absolute-private-directory>

prepare: metadata-only proposal and review template, no provider write.
apply: exact reviewed four-binding PATCH once; completion still requires verify.
verify: read-only operation/preservation check; never replays the PATCH.

Source must include #745 and have a clean, freshly built Functions artifact.
Keep comparison.key private. Only run/review.json can approve this proposal.
Ordinary deployment/configuration receipts are never created or bypassed.`;
const need = (condition, code) => {if (!condition) throw new BindingRepairError(code);};
function command(root, args) {
  try {return execFileSync("git", args, {cwd: root, encoding: "utf8", timeout: 30000, maxBuffer: 20 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"]});}
  catch {throw new BindingRepairError("local-git-read-failed");}
}
export function parseRepairArguments(args) {
  if (args.length === 1 && args[0] === "--help") return {help: true};
  const names = {"--env": "environment", "--phase": "phase", "--run-dir": "runDirectory"};
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const field = names[args[index]];
    need(field && !Object.hasOwn(options, field) && typeof args[index + 1] === "string" && !args[index + 1].startsWith("--"), "invalid-arguments");
    options[field] = args[index + 1];
  }
  need(["dev", "prod"].includes(options.environment) && ["prepare", "apply", "verify"].includes(options.phase) &&
    path.isAbsolute(options.runDirectory ?? "") && path.resolve(options.runDirectory) === options.runDirectory, "invalid-arguments");
  return options;
}
export async function readLocalSource(root, projectId) {
  need(process.versions.node.split(".")[0] === "24", "node-24-required");
  need(command(root, ["status", "--porcelain=v1"]).trim() === "", "source-not-clean");
  const gitSha = command(root, ["rev-parse", "HEAD"]).trim();
  const tree = command(root, ["rev-parse", "HEAD^{tree}"]).trim();
  const entries = command(root, ["ls-tree", "-rz", "HEAD"]).split("\0").filter(Boolean);
  const files = [];
  for (const entry of entries) {
    const [metadata, name] = entry.split("\t");
    const [mode, type, object] = metadata.split(" ");
    need(type === "blob" && ["100644", "100755"].includes(mode) && name && !path.isAbsolute(name) && !name.split("/").includes(".."), "unsupported-source-entry");
    const file = path.join(root, name), stat = await lstat(file);
    need(stat.isFile() && !stat.isSymbolicLink(), "unsupported-source-entry");
    const bytes = await readFile(file);
    const actual = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    need(actual === object, "tracked-source-bytes-changed");
    files.push([name, createHash("sha256").update(bytes).digest("hex")]);
  }
  const buildSha256 = await hashDirectory(path.join(root, "functions/lib"));
  const discovered = await discoverManifest(path.join(root, "functions"), projectId);
  need(await hashDirectory(path.join(root, "functions/lib")) === buildSha256, "build-changed-during-discovery");
  need(command(root, ["status", "--porcelain=v1"]).trim() === "" && command(root, ["rev-parse", "HEAD"]).trim() === gitSha,
    "source-changed-during-discovery");
  return {binding: {gitSha, tree, trackedSha256: digest(files), buildSha256, manifestSha256: digest(discovered.manifest), sdk: discovered.sdk},
    manifest: discovered.manifest};
}
export function sharedLockDirectory(root) {
  const common = command(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim();
  need(path.isAbsolute(common) && path.basename(common) === ".git", "unsupported-shared-repository-layout");
  return path.join(path.dirname(common), ".firebase/notify-binding-repair-locks");
}
export async function runBindingRepair(root, options, {
  readSource = projectId => readLocalSource(root, projectId),
  providerFactory = createBindingRepairProvider,
  initialize = initializeRunDirectory,
  loadRun = loadRunDirectory,
  openStore = openRepairStore,
  persist = persistVerification,
  lockDirectory = () => sharedLockDirectory(root),
  now = Date.now,
} = {}) {
  if (options.help) return {status: "HELP", help};
  const firebaseRc = JSON.parse(await readFile(path.join(root, ".firebaserc"), "utf8"));
  const projectId = validateFirebaseAlias(firebaseRc, options.environment);
  need(["dev", "prod"].includes(options.environment), "unsupported-environment");
  const provider = providerFactory({projectId, region: REGION});
  let result;
  if (options.phase === "prepare") {
    const source = await readSource(projectId); assertRepairSource(source, projectId);
    const comparisonKey = randomBytes(32);
    const proposal = prepareRepair({environment: options.environment, source, snapshot: await provider.snapshot(), comparisonKey, now});
    await initialize(options.runDirectory, {proposal, comparisonKey});
    result = {status: "REVIEW_REQUIRED", proposalSha256: digest(proposal), projectId, target: TARGET,
      expiresAt: proposal.expiresAt, reviewTemplate: path.join(options.runDirectory, "review-template.json"), providerWrites: 0};
  } else {
    const {proposal, comparisonKey} = await loadRun({runDirectory: options.runDirectory});
    need(proposal.environment === options.environment && proposal.projectId === projectId, "run-environment-mismatch");
    const store = await openStore({runDirectory: options.runDirectory, lockDirectory: lockDirectory(), proposal});
    const context = {proposal, comparisonKey, provider, readSource: () => readSource(projectId), store, now};
    if (options.phase === "apply") result = await applyRepair({...context, review: await store.read("review.json")});
    else {
      need(options.phase === "verify", "invalid-phase");
      result = await verifyRepair(context);
    }
    await persist({runDirectory: options.runDirectory, verification: {schemaVersion: "sodc-notify-binding-repair-result/v1",
      phase: options.phase, checkedAt: new Date(now()).toISOString(), ...result}});
  }
  return result;
}

export async function runRepairCommand(args, {
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), deps,
  stdout = text => console.log(text), stderr = text => console.error(text),
} = {}) {
  try {
    const options = parseRepairArguments(args);
    const result = await runBindingRepair(root, options, deps);
    stdout(options.help ? result.help : JSON.stringify(result, null, 2));
    return ["REVIEW_REQUIRED", "PASS", "HELP"].includes(result.status) ? 0 : 3;
  } catch (error) {
    const code = (error instanceof BindingRepairError || error instanceof BindingRepairProviderError) &&
      /^[a-z0-9-]+$/.test(error.code ?? "") ? error.code : "invalid-input-or-local-state";
    stderr(`Notify binding repair blocked: ${code}.`);
    return 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runRepairCommand(process.argv.slice(2));
}
