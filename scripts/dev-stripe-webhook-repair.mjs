#!/usr/bin/env node
import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import {randomBytes} from "node:crypto";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {validateFirebaseAlias} from "./deploy-environment-lib.mjs";
import {digest} from "./functions-config-guard-lib.mjs";
import {readLocalSource} from "./notify-secret-binding-repair.mjs";
import {BindingRepairError} from "./notify-secret-binding-repair-lib.mjs";
import * as protocol from "./dev-stripe-webhook-repair-lib.mjs";
import * as providerModule from "./dev-stripe-webhook-repair-provider.mjs";
import * as storage from "./dev-stripe-webhook-repair-store.mjs";

const PROJECT = "sodc-web";
const TARGET = "stripeWebhookPayments";
const PHASES = ["prepare", "apply-secret", "apply-function", "verify-function", "apply-subscriptions", "verify"];
const SECRET_PHASES = new Set(["prepare", "apply-secret"]);
export const help = `Usage: npm run operations:dev-stripe-webhook -- --env dev --phase <${PHASES.join("|")}> --run-dir <absolute-private-run-directory> [--secret-stdin]

Dev only: the existing RAF SODC sandbox endpoint and signing secret are fixed.
prepare: provider reads and private proposal only; paste endpoint secret into protected stdin.
apply-secret: one reviewed Secret Manager addVersion; secret stdin required again.
apply-function: one reviewed exact Function binding PATCH; Google may rebuild.
verify-function: operation/source-archive/build/configuration checks by reads only.
apply-subscriptions: one reviewed exact seven-to-eleven subscription update.
verify: final read-only preservation check; metadata PASS is not runtime acceptance.

Use a new directory directly under /private/tmp on macOS (system temp on Linux),
with basename sodc-dev-stripe-webhook-repair-run-<unique-suffix>.
Only run/review.json can approve the exact proposal. Never put a secret in arguments,
environment, shell history, chat, evidence or a regular input file. Terminal input
is hidden; --secret-stdin also permits a protected pipe. No automatic write retry,
manual event replay, Production operation or deployment-guard exemption is provided.
Existing Dev TEST backlog processing is accepted; SIMULATION remains mandatory.`;

export class DevStripeWebhookCommandError extends Error {
  constructor(code) {super(`Dev Stripe webhook repair blocked: ${code}.`); this.code = code;}
}
const need = (value, code) => {if (!value) throw new DevStripeWebhookCommandError(code);};
export function validateRunPath(value, {platform = process.platform, temporaryRoot = tmpdir(), sourceRoot} = {}) {
  const parent = platform === "darwin" ? "/private/tmp" : path.resolve(temporaryRoot);
  need(typeof value === "string" && path.isAbsolute(value) && path.normalize(value) === value &&
    !value.endsWith(path.sep) && path.dirname(value) === parent &&
    /^sodc-dev-stripe-webhook-repair-run-[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(path.basename(value)), "invalid-run-directory");
  if (sourceRoot) need(value !== sourceRoot && !sourceRoot.startsWith(`${value}${path.sep}`) && !value.startsWith(`${sourceRoot}${path.sep}`), "run-overlaps-source");
  return value;
}
export function parseRepairArguments(args, pathOptions = {}) {
  if (args.length === 1 && args[0] === "--help") return {help: true};
  const names = {"--env": "environment", "--phase": "phase", "--run-dir": "runDirectory"};
  const options = {};
  for (let index = 0; index < args.length;) {
    const flag = args[index++];
    if (flag === "--secret-stdin") {
      need(!Object.hasOwn(options, "secretStdin"), "invalid-arguments"); options.secretStdin = true; continue;
    }
    const field = names[flag], value = args[index++];
    need(field && !Object.hasOwn(options, field) && typeof value === "string" && !value.startsWith("--"), "invalid-arguments");
    options[field] = value;
  }
  need(options.environment === "dev" && PHASES.includes(options.phase), "invalid-arguments");
  validateRunPath(options.runDirectory, pathOptions);
  need(Boolean(options.secretStdin) === SECRET_PHASES.has(options.phase), "secret-input-phase-mismatch");
  return options;
}

/** The input is never a command argument, environment value or JSON record.
 * Remove only a stream line terminator; never silently trim candidate bytes. */
export async function readSecretInput(input = process.stdin, output = process.stderr) {
  let value;
  if (input.isTTY) {
    need(typeof input.setRawMode === "function", "protected-terminal-unavailable");
    value = await new Promise((resolve, reject) => {
      let bytes = [], settled = false;
      const previousRaw = Boolean(input.isRaw);
      const finish = (error) => {
        if (settled) return;
        settled = true;
        input.off("data", onData); input.off("end", onEnd); input.off("error", onError);
        let result, cleanupFailed = false;
        try {if (!error) result = Buffer.from(bytes).toString("utf8");}
        finally {
          bytes.fill(0); bytes = [];
          for (const cleanup of [() => input.setRawMode(previousRaw), () => input.pause(), () => output.write("\n")]) {
            try {cleanup();} catch {cleanupFailed = true;}
          }
        }
        if (error || cleanupFailed) reject(error ?? new DevStripeWebhookCommandError("secret-input-cleanup-failed"));
        else resolve(result);
      };
      const onEnd = () => finish(new DevStripeWebhookCommandError("secret-input-incomplete"));
      const onError = () => finish(new DevStripeWebhookCommandError("secret-input-failed"));
      const onData = chunk => {
        for (const byte of Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)) {
          if (byte === 3 || byte === 4) {finish(new DevStripeWebhookCommandError("secret-input-cancelled")); return;}
          if (byte === 13 || byte === 10) {finish(); return;}
          if (byte === 127 || byte === 8) {bytes.pop(); continue;}
          bytes.push(byte);
          if (bytes.length > 512) {finish(new DevStripeWebhookCommandError("secret-input-too-large")); return;}
        }
      };
      try {
        // Enter hidden mode before prompting. Every setup/cleanup failure is
        // sanitized and settles the read after dropping its buffered bytes.
        input.setRawMode(true);
        output.write("Paste the exact Dev endpoint signing secret (input hidden): ");
        input.on("data", onData); input.once("end", onEnd); input.once("error", onError); input.resume();
      } catch {finish(new DevStripeWebhookCommandError("protected-terminal-unavailable"));}
    });
  } else {
    const chunks = []; let size = 0;
    try {
      for await (const chunk of input) {
        size += Buffer.byteLength(chunk); need(size <= 512, "secret-input-too-large"); chunks.push(Buffer.from(chunk));
      }
      value = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
    } finally {for (const chunk of chunks) chunk.fill(0);}
  }
  need(typeof value === "string" && /^whsec_[A-Za-z0-9]{10,250}$/.test(value), "invalid-secret-input");
  return value;
}
export function sharedLockDirectory(root) {
  let common;
  try {common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    {cwd: root, encoding: "utf8", timeout: 30000, maxBuffer: 64 * 1024, stdio: ["ignore", "pipe", "pipe"]}).trim();}
  catch {throw new DevStripeWebhookCommandError("shared-git-directory-unavailable");}
  need(path.isAbsolute(common) && path.basename(common) === ".git", "unsupported-shared-repository-layout");
  return path.join(path.dirname(common), ".firebase/dev-stripe-webhook-repair-locks");
}
export async function runRepair(root, options, {
  readSource = () => readLocalSource(root, PROJECT),
  providerFactory = providerModule.createDevStripeWebhookProvider,
  preflightStorage = storage.preflightRepairStorage,
  initialize = storage.initializeRunDirectory,
  loadRun = storage.loadRunDirectory,
  openStore = storage.openRepairStore,
  persist = storage.persistVerification,
  lockDirectory = () => sharedLockDirectory(root),
  readCandidate = readSecretInput,
  now = Date.now,
  pathOptions = {},
} = {}) {
  if (options.help) return {status: "HELP", help};
  need(options.environment === "dev" && PHASES.includes(options.phase) &&
    Boolean(options.secretStdin) === SECRET_PHASES.has(options.phase), "invalid-arguments");
  validateRunPath(options.runDirectory, {...pathOptions, sourceRoot: root});
  const aliases = JSON.parse(await readFile(path.join(root, ".firebaserc"), "utf8"));
  need(validateFirebaseAlias(aliases, "dev") === PROJECT, "dev-project-alias-mismatch");
  const selectedLockDirectory = lockDirectory();
  await preflightStorage({runDirectory: options.runDirectory, lockDirectory: selectedLockDirectory,
    preparing: options.phase === "prepare"});
  let candidateSecret;
  try {
    // Local storage, proposal and review checks precede credentials/provider IO.
    const source = await readSource();
    let loaded, store, review;
    if (options.phase !== "prepare") {
      loaded = await loadRun({runDirectory: options.runDirectory});
      need(loaded.proposal.projectId === PROJECT && loaded.proposal.environment === "dev", "run-environment-mismatch");
      need(digest(source.binding) === digest(loaded.proposal.sourceBinding), "source-or-build-drift");
      store = await openStore({runDirectory: options.runDirectory, lockDirectory: selectedLockDirectory, proposal: loaded.proposal});
      if (options.phase.startsWith("apply-")) {
        review = await store.read("review.json"); protocol.assertReview(loaded.proposal, review, now);
      }
      if (options.phase === "apply-secret") need(await store.read("secret-intent.json") === null, "secret-stage-already-started");
    }
    if (SECRET_PHASES.has(options.phase)) candidateSecret = await readCandidate();
    const provider = providerFactory({projectId: PROJECT, region: "europe-west2"});
    if (options.phase === "prepare") {
      const comparisonKey = randomBytes(32);
      const proposal = protocol.prepareRepair({source, snapshot: await provider.snapshot(), comparisonKey, candidateSecret, now});
      await initialize(options.runDirectory, {proposal, comparisonKey});
      return {status: "REVIEW_REQUIRED", proposalSha256: digest(proposal), projectId: PROJECT, target: TARGET,
        expiresAt: proposal.expiresAt, reviewTemplate: path.join(options.runDirectory, "review-template.json"), providerWrites: 0};
    }
    const {proposal, comparisonKey} = loaded;
    const context = {proposal, comparisonKey, provider, readSource, store, now};
    let result;
    if (options.phase === "apply-secret") result = await protocol.applySecret({...context, review, candidateSecret});
    else if (options.phase === "apply-function") result = await protocol.applyFunction({...context, review});
    else if (options.phase === "verify-function") result = await protocol.verifyFunction(context);
    else if (options.phase === "apply-subscriptions") result = await protocol.applySubscriptions({...context, review});
    else result = await protocol.verifyRepair(context);
    await persist({runDirectory: options.runDirectory, verification: {schemaVersion: "sodc-dev-stripe-webhook-result/v1",
      phase: options.phase, checkedAt: new Date(now()).toISOString(), ...result}});
    return result;
  } finally {candidateSecret = undefined;}
}
export async function runRepairCommand(args, {
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  stdout = process.stdout, stderr = process.stderr, ...dependencies
} = {}) {
  try {
    const options = parseRepairArguments(args, dependencies.pathOptions);
    const result = await runRepair(root, options, dependencies);
    stdout.write(result.status === "HELP" ? `${result.help}\n` : `${JSON.stringify(result)}\n`);
    return ["HELP", "REVIEW_REQUIRED", "PASS", "FUNCTION_VERIFIED", "SECRET_VERSION_CREATED"].includes(result.status) ? 0 : 3;
  } catch (error) {
    const classes = [DevStripeWebhookCommandError, protocol.DevStripeWebhookRepairError,
      providerModule.DevStripeWebhookProviderError, storage.DevStripeWebhookStoreError, BindingRepairError].filter(Boolean);
    const code = classes.some(Type => error instanceof Type) && /^[a-z0-9-]{1,100}$/.test(error.code ?? "") ? error.code : "unsupported-or-invalid-input";
    stderr.write(`Dev Stripe webhook repair blocked: ${code}.\n`);
    return 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = await runRepairCommand(process.argv.slice(2));
}
