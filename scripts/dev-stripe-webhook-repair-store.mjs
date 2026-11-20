import fs from "node:fs/promises";
import {constants} from "node:fs";
import path from "node:path";
import {createHash, randomUUID} from "node:crypto";
import {digest} from "./functions-config-guard-lib.mjs";
import {reviewTemplate} from "./dev-stripe-webhook-repair-lib.mjs";

const PROJECT = "sodc-web";
const TARGET = "projects/sodc-web/locations/europe-west2/functions/stripeWebhookPayments";
const SECRET = "STRIPE_WEBHOOK_SECRET_PAYMENTS";
const ENDPOINT = "we_1TOixKEJWVZaraSfeonnSQby";
const ACCOUNT = "acct_1SgTanEJWVZaraSf";
const PROPOSAL_SCHEMA = "sodc-dev-stripe-webhook-repair/v1";
const RECORD_SCHEMA = "sodc-dev-stripe-webhook-repair-record/v1";
const RUN_SCHEMA = "sodc-dev-stripe-webhook-repair-private-run/v1";
const CLAIM_SCHEMA = "sodc-dev-stripe-webhook-repair-target-lock/v1";
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const STAGES = new Set(["secret-intent.json", "secret-version.json", "function-intent.json", "operation.json",
  "function-pass.json", "stripe-intent.json", "stripe-ack.json"]);
const READABLE = new Set(["proposal.json", "review-template.json", "review.json", ...STAGES]);
const PREVIOUS = {"secret-version.json": "secret-intent.json", "function-intent.json": "secret-version.json",
  "operation.json": "function-intent.json", "function-pass.json": "operation.json",
  "stripe-intent.json": "function-pass.json", "stripe-ack.json": "stripe-intent.json"};

export class DevStripeWebhookStoreError extends Error {
  constructor(code) {super(`Dev Stripe webhook repair blocked: ${code}.`); this.name = "DevStripeWebhookStoreError"; this.code = code;}
}
const need = (condition, code) => {if (!condition) throw new DevStripeWebhookStoreError(code);};
const fail = (code, error) => {throw error instanceof DevStripeWebhookStoreError ? error : new DevStripeWebhookStoreError(code);};
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const equal = (a, b) => digest(a) === digest(b);
function absoluteDirectory(value) {
  need(typeof value === "string" && !value.includes("\0") && path.isAbsolute(value) && path.normalize(value) === value &&
    !value.endsWith(path.sep) && value !== path.parse(value).root, "invalid-private-directory-path");
  need(typeof process.getuid === "function" && Number.isInteger(constants.O_NOFOLLOW), "unsupported-private-filesystem");
  return value;
}
function overlap(a, b) {
  // Conservative for the usual case-insensitive, normalization-insensitive
  // Darwin filesystem. Owner-controlled renames remain outside this boundary.
  const normalize = value => process.platform === "darwin" ? value.normalize("NFD").toLowerCase() : value;
  a = normalize(a); b = normalize(b);
  return a === b || a.startsWith(`${b}${path.sep}`) || b.startsWith(`${a}${path.sep}`);
}
function storageBoundary(runDirectory, lockDirectory) {
  absoluteDirectory(runDirectory); absoluteDirectory(lockDirectory);
  need(!overlap(runDirectory, lockDirectory), "run-and-claim-directories-overlap");
  need(path.basename(lockDirectory) === "dev-stripe-webhook-repair-locks" &&
    path.basename(path.dirname(lockDirectory)) === ".firebase", "invalid-claim-directory-namespace");
}
function privateDirectory(stat) {
  need(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o7777) === 0o700,
    "private-directory-required");
}
function privateFile(stat) {
  need(stat.isFile() && !stat.isSymbolicLink() && stat.uid === process.getuid() && stat.nlink === 1 &&
    (stat.mode & 0o7777) === 0o600, "private-regular-file-required");
}
async function syncDirectory(directory) {
  let handle;
  try {handle = await fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW); await handle.sync();}
  finally {await handle?.close();}
}
async function ancestors(directory, {create = false, allowMissing = false} = {}) {
  absoluteDirectory(directory);
  const prefix = path.parse(directory).root;
  let current = prefix;
  for (const part of directory.slice(prefix.length).split(path.sep)) {
    current = path.join(current, part);
    let stat;
    try {stat = await fs.lstat(current);}
    catch (error) {
      if (error.code === "ENOENT" && allowMissing) return false;
      if (error.code !== "ENOENT" || !create) throw error;
      try {await fs.mkdir(current, {mode: 0o700}); await syncDirectory(path.dirname(current));}
      catch (created) {if (created.code !== "EEXIST") throw created;}
      stat = await fs.lstat(current);
    }
    need(stat.isDirectory() && !stat.isSymbolicLink() && [process.getuid(), 0].includes(stat.uid), "unsafe-private-directory-ancestor");
    need((stat.mode & 0o022) === 0 || (stat.uid === 0 && (stat.mode & 0o1000) !== 0), "writable-private-directory-ancestor");
  }
  return true;
}
async function checkDirectory(directory) {await ancestors(directory); privateDirectory(await fs.lstat(directory));}
function metadata(proposal) {
  need(object(proposal) && proposal.schemaVersion === PROPOSAL_SCHEMA && proposal.environment === "dev" &&
    proposal.projectId === PROJECT && proposal.projectNumber === "931675247602" && proposal.target === TARGET &&
    proposal.endpointId === ENDPOINT && proposal.accountId === ACCOUNT, "invalid-storage-proposal-scope");
  // The protocol performs its complete semantic validation before this store
  // initializes anything. Do not duplicate its review format here.
  const review = reviewTemplate(proposal);
  need(review.proposalSha256 === digest(proposal), "invalid-storage-proposal-hash");
  return {proposalSha256: review.proposalSha256, projectId: PROJECT, target: TARGET, secret: SECRET, endpointId: ENDPOINT};
}
function jsonBytes(value) {
  need(object(value), "invalid-local-json-record");
  let bytes;
  try {bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);} catch {throw new DevStripeWebhookStoreError("invalid-local-json-record");}
  need(bytes.length <= MAX_JSON_BYTES, "local-json-record-too-large"); return bytes;
}
async function durableWrite(directory, name, bytes, existsCode = "local-record-already-exists") {
  try {
    await checkDirectory(directory);
    const handle = await fs.open(path.join(directory, name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {privateFile(await handle.stat()); await handle.writeFile(bytes); await handle.sync();}
    finally {await handle.close();}
    await syncDirectory(directory);
  } catch (error) {
    if (error.code === "EEXIST") throw new DevStripeWebhookStoreError(existsCode);
    fail("durable-local-record-write-failed", error);
  }
}
function stable(a, b) {return ["dev", "ino", "uid", "gid", "mode", "nlink", "size", "mtimeMs"].every(key => a[key] === b[key]);}
async function privateRead(directory, name, {optional = false, key = false} = {}) {
  let directoryChecked = false;
  try {
    await checkDirectory(directory); directoryChecked = true;
    let handle;
    try {
      const file = path.join(directory, name), before = await fs.lstat(file);
      privateFile(before);
      handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      const opened = await handle.stat(); privateFile(opened);
      need(stable(before, opened), "private-record-changed-during-read");
      need(opened.size <= (key ? 32 : MAX_JSON_BYTES), "private-record-too-large");
      const bytes = await handle.readFile(), after = await handle.stat(); privateFile(after);
      need(stable(opened, after), "private-record-changed-during-read");
      if (key) {need(bytes.length === 32, "invalid-comparison-key-file"); return bytes;}
      need(bytes.length <= MAX_JSON_BYTES, "private-record-too-large");
      let value;
      try {value = JSON.parse(bytes.toString("utf8"));} catch {throw new DevStripeWebhookStoreError("malformed-private-json-record");}
      need(object(value), "invalid-local-json-record"); return value;
    } finally {await handle?.close();}
  } catch (error) {
    if (optional && directoryChecked && error.code === "ENOENT") return null;
    fail("private-record-read-failed", error);
  }
}
const initialized = info => ({schemaVersion: RUN_SCHEMA, ...info});
async function assertInitialized(runDirectory, info) {
  const marker = await privateRead(runDirectory, "initialized.json");
  need(equal(marker, initialized(info)), "private-run-initialization-incomplete");
}

/** Read-only filesystem gate before sensitive input or provider work. This does
 * not reserve paths: initialization and claim creation remain exclusive and
 * repeat their own checks immediately before every durable write. */
export async function preflightRepairStorage({runDirectory, lockDirectory, preparing}) {
  storageBoundary(runDirectory, lockDirectory);
  need(typeof preparing === "boolean", "invalid-storage-preflight-phase");
  try {
    if (preparing) {
      await ancestors(path.dirname(runDirectory));
      // lstat distinguishes a dangling leaf alias from an absent directory.
      let exists = true;
      try {await fs.lstat(runDirectory);} catch (error) {if (error.code === "ENOENT") exists = false; else throw error;}
      need(!exists, "run-directory-already-exists");
    } else await checkDirectory(runDirectory);
    if (await ancestors(lockDirectory, {allowMissing: true})) {
      privateDirectory(await fs.lstat(lockDirectory));
      if (preparing) {
        let exists = true;
        try {await fs.lstat(path.join(lockDirectory, `${PROJECT}.json`));}
        catch (error) {if (error.code === "ENOENT") exists = false; else throw error;}
        need(!exists, "global-target-already-claimed");
      } else await privateRead(lockDirectory, `${PROJECT}.json`, {optional: true});
    }
  } catch (error) {fail("private-storage-preflight-failed", error);}
  return {status: "STORAGE_READY"};
}

export async function initializeRunDirectory(runDirectory, {proposal, comparisonKey}) {
  const info = metadata(proposal);
  need(Buffer.isBuffer(comparisonKey) && comparisonKey.length === 32, "invalid-comparison-key");
  absoluteDirectory(runDirectory);
  try {
    await ancestors(path.dirname(runDirectory), {create: true});
    try {await fs.mkdir(runDirectory, {mode: 0o700});}
    catch (error) {if (error.code === "EEXIST") throw new DevStripeWebhookStoreError("run-directory-already-exists"); throw error;}
    await checkDirectory(runDirectory); await syncDirectory(path.dirname(runDirectory));
    await durableWrite(runDirectory, "proposal.json", jsonBytes(proposal));
    await durableWrite(runDirectory, "review-template.json", jsonBytes(reviewTemplate(proposal)));
    await durableWrite(runDirectory, "comparison.key", comparisonKey);
    // A partial run is permanently closed; initialize never adopts an existing
    // directory, and apply cannot run without this final durable marker.
    await durableWrite(runDirectory, "initialized.json", jsonBytes(initialized(info)));
    return {runDirectory, ...info};
  } catch (error) {fail("run-directory-initialization-failed", error);}
}

export async function loadRunDirectory({runDirectory}) {
  absoluteDirectory(runDirectory);
  try {
    const proposal = await privateRead(runDirectory, "proposal.json");
    await assertInitialized(runDirectory, metadata(proposal));
    const comparisonKey = await privateRead(runDirectory, "comparison.key", {key: true});
    return {proposal, comparisonKey};
  } catch (error) {fail("private-run-load-failed", error);}
}

export async function openRepairStore({runDirectory, lockDirectory, proposal}) {
  storageBoundary(runDirectory, lockDirectory);
  const info = metadata(proposal), disk = await privateRead(runDirectory, "proposal.json");
  need(metadata(disk).proposalSha256 === info.proposalSha256, "stored-proposal-mismatch");
  await assertInitialized(runDirectory, info);
  const claimValue = {schemaVersion: CLAIM_SCHEMA, ...info, runDirectory};
  let freshClaimConfirmed = false;
  async function assertClaim() {
    const actual = await privateRead(lockDirectory, `${PROJECT}.json`);
    need(equal(actual, claimValue), "global-target-claim-mismatch");
  }
  function boundRecord(value) {
    need(object(value) && value.schemaVersion === RECORD_SCHEMA && value.proposalSha256 === info.proposalSha256,
      "invalid-local-stage-record");
  }
  const read = async name => {
    need(READABLE.has(name), "unsupported-local-record-name");
    const value = await privateRead(runDirectory, name, {optional: true});
    if (value && name === "proposal.json") need(metadata(value).proposalSha256 === info.proposalSha256, "stored-proposal-mismatch");
    if (value && STAGES.has(name)) {boundRecord(value); await assertClaim();}
    return value;
  };
  return {
    read,
    async claim(selectedProposal) {
      need(metadata(selectedProposal).proposalSha256 === info.proposalSha256, "stored-proposal-mismatch");
      try {
        await ancestors(lockDirectory, {create: true}); privateDirectory(await fs.lstat(lockDirectory));
        // This distinct namespace never inspects, reuses or deletes the original
        // Notify repair claim. Every outcome retains this new one-shot claim.
        await durableWrite(lockDirectory, `${PROJECT}.json`, jsonBytes(claimValue), "global-target-already-claimed");
        freshClaimConfirmed = true;
      } catch (error) {fail("global-target-claim-failed", error);}
    },
    async writeOnce(name, value) {
      need(STAGES.has(name), "unsupported-local-record-name"); boundRecord(value);
      try {
        if (name === "secret-intent.json") need(freshClaimConfirmed, "fresh-durable-claim-required");
        await assertClaim();
        const previous = PREVIOUS[name];
        if (previous) need(await read(previous), "local-stage-predecessor-missing");
        await durableWrite(runDirectory, name, jsonBytes(value));
      } catch (error) {fail("local-store-write-failed", error);}
    },
  };
}

export async function persistVerification({runDirectory, verification}) {
  absoluteDirectory(runDirectory);
  try {
    const proposal = await privateRead(runDirectory, "proposal.json");
    await assertInitialized(runDirectory, metadata(proposal));
    const bytes = jsonBytes(verification), name = `verification-${randomUUID()}.json`;
    await durableWrite(runDirectory, name, bytes);
    return {runDirectory, name, sha256: createHash("sha256").update(bytes).digest("hex")};
  } catch (error) {fail("verification-record-write-failed", error);}
}
