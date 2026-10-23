import { afterEach, describe, expect, it } from "vitest";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { classifyApi, denyOnboarding, prepareMigrationSources, stableHash, verifyMigrationArtifact } from "./authorization-migration-sources.mjs";

const repositoryRoot = process.cwd();
const roots = [];
const now = new Date("2026-10-23T12:00:00Z");
const gitSha = "a".repeat(40);
const projectId = "sodc-web-beta";
const legacy = `mutation CreateUserProfile($firstName:String!) @auth(expr:"auth.token.email_verified == true") {
  user_insert(data:{id_expr:"auth.uid",email_expr:"auth.token.email",membershipStatus:PENDING,firstName:$firstName})
}
query LegacyMembers @auth(expr:"auth.token.enabled == true") {users {id}}
`;
const files = content => [{ path: "user-mutations.gql", content }];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function temporary() { const root = await mkdtemp(path.join(tmpdir(), "authorization-source-test-")); roots.push(root); return root; }
async function prepare(installation = "legacy") {
  const parent = await temporary();
  return prepareMigrationSources({ repositoryRoot, artifactDirectory: path.join(parent, "sources"), projectId, gitSha, installation,
    liveSchemaFiles: [{ path: "schema.gql", content: "type User @table {id:String!}" }],
    liveApiFiles: files(installation === "strict" ? legacy + 'query Current @auth(level:USER){userSecurityState(key:{userId_expr:"auth.uid"}){securityVersion}}' : legacy), now });
}

describe("migration source classification and precise onboarding freeze", () => {
  it("hashes JSON independently of nested property order while preserving array order and values", () => {
    expect(stableHash({ b: [{ z: 1, a: 2 }], a: false })).toBe(stableHash({ a: false, b: [{ a: 2, z: 1 }] }));
    expect(stableHash([1, 2])).not.toBe(stableHash([2, 1]));
    expect(() => stableHash({ invalid: undefined })).toThrow("JSON");
    const cyclic = {}; cyclic.self = cyclic;
    expect(() => stableHash(cyclic)).toThrow("JSON");
  });

  it("never classifies a public current-state/version boundary as legacy", () => {
    for (const marker of ["userSecurityState", "currentAuthorization", "securityVersion", "adminSafetyControl", "SESSION_VERSION_STALE"]) {
      expect(classifyApi(files(legacy + `query Protected @auth(level:USER) {${marker}}`))).toBe("strict");
    }
    expect(classifyApi(files(legacy + 'query Token @auth(expr:"auth.token.securityVersion == 3") {users{id}}'))).toBe("strict");
  });

  it("does not confuse NO_ACCESS service/legacy writer version fields with strict client authorization", () => {
    const service = 'query ServiceState($id:String!) @auth(level:NO_ACCESS) {userSecurityState(key:{userId:$id}) {securityVersion}}';
    const writer = 'mutation ConfirmPotentialLostWithSecurityState @auth(level:NO_ACCESS) @transaction {userSecurityState_updateMany(data:{securityVersion:1})}';
    expect(classifyApi(files(legacy + service + writer))).toBe("legacy");
  });

  it("changes only the named registration authorization and is idempotent", () => {
    const original = '# mutation CreateUserProfile fake @auth(level:PUBLIC)\n' + legacy;
    const denied = denyOnboarding(files(original));
    expect(denied[0].content).toBe(original.replace('@auth(expr:"auth.token.email_verified == true")', "@auth(level: NO_ACCESS)"));
    expect(denyOnboarding(denied)).toEqual(denied);
    expect(denied[0].content).toContain('LegacyMembers @auth(expr:"auth.token.enabled == true")');
  });

  it.each([
    legacy.replace("CreateUserProfile", "SomethingElse"),
    legacy + legacy,
    legacy.replace('auth.token.email_verified == true', 'true'),
    legacy.replace('@auth(expr:', '@mystery(expr:'),
    legacy.replace('id_expr:"auth.uid"', 'id_expr:"vars.uid"'),
    legacy.replace('membershipStatus:PENDING', 'membershipStatus:REGULAR'),
    legacy.replace('firstName:$firstName', 'admin:true'),
    legacy.replace('firstName:$firstName', 'firstName:$wrong'),
    legacy.replace(')\n}', ') user_delete(id:"someone")\n}'),
    legacy.slice(0, -4),
  ])("refuses unknown or malformed onboarding source", content => {
    expect(() => denyOnboarding(files(content))).toThrow();
  });

  it("rejects traversal and duplicate source paths before artifact creation", () => {
    for (const name of ["../outside.gql", "/absolute.gql", "x/../../bad.gql", "x\\bad.gql", "x//bad.gql"]) expect(() => denyOnboarding([{ path: name, content: legacy }])).toThrow("path");
    expect(() => denyOnboarding([...files(legacy), ...files(legacy)])).toThrow("duplicate");
  });
});

describe("reviewed immutable source artifacts", () => {
  it("preserves exact live schema/API except registration freeze and emits strict/legacy stages without SDK outputs", async () => {
    const result = await prepare();
    expect(result.compatibilityFrozen).not.toBeNull();
    expect(result.strictFrozen).not.toBeNull();
    expect(result.strictOpen).not.toBeNull();
    expect(await readFile(path.join(result.liveFrozen.directory, "dataconnect/schema/schema.gql"), "utf8")).toBe("type User @table {id:String!}");
    expect(await readFile(path.join(result.liveFrozen.directory, "dataconnect/api/user-mutations.gql"), "utf8")).toBe(denyOnboarding(files(legacy))[0].content);
    const strictSource = await readFile(path.join(result.strictFrozen.directory, "dataconnect/api/user-mutations.gql"), "utf8");
    expect(strictSource).toContain("currentAuthorization:");
    expect(strictSource).toContain("@auth(level: NO_ACCESS)");
    const compatibilityFiles = await Promise.all((await readdir(path.join(result.compatibilityFrozen.directory, "dataconnect/api"))).filter(file => file.endsWith(".gql")).map(async file => ({ path: file, content: await readFile(path.join(result.compatibilityFrozen.directory, "dataconnect/api", file), "utf8") })));
    expect(classifyApi(compatibilityFiles)).toBe("legacy");
    for (const artifact of [result.liveFrozen, result.compatibilityFrozen, result.strictFrozen, result.strictOpen]) {
      expect(await verifyMigrationArtifact({ directory: artifact.directory, projectId, gitSha, now })).toEqual(artifact);
      expect(JSON.parse(await readFile(artifact.configPath, "utf8"))).toEqual({ dataconnect: { source: "dataconnect" } });
      expect(artifact.manifest.expiresAt).toBe("2026-10-25T12:00:00.000Z");
      expect(await readFile(path.join(artifact.directory, "dataconnect/api/connector.yaml"), "utf8")).toBe("connectorId: api\n");
    }
    expect(await readFile(path.join(result.strictFrozen.directory, "dataconnect/authorization-service/connector.yaml"), "utf8")).toBe("connectorId: authorization-service\n");
    expect(await readFile(path.join(result.strictFrozen.directory, "dataconnect/dataconnect.yaml"), "utf8")).toMatch(/postgresql:\n {6}schemaValidation: COMPATIBLE\n/);
    expect(await readFile(path.join(result.strictOpen.directory, "dataconnect/dataconnect.yaml"), "utf8")).toBe(await readFile(path.join(result.strictFrozen.directory, "dataconnect/dataconnect.yaml"), "utf8"));
    expect(await readFile(path.join(result.strictOpen.directory, "dataconnect/api/user-mutations.gql"), "utf8")).toBe(await readFile(path.join(repositoryRoot, "dataconnect/api/user-mutations.gql"), "utf8"));
  });

  it("never generates compatibility sources for an already strict installation", async () => {
    const result = await prepare("strict");
    expect(result.compatibilityFrozen).toBeNull();
    const source = await readFile(path.join(result.liveFrozen.directory, "dataconnect/api/user-mutations.gql"), "utf8");
    expect(source).toContain("userSecurityState");
    await expect(prepareMigrationSources({ repositoryRoot, artifactDirectory: path.join(await temporary(), "wrong"), projectId, gitSha, installation: "legacy",
      liveSchemaFiles: [{ path: "schema.gql", content: "type User @table {id:String!}" }], liveApiFiles: files(source), now })).rejects.toThrow("never downgrade");
  });

  it("rejects existing/in-checkout output and symlink paths resolving into checkout", async () => {
    const result = await prepare();
    const base = { repositoryRoot, artifactDirectory: result.directory, projectId, gitSha, installation: "legacy", liveSchemaFiles: [{ path: "schema.gql", content: "x" }], liveApiFiles: files(legacy), now };
    await expect(prepareMigrationSources(base)).rejects.toThrow();
    await expect(prepareMigrationSources({ ...base, artifactDirectory: repositoryRoot })).rejects.toThrow("outside");
    const parent = await temporary();
    await symlink(repositoryRoot, path.join(parent, "checkout"));
    await expect(prepareMigrationSources({ ...base, artifactDirectory: path.join(parent, "checkout", "new-artifact") })).rejects.toThrow("outside");
  });

  it("rejects source symlinks before a copied configuration could write through them", async () => {
    const parent = await temporary();
    const checkout = path.join(parent, "checkout");
    await mkdir(path.join(checkout, "dataconnect"), { recursive: true });
    const protectedFile = path.join(parent, "protected.yaml");
    await writeFile(protectedFile, "must remain untouched\n");
    await symlink(protectedFile, path.join(checkout, "dataconnect/dataconnect.yaml"));
    await expect(prepareMigrationSources({ repositoryRoot: checkout, artifactDirectory: path.join(parent, "output"), projectId, gitSha,
      installation: "strict", liveSchemaFiles: [{ path: "schema.gql", content: "type User @table {id:String!}" }],
      liveApiFiles: files(legacy + 'query Strict @auth(level:USER){userSecurityState{securityVersion}}'), now })).rejects.toThrow("symlink");
    expect(await readFile(protectedFile, "utf8")).toBe("must remain untouched\n");
  });

  it("rejects expired artifacts, foreign identity, added files, tampered sources and symlinks", async () => {
    const result = await prepare("strict");
    const directory = result.liveFrozen.directory;
    await expect(verifyMigrationArtifact({ directory, projectId, gitSha, now: new Date("2026-10-25T12:00:00Z") })).rejects.toThrow("expiry");
    await expect(verifyMigrationArtifact({ directory, projectId: "sodc-web", gitSha, now })).rejects.toThrow("identity");
    await expect(verifyMigrationArtifact({ directory, projectId, gitSha: "b".repeat(40), now })).rejects.toThrow("identity");
    const unexpected = path.join(directory, "unexpected.gql");
    await writeFile(unexpected, "query Extra {users{id}}");
    await expect(verifyMigrationArtifact({ directory, projectId, gitSha, now })).rejects.toThrow("tamper");
    await rm(unexpected);
    const source = path.join(directory, "dataconnect/api/user-mutations.gql");
    await chmod(source, 0o600);
    const original = await readFile(source, "utf8");
    await writeFile(source, original + "# changed\n");
    await expect(verifyMigrationArtifact({ directory, projectId, gitSha, now })).rejects.toThrow("tamper");
    await rm(source);
    await symlink(path.join(repositoryRoot, "dataconnect/api/user-mutations.gql"), source);
    await expect(verifyMigrationArtifact({ directory, projectId, gitSha, now })).rejects.toThrow("symlink");
  });

  it("rejects traversal in a rehashed manifest and extending the expiry beyond 48 hours", async () => {
    const result = await prepare("strict");
    const file = path.join(result.liveFrozen.directory, "AUTHORIZATION-MIGRATION-ARTIFACT.json");
    await chmod(file, 0o600);
    const original = JSON.parse(await readFile(file, "utf8"));
    async function replace(changes) {
      const payload = { ...original, ...changes };
      delete payload.manifestHash;
      await writeFile(file, JSON.stringify({ ...payload, manifestHash: stableHash(payload) }));
    }
    await replace({ files: { "../escape.gql": "a".repeat(64) } });
    await expect(verifyMigrationArtifact({ directory: result.liveFrozen.directory, projectId, gitSha, now })).rejects.toThrow("path");
    await replace({ expiresAt: "2026-10-26T12:00:00.000Z" });
    await expect(verifyMigrationArtifact({ directory: result.liveFrozen.directory, projectId, gitSha, now })).rejects.toThrow("expiry");
  });

  it("binds strict-open API to the reviewed candidate even if tampered local hashes are recomputed", async () => {
    const result = await prepare("strict");
    const directory = result.strictOpen.directory;
    const sourceFile = "dataconnect/api/user-mutations.gql";
    const source = path.join(directory, sourceFile);
    const changed = (await readFile(source, "utf8")) + "# unreviewed alteration\n";
    await chmod(source, 0o600);
    await writeFile(source, changed);
    const manifestFile = path.join(directory, "AUTHORIZATION-MIGRATION-ARTIFACT.json");
    await chmod(manifestFile, 0o600);
    const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
    const hash = createHash("sha256").update(changed).digest("hex");
    manifest.files[sourceFile] = hash;
    manifest.candidateApiFiles["user-mutations.gql"] = hash;
    delete manifest.manifestHash;
    await writeFile(manifestFile, JSON.stringify({ ...manifest, manifestHash: stableHash(manifest) }));
    await expect(verifyMigrationArtifact({ directory, projectId, gitSha, now })).rejects.toThrow("reviewed candidate API");
  });
});
