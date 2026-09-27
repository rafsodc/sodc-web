import { beforeEach, describe, expect, it, vi } from "vitest";
import * as sdk from "@dataconnect/admin-generated";
import { confirmPotentialLostMember, listPotentialLostMembers, potentialLostCandidate } from "../../potentialLost";
import { isOlderThanYears, hasCurrentProfileReview } from "../../memberReviewRules";
import { readFileSync } from "node:fs";
import type { UserRecord } from "firebase-admin/auth";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), listUsers: vi.fn(), reconcile: vi.fn(), notify: vi.fn() }));
vi.mock("firebase-admin", () => ({ auth: () => ({ getUser: mocks.getUser, listUsers: mocks.listUsers }) }));
vi.mock("../../rateLimiter", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("../../enabledClaimReconciliation", () => ({ reconcileEnabledClaim: mocks.reconcile }));
vi.mock("../../membershipStatusEmailDispatcher", () => ({ notifyMembershipStatusEmailIfNeeded: mocks.notify }));
vi.mock("../../users", () => ({ invalidateDcProfileCache: vi.fn() }));
const profileQuery = vi.spyOn(sdk, "getPotentialLostProfile");
const listQuery = vi.spyOn(sdk, "listPotentialLostProfiles");
const mutation = vi.spyOn(sdk, "confirmPotentialLost");
const profile = { id: "member", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", membershipStatus: sdk.MembershipStatus.REGULAR, updatedAt: "2026-01-01T00:00:00Z", emailBounceCount: 3, emailLastBounceAt: "2026-01-01T00:00:00Z", emailDeliveryVersion: 4 };
const auth = { uid: "member", customClaims: {}, metadata: { lastSignInTime: "2020-01-01T00:00:00Z", creationTime: "2019-01-01T00:00:00Z" } } as UserRecord;
function request(data: unknown = {}, token: Record<string, unknown> = { admin: true, enabled: true }) {
  return { auth: { uid: "reviewer", token }, data } as Parameters<typeof confirmPotentialLostMember.run>[0];
}
function confirmation() { return request({ userId: "member", reviewToken: potentialLostCandidate(profile, auth)!.reviewToken }); }

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue(auth);
  mocks.listUsers.mockResolvedValue({ users: [auth] });
  mocks.reconcile.mockResolvedValue({ enabled: false });
  mocks.notify.mockResolvedValue(undefined);
  profileQuery.mockResolvedValue({ data: { user: profile } });
  listQuery.mockResolvedValue({ data: { users: [profile] } });
  mutation.mockResolvedValue({ data: { user_updateMany: 1 } } as never);
});

describe("calendar rules", () => {
  it.each([2, 3])("uses an exact %i-year anniversary and clamps leap days", (years) => {
    const anniversary = `202${4 + years}-02-28T10:00:00Z`;
    expect(isOlderThanYears("2024-02-29T10:00:00Z", years, new Date(anniversary))).toBe(false);
    expect(isOlderThanYears("2024-02-29T10:00:00Z", years, new Date(new Date(anniversary).getTime() + 1))).toBe(true);
    expect(isOlderThanYears("2024-02-29T10:00:00Z", years, new Date(new Date(anniversary).getTime() - 1))).toBe(false);
  });
  it("fails closed for missing and invalid reviews", () => {
    expect(hasCurrentProfileReview(null)).toBe(false);
    expect(hasCurrentProfileReview("invalid")).toBe(false);
    expect(hasCurrentProfileReview(new Date().toISOString())).toBe(true);
  });
});

describe("potential lost review", () => {
  it("combines reasons once and excludes already-lost and current members", () => {
    expect(potentialLostCandidate(profile, auth)?.reasons).toEqual(["INACTIVE", "BOUNCES"]);
    expect(potentialLostCandidate({ ...profile, membershipStatus: sdk.MembershipStatus.LOST }, auth)).toBeNull();
    expect(potentialLostCandidate({ ...profile, emailBounceCount: 0 }, { ...auth, metadata: { ...auth.metadata, lastSignInTime: new Date().toISOString() } })).toBeNull();
  });
  it("does not flag a member who stays signed in and refreshes tokens", () => {
    const recent = { ...auth, metadata: { ...auth.metadata, lastRefreshTime: new Date().toISOString() } };
    expect(potentialLostCandidate({ ...profile, emailBounceCount: 0 }, recent)).toBeNull();
    expect(potentialLostCandidate(profile, recent)?.reasons).toEqual(["BOUNCES"]);
  });
  it.each([
    ["2021-01-01", "2022-01-01", "2022-01-01T00:00:00.000Z", "TOKEN_REFRESH"],
    ["2022-01-01", "2021-01-01", "2022-01-01T00:00:00.000Z", "SIGN_IN"],
    ["invalid", "2022-01-01", "2022-01-01T00:00:00.000Z", "TOKEN_REFRESH"],
    ["2022-01-01", "invalid", "2022-01-01T00:00:00.000Z", "SIGN_IN"],
    ["invalid", "invalid", null, "ACCOUNT_CREATED"],
  ])("selects the latest valid activity (%s / %s)", (lastSignInTime, lastRefreshTime, expected, source) => {
    const candidate = potentialLostCandidate(profile, { ...auth, metadata: { ...auth.metadata, lastSignInTime, lastRefreshTime } });
    expect(candidate?.lastActivityTime).toBe(expected);
    expect(candidate?.activitySource).toBe(source);
  });
  it("rejects a newer token refresh between listing and confirmation even when bounces still qualify", async () => {
    const initial = confirmation();
    mocks.getUser.mockResolvedValue({ ...auth, metadata: { ...auth.metadata, lastRefreshTime: new Date().toISOString() } });
    await expect(confirmPotentialLostMember.run(initial)).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mutation).not.toHaveBeenCalled();
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
  it("audits token activity separately from the actual sign-in", async () => {
    const refreshed = { ...auth, metadata: { ...auth.metadata, lastRefreshTime: "2022-01-01T00:00:00Z" } };
    mocks.getUser.mockResolvedValue(refreshed);
    await confirmPotentialLostMember.run(request({ userId: "member", reviewToken: potentialLostCandidate(profile, refreshed)!.reviewToken }));
    expect(mutation).toHaveBeenCalledWith(expect.objectContaining({
      lastSignInTime: "2020-01-01T00:00:00.000Z", lastActivityTime: "2022-01-01T00:00:00.000Z",
      inactivitySince: "2022-01-01T00:00:00.000Z", activitySource: "TOKEN_REFRESH",
    }));
  });
  it("uses account creation for never-login accounts without assuming pre-import history", () => {
    const never = { ...auth, metadata: { ...auth.metadata, lastSignInTime: "", creationTime: new Date().toISOString() } };
    expect(potentialLostCandidate({ ...profile, emailBounceCount: 0 }, never)).toBeNull();
    never.metadata.creationTime = "2020-01-01";
    expect(potentialLostCandidate({ ...profile, emailBounceCount: 0 }, never)?.reasons).toEqual(["INACTIVE"]);
    never.metadata.creationTime = "invalid";
    expect(potentialLostCandidate({ ...profile, emailBounceCount: 0 }, never)).toBeNull();
  });
  it.each([{ enabled: true }, { admin: true, enabled: false }])("rejects non-admin/disabled callers", async (token) => {
    await expect(listPotentialLostMembers.run(request({}, token))).rejects.toMatchObject({ code: "permission-denied" });
    await expect(confirmPotentialLostMember.run(request({}, token))).rejects.toMatchObject({ code: "permission-denied" });
    expect(listQuery).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated callers", async () => {
    await expect(listPotentialLostMembers.run({ data: {} } as never)).rejects.toMatchObject({ code: "unauthenticated" });
  });
  it("pages both Auth and profile data and omits missing Auth records", async () => {
    mocks.listUsers.mockResolvedValueOnce({ users: [], pageToken: "next" }).mockResolvedValueOnce({ users: [auth] });
    listQuery.mockResolvedValueOnce({ data: { users: Array.from({ length: 500 }, (_, i) => ({ ...profile, id: `missing-${i}` })) } }).mockResolvedValueOnce({ data: { users: [profile] } });
    expect((await listPotentialLostMembers.run(request())).members).toHaveLength(1);
    expect(listQuery).toHaveBeenLastCalledWith({ limit: 500, offset: 500 });
    expect(mocks.listUsers).toHaveBeenLastCalledWith(1000, "next");
  });
  it("confirms through the established access path and records the reviewer atomically", async () => {
    expect(await confirmPotentialLostMember.run(confirmation())).toEqual({ success: true });
    expect(mocks.reconcile).toHaveBeenCalledWith("member", "LOST");
    expect(mutation).toHaveBeenCalledWith(expect.objectContaining({ userId: "member", reviewedBy: "reviewer", expectedStatus: "REGULAR", expectedUpdatedAt: profile.updatedAt, expectedEmailDeliveryVersion: 4, reasons: ["INACTIVE", "BOUNCES"] }));
    expect(mocks.notify).toHaveBeenCalled();
  });
  it("rejects changed evidence before revoking access", async () => {
    profileQuery.mockResolvedValue({ data: { user: { ...profile, emailBounceCount: 0 } } });
    await expect(confirmPotentialLostMember.run(confirmation())).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
  });
  it("protects administrator accounts", async () => {
    const adminAuth = { ...auth, customClaims: { admin: true } };
    mocks.getUser.mockResolvedValue(adminAuth);
    await expect(confirmPotentialLostMember.run(request({ userId: "member", reviewToken: potentialLostCandidate(profile, adminAuth)!.reviewToken }))).rejects.toMatchObject({ code: "permission-denied" });
    expect(mutation).not.toHaveBeenCalled();
  });
  it("repairs claims after a failed concurrent write without overwriting membership", async () => {
    mutation.mockRejectedValueOnce(new Error("POTENTIAL_LOST_CONFLICT"));
    profileQuery.mockResolvedValueOnce({ data: { user: profile } }).mockResolvedValueOnce({ data: { user: { ...profile, membershipStatus: sdk.MembershipStatus.RESIGNED } } });
    await expect(confirmPotentialLostMember.run(confirmation())).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mocks.reconcile).toHaveBeenLastCalledWith("member", "RESIGNED");
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("retries an already-completed transition without a second audit", async () => {
    profileQuery.mockResolvedValue({ data: { user: { ...profile, membershipStatus: sdk.MembershipStatus.LOST } } });
    await expect(confirmPotentialLostMember.run(confirmation())).resolves.toEqual({ success: true });
    expect(mutation).not.toHaveBeenCalled();
    expect(mocks.reconcile).toHaveBeenCalledWith("member", "LOST");
  });
  it("keeps queries server-only and status/audit updates atomic", () => {
    const query = readFileSync(new URL("../../../../dataconnect/api/member-review.gql", import.meta.url), "utf8");
    expect(query.match(/@auth\(level: NO_ACCESS\)/g)).toHaveLength(3);
    expect(query).toContain("@transaction");
    expect(query).toContain("message: \"POTENTIAL_LOST_CONFLICT\"");
    expect(query).toContain("potentialLostReview_insert");
  });
});
