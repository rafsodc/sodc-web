import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({getUser: vi.fn(), lookup: vi.fn(), sync: vi.fn(), limit: vi.fn()}));
vi.mock("firebase-admin", () => ({auth: () => ({getUser: mocks.getUser})}));
vi.mock("../../securityRepository", () => ({getUserSecurityState: mocks.lookup}));
vi.mock("../../currentAuthorizationTransitions", () => ({synchronizeUserSecurity: mocks.sync}));
vi.mock("../../rateLimiter", () => ({enforceRateLimit: mocks.limit}));
import { getMyAuthorizationStatus } from "../../authorizationStatus";
const base = {userId: "self", securityVersion: 3, membershipStatus: "REGULAR", desiredEnabled: true, desiredAdmin: false,
  accessReady: true, adminReady: false, operationId: "intent-3", syncStatus: "READY", verificationEmail: null, user: {membershipStatus: "REGULAR"}};
const run = (token = {}, data = {}) => getMyAuthorizationStatus.run({auth: {uid: "self", token}, data} as never);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({disabled: false, emailVerified: true, email: "private@example.org"});
  mocks.lookup.mockResolvedValue({data: {userSecurityState: structuredClone(base)}});
});
describe("own authorization status", () => {
  it("returns only own minimal metadata despite old flags, no version, or caller-supplied UID", async () => {
    expect(await run({enabled: false, admin: true}, {userId: "another", admin: true})).toEqual({
      status: "enabled", isAdmin: false, securityVersion: 3, tokenVersionCurrent: false, verificationRequired: false,
    });
    expect(mocks.lookup).toHaveBeenCalledWith({userId: "self"});
    expect(mocks.getUser).toHaveBeenCalledWith("self");
    expect(mocks.sync).toHaveBeenCalledWith("intent-3");
    expect(mocks.limit).toHaveBeenCalledWith("getMyAuthorizationStatus", "self");
  });
  it("requires an authenticated identity", async () => {
    await expect(getMyAuthorizationStatus.run({data: {}} as never)).rejects.toMatchObject({code: "unauthenticated"});
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it("does not create a missing authorization record", async () => {
    mocks.lookup.mockResolvedValue({data: {userSecurityState: null}});
    expect(await run()).toMatchObject({status: "missing", securityVersion: null});
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("distinguishes a temporary pending grant from a terminal restriction", async () => {
    mocks.lookup.mockResolvedValue({data: {userSecurityState: {...base, syncStatus: "PENDING", accessReady: false}}});
    expect(await run()).toMatchObject({status: "pending"});
    expect(mocks.sync).not.toHaveBeenCalled();
    mocks.lookup.mockResolvedValue({data: {userSecurityState: {...base, desiredEnabled: false, syncStatus: "PENDING", accessReady: false}}});
    expect(await run()).toMatchObject({status: "restricted"});
  });
  it.each([
    {...base, verificationEmail: "intended@example.org"},
    {...base, user: {membershipStatus: "LOST"}},
    {...base, membershipStatus: "PENDING"},
  ])("does not release holds, repair profile drift, or grant from token flags", async state => {
    mocks.lookup.mockResolvedValue({data: {userSecurityState: state}});
    expect(await run({admin: true, enabled: true, securityVersion: 3})).toMatchObject({status: "restricted"});
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it.each([{disabled: true, emailVerified: true}, {disabled: false, emailVerified: false}])("freshly checks external identity restrictions", async identity => {
    mocks.getUser.mockResolvedValue(identity);
    expect(await run()).toMatchObject({status: "restricted"});
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("fails closed when identity status cannot be checked", async () => {
    mocks.getUser.mockRejectedValue({code: "auth/internal-error"});
    await expect(run()).rejects.toMatchObject({code: "unavailable"});
  });
  it("reports deleted identities as restricted", async () => {
    mocks.getUser.mockRejectedValue({code: "auth/user-not-found"});
    expect(await run()).toMatchObject({status: "restricted"});
  });
  it("rechecks authority after mirror repair instead of returning an earlier ready snapshot", async () => {
    mocks.lookup.mockResolvedValueOnce({data: {userSecurityState: base}})
      .mockResolvedValueOnce({data: {userSecurityState: {...base, accessReady: false, desiredEnabled: false, securityVersion: 4}}});
    expect(await run({securityVersion: 3})).toMatchObject({status: "restricted", securityVersion: 4, tokenVersionCurrent: false});
  });
});
