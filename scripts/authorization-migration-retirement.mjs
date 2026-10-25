import {stableHash} from "./authorization-migration-sources.mjs";

const VERSION = "sodc-migration-old-writers/v1";
const IMAGE = /^[A-Za-z0-9.-]+(?::[0-9]+)?\/[A-Za-z0-9_./-]+@sha256:[a-f0-9]{64}$/;
const SEGMENT = /^[a-z][a-z0-9-]*$/;
const UID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const fail = code => {throw new Error(code);};
const need = (value, code) => {if (!value) fail(code);};
const keys = (value, allowed) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key));
const sorted = rows => rows.sort((a, b) => a.name.localeCompare(b.name));
function indexed(rows, code) {
  need(Array.isArray(rows), code);
  const result = new Map();
  for (const row of rows) {
    need(row && typeof row.name === "string" && !result.has(row.name), code);
    result.set(row.name, row);
  }
  return result;
}
function serviceName(name, projectId) {
  need(typeof name === "string", "OLD_WRITER_SERVICE_INVALID");
  const parts = name.split("/");
  need(parts.length === 6 && parts[0] === "projects" && parts[1] === projectId && parts[2] === "locations" &&
    /^[a-z0-9-]+$/.test(parts[3]) && parts[4] === "services" && SEGMENT.test(parts[5]), "OLD_WRITER_SERVICE_INVALID");
  return name;
}
function revisionName(name, service) {
  need(typeof name === "string" && name.startsWith(service + "/revisions/") &&
    SEGMENT.test(name.slice((service + "/revisions/").length)), "OLD_WRITER_REVISION_SCOPE_INVALID");
  return name;
}
function imageIdentities(images) {
  need(Array.isArray(images) && images.length > 0 && images.every(image => typeof image === "string" && IMAGE.test(image)), "OLD_WRITER_IMMUTABLE_IMAGES_REQUIRED");
  return [...images].sort();
}
function canonicalIdentity(identity, service) {
  need(keys(identity, ["name", "uid", "images"]) && typeof identity.uid === "string" && UID.test(identity.uid), "OLD_WRITER_IDENTITY_INVALID");
  return {name: revisionName(identity.name, service), uid: identity.uid, images: imageIdentities(identity.images)};
}
/** Identities contain no environment values, tokens, claims or mutable image tags. */
export function revisionIdentity(raw, service) {
  need(raw && raw.service === service && typeof raw.uid === "string" && UID.test(raw.uid) && Array.isArray(raw.containers), "OLD_WRITER_IDENTITY_INVALID");
  return canonicalIdentity({name: raw.name, uid: raw.uid, images: raw.containers.map(container => container?.image)}, service);
}
function normalizeInventory(inventory) {
  need(keys(inventory, ["schemaVersion", "projectId", "services"]) && inventory.schemaVersion === VERSION &&
    typeof inventory.projectId === "string" && /^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(inventory.projectId), "OLD_WRITER_INVENTORY_INVALID");
  const services = indexed(inventory.services, "OLD_WRITER_SERVICE_SCOPE_INVALID");
  need(services.size > 0, "OLD_WRITER_SERVICE_SCOPE_INVALID");
  return {schemaVersion: VERSION, projectId: inventory.projectId, services: sorted([...services.values()].map(service => {
    need(keys(service, ["name", "uid", "revisions"]) && typeof service.uid === "string" && UID.test(service.uid), "OLD_WRITER_SERVICE_IDENTITY_INVALID");
    serviceName(service.name, inventory.projectId);
    const revisions = indexed(service.revisions, "OLD_WRITER_REVISION_INVENTORY_INVALID");
    need(revisions.size > 0, "OLD_WRITER_REVISION_INVENTORY_INVALID");
    return {name: service.name, uid: service.uid, revisions: sorted([...revisions.values()].map(revision => canonicalIdentity(revision, service.name)))};
  }))};
}
/** The caller must exhaust provider pagination before passing each revision list. */
export function captureOldWriterInventory(input) {
  need(input && typeof input === "object", "OLD_WRITER_INVENTORY_INVALID");
  const {projectId, services} = input;
  need(Array.isArray(services), "OLD_WRITER_SERVICE_SCOPE_INVALID");
  return normalizeInventory({schemaVersion: VERSION, projectId, services: services.map(item => {
    need(item && typeof item === "object", "OLD_WRITER_SERVICE_SCOPE_INVALID");
    const {service, revisions} = item;
    need(service && Array.isArray(revisions), "OLD_WRITER_SERVICE_SCOPE_INVALID");
    return {name: service.name, uid: service.uid, revisions: revisions.map(revision => revisionIdentity(revision, service.name))};
  })});
}
function settled(raw) {
  const integer = value => typeof value === "string" && /^[1-9][0-9]*$/.test(value) || Number.isSafeInteger(value) && value > 0;
  need(raw && integer(raw.generation) && integer(raw.observedGeneration) && String(raw.generation) === String(raw.observedGeneration) &&
    (raw.reconciling === false || raw.reconciling === undefined), "OLD_WRITER_PROVIDER_NOT_SETTLED");
  return {generation: String(raw.generation), observedGeneration: String(raw.observedGeneration), reconciling: false};
}
function retirement(raw) {
  const active = Array.isArray(raw.conditions) ? raw.conditions.filter(condition => condition?.type === "Active") : [];
  need(active.length === 1 && active[0].state === "CONDITION_FAILED" && active[0].revisionReason === "RETIRED", "OLD_WRITER_POSITIVE_RETIREMENT_REQUIRED");
  // Cloud Run retains ResourcesAvailable/RECONCILING/RETIRED after retiring infrastructure.
  // This ancillary condition must not weaken the exact positive Active retirement above.
  const retiredResources = condition => condition.type === "ResourcesAvailable" &&
    condition.state === "CONDITION_RECONCILING" && condition.revisionReason === "RETIRED";
  need(raw.conditions.every(condition => condition && !["RETIRING", "RESERVE", "RECREATING", "PENDING"].includes(condition.revisionReason) &&
    (!["CONDITION_PENDING", "CONDITION_RECONCILING"].includes(condition.state) || retiredResources(condition))), "OLD_WRITER_RETIREMENT_CONTRADICTED");
  return {type: "Active", state: "CONDITION_FAILED", revisionReason: "RETIRED"};
}
function reference(value, service) {
  return revisionName(typeof value === "string" && SEGMENT.test(value) ? service + "/revisions/" + value : value, service);
}
function traffic(rows, raw, allowed) {
  need(Array.isArray(rows) && rows.length > 0, "OLD_WRITER_TRAFFIC_REQUIRED");
  const result = rows.map(target => {
    need(target && ["TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST", "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION"].includes(target.type), "OLD_WRITER_TRAFFIC_INVALID");
    const latest = target.type === "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST";
    const revision = reference(latest ? raw.latestReadyRevision : target.revision, raw.name);
    need(allowed.has(revision) && (target.revision === undefined || allowed.has(reference(target.revision, raw.name))) &&
      (!latest || target.revision === undefined || reference(target.revision, raw.name) === revision), "OLD_WRITER_OLD_TRAFFIC_OR_TAG");
    const percent = target.percent ?? 0;
    need(Number.isInteger(percent) && percent >= 0 && percent <= 100 && (target.tag === undefined || typeof target.tag === "string" && /^[a-z][a-z0-9-]*$/.test(target.tag)), "OLD_WRITER_TRAFFIC_INVALID");
    return {type: target.type, revision, percent, ...(target.tag === undefined ? {} : {tag: target.tag})};
  });
  need(result.reduce((total, target) => total + target.percent, 0) === 100, "OLD_WRITER_TRAFFIC_INVALID");
  return result.sort((a, b) => stableHash(a).localeCompare(stableHash(b)));
}
/** Pure verification; exactRevisions must be successful GET bodies, never copied operator statuses. */
export function verifyOldWriterRetirement(input) {
  need(input && typeof input === "object", "OLD_WRITER_INVENTORY_INVALID");
  const {inventory, successors, services, servingRevisions} = input;
  const original = normalizeInventory(inventory);
  const oldServices = new Map(original.services.map(service => [service.name, service]));
  const approved = indexed(successors, "OLD_WRITER_SUCCESSORS_INVALID");
  const approvedByService = new Map(original.services.map(service => [service.name, []]));
  for (const successor of approved.values()) {
    const service = typeof successor.name === "string" ? successor.name.split("/revisions/")[0] : null;
    need(oldServices.has(service), "OLD_WRITER_SUCCESSOR_SCOPE_INVALID");
    const identity = canonicalIdentity(successor, service);
    need(!oldServices.get(service).revisions.some(revision => revision.name === identity.name), "OLD_WRITER_SUCCESSOR_IS_ORIGINAL");
    approvedByService.get(service).push(identity);
  }
  let serving;
  if (servingRevisions !== undefined) {
    need(Array.isArray(servingRevisions) && servingRevisions.length > 0 &&
      servingRevisions.every(name => typeof name === "string" && approved.has(name)), "OLD_WRITER_REVIEWED_SERVING_REVISIONS_REQUIRED");
    serving = new Set(servingRevisions);
    need(serving.size === servingRevisions.length, "OLD_WRITER_REVIEWED_SERVING_REVISIONS_REQUIRED");
  }
  need(Array.isArray(services), "OLD_WRITER_SERVICE_SCOPE_INVALID");
  const observed = indexed(services.map(item => ({...item, name: item?.service?.name})), "OLD_WRITER_SERVICE_SCOPE_INVALID");
  need(observed.size === oldServices.size && [...observed.keys()].every(name => oldServices.has(name)), "OLD_WRITER_SERVICE_SCOPE_INVALID");
  const snapshots = original.services.map(old => {
    const {service, revisions, exactRevisions} = observed.get(old.name);
    need(service.uid === old.uid, "OLD_WRITER_SERVICE_IDENTITY_CHANGED");
    const serviceState = settled(service);
    const next = sorted(approvedByService.get(old.name));
    need(next.length > 0, "OLD_WRITER_SUCCESSORS_REQUIRED");
    const allowed = new Set(next.map(revision => revision.name));
    const reachable = serving ? new Set([...allowed].filter(name => serving.has(name))) : allowed;
    need(reachable.size > 0, "OLD_WRITER_REVIEWED_SERVING_REVISIONS_REQUIRED");
    const expected = new Map([...old.revisions, ...next].map(revision => [revision.name, revision]));
    const listed = indexed(revisions, "OLD_WRITER_FULL_INVENTORY_REQUIRED");
    const exact = indexed(exactRevisions, "OLD_WRITER_EXACT_GETS_REQUIRED");
    for (const rows of [listed, exact]) need(rows.size === expected.size && [...rows.keys()].every(name => expected.has(name)), "OLD_WRITER_REVISION_SET_CHANGED");
    const identities = sorted([...expected.values()].map(identity => {
      const raw = exact.get(identity.name);
      need(stableHash(revisionIdentity(raw, old.name)) === stableHash(identity) &&
        stableHash(revisionIdentity(listed.get(identity.name), old.name)) === stableHash(identity), "OLD_WRITER_REVISION_IDENTITY_CHANGED");
      const state = settled(raw);
      settled(listed.get(identity.name));
      // Once candidate Functions are proven, maintenance successors are old code too.
      const mustRetire = !allowed.has(identity.name) || serving && !serving.has(identity.name);
      const retired = mustRetire ? {retirement: retirement(raw)} : {};
      if (mustRetire) retirement(listed.get(identity.name));
      return {...identity, ...state, ...retired};
    }));
    const latestReadyRevision = reference(service.latestReadyRevision, old.name);
    const latestCreatedRevision = reference(service.latestCreatedRevision, old.name);
    need(reachable.has(latestReadyRevision) && reachable.has(latestCreatedRevision), "OLD_WRITER_LATEST_NOT_REVIEWED_SERVING_REVISION");
    return {name: old.name, uid: old.uid, ...serviceState, latestReadyRevision, latestCreatedRevision,
      traffic: traffic(service.traffic, service, reachable), trafficStatuses: traffic(service.trafficStatuses, service, reachable), revisions: identities};
  });
  return {retiredRevisions: original.services.reduce((total, service) => total + service.revisions.length, 0),
    approvedSuccessors: approved.size, proofHash: stableHash({inventory: original, services: snapshots})};
}
