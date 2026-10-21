import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepareAuthorizationRollout, compatibilityOperationSource } from "./prepare-authorization-rollout.mjs";
import { verifyAuthorizationMigration, AUTHORIZATION_MIGRATION_ID } from "./check-authorization-migration.mjs";
const repositoryRoot = process.cwd();
const roots = [];
afterEach(async () => {for (const root of roots.splice(0)) await rm(root, {recursive: true, force: true});});
async function temporary() {const root = await mkdtemp(path.join(tmpdir(), "security-rollout-test-")); roots.push(root); return root;}
describe("staged current-authorization rollout", () => {
  it("prepares only an explicitly targeted, expiring compatibility source outside the checkout", async () => {
    const temp = await temporary(); const output = path.join(temp, "compatibility");
    const original = await readFile(path.join(repositoryRoot, "dataconnect/api/user-mutations.gql"), "utf8");
    await prepareAuthorizationRollout({repositoryRoot, output, projectId: "sodc-web-beta", now: new Date("2026-10-21T00:00:00Z"), expiresAt: "2026-10-22T00:00:00Z"});
    const compatibility = await readFile(path.join(output, "dataconnect/api/user-mutations.gql"), "utf8");
    expect(compatibility).not.toContain("currentAuthorization:");
    expect(compatibility).not.toMatch(/query\s+@redact\s*\{\s*\}/);
    expect(compatibility).toContain('auth.token.enabled == true');
    expect(compatibility).toContain('auth.token.admin == true');
    expect(compatibility).toContain('userId_expr: "auth.uid"');
    expect(await readFile(path.join(repositoryRoot, "dataconnect/api/user-mutations.gql"), "utf8")).toBe(original);
    expect(original).toContain("currentAuthorization:");
    expect(await readFile(path.join(output, "dataconnect/authorization-service/connector.yaml"), "utf8")).toBe("connectorId: authorization-service\n");
    const metadata = JSON.parse(await readFile(path.join(output, "AUTHORIZATION-ROLLOUT.json"), "utf8"));
    expect(metadata).toMatchObject({projectId: "sodc-web-beta", expiresAt: "2026-10-22T00:00:00.000Z"});
  });
  it("rejects unsupported targets, existing output, unsafe output paths and unbounded expiry", async () => {
    const temp = await temporary(); const base = {repositoryRoot, output: path.join(temp, "new"), projectId: "sodc-web-beta", now: new Date("2026-10-21"), expiresAt: "2026-10-22"};
    await expect(prepareAuthorizationRollout({...base, projectId: "other"})).rejects.toThrow("supported");
    await expect(prepareAuthorizationRollout({...base, expiresAt: "2026-10-25"})).rejects.toThrow("48 hours");
    await expect(prepareAuthorizationRollout({...base, expiresAt: "2026-10-20"})).rejects.toThrow("48 hours");
    await expect(prepareAuthorizationRollout({...base, output: repositoryRoot})).rejects.toThrow("outside");
    await expect(prepareAuthorizationRollout({...base, output: temp})).rejects.toThrow();
  });
  it("refuses unknown lookup syntax rather than silently emitting unguarded source", () => {
    expect(() => compatibilityOperationSource('query X { currentAuthorization: userSecurityState(key: {userId_expr: "auth.uid"})')).toThrow("refusing");
  });
  it("retains the old server operation signature and adds a new atomic security operation", async () => {
    const source = await readFile(path.join(repositoryRoot, "dataconnect/api/member-review.gql"), "utf8");
    const legacy = source.split("mutation ConfirmPotentialLost(")[1];
    expect(legacy).not.toContain("expectedSecurityVersion");
    const current = source.split("mutation ConfirmPotentialLostWithSecurityState(")[1].split("mutation ConfirmPotentialLost(")[0];
    expect(current).toContain("userSecurityState_updateMany");
    expect(current).toContain("securityTransition_insert");
  });
  it("blocks normal deployment until an operator attests the exact project/revision with audit evidence", async () => {
    const temp = await temporary(); const expected = {projectId: "sodc-web-beta", gitSha: "a".repeat(40)};
    await expect(verifyAuthorizationMigration(temp, expected)).rejects.toThrow("one-shot deployment is unsafe");
    const folder = path.join(temp, ".firebase/authorization-migration"); await mkdir(folder, {recursive: true});
    const attestation = {migrationId: AUTHORIZATION_MIGRATION_ID, schemaVersion: "sodc-authorization-migration/v1", ...expected, backfillComplete: true, strictApiReady: true, adminSafetyControlReady: true, securityWriteFreezeVerified: true, reviewedBy: "operator", evidence: "nonprod gate + profile and Auth audit reference"};
    await writeFile(path.join(folder, `${expected.projectId}.json`), JSON.stringify(attestation));
    expect(await verifyAuthorizationMigration(temp, expected, () => true)).toEqual(attestation);
    await writeFile(path.join(folder, `${expected.projectId}.json`), JSON.stringify({...attestation, securityWriteFreezeVerified: false}));
    await expect(verifyAuthorizationMigration(temp, expected, () => true)).rejects.toThrow("not attested");
    await writeFile(path.join(folder, `${expected.projectId}.json`), JSON.stringify({...attestation, adminSafetyControlReady: false}));
    await expect(verifyAuthorizationMigration(temp, expected, () => true)).rejects.toThrow("not attested");
    await writeFile(path.join(folder, `${expected.projectId}.json`), JSON.stringify({...attestation, migrationId: "current-authorization/v1"}));
    await expect(verifyAuthorizationMigration(temp, expected, () => true)).rejects.toThrow("not attested");
    await writeFile(path.join(folder, `${expected.projectId}.json`), JSON.stringify(attestation));
    await expect(verifyAuthorizationMigration(temp, {...expected, gitSha: "different"}, () => false)).rejects.toThrow("not attested");
    expect(await verifyAuthorizationMigration(temp, {...expected, gitSha: "b".repeat(40)}, () => true)).toEqual(attestation);
    for (const script of ["deploy-environment.mjs", "deployment-preflight.mjs"]) {
      const source = await readFile(path.join(repositoryRoot, "scripts", script), "utf8");
      expect(source.indexOf("await verifyAuthorizationMigration(")).toBeLessThan(source.indexOf("await runDeploymentPlan("));
    }
  });
});
