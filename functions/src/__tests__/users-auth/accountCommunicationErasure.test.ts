import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { ACCOUNT_ERASURE_DRAIN_MS, announcementErasureTaskIds, erasureDrainRemaining, pruneAnnouncementSnapshot, withSnapshotErasure } from "../../accountCommunicationErasure";
import { redactAccountSnapshotMutation } from "../../accountDeletionDatabase";
import { accountDeletionMatch } from "../../accountDeletion";

const uid = "erase-member", email = "member@example.invalid", sendId = "10000000-0000-4000-8000-000000000001";
const survivor = {sendId, recipientId: "keep-member", email: "keep@example.invalid", personalisation: {name: "Preserve", token: "opaque-other-token"}};
const own = {sendId, recipientId: uid, email: "former@example.invalid", personalisation: {name: "Remove", token: "opaque-own-token"}, effectiveDeliveryMode: "TEAM_TEST"};
const original = JSON.stringify({version: 1, tasks: [survivor, own], skippedRecipients: [{userId: uid, email}], audienceSummary: "unchanged summary", extension: {keep: true}});

describe("member-only communication erasure", () => {
  it("removes only selected tasks and opt-outs while preserving every surviving field", () => {
    const result = pruneAnnouncementSnapshot(original, uid, email);
    expect(JSON.parse(result.replacement)).toEqual({version: 1, tasks: [survivor], skippedRecipients: [], audienceSummary: "unchanged summary", extension: {keep: true}});
    expect(result).toMatchObject({removed: 2, removedTasks: 1, removedSkipped: 1, emails: ["former@example.invalid", email]});
    expect(result.tasks).toEqual([{sendId, recipientId: uid, effectiveDeliveryMode: "TEAM_TEST"}]);
    expect(result.replacement).not.toContain("opaque-own-token");
  });
  it("refuses malformed snapshots and shared-address ambiguity rather than removing another identity", () => {
    expect(() => pruneAnnouncementSnapshot("not-json", uid, email)).toThrow();
    expect(() => pruneAnnouncementSnapshot(JSON.stringify({version: 2, tasks: [], skippedRecipients: []}), uid, email)).toThrow();
    expect(() => pruneAnnouncementSnapshot(JSON.stringify({version: 1, tasks: [{...survivor, email}], skippedRecipients: []}), uid, email)).toThrow("AMBIGUOUS");
    expect(accountDeletionMatch("AnnouncementSend", {recipientSnapshot: original, audienceSummary: `Shared note mentioning ${email}`}, uid, email)).toBe("block");
  });
  it("fences snapshot contents and counts in one authorized transaction", () => {
    const pruned = pruneAnnouncementSnapshot(original, uid, email);
    const result = withSnapshotErasure(redactAccountSnapshotMutation, [{id: sendId, expected: original, replacement: pruned.replacement, recipientCount: 2, skippedCount: 1, removedTasks: 1, removedSkipped: 1}]);
    expect(result.query).toContain("recipientSnapshot: {eq: $before0}");
    expect(result.query).toContain("recipientCount: {eq: $recipientBefore0}");
    expect(result.query).toContain("ANNOUNCEMENT_CHANGED_DURING_ERASURE");
    expect(result.query.indexOf("snapshot0:")).toBeGreaterThan(result.query.indexOf("actor:"));
    expect(result.variables).toMatchObject({before0: original, after0: pruned.replacement, recipientAfter0: 1, skippedAfter0: 0});
    expect(result.query).not.toContain("opaque-other-token");
  });
  it("cancels only deterministic task IDs for the selected member, including legacy and UUID forms", () => {
    const ids = announcementErasureTaskIds(sendId, uid, "TEAM_TEST");
    expect(ids).toContain(createHash("sha256").update(`${sendId}:${uid}:TEAM_TEST`).digest("hex"));
    expect(ids).toContain(createHash("sha256").update(`${sendId}:${uid}`).digest("hex"));
    const other = new Set(announcementErasureTaskIds(sendId, "keep-member", "TEAM_TEST"));
    expect(ids.some(id => other.has(id))).toBe(false);
    expect(() => announcementErasureTaskIds("invalid", uid)).toThrow();
  });
  it("enforces the complete in-flight sender drain without resetting it on retry", () => {
    const start = Date.parse("2026-01-01T00:00:00Z");
    expect(erasureDrainRemaining(new Date(start).toISOString(), start)).toBe(ACCOUNT_ERASURE_DRAIN_MS);
    expect(erasureDrainRemaining(new Date(start).toISOString(), start + ACCOUNT_ERASURE_DRAIN_MS - 1)).toBe(1);
    expect(erasureDrainRemaining(new Date(start).toISOString(), start + ACCOUNT_ERASURE_DRAIN_MS)).toBe(0);
    expect(() => erasureDrainRemaining("invalid", start)).toThrow();
  });
  it("includes owned delivery history and completed non-admin migration history, retaining unrelated evidence", () => {
    expect(accountDeletionMatch("AnnouncementRecipient", {userId: uid, email}, uid, email)).toBe("remove");
    expect(accountDeletionMatch("NotificationDelivery", {user: {id: uid}, status: "PENDING"}, uid, email)).toBe("remove");
    expect(accountDeletionMatch("NotificationDelivery", {user: {id: uid}, booking: {id: "financial"}}, uid, email)).toBe("block");
    expect(accountDeletionMatch("SecurityTransition", {userId: uid, actorId: "operator", syncStatus: "READY", desiredAdmin: false, startedAdminDelta: 0, completedAdminDelta: 0}, uid, email)).toBe("remove");
    expect(accountDeletionMatch("SecurityTransition", {userId: "other", actorId: uid, syncStatus: "READY"}, uid, email)).toBe("block");
    expect(accountDeletionMatch("AccountErasure", {userId: uid, emailHash: "suppression"}, uid, email)).toBe("none");
  });
});
