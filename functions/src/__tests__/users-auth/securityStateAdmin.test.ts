import { describe, expect, it } from "vitest";
import { parseSecurityAdminArguments } from "../../securityAdminArguments";
describe("security operator targeting", () => {
  it("defaults to read-only audit with explicit project and identity", () => {
    expect(parseSecurityAdminArguments(["--project", "sodc-web-beta", "--user", "fixture"])).toMatchObject({mode: "audit", apply: false, userId: "fixture"});
  });
  it.each([[], ["--project", "unknown", "--all"], ["--project", "sodc-web-beta"], ["--project", "sodc-web-beta", "--all", "--user", "fixture"], ["--project", "sodc-web-beta", "--all", "--mode", "disable"]])("rejects an unbound/unsafe target: %s", args => {
    expect(() => parseSecurityAdminArguments(args)).toThrow();
  });
  it("requires independent project confirmation and audit attribution for writes", () => {
    const args = ["--project", "sodc-web-beta", "--user", "fixture", "--mode", "disable", "--apply"];
    expect(() => parseSecurityAdminArguments(args)).toThrow("Writes require");
    expect(parseSecurityAdminArguments([...args, "--confirm-project", "sodc-web-beta", "--actor", "operator", "--reason", "Approved restriction", "--operation-id", "operator-restriction-reference"])).toMatchObject({apply: true});
  });
});
