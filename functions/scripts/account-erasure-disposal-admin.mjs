#!/usr/bin/env node
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PROJECTS = new Set(["sodc-web", "sodc-web-beta", "sodc-web-production"]);
const MODES = new Set(["inspect", "policy", "initialize", "adopt", "hold"]);
const VALUE_FLAGS = new Set(["--project", "--mode", "--case-file", "--expected-version", "--expected-generation", "--review-reference", "--hold-code", "--review-due-at"]);
const BOOLEAN_FLAGS = new Set(["--apply", "--external-reviewed", "--external-review-pending"]);
const HOLD_CODES = new Set(["EXTERNAL_COPY", "RESTORE_REVIEW", "PROVIDER_REVIEW", "TASK_REVIEW", "OPERATOR_REVIEW"]);
const SCHEMA = "sodc-account-erasure-disposal-admin/v1";
const SAFE_ERRORS = new Set([
  "DISPOSAL_OPTION_INVALID", "DISPOSAL_OPTION_VALUE_INVALID", "DISPOSAL_PROJECT_REQUIRED", "DISPOSAL_MODE_INVALID",
  "DISPOSAL_ENVIRONMENT_OVERRIDE", "DISPOSAL_ENVIRONMENT_PROJECT_CONFLICT", "DISPOSAL_CASE_FILE_INVALID", "DISPOSAL_CASE_FILE_REQUIRED",
  "DISPOSAL_FLAGS_CONFLICT", "DISPOSAL_VERSION_INVALID", "DISPOSAL_GENERATION_INVALID", "DISPOSAL_EXPECTED_VERSION_REQUIRED",
  "DISPOSAL_EXPECTED_GENERATION_REQUIRED", "DISPOSAL_REFERENCE_INVALID", "DISPOSAL_EXTERNAL_REVIEW_REQUIRED", "DISPOSAL_HOLD_INVALID",
  "DISPOSAL_CASE_FILE_PRIVATE_REQUIRED", "DISPOSAL_CASE_INVALID", "DISPOSAL_CASE_DATE_INVALID", "DISPOSAL_ADOPTION_EVIDENCE_REQUIRED",
  "DISPOSAL_SDK_CONTEXT_INVALID", "DISPOSAL_SNAPSHOT_CHANGED", "DISPOSAL_READBACK_INCOMPLETE", "DISPOSAL_INITIALIZATION_REQUIRED",
  "DISPOSAL_ALREADY_INITIALIZED", "DISPOSAL_MARKERS_REQUIRED", "ERASURE_DISPOSAL_REFERENCE_INVALID", "ERASURE_DISPOSAL_INCOMPLETE",
  "ERASURE_DISPOSAL_EVIDENCE_INVALID", "ERASURE_DISPOSAL_AUTH_UNAVAILABLE", "ERASURE_DISPOSAL_AUTH_PRESENT", "ERASURE_DISPOSAL_HOLD_INVALID",
  "ERASURE_DISPOSAL_CONFLICT", "ERASURE_DISPOSAL_NOT_READY", "ERASURE_DISPOSAL_UNAVAILABLE",
]);
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const referenceValid = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/.test(value);
const dateValid = value => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
const fail = code => { throw new Error(code); };
const hasControl = value => [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);

/** Runs before SDK imports, credentials, case-file access or any network call. */
export function parseAccountErasureDisposalArguments(args, env = process.env, now = Date.now()) {
  if (args.length === 1 && args[0] === "--help") return {help: true};
  const values = new Map();
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if ((!VALUE_FLAGS.has(key) && !BOOLEAN_FLAGS.has(key)) || values.has(key)) fail("DISPOSAL_OPTION_INVALID");
    if (BOOLEAN_FLAGS.has(key)) values.set(key, true);
    else {
      const value = args[++index];
      if (!value || value.startsWith("--") || hasControl(value)) fail("DISPOSAL_OPTION_VALUE_INVALID");
      values.set(key, value);
    }
  }
  const projectId = values.get("--project"), mode = values.get("--mode") ?? "inspect";
  if (!PROJECTS.has(projectId)) fail("DISPOSAL_PROJECT_REQUIRED");
  if (!MODES.has(mode)) fail("DISPOSAL_MODE_INVALID");
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    if (/_EMULATOR_(HOST|PORT)$/.test(key) || /(?:ENDPOINT|ENDPOINTS)(?:_|$)/.test(key) || key.startsWith("CLOUDSDK_API_ENDPOINT_OVERRIDES_") ||
        ["FIREBASE_CONFIG", "GCE_METADATA_HOST", "GCE_METADATA_IP", "GCE_METADATA_ROOT", "GOOGLE_GCE_METADATA_IP"].includes(key)) fail("DISPOSAL_ENVIRONMENT_OVERRIDE");
    if (["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"].includes(key) && value !== projectId) fail("DISPOSAL_ENVIRONMENT_PROJECT_CONFLICT");
  }
  const apply = values.has("--apply"), caseFile = values.get("--case-file");
  if (caseFile && !path.isAbsolute(caseFile)) fail("DISPOSAL_CASE_FILE_INVALID");
  if (["initialize", "adopt", "hold"].includes(mode) && !caseFile) fail("DISPOSAL_CASE_FILE_REQUIRED");
  if (mode === "policy" && caseFile) fail("DISPOSAL_FLAGS_CONFLICT");
  if (mode === "inspect" && apply) fail("DISPOSAL_FLAGS_CONFLICT");
  const versionInput = values.get("--expected-version");
  const expectedVersion = versionInput === undefined ? undefined : Number(versionInput);
  if (versionInput !== undefined && (!/^\d+$/.test(versionInput) || !Number.isSafeInteger(expectedVersion))) fail("DISPOSAL_VERSION_INVALID");
  const expectedGeneration = values.get("--expected-generation");
  if (expectedGeneration !== undefined && !/^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(expectedGeneration)) fail("DISPOSAL_GENERATION_INVALID");
  if (apply && expectedVersion === undefined) fail("DISPOSAL_EXPECTED_VERSION_REQUIRED");
  if (mode === "initialize" && (expectedGeneration !== undefined || (expectedVersion !== undefined && expectedVersion !== 0))) fail("DISPOSAL_FLAGS_CONFLICT");
  if (["adopt", "hold"].includes(mode) && apply && (!expectedGeneration || expectedVersion < 1)) fail("DISPOSAL_EXPECTED_GENERATION_REQUIRED");
  if (["inspect", "policy"].includes(mode) && expectedGeneration !== undefined) fail("DISPOSAL_FLAGS_CONFLICT");
  const reviewReference = values.get("--review-reference");
  const externalReviewed = values.has("--external-reviewed") ? true : values.has("--external-review-pending") ? false : undefined;
  if (values.has("--external-reviewed") && values.has("--external-review-pending")) fail("DISPOSAL_FLAGS_CONFLICT");
  if (mode !== "policy" && (externalReviewed !== undefined || reviewReference !== undefined)) fail("DISPOSAL_FLAGS_CONFLICT");
  if (reviewReference !== undefined && !referenceValid(reviewReference)) fail("DISPOSAL_REFERENCE_INVALID");
  if (mode === "policy" && apply && (externalReviewed === undefined || !reviewReference)) fail("DISPOSAL_EXTERNAL_REVIEW_REQUIRED");
  const holdCode = values.get("--hold-code"), reviewDueAt = values.get("--review-due-at");
  if (mode !== "hold" && (holdCode !== undefined || reviewDueAt !== undefined)) fail("DISPOSAL_FLAGS_CONFLICT");
  if (mode === "hold" && (!HOLD_CODES.has(holdCode) || !dateValid(reviewDueAt) || Date.parse(reviewDueAt) <= now || Date.parse(reviewDueAt) > now + RETENTION_MS)) fail("DISPOSAL_HOLD_INVALID");
  return {projectId, mode, apply, caseFile, expectedVersion, expectedGeneration, reviewReference, externalReviewed, holdCode, reviewDueAt};
}

/** Read a regular, owner-only case file through its already-open descriptor. */
export async function readAccountErasureDisposalCase(file) {
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || (process.getuid && stat.uid !== process.getuid()) || stat.size > 16_384) fail("DISPOSAL_CASE_FILE_PRIVATE_REQUIRED");
    const text = await handle.readFile("utf8");
    if (Buffer.byteLength(text) > 16_384) fail("DISPOSAL_CASE_FILE_INVALID");
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof Error && ["DISPOSAL_CASE_FILE_PRIVATE_REQUIRED", "DISPOSAL_CASE_FILE_INVALID"].includes(error.message)) throw error;
    fail("DISPOSAL_CASE_FILE_INVALID");
  } finally { await handle?.close(); }
}

export function validateAccountErasureDisposalCase(value, mode) {
  if (!value || Array.isArray(value) || typeof value !== "object" || Object.keys(value).some(key => !["uid", "reviewReference", "taskSafeAt", "providerSafeAt"].includes(key)) ||
      typeof value.uid !== "string" || !value.uid.trim() || value.uid !== value.uid.trim() || value.uid.length > 128 || hasControl(value.uid)) fail("DISPOSAL_CASE_INVALID");
  if (value.reviewReference !== undefined && !referenceValid(value.reviewReference)) fail("DISPOSAL_REFERENCE_INVALID");
  for (const key of ["taskSafeAt", "providerSafeAt"]) if (value[key] !== undefined && !dateValid(value[key])) fail("DISPOSAL_CASE_DATE_INVALID");
  if (mode === "adopt" && (!referenceValid(value.reviewReference) || !dateValid(value.taskSafeAt) || !dateValid(value.providerSafeAt))) fail("DISPOSAL_ADOPTION_EVIDENCE_REQUIRED");
  return value;
}

async function defaultDependencies(options) {
  const [{initializeApp, applicationDefault, deleteApp, getApps}, core, markerCore] = await Promise.all([
    import("firebase-admin/app"), import("../lib/accountErasureDisposal.js"), import("../lib/accountErasureState.js"),
  ]);
  if (getApps().length) fail("DISPOSAL_SDK_CONTEXT_INVALID");
  // Core helpers use the default app; explicit project + credential initialization
  // is permitted only after all local targeting and case validation has passed.
  const app = initializeApp({projectId: options.projectId, credential: applicationDefault()});
  return {...core, readMarkers: markerCore.accountErasureState, dispose: () => deleteApp(app)};
}

function decisionSummary(decision) {
  return decision ? {present: true, generation: decision.generation, version: decision.version, held: decision.holdCode !== null,
    internalEvidencePresent: Boolean(decision.internalQuiescedAt), taskEvidencePresent: Boolean(decision.taskSafeAt), providerEvidencePresent: Boolean(decision.providerSafeAt)} : {present: false, version: 0};
}
function policySummary(policy) {
  return {version: policy?.version ?? 0, externalReplayReviewed: policy?.externalReplayReviewed === true, reviewReferencePresent: Boolean(policy?.reviewReference)};
}
function matchesExpected(decision, options) {
  if (options.expectedVersion !== undefined && options.expectedVersion !== (decision?.version ?? 0)) fail("DISPOSAL_SNAPSHOT_CHANGED");
  if (options.expectedGeneration !== undefined && options.expectedGeneration.replace(/-/g, "").toLowerCase() !== decision?.generation?.replace(/-/g, "").toLowerCase()) fail("DISPOSAL_SNAPSHOT_CHANGED");
}

/** Only explicitly reviewed writes are available here; the scheduler owns purge. */
export async function runAccountErasureDisposalAdmin(args, {env = process.env, now = Date.now, loadCase = readAccountErasureDisposalCase, createDependencies = defaultDependencies} = {}) {
  let dependencies, report = {schemaVersion: SCHEMA, result: "NOT_APPLIED"}, writeStarted = false;
  try {
    const options = parseAccountErasureDisposalArguments(args, env, now());
    if (options.help) return {schemaVersion: SCHEMA, result: "HELP", usage: "--project PROJECT [--mode inspect|policy|initialize|adopt|hold] [--case-file /private/case.json] [--expected-version N] [--expected-generation UUID] [--apply]; policy uses --review-reference REF and --external-reviewed or --external-review-pending; hold uses --hold-code CODE and --review-due-at UTC_TIMESTAMP. Case files contain uid and optional reviewReference, taskSafeAt, providerSafeAt. This tool never purges records."};
    const caseData = options.caseFile ? validateAccountErasureDisposalCase(await loadCase(options.caseFile), options.mode) : null;
    dependencies = await createDependencies(options);
    const policy = await dependencies.readAccountErasureDisposalPolicy();
    report = {...report, projectId: options.projectId, mode: options.mode, apply: options.apply, policy: policySummary(policy)};
    if (!caseData) {
      if (options.expectedVersion !== undefined && options.expectedVersion !== (policy?.version ?? 0)) fail("DISPOSAL_SNAPSHOT_CHANGED");
      if (!options.apply) {report.result = "INSPECTED"; return report;}
      writeStarted = true;
      await dependencies.setAccountErasureDisposalPolicy(options.expectedVersion, options.externalReviewed, options.reviewReference);
      const after = await dependencies.readAccountErasureDisposalPolicy();
      if (!after || after.version !== options.expectedVersion + 1 || after.externalReplayReviewed !== options.externalReviewed || after.reviewReference !== options.reviewReference) fail("DISPOSAL_READBACK_INCOMPLETE");
      report.policy = policySummary(after); report.result = "APPLIED"; return report;
    }
    const before = await dependencies.readAccountErasureDisposal(caseData.uid);
    const markers = await dependencies.readMarkers(caseData.uid);
    report.decision = decisionSummary(before);
    report.markers = {total: markers.length, completed: markers.filter(marker => marker.completedAt && marker.profileDeletedAt).length};
    matchesExpected(before, options);
    if (!options.apply) {report.result = "INSPECTED"; return report;}
    if (options.mode !== "initialize" && !before) fail("DISPOSAL_INITIALIZATION_REQUIRED");
    if (options.mode === "initialize" && before) fail("DISPOSAL_ALREADY_INITIALIZED");
    if (options.mode === "initialize" && !markers.length) fail("DISPOSAL_MARKERS_REQUIRED");
    writeStarted = true;
    if (options.mode === "initialize") await dependencies.ensureAccountErasureDisposal(caseData.uid, true);
    else if (options.mode === "adopt") await dependencies.adoptHistoricalAccountErasureDisposal(caseData.uid, {generation: before.generation, version: before.version}, markers,
      {taskSafeAt: caseData.taskSafeAt, providerSafeAt: caseData.providerSafeAt, reviewReference: caseData.reviewReference});
    else if (options.mode === "hold") await dependencies.setAccountErasureDisposalHold(caseData.uid, {generation: before.generation, version: before.version}, options.holdCode, options.reviewDueAt);
    else fail("DISPOSAL_MODE_INVALID");
    const after = await dependencies.readAccountErasureDisposal(caseData.uid);
    if (!after || (before && (after.generation !== before.generation || after.version !== before.version + 1)) ||
        (options.mode === "initialize" && after.holdCode !== "HISTORICAL_EVIDENCE_REQUIRED") ||
        (options.mode === "adopt" && (after.holdCode !== null || after.evidenceReference !== caseData.reviewReference || Date.parse(after.taskSafeAt) !== Date.parse(caseData.taskSafeAt) || Date.parse(after.providerSafeAt) !== Date.parse(caseData.providerSafeAt))) ||
        (options.mode === "hold" && (after.holdCode !== options.holdCode || Date.parse(after.reviewDueAt) !== Date.parse(options.reviewDueAt)))) fail("DISPOSAL_READBACK_INCOMPLETE");
    report.decision = decisionSummary(after); report.result = "APPLIED"; return report;
  } catch (error) {
    const code = error instanceof Error && SAFE_ERRORS.has(error.message) ? error.message : "DISPOSAL_OPERATION_FAILED";
    report.result = writeStarted ? "WRITE_OUTCOME_UNKNOWN" : "NOT_APPLIED";
    report.code = code;
    return report;
  } finally {
    try {await dependencies?.dispose?.();} catch {report.warningCode = "DISPOSAL_CLEANUP_FAILED";}
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.versions.node.split(".")[0] !== "24") {
    console.error(JSON.stringify({schemaVersion: SCHEMA, result: "NOT_APPLIED", code: "DISPOSAL_NODE_VERSION_INVALID"})); process.exitCode = 1;
  } else {
    void runAccountErasureDisposalAdmin(process.argv.slice(2)).then(report => {
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = ["HELP", "INSPECTED", "APPLIED"].includes(report.result) ? 0 : 1;
    }).catch(() => {console.error(JSON.stringify({schemaVersion: SCHEMA, result: "WRITE_OUTCOME_UNKNOWN", code: "DISPOSAL_OUTPUT_FAILED"})); process.exitCode = 1;});
  }
}
