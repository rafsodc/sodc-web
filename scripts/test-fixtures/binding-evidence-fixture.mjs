import {vi} from "vitest";
import {digest} from "../functions-config-guard-lib.mjs";
import {TARGET} from "../notify-secret-binding-repair-lib.mjs";
import {PROJECT, PREFIX, TARGET_NAME, OPERATION, NOW, KEY, clone, fixture, approved, operationRecord} from "./notify-binding-repair-fixture.mjs";

export const ORIGINAL_DIRECTORY = "/private/tmp/binding-evidence-original-fixture";
export const TOOL_BINDING = Object.freeze({gitSha: "1".repeat(40), tree: "2".repeat(40), trackedSha256: "3".repeat(64), nodeMajor: 24});
export const NEW_BUILD = `${PREFIX}/builds/01234567-89ab-cdef-0123-456789abcdef`;
export function emptyProvenance() {
  return Object.fromEntries(["currentRevision", "previousRevision", "functionBuild", "operationBuild", "sourceObject"]
    .map(name => [name, {state: "NOT_REQUESTED"}]));
}
export function evidenceFixture({rebuild = true} = {}) {
  const f = fixture();
  const proposal = f.prepare();
  const review = approved(proposal);
  const original = {proposal, comparisonKey: KEY, review,
    intent: {schemaVersion: proposal.schemaVersion, proposalSha256: digest(proposal), reviewSha256: digest(review),
      startedAt: new Date(NOW).toISOString()},
    operation: {name: OPERATION},
    claim: {schemaVersion: "sodc-notify-binding-repair-target-lock/v1", proposalSha256: digest(proposal),
      projectId: PROJECT, target: TARGET_NAME, runDirectory: ORIGINAL_DIRECTORY}};
  f.commit();
  f.snapshot.functions[0].serviceConfig.revision = `${TARGET.toLowerCase()}-updated`;
  if (rebuild) {
    f.snapshot.functions[0].buildConfig.build = NEW_BUILD;
    f.snapshot.functions[0].buildConfig.source.storageSource.generation = "9";
    f.snapshot.functions[0].buildConfig.sourceProvenance.resolvedStorageSource.generation = "9";
  }
  const provider = {snapshot: vi.fn(async () => clone(f.snapshot)),
    operation: vi.fn(async () => operationRecord({done: true})),
    provenance: vi.fn(async () => emptyProvenance()),
    patchBindings: vi.fn(async () => {throw new Error("READ_ONLY_TEST_MUTATION_FORBIDDEN");})};
  return {f, original, provider, source: f.source, target: f.snapshot.functions.find(fn => fn.name.endsWith(`/${TARGET}`)),
    reconcileOptions: () => ({environment: "dev", original, originalRunDirectory: ORIGINAL_DIRECTORY,
      originalSource: clone(f.source), toolBinding: clone(TOOL_BINDING), provider, now: NOW + 60_000}),
    captureOptions: () => ({environment: "dev", source: clone(f.source), toolBinding: clone(TOOL_BINDING),
      snapshot: clone(f.snapshot), provenance: emptyProvenance(), comparisonKey: KEY, now: NOW + 60_000})};
}
