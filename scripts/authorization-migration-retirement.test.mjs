import {describe, expect, it} from "vitest";
import {createHash} from "node:crypto";
import {captureOldWriterInventory, revisionIdentity, verifyOldWriterRetirement} from "./authorization-migration-retirement.mjs";

const projectId = "sodc-web";
const resource = "projects/sodc-web/locations/europe-west2/services/status-writer";
const image = "europe-west2-docker.pkg.dev/sodc-web/functions/status-writer@sha256:" + "a".repeat(64);
const LATEST = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST";
const REVISION = "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION";
const changedUid = "11111111-1111-4111-8111-111111111111";
function uid(label) {
  const hash = createHash("sha256").update(label).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
function revision(suffix, service = resource) {
  return {name: service + "/revisions/" + suffix, service, uid: uid(service + suffix), generation: "1", observedGeneration: "1", reconciling: false,
    containers: [{image, env: [{name: "PRIVATE_TOKEN", value: "must-never-appear"}]}],
    conditions: [{type: "Ready", state: "CONDITION_SUCCEEDED"}, {type: "Active", state: "CONDITION_FAILED", revisionReason: "RETIRED"}]};
}
function service(name, latest) {
  return {name, uid: uid(name), generation: "2", observedGeneration: "2", reconciling: false,
    latestReadyRevision: latest.name, latestCreatedRevision: latest.name,
    traffic: [{type: LATEST, percent: 100}], trafficStatuses: [{type: REVISION, revision: latest.name, percent: 100}]};
}
function fixture() {
  const old = revision("old-writer");
  const next = revision("replacement");
  next.conditions = [{type: "Active", state: "CONDITION_SUCCEEDED"}];
  const live = service(resource, next);
  return {inventory: captureOldWriterInventory({projectId, services: [{service: live, revisions: [old]}]}),
    successors: [revisionIdentity(next, resource)], services: [{service: live, revisions: [structuredClone(old), structuredClone(next)], exactRevisions: [old, next]}]};
}
const verify = value => verifyOldWriterRetirement(value);
const getOld = value => value.services[0].exactRevisions[0];

describe("positive old-writer retirement", () => {
  it.each([['bare', 'bare'], ['bare', 'full'], ['full', 'bare']])("captures and verifies provider parent shapes: list=%s GET=%s", (listedShape, exactShape) => {
    const input = fixture();
    const originalProof = verify(input);
    for (const raw of input.services[0].revisions) if (listedShape === 'bare') raw.service = resource.split('/').at(-1);
    for (const raw of input.services[0].exactRevisions) if (exactShape === 'bare') raw.service = resource.split('/').at(-1);
    const captured = captureOldWriterInventory({projectId, services: [{service: input.services[0].service, revisions: [input.services[0].revisions[0]]}]});
    expect(captured).toEqual(input.inventory);
    expect(verify(input)).toEqual(originalProof);
  });

  it.each([
    ['missing parent', raw => {delete raw.service;}],
    ['another bare service', raw => {raw.service = 'another-writer';}],
    ['a foreign project with the same leaf', raw => {raw.service = resource.replace('sodc-web/', 'sodc-web-beta/');}],
    ['a foreign region with the same leaf', raw => {raw.service = resource.replace('europe-west2', 'europe-west1');}],
    ['a misleading parent suffix', raw => {raw.service = 'prefix/' + resource.split('/').at(-1);}],
    ['a deceptive full revision name with the expected leaf', raw => {raw.service = resource.split('/').at(-1); raw.name = raw.name.replace('sodc-web/', 'sodc-web-beta/');}],
    ['a revision path traversal with the expected leaf', raw => {raw.service = resource.split('/').at(-1); raw.name = resource + '/revisions/../foreign';}],
  ])("refuses %s even when the other identity fields match", (_label, mutate) => {
    const raw = revision('old-writer');
    mutate(raw);
    expect(() => revisionIdentity(raw, resource)).toThrow(/OLD_WRITER_[A-Z_]+/);
  });

  it("requires a full expected service resource even when both raw parent fields are misleading", () => {
    const raw = revision('old-writer');
    raw.service = 'status-writer';
    raw.name = 'status-writer/revisions/old-writer';
    expect(() => revisionIdentity(raw, 'status-writer')).toThrow(/OLD_WRITER_[A-Z_]+/);
  });

  it("requires independently observed exact retirement and emits only a safe stable hash", () => {
    const input = fixture();
    const result = verify(input);
    expect(result).toEqual({retiredRevisions: 1, approvedSuccessors: 1, proofHash: expect.stringMatching(/^[a-f0-9]{64}$/)});
    expect(JSON.stringify(input.inventory)).not.toMatch(/must-never-appear|PRIVATE_TOKEN|conditions|observedGeneration/);
    expect(JSON.stringify(result)).not.toMatch(/must-never-appear|PRIVATE_TOKEN|env/);
    const reordered = structuredClone(input);
    reordered.services[0].revisions.reverse();
    reordered.services[0].exactRevisions.reverse();
    expect(verify(reordered)).toEqual(result);
  });

  it("supports all original revisions in multiple callable and scheduled worker services", () => {
    const input = fixture();
    const workerService = resource.replace("status-writer", "scheduled-writer");
    const old = revision("old-worker", workerService);
    const earlier = revision("earlier-worker", workerService);
    const next = revision("replacement-worker", workerService);
    const live = service(workerService, next);
    const worker = captureOldWriterInventory({projectId, services: [{service: live, revisions: [old, earlier]}]});
    input.inventory.services.push(...worker.services);
    input.successors.push(revisionIdentity(next, workerService));
    input.services.push({service: live, revisions: [old, earlier, next], exactRevisions: [old, earlier, next]});
    expect(verify(input)).toMatchObject({retiredRevisions: 3, approvedSuccessors: 2});
  });

  it("accepts Ready success alongside the unique positive Active retirement and protobuf default false", () => {
    const input = fixture();
    for (const raw of [...input.services[0].exactRevisions, ...input.services[0].revisions, input.services[0].service]) delete raw.reconciling;
    expect(verify(input).retiredRevisions).toBe(1);
  });

  it("does not require approved successors to have any retirement condition", () => {
    const input = fixture();
    input.services[0].exactRevisions[1].conditions = [{type: "Unrecognized", state: "CONDITION_PENDING"}];
    input.services[0].revisions[1].conditions = [];
    expect(verify(input).approvedSuccessors).toBe(1);
  });

  it("accepts the ancillary retired-resources shape retained from Dev provider observations", () => {
    const input = fixture();
    // Dev GET projection, 2026-10-23: recovernotificationdeliveries-00063-mav.
    // The projection's reason is the provider revisionReason; identifiers are synthetic here.
    const conditions = [
      {type: "Ready", state: "CONDITION_SUCCEEDED", revisionReason: "RETIRED"},
      {type: "Active", state: "CONDITION_FAILED", revisionReason: "RETIRED"},
      {type: "ResourcesAvailable", state: "CONDITION_RECONCILING", revisionReason: "RETIRED"},
      {type: "ContainerReady", state: "CONDITION_SUCCEEDED"},
      {type: "ContainerHealthy", state: "CONDITION_SUCCEEDED"},
    ];
    getOld(input).conditions = structuredClone(conditions);
    input.services[0].revisions[0].conditions = structuredClone(conditions);
    expect(verify(input).retiredRevisions).toBe(1);
  });

  it.each([
    {type: "ResourcesAvailable", state: "CONDITION_RECONCILING"},
    {type: "ResourcesAvailable", state: "CONDITION_RECONCILING", revisionReason: "RETIRING"},
    {type: "ResourcesAvailable", state: "CONDITION_PENDING", revisionReason: "RETIRED"},
    {type: "ContainerReady", state: "CONDITION_RECONCILING", revisionReason: "RETIRED"},
  ])("rejects ancillary work that is not the observed retired-resources condition: %j", condition => {
    for (const source of ["exactRevisions", "revisions"]) {
      const input = fixture();
      input.services[0][source][0].conditions.push(condition);
      expect(() => verify(input)).toThrow("OLD_WRITER_RETIREMENT_CONTRADICTED");
    }
  });

  it("resolves scoped short revision names and tagged approved successors", () => {
    const input = fixture();
    const live = input.services[0].service;
    live.latestReadyRevision = "replacement";
    live.latestCreatedRevision = "replacement";
    live.traffic = [{type: REVISION, revision: "replacement", percent: 100, tag: "approved"}];
    live.trafficStatuses = structuredClone(live.traffic);
    expect(verify(input).retiredRevisions).toBe(1);
  });

  it.each([
    ["timeout without positive terminal evidence", input => {getOld(input).conditions = [{type: "Ready", state: "CONDITION_SUCCEEDED"}]; getOld(input).timeout = "1s";}],
    ["a copied pass flag and zero requests", input => {getOld(input).conditions = []; input.passed = true; input.inFlightExecutions = 0;}],
    ["an active old handler after elapsed timeout", input => {getOld(input).conditions[1] = {type: "Active", state: "CONDITION_SUCCEEDED"}; input.drainUntil = "2000-01-01T00:00:00Z";}],
    ["RETIRING instead of RETIRED", input => {getOld(input).conditions[1].revisionReason = "RETIRING";}],
    ["RESERVE instead of RETIRED", input => {getOld(input).conditions[1].revisionReason = "RESERVE";}],
    ["a retired reason on the wrong condition", input => {getOld(input).conditions = [{type: "Ready", state: "CONDITION_FAILED", revisionReason: "RETIRED"}];}],
    ["duplicate Active conditions", input => {getOld(input).conditions.push({...getOld(input).conditions[1]});}],
    ["contradictory Active condition", input => {getOld(input).conditions.push({type: "Active", state: "CONDITION_SUCCEEDED"});}],
    ["another condition says recreating", input => {getOld(input).conditions.push({type: "Other", state: "CONDITION_FAILED", revisionReason: "RECREATING"});}],
    ["retirement is still reconciling", input => {getOld(input).reconciling = true;}],
    ["an unsettled old revision generation", input => {getOld(input).observedGeneration = "2";}],
    ["missing old revision generation", input => {delete getOld(input).generation;}],
    ["old UID changed", input => {getOld(input).uid = changedUid;}],
    ["old image digest changed", input => {getOld(input).containers[0].image = image.replace("a".repeat(64), "b".repeat(64));}],
    ["old image repository changed", input => {getOld(input).containers[0].image = image.replace("/functions/", "/unreviewed-source/");}],
    ["mutable image tag", input => {getOld(input).containers[0].image = "registry.example.invalid/writer:latest";}],
    ["retirement GET is missing", input => {input.services[0].exactRevisions.shift();}],
    ["exact GET is duplicated", input => {input.services[0].exactRevisions.push(getOld(input));}],
    ["partial paginated revision list", input => {input.services[0].revisions.shift();}],
    ["list disagrees with the exact GET UID", input => {input.services[0].revisions[0].uid = changedUid;}],
    ["list still shows live old infrastructure", input => {input.services[0].revisions[0].conditions[1].state = "CONDITION_SUCCEEDED";}],
    ["an unknown old revision appears", input => {input.services[0].revisions.push(revision("unaccounted-old"));}],
    ["an unapproved new deployment appears", input => {const raw = revision("unknown-new"); input.services[0].revisions.push(raw); input.services[0].exactRevisions.push(raw);}],
    ["service UID changed", input => {input.services[0].service.uid = changedUid;}],
    ["an unsettled service generation", input => {input.services[0].service.observedGeneration = "1";}],
    ["service still reconciling", input => {input.services[0].service.reconciling = true;}],
    ["a missing scoped service", input => {input.services = [];}],
    ["a duplicate scoped service", input => {input.services.push(structuredClone(input.services[0]));}],
    ["a foreign exact revision", input => {getOld(input).service = resource.replace("status-writer", "foreign");}],
    ["old identity relabelled as approved successor", input => {input.successors.push(structuredClone(input.inventory.services[0].revisions[0]));}],
    ["duplicate approved successor", input => {input.successors.push({...input.successors[0]});}],
    ["an approved successor changed image", input => {input.services[0].exactRevisions[1].containers[0].image = image.replace("a".repeat(64), "c".repeat(64));}],
    ["successor from another project", input => {input.successors[0].name = input.successors[0].name.replace("sodc-web/", "sodc-web-beta/");}],
    ["desired traffic still targets old revision", input => {input.services[0].service.traffic = [{type: REVISION, revision: getOld(input).name, percent: 100}];}],
    ["observed traffic still targets old revision", input => {input.services[0].service.trafficStatuses[0].revision = getOld(input).name;}],
    ["a zero-percent old tag remains reachable", input => {input.services[0].service.traffic.push({type: REVISION, revision: getOld(input).name, percent: 0, tag: "old"});}],
    ["LATEST explicitly references old", input => {input.services[0].service.traffic[0].revision = getOld(input).name;}],
    ["LATEST resolves to old infrastructure", input => {input.services[0].service.latestReadyRevision = getOld(input).name;}],
    ["latest created revision is original", input => {input.services[0].service.latestCreatedRevision = getOld(input).name;}],
    ["an empty desired traffic list", input => {input.services[0].service.traffic = [];}],
    ["a missing traffic-status list", input => {delete input.services[0].service.trafficStatuses;}],
    ["unknown allocation semantics", input => {input.services[0].service.traffic[0].type = "UNKNOWN";}],
  ])("refuses %s", (_name, mutate) => {
    const input = fixture();
    mutate(input);
    expect(() => verify(input)).toThrow(/OLD_WRITER_[A-Z_]+/);
  });

  it("revalidates provider retirement when a previously proven original revives", () => {
    const input = fixture();
    const proof = verify(input);
    expect(proof.retiredRevisions).toBe(1);
    getOld(input).conditions[1] = {type: "Active", state: "CONDITION_SUCCEEDED"};
    expect(() => verify(input)).toThrow("OLD_WRITER_POSITIVE_RETIREMENT_REQUIRED");
  });

  function candidateFixture() {
    const input = fixture();
    const maintenance = input.services[0].exactRevisions[1];
    const candidate = revision("reviewed-candidate");
    candidate.conditions = [{type: "Active", state: "CONDITION_SUCCEEDED"}];
    input.successors.push(revisionIdentity(candidate, resource));
    input.services[0].exactRevisions.push(candidate);
    input.services[0].revisions.push(structuredClone(candidate));
    input.services[0].service = service(resource, candidate);
    input.servingRevisions = [candidate.name];
    for (const source of ["exactRevisions", "revisions"]) input.services[0][source][1].conditions =
      [{type: "Active", state: "CONDITION_FAILED", revisionReason: "RETIRED"}];
    return {input, maintenance};
  }

  it("retires the maintenance successor and serves only the proven candidate after Functions deployment", () => {
    const {input} = candidateFixture();
    expect(verify(input)).toMatchObject({retiredRevisions: 1, approvedSuccessors: 2});
  });

  it.each(["traffic", "trafficStatuses", "tag", "latestReadyRevision", "latestCreatedRevision"])(
    "rejects approved old maintenance code reachable through %s despite a proven candidate", field => {
      const {input, maintenance} = candidateFixture();
      const live = input.services[0].service;
      if (field === "tag") live.traffic.push({type: REVISION, revision: maintenance.name, percent: 0, tag: "maintenance"});
      else if (field.startsWith("latest")) live[field] = maintenance.name;
      else live[field] = [{type: REVISION, revision: maintenance.name, percent: 100}];
      expect(() => verify(input)).toThrow(/OLD_WRITER_/);
    });

  it.each(["exactRevisions", "revisions"])("rejects a still-running maintenance successor in %s even at zero traffic", source => {
    const {input} = candidateFixture();
    input.services[0][source][1].conditions = [{type: "Active", state: "CONDITION_SUCCEEDED"}];
    expect(() => verify(input)).toThrow("OLD_WRITER_POSITIVE_RETIREMENT_REQUIRED");
  });

  it.each([
    ["null input", () => captureOldWriterInventory(null)],
    ["null service entry", () => captureOldWriterInventory({projectId, services: [null]})],
    ["empty service scope", () => captureOldWriterInventory({projectId, services: []})],
    ["duplicate service", () => {const input = fixture(); const raw = input.services[0]; return captureOldWriterInventory({projectId, services: [raw, raw]});}],
    ["foreign project", () => captureOldWriterInventory({projectId: "sodc-web-beta", services: fixture().services})],
    ["duplicate original", () => {const input = fixture(); return captureOldWriterInventory({projectId, services: [{service: input.services[0].service, revisions: [getOld(input), getOld(input)]}]});}],
    ["empty original list", () => captureOldWriterInventory({projectId, services: [{service: fixture().services[0].service, revisions: []}]})],
  ])("refuses inventory capture with %s", (_name, capture) => {
    expect(capture).toThrow(/OLD_WRITER_[A-Z_]+/);
  });

  it.each([undefined, null, {}, {inventory: null}, {...fixture(), services: [null]}])("refuses malformed provider proof input", input => {
    expect(() => verify(input)).toThrow(/OLD_WRITER_[A-Z_]+/);
  });
});
