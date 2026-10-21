import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({apps: [] as {name: string; options?: object}[], init: vi.fn(), getDataConnect: vi.fn(), read: vi.fn(), begin: vi.fn()}));
vi.unmock("../../securityRepository");
vi.mock("firebase-admin/app", () => ({getApps: () => mocks.apps, getApp: () => ({name: "[DEFAULT]", options: {projectId: "demo-project"}}), initializeApp: mocks.init}));
vi.mock("firebase-admin/data-connect", () => ({getDataConnect: mocks.getDataConnect}));
vi.mock("../../security-admin-generated", () => ({connectorConfig: {connector: "authorization-service", serviceId: "sodc-web-service", location: "europe-west2"},
  getUserSecurityState: mocks.read, beginSecurityTransition: mocks.begin}));
import { getUserSecurityState, beginSecurityTransition } from "../../securityRepository";
beforeEach(() => {
  vi.resetAllMocks(); mocks.apps.length = 0;
  mocks.init.mockImplementation((options, name) => {const app = {options, name}; mocks.apps.push(app); return app;});
  mocks.getDataConnect.mockReturnValue({connector: "isolated-security-client"});
});
describe("authorization connector isolation", () => {
  it("uses a dedicated named App rather than Admin SDK's connector-colliding default cache", async () => {
    await getUserSecurityState({userId: "self"});
    await getUserSecurityState({userId: "other"});
    expect(mocks.init).toHaveBeenCalledOnce();
    expect(mocks.init).toHaveBeenCalledWith({projectId: "demo-project"}, "current-authorization-data-connect");
    expect(mocks.getDataConnect).toHaveBeenCalledWith(expect.objectContaining({connector: "authorization-service"}), expect.objectContaining({name: "current-authorization-data-connect"}));
    expect(mocks.read).toHaveBeenCalledWith({connector: "isolated-security-client"}, {userId: "self"});
  });
  it("passes the isolated DataConnect explicitly for writes too", async () => {
    await beginSecurityTransition({userId: "self"} as never);
    expect(mocks.begin).toHaveBeenCalledWith({connector: "isolated-security-client"}, {userId: "self"});
  });
});
