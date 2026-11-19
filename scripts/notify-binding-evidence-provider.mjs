import {execFileSync} from "node:child_process";
import {createBindingRepairProvider, BindingRepairProviderError} from "./notify-secret-binding-repair-provider.mjs";

const TARGET = "reconcileMyCheckoutSessionOrders";
const SERVICE = TARGET.toLowerCase();
const REGION = "europe-west2";
const MAX_BYTES = 5 * 1024 * 1024;
const ANNOTATIONS = ["run.googleapis.com/build-id", "run.googleapis.com/build-function-target", "run.googleapis.com/build-source-location"];
const NUMERIC = /^[1-9]\d*$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const STATUS = new Set(["STATUS_UNKNOWN", "PENDING", "QUEUED", "WORKING", "SUCCESS", "FAILURE", "INTERNAL_ERROR", "TIMEOUT", "CANCELLED", "EXPIRED"]);

export class BindingEvidenceProviderError extends Error {
  constructor(code) {super(`Notify binding evidence blocked: ${code}.`); this.name = "BindingEvidenceProviderError"; this.code = code;}
}
const need = (value, code) => {if (!value) throw new BindingEvidenceProviderError(code);};
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const envelope = (state, reason, value) => ({state, ...(reason ? {reason} : {}), ...(value === undefined ? {} : {value})});
function timestamp(value) {
  need(value === undefined || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))), "invalid-provenance-timestamp");
  return value ?? null;
}
function defaultAuthentication() {
  let token, expires = 0;
  return () => {
    if (Date.now() >= expires) {
      try {token = execFileSync("gcloud", ["auth", "print-access-token"], {encoding: "utf8", timeout: 30_000,
        maxBuffer: 64 * 1024, stdio: ["ignore", "pipe", "pipe"]}).trim();}
      catch {throw new BindingRepairProviderError("provider-authentication-failed");}
      expires = Date.now() + 60_000;
    }
    return token;
  };
}
async function jsonResponse(response) {
  const length = response.headers?.get("content-length");
  if (length !== null && length !== undefined) need(Number.isSafeInteger(Number(length)) && Number(length) >= 0 && Number(length) <= MAX_BYTES,
    "provenance-response-too-large");
  need(response.body?.getReader, "invalid-provenance-response");
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.byteLength; need(size <= MAX_BYTES, "provenance-response-too-large"); chunks.push(Buffer.from(value));
    }
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    need(object(parsed), "invalid-provenance-response"); return parsed;
  } finally {await reader.cancel().catch(() => {}); reader.releaseLock();}
}
function base64(value, bytes) {
  need(typeof value === "string" && Buffer.from(value, "base64").length === bytes && Buffer.from(value, "base64").toString("base64") === value,
    "invalid-provenance-checksum");
  return value;
}

/** GET-only facade. Raw snapshot data is ephemeral collector input; all extra
 * provenance and operation results are projected before leaving this module. */
export function createBindingEvidenceProvider({projectId, region, tokenProvider, fetchImpl = globalThis.fetch} = {}) {
  need(["sodc-web", "sodc-web-production"].includes(projectId) && region === REGION, "unsupported-evidence-project-or-region");
  need(typeof fetchImpl === "function" && (tokenProvider === undefined || typeof tokenProvider === "function"), "invalid-evidence-provider-dependency");
  const authenticate = tokenProvider ?? defaultAuthentication();
  const original = createBindingRepairProvider({projectId, region, tokenProvider: authenticate, fetchImpl});
  const prefix = `projects/${projectId}/locations/${region}`;
  const targetName = `${prefix}/functions/${TARGET}`;
  let projectNumber;
  const sameProject = value => value === projectId || value === projectNumber;
  function context(snapshot) {
    need(projectNumber !== undefined && snapshot?.project?.projectId === projectId && snapshot.project.projectNumber === projectNumber,
      "verified-snapshot-required");
    need(Array.isArray(snapshot.functions), "invalid-provenance-snapshot");
    const targets = snapshot.functions.filter(fn => fn?.name === targetName);
    need(targets.length === 1, "invalid-provenance-target");
    const service = targets[0].serviceConfig?.service;
    const match = /^projects\/([^/]+)\/locations\/([^/]+)\/services\/([^/]+)$/.exec(service ?? "");
    need(match && sameProject(match[1]) && match[2] === region && match[3] === SERVICE, "invalid-provenance-service");
    return {target: targets[0], service};
  }
  function operationReference(name) {
    need(typeof name === "string" && name.length <= 512 && name.startsWith(`${prefix}/operations/`) && /^[A-Za-z0-9_-]+$/.test(name.slice(`${prefix}/operations/`.length)),
      "invalid-evidence-operation-reference"); return name;
  }
  function buildReference(name) {
    const match = /^projects\/([^/]+)\/locations\/([^/]+)\/builds\/([^/]+)$/.exec(name ?? "");
    need(match && sameProject(match[1]) && match[2] === region && UUID.test(match[3]), "invalid-provenance-build-reference");
    return {name, id: match[3]};
  }
  function revisionReference(revision, service) {
    need(typeof revision === "string" && revision.length <= 63 && revision.startsWith(`${SERVICE}-`) && /^[a-z0-9-]+$/.test(revision),
      "invalid-provenance-revision-reference");
    return `${service}/revisions/${revision}`;
  }
  function storageReference(value, {unresolved = false} = {}) {
    need(object(value), "invalid-provenance-storage-reference");
    const buckets = [`gcf-v2-sources-${projectNumber}-${region}`, `gcf-v2-uploads-${projectNumber}-${region}.cloudfunctions.appspot.com`];
    need(buckets.includes(value.bucket) && typeof value.object === "string" && value.object.length <= 1024 &&
      /^[A-Za-z0-9_./-]+\.zip$/.test(value.object) && !value.object.startsWith("/") &&
      value.object.split("/").every(part => part && ![".", ".."].includes(part)), "invalid-provenance-storage-reference");
    if (unresolved && (value.generation === undefined || value.generation === "0")) return null;
    need(typeof value.generation === "string" && value.generation.length <= 20 && NUMERIC.test(value.generation), "invalid-provenance-storage-generation");
    return {bucket: value.bucket, object: value.object, generation: value.generation};
  }
  function imageReference(image) {
    need(typeof image === "string" && image.length <= 2048, "invalid-provenance-image-reference");
    const match = new RegExp(`^${region}-docker\\.pkg\\.dev/([^/]+)/gcf-artifacts/([A-Za-z0-9_./-]+)(?::[A-Za-z0-9._-]+|@sha256:[a-f0-9]{64})?$`).exec(image);
    need(match && sameProject(match[1]) && match[2].split("/").every(part => part && ![".", ".."].includes(part)), "invalid-provenance-image-reference");
    return image;
  }
  function operationProjection(value, expectedName) {
    need(object(value) && value.name === expectedName && (value.done === undefined || typeof value.done === "boolean"), "invalid-evidence-operation-response");
    const result = {name: value.name, ...(value.done === undefined ? {} : {done: value.done})};
    if (value.metadata !== undefined) {
      need(object(value.metadata), "invalid-evidence-operation-response");
      const metadata = {};
      if (value.metadata.target !== undefined) {
        need([targetName, targetName.replace(`projects/${projectId}/`, `projects/${projectNumber}/`)].includes(value.metadata.target), "invalid-evidence-operation-scope");
        metadata.target = value.metadata.target;
      }
      if (value.metadata.verb !== undefined) {need(value.metadata.verb === "update", "invalid-evidence-operation-scope"); metadata.verb = "update";}
      if (value.metadata.buildName !== undefined) {
        need(metadata.target && metadata.verb === "update", "unscoped-operation-build-reference");
        metadata.buildName = buildReference(value.metadata.buildName).name;
      }
      result.metadata = metadata;
    }
    if (value.error !== undefined) {
      need(object(value.error) && Number.isSafeInteger(value.error.code), "invalid-evidence-operation-error");
      result.error = {code: value.error.code};
    }
    return result;
  }
  async function get(host, resource) {
    let token;
    try {token = await authenticate();} catch {throw new BindingEvidenceProviderError("provider-authentication-failed");}
    need(typeof token === "string" && /^[^\s]+$/.test(token) && token.length <= 16_384, "provider-authentication-failed");
    try {
      const response = await fetchImpl(`https://${host}${resource}`, {method: "GET", redirect: "error",
        headers: {Authorization: `Bearer ${token}`, "x-goog-user-project": projectId}, signal: AbortSignal.timeout(30_000)});
      if (!response.ok) {await response.body?.cancel().catch(() => {}); return envelope("UNAVAILABLE", "metadata-not-readable");}
      return envelope("AVAILABLE", undefined, await jsonResponse(response));
    } catch (error) {
      return envelope("UNAVAILABLE", error instanceof BindingEvidenceProviderError && error.code === "provenance-response-too-large"
        ? "metadata-response-too-large" : "metadata-read-failed");
    }
  }
  async function revision(name) {
    const response = await get("run.googleapis.com", `/v2/${name}`); if (response.state !== "AVAILABLE") return response;
    const value = response.value;
    need(value.name === name && Array.isArray(value.containers ?? []) && (value.annotations === undefined || object(value.annotations)), "invalid-provenance-revision-response");
    const buildAnnotations = {};
    for (const key of ANNOTATIONS) if (Object.hasOwn(value.annotations ?? {}, key)) {
      const item = value.annotations[key];
      if (key === "run.googleapis.com/build-id") need(typeof item === "string" && UUID.test(item), "invalid-provenance-build-annotation");
      if (key === "run.googleapis.com/build-function-target") need(item === TARGET, "invalid-provenance-build-annotation");
      if (key === "run.googleapis.com/build-source-location") {
        const match = /^gs:\/\/([^/]+)\/(.+?)(?:#([1-9]\d*))?$/.exec(item ?? "");
        need(match, "invalid-provenance-build-annotation"); storageReference({bucket: match[1], object: match[2], generation: match[3]}, {unresolved: true});
      }
      buildAnnotations[key] = item;
    }
    return envelope("AVAILABLE", undefined, {name: value.name, createTime: timestamp(value.createTime),
      images: (value.containers ?? []).map(container => {
        need(object(container) && (container.name === undefined || (typeof container.name === "string" && /^[A-Za-z0-9_-]{1,63}$/.test(container.name))), "invalid-provenance-container");
        return {name: container.name ?? null, image: imageReference(container.image)};
      }), buildAnnotations});
  }
  function archiveSha256(value, resolved) {
    if (!resolved || !object(value.sourceProvenance?.fileHashes)) return null;
    const path = `gs://${resolved.bucket}/${resolved.object}`;
    const entries = Object.entries(value.sourceProvenance.fileHashes).filter(([key]) => [path, `${path}#${resolved.generation}`].includes(key));
    if (entries.length === 0) return null;
    const hashes = [];
    for (const [, entry] of entries) {
      need(object(entry) && Array.isArray(entry.fileHash), "invalid-source-hash-metadata");
      const sha = entry.fileHash.filter(hash => hash?.type === "SHA256");
      if (sha.length !== 1) return null;
      hashes.push(Buffer.from(base64(sha[0].value, 32), "base64").toString("hex"));
    }
    return new Set(hashes).size === 1 ? hashes[0] : null;
  }
  async function build(ref) {
    const response = await get("cloudbuild.googleapis.com", `/v1/${ref.name}`); if (response.state !== "AVAILABLE") return response;
    const value = response.value;
    need(value.name === ref.name && value.id === ref.id && STATUS.has(value.status), "invalid-provenance-build-response");
    const source = value.source?.storageSource === undefined ? null : storageReference(value.source.storageSource, {unresolved: true});
    const resolvedSource = value.sourceProvenance?.resolvedStorageSource === undefined ? null : storageReference(value.sourceProvenance.resolvedStorageSource);
    need(Array.isArray(value.results?.images ?? []), "invalid-provenance-build-images");
    const images = (value.results?.images ?? []).map(image => {
      need(object(image) && /^sha256:[a-f0-9]{64}$/.test(image.digest ?? ""), "invalid-provenance-build-images");
      need(!String(image.name).includes("@sha256:") || image.name.endsWith(`@${image.digest}`), "contradictory-provenance-build-image");
      return {name: imageReference(image.name), digest: image.digest};
    });
    return envelope("AVAILABLE", undefined, {name: value.name, id: value.id, status: value.status, createTime: timestamp(value.createTime),
      startTime: timestamp(value.startTime), finishTime: timestamp(value.finishTime), source, resolvedSource,
      archiveSha256: archiveSha256(value, resolvedSource), images});
  }
  async function sourceObject(ref) {
    const fields = "bucket,name,generation,size,md5Hash,crc32c";
    const response = await get("storage.googleapis.com", `/storage/v1/b/${encodeURIComponent(ref.bucket)}/o/${encodeURIComponent(ref.object)}?generation=${ref.generation}&fields=${fields}`);
    if (response.state !== "AVAILABLE") return response;
    const value = response.value;
    need(value.bucket === ref.bucket && value.name === ref.object && value.generation === ref.generation &&
      typeof value.size === "string" && value.size.length <= 20 && /^(0|[1-9]\d*)$/.test(value.size), "invalid-provenance-source-object-response");
    return envelope("AVAILABLE", undefined, {bucket: value.bucket, name: value.name, generation: value.generation, size: value.size,
      md5Hash: value.md5Hash == null ? null : base64(value.md5Hash, 16), crc32c: value.crc32c == null ? null : base64(value.crc32c, 4)});
  }
  return {
    async snapshot() {
      try {
        const value = await original.snapshot();
        need(value?.project?.projectId === projectId && typeof value.project.projectNumber === "string" && value.project.projectNumber.length <= 20 && NUMERIC.test(value.project.projectNumber), "invalid-evidence-project-metadata");
        projectNumber = value.project.projectNumber; return value;
      } catch (error) {throw new BindingEvidenceProviderError(error instanceof BindingRepairProviderError && error.code === "provider-authentication-failed"
        ? "provider-authentication-failed" : "evidence-snapshot-unavailable");}
    },
    async operation(name) {
      need(projectNumber !== undefined, "verified-snapshot-required"); operationReference(name);
      let value;
      try {value = await original.operation(name);} catch {throw new BindingEvidenceProviderError("evidence-operation-read-failed");}
      return operationProjection(value, name);
    },
    async provenance({snapshot, operation, previousRevision} = {}) {
      const {target, service} = context(snapshot);
      // Validate every supplied reference before issuing any provenance GET.
      const current = target.serviceConfig.revision === undefined ? null : revisionReference(target.serviceConfig.revision, service);
      const previous = previousRevision === undefined || previousRevision === null ? null : revisionReference(previousRevision, service);
      const currentBuild = target.buildConfig?.build === undefined ? null : buildReference(target.buildConfig.build);
      const checkedOperation = operation === undefined ? null : operationProjection(operation, operationReference(operation?.name));
      const operationBuild = checkedOperation?.metadata?.buildName === undefined ? null : buildReference(checkedOperation.metadata.buildName);
      const source = target.buildConfig?.source;
      need(source === undefined || object(source), "invalid-provenance-source");
      need(source?.storageSource === undefined || Object.keys(source).every(key => key === "storageSource"), "ambiguous-provenance-source");
      const sourceRef = source?.storageSource === undefined ? null : storageReference(source.storageSource, {unresolved: true});
      const revisionCache = new Map(), buildCache = new Map();
      const getRevision = name => {if (!revisionCache.has(name)) revisionCache.set(name, revision(name)); return revisionCache.get(name);};
      const getBuild = ref => {if (!buildCache.has(ref.name)) buildCache.set(ref.name, build(ref)); return buildCache.get(ref.name);};
      const [currentResult, previousResult, functionBuildResult, operationBuildResult, sourceResult] = await Promise.all([
        current ? getRevision(current) : envelope("UNAVAILABLE", "current-revision-reference-missing"),
        previous ? getRevision(previous) : envelope(previousRevision === undefined ? "NOT_REQUESTED" : "UNAVAILABLE", "previous-revision-reference-missing"),
        currentBuild ? getBuild(currentBuild) : envelope("UNAVAILABLE", "function-build-reference-missing"),
        operationBuild ? getBuild(operationBuild) : envelope(operation === undefined ? "NOT_REQUESTED" : "UNAVAILABLE", "operation-build-reference-missing"),
        sourceRef ? sourceObject(sourceRef) : envelope(source === undefined ? "UNAVAILABLE" : "UNSUPPORTED", "storage-source-reference-missing-or-unsupported"),
      ]);
      return {currentRevision: currentResult, previousRevision: previousResult, functionBuild: structuredClone(functionBuildResult),
        operationBuild: structuredClone(operationBuildResult), sourceObject: sourceResult};
    },
  };
}
