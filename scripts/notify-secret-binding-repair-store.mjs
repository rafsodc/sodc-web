import fs from "node:fs/promises";
import {constants} from "node:fs";
import path from "node:path";
import {createHash, randomUUID} from "node:crypto";
import {BindingRepairError, REGION, TARGET, reviewTemplate} from "./notify-secret-binding-repair-lib.mjs";
import {digest} from "./functions-config-guard-lib.mjs";

const RECORDS = new Set(["proposal.json", "review-template.json", "review.json", "intent.json", "operation.json"]);
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const need = (condition, code) => {if (!condition) throw new BindingRepairError(code);};
const failure = (code, error) => {throw error instanceof BindingRepairError ? error : new BindingRepairError(code);};
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const exactKeys = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

function absoluteDirectory(value) {
  need(typeof value === "string" && !value.includes("\0") && path.isAbsolute(value) &&
    path.normalize(value) === value && !value.endsWith(path.sep) && value !== path.parse(value).root, "invalid-private-directory-path");
  need(typeof process.getuid === "function" && Number.isInteger(constants.O_NOFOLLOW), "unsupported-private-filesystem");
  return value;
}
function owner(stat) {return stat.uid === process.getuid();}
function privateDirectory(stat) {
  need(stat.isDirectory() && !stat.isSymbolicLink() && owner(stat) && (stat.mode & 0o7777) === 0o700,
    "private-directory-required");
}
function privateFile(stat) {
  need(stat.isFile() && !stat.isSymbolicLink() && owner(stat) && stat.nlink === 1 && (stat.mode & 0o7777) === 0o600,
    "private-regular-file-required");
}
async function syncDirectory(directory) {
  let handle;
  try {
    handle = await fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    await handle.sync();
  } finally {await handle?.close();}
}
/** Check every existing component rather than following an ancestor symlink.
 * Only the leaf must be private; trusted root/current-owner ancestors can be
 * readable. Root-owned sticky temporary directories are supported. */
async function checkAncestors(directory, {create = false} = {}) {
  absoluteDirectory(directory);
  const parsed = path.parse(directory);
  let current = parsed.root;
  for (const component of directory.slice(parsed.root.length).split(path.sep)) {
    current = path.join(current, component);
    let stat;
    try {stat = await fs.lstat(current);}
    catch (error) {
      if (error.code !== "ENOENT" || !create) throw error;
      try {await fs.mkdir(current, {mode: 0o700}); await syncDirectory(path.dirname(current));}
      catch (created) {if (created.code !== "EEXIST") throw created;}
      stat = await fs.lstat(current);
    }
    need(stat.isDirectory() && !stat.isSymbolicLink() && (owner(stat) || stat.uid === 0), "unsafe-private-directory-ancestor");
    need((stat.mode & 0o022) === 0 || (stat.uid === 0 && (stat.mode & 0o1000) !== 0), "writable-private-directory-ancestor");
  }
}
async function checkPrivateDirectory(directory) {
  await checkAncestors(directory);
  privateDirectory(await fs.lstat(directory));
}
async function ensureLockDirectory(directory) {
  await checkAncestors(directory, {create: true});
  privateDirectory(await fs.lstat(directory));
}
function proposalMetadata(proposal) {
  // The protocol validator enforces Dev/Production, exact target, mask and
  // secret scope. No arbitrary project or target can choose a global lock.
  const review = reviewTemplate(proposal);
  need(["sodc-web", "sodc-web-production"].includes(proposal.projectId) &&
    proposal.target === `projects/${proposal.projectId}/locations/${REGION}/functions/${TARGET}`, "invalid-storage-proposal-target");
  return {proposalSha256: review.proposalSha256, projectId: proposal.projectId, target: proposal.target};
}
function jsonBytes(value) {
  need(value !== null && typeof value === "object" && !Array.isArray(value), "invalid-local-json-record");
  let bytes;
  try {bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);}
  catch {throw new BindingRepairError("invalid-local-json-record");}
  need(bytes.length <= MAX_JSON_BYTES, "local-json-record-too-large");
  return bytes;
}
async function durableWrite(directory, name, bytes, existsCode = "local-record-already-exists") {
  try {
    await checkPrivateDirectory(directory);
    const handle = await fs.open(path.join(directory, name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
      privateFile(await handle.stat());
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {await handle.close();}
    await syncDirectory(directory);
  } catch (error) {
    if (error.code === "EEXIST") throw new BindingRepairError(existsCode);
    failure("durable-local-record-write-failed", error);
  }
}
async function privateRead(directory, name, {optional = false, key = false} = {}) {
  let directoryChecked = false;
  try {
    await checkPrivateDirectory(directory); directoryChecked = true;
    let handle;
    try {
      const file = path.join(directory, name);
      privateFile(await fs.lstat(file));
      handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await handle.stat(); privateFile(stat);
      need(stat.size <= (key ? 32 : MAX_JSON_BYTES), "private-record-too-large");
      const bytes = await handle.readFile();
      privateFile(await handle.stat());
      if (key) {need(bytes.length === 32, "invalid-comparison-key-file"); return bytes;}
      need(bytes.length <= MAX_JSON_BYTES, "private-record-too-large");
      try {return JSON.parse(bytes.toString("utf8"));}
      catch {throw new BindingRepairError("malformed-private-json-record");}
    } finally {await handle?.close();}
  } catch (error) {
    if (optional && directoryChecked && error.code === "ENOENT") return null;
    failure("private-record-read-failed", error);
  }
}
function initializationRecord(metadata) {
  return {schemaVersion: "sodc-notify-binding-repair-private-run/v1", ...metadata};
}
async function assertInitialized(runDirectory, metadata) {
  const initialized = await privateRead(runDirectory, "initialized.json");
  need(exactKeys(initialized, ["schemaVersion", "proposalSha256", "projectId", "target"]) &&
    JSON.stringify(initialized) === JSON.stringify(initializationRecord(metadata)), "private-run-initialization-incomplete");
}

export async function initializeRunDirectory(runDirectory, {proposal, comparisonKey}) {
  const metadata = proposalMetadata(proposal);
  need(Buffer.isBuffer(comparisonKey) && comparisonKey.length === 32, "invalid-comparison-key");
  absoluteDirectory(runDirectory);
  try {
    await checkAncestors(path.dirname(runDirectory), {create: true});
    try {await fs.mkdir(runDirectory, {mode: 0o700});}
    catch (error) {if (error.code === "EEXIST") throw new BindingRepairError("run-directory-already-exists"); throw error;}
    await checkPrivateDirectory(runDirectory);
    await syncDirectory(path.dirname(runDirectory));
    await durableWrite(runDirectory, "proposal.json", jsonBytes(proposal));
    await durableWrite(runDirectory, "review-template.json", jsonBytes(reviewTemplate(proposal)));
    await durableWrite(runDirectory, "comparison.key", comparisonKey);
    // Written only after all critical files and their directory entries are
    // durable. Partial initialization must not be silently reused by apply.
    await durableWrite(runDirectory, "initialized.json", jsonBytes(initializationRecord(metadata)));
    return {runDirectory, ...metadata};
  } catch (error) {failure("run-directory-initialization-failed", error);}
}

/** The raw comparison key is returned only to the caller doing local HMAC
 * comparisons. It must never be logged or copied into release evidence. */
export async function loadRunDirectory({runDirectory}) {
  absoluteDirectory(runDirectory);
  try {
    const proposal = await privateRead(runDirectory, "proposal.json");
    await assertInitialized(runDirectory, proposalMetadata(proposal));
    const comparisonKey = await privateRead(runDirectory, "comparison.key", {key: true});
    return {proposal, comparisonKey};
  } catch (error) {failure("private-run-load-failed", error);}
}

export async function openRepairStore({runDirectory, lockDirectory, proposal}) {
  absoluteDirectory(runDirectory); absoluteDirectory(lockDirectory);
  const metadata = proposalMetadata(proposal);
  const disk = await privateRead(runDirectory, "proposal.json");
  need(proposalMetadata(disk).proposalSha256 === metadata.proposalSha256, "stored-proposal-mismatch");
  await assertInitialized(runDirectory, metadata);
  const claim = {schemaVersion: "sodc-notify-binding-repair-target-lock/v1", ...metadata, runDirectory};
  const lockName = `${metadata.projectId}.json`;
  const read = async name => {
    need(RECORDS.has(name), "unsupported-local-record-name");
    const value = await privateRead(runDirectory, name, {optional: true});
    if (name === "proposal.json" && value !== null) need(proposalMetadata(value).proposalSha256 === metadata.proposalSha256, "stored-proposal-mismatch");
    return value;
  };
  return {
    read,
    async writeOnce(name, value) {
      need(["intent.json", "operation.json"].includes(name), "unsupported-local-record-name");
      try {
        if (name === "intent.json") {
          need(exactKeys(value, ["schemaVersion", "proposalSha256", "reviewSha256", "startedAt"]) &&
            value.schemaVersion === proposal.schemaVersion && value.proposalSha256 === metadata.proposalSha256 &&
            /^[a-f0-9]{64}$/.test(value.reviewSha256 ?? "") &&
            Date.parse(value.startedAt) >= Date.parse(proposal.createdAt) && Date.parse(value.startedAt) <= Date.parse(proposal.expiresAt), "invalid-local-intent");
          await ensureLockDirectory(lockDirectory);
          // Claim once across run directories/worktrees FIRST. Never unlink on
          // failure: even failed fsync/local intent requires operator review.
          await durableWrite(lockDirectory, lockName, jsonBytes(claim), "global-target-already-claimed");
        } else {
          const intent = await read("intent.json");
          need(intent?.proposalSha256 === metadata.proposalSha256, "operation-without-local-intent");
          const locked = await privateRead(lockDirectory, lockName);
          need(JSON.stringify(locked) === JSON.stringify(claim), "global-target-claim-mismatch");
          need(exactKeys(value, ["name"]) && typeof value.name === "string" &&
            new RegExp(`^projects/${metadata.projectId}/locations/${REGION}/operations/[A-Za-z0-9_-]+$`).test(value.name), "invalid-local-operation");
        }
        await durableWrite(runDirectory, name, jsonBytes(value));
      } catch (error) {failure("local-store-write-failed", error);}
    },
  };
}

export async function persistVerification({runDirectory, verification}) {
  absoluteDirectory(runDirectory);
  const name = `verification-${randomUUID()}.json`;
  const bytes = jsonBytes(verification);
  try {
    await durableWrite(runDirectory, name, bytes);
    return {runDirectory, name, sha256: hash(bytes)};
  } catch (error) {failure("verification-record-write-failed", error);}
}

/** Read the original repair state without creating a claim, record or directory.
 * The comparison key is for in-memory HMAC checks only and must not be copied to
 * a reconciliation report or output directory. */
export async function readRepairRunEvidence({runDirectory, lockDirectory}) {
  absoluteDirectory(runDirectory); absoluteDirectory(lockDirectory);
  try {
    const {proposal, comparisonKey} = await loadRunDirectory({runDirectory});
    const metadata = proposalMetadata(proposal);
    const claim = await privateRead(lockDirectory, `${metadata.projectId}.json`, {optional: true});
    const expected = {schemaVersion: "sodc-notify-binding-repair-target-lock/v1", ...metadata, runDirectory};
    need(claim !== null && exactKeys(claim, Object.keys(expected)) && digest(claim) === digest(expected),
      "missing-or-invalid-original-project-claim");
    const review = await privateRead(runDirectory, "review.json", {optional: true});
    const intent = await privateRead(runDirectory, "intent.json", {optional: true});
    const operation = await privateRead(runDirectory, "operation.json", {optional: true});
    return {proposal, comparisonKey, review, intent, operation, claim};
  } catch (error) {failure("private-repair-evidence-read-failed", error);}
}

/** Read only fixed project claims to protect their original run directories in
 * both evidence phases. Never inspect those runs or create a lock directory. */
export async function readBindingRepairClaimDirectories(lockDirectory) {
  absoluteDirectory(lockDirectory);
  try {
    try {await checkPrivateDirectory(lockDirectory);}
    catch (error) {if (error.code === "ENOENT") return []; throw error;}
    const directories = [];
    for (const projectId of ["sodc-web", "sodc-web-production"]) {
      const name = `${projectId}.json`;
      try {await fs.lstat(path.join(lockDirectory, name));}
      catch (error) {if (error.code === "ENOENT") continue; throw error;}
      const claim = await privateRead(lockDirectory, name);
      need(exactKeys(claim, ["schemaVersion", "proposalSha256", "projectId", "target", "runDirectory"]) &&
        claim.schemaVersion === "sodc-notify-binding-repair-target-lock/v1" && claim.projectId === projectId &&
        claim.target === `projects/${projectId}/locations/${REGION}/functions/${TARGET}` &&
        typeof claim.proposalSha256 === "string" && /^[a-f0-9]{64}$/.test(claim.proposalSha256),
      "invalid-binding-repair-project-claim");
      directories.push(absoluteDirectory(claim.runDirectory));
    }
    return [...new Set(directories)];
  } catch (error) {failure("private-project-claims-read-failed", error);}
}

/** Persist only new, private evidence. This never initializes an original repair
 * run or a target claim, and reconciliation must never receive the old key. */
export async function initializeBindingEvidenceDirectory(outputDirectory, options) {
  const report = options?.report;
  const capture = report?.schemaVersion === "sodc-notify-binding-capture/v1";
  need(capture || report?.schemaVersion === "sodc-notify-binding-reconciliation/v1", "unsupported-binding-evidence-schema");
  need(exactKeys(options, capture ? ["report", "comparisonKey"] : ["report"]),
    capture ? "invalid-binding-capture-options" : "comparison-key-forbidden-for-reconciliation");
  if (capture) need(Buffer.isBuffer(options.comparisonKey) && options.comparisonKey.length === 32, "invalid-comparison-key");
  const capturedKey = capture ? Buffer.from(options.comparisonKey) : null;
  const bytes = jsonBytes(report);
  const reportSha256 = digest(report);
  const initialized = {schemaVersion: "sodc-notify-binding-evidence-private-run/v1", reportSchemaVersion: report.schemaVersion,
    reportSha256, comparisonKeyPresent: capture};
  absoluteDirectory(outputDirectory);
  try {
    await checkAncestors(path.dirname(outputDirectory), {create: true});
    try {await fs.mkdir(outputDirectory, {mode: 0o700});}
    catch (error) {if (error.code === "EEXIST") throw new BindingRepairError("evidence-directory-already-exists"); throw error;}
    await checkPrivateDirectory(outputDirectory);
    await syncDirectory(path.dirname(outputDirectory));
    await durableWrite(outputDirectory, "report.json", bytes);
    if (capture) await durableWrite(outputDirectory, "comparison.key", capturedKey);
    await durableWrite(outputDirectory, "initialized.json", jsonBytes(initialized));
    return {outputDirectory, reportSha256, comparisonKeyPresent: capture};
  } catch (error) {failure("binding-evidence-initialization-failed", error);}
}

/** Read-only access to an initialized prospective capture. Never copies its key. */
export async function readBindingEvidenceCapture(directory) {
  absoluteDirectory(directory);
  const initialized = await privateRead(directory, "initialized.json");
  const report = await privateRead(directory, "report.json");
  need(exactKeys(initialized, ["schemaVersion", "reportSchemaVersion", "reportSha256", "comparisonKeyPresent"]) &&
    initialized.schemaVersion === "sodc-notify-binding-evidence-private-run/v1" &&
    initialized.reportSchemaVersion === "sodc-notify-binding-capture/v1" && initialized.comparisonKeyPresent === true &&
    report?.schemaVersion === initialized.reportSchemaVersion && initialized.reportSha256 === digest(report),
  "invalid-prospective-capture-initialization");
  const comparisonKey = await privateRead(directory, "comparison.key", {key: true});
  return {report, comparisonKey};
}

/** These input readers never create missing files or read credentials. */
export async function readProspectiveJsonInput(file) {
  need(typeof file === "string" && path.isAbsolute(file) && path.normalize(file) === file &&
    /^[A-Za-z0-9_.-]+\.json$/.test(path.basename(file)), "invalid-prospective-input-path");
  return privateRead(path.dirname(file), path.basename(file));
}

export async function readProspectiveOperationRecords(directory) {
  absoluteDirectory(directory);
  return {intent: await privateRead(directory, "intent.json"), acknowledgement: await privateRead(directory, "operation.json")};
}

/** Prospective reports contain no comparison key and confer no write authority. */
export async function initializeProspectiveEvidenceDirectory(outputDirectory, options) {
  need(exactKeys(options, ["report"]), "invalid-prospective-report-options");
  const report = options.report;
  need(report?.schemaVersion === "sodc-notify-binding-prospective/v1" && report.readOnly === true &&
    report.productionAuthorized === false && report.releaseAuthorized === false && report.originalContractAccepted === false,
  "invalid-prospective-report");
  absoluteDirectory(outputDirectory);
  const bytes = jsonBytes(report), reportSha256 = digest(report);
  try {
    await checkAncestors(path.dirname(outputDirectory), {create: true});
    try {await fs.mkdir(outputDirectory, {mode: 0o700});}
    catch (error) {if (error.code === "EEXIST") throw new BindingRepairError("evidence-directory-already-exists"); throw error;}
    await checkPrivateDirectory(outputDirectory);
    await syncDirectory(path.dirname(outputDirectory));
    await durableWrite(outputDirectory, "report.json", bytes);
    await durableWrite(outputDirectory, "initialized.json", jsonBytes({schemaVersion: "sodc-notify-binding-prospective-private-run/v1",
      reportSchemaVersion: report.schemaVersion, reportSha256, comparisonKeyPresent: false}));
    return {outputDirectory, reportSha256, comparisonKeyPresent: false};
  } catch (error) {failure("prospective-evidence-initialization-failed", error);}
}
