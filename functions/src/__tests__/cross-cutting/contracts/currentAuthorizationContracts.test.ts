import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
const root = resolve(process.cwd(), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
describe("current-authorization boundary inventory", () => {
  it("classifies every connector operation and checks client authorization before transactional writes", () => {
    expect(execFileSync(process.execPath, ["scripts/check-authorization-inventory.mjs"], {cwd: root, encoding: "utf8"})).toContain("explicitly classified");
  });
  it("keeps security state and transition writes inaccessible to client identities", () => {
    const source = read("dataconnect/authorization-service/security.gql");
    for (const block of source.split(/(?=^(?:query|mutation) )/m).filter(block => /^(?:query|mutation) /.test(block))) expect(block).toContain("@auth(level: NO_ACCESS)");
    expect(source).toContain("securityVersion: {eq: $expectedVersion}");
    expect(source).toContain("syncStatus: {eq: PENDING}");
    expect(source).toContain("intentHash: $intentHash");
  });
  it("loads generated authorization runtime from the deployed file dependency and wraps every operation with the isolated connector", () => {
    const repository = read("functions/src/securityRepository.ts");
    expect(repository).toContain("from \"@dataconnect/security-admin-generated\"");
    expect(repository).not.toContain("from \"./security-admin-generated\"");
    for (const operation of read("dataconnect/authorization-service/security.gql").matchAll(/^(?:query|mutation) (\w+)/gm)) {
      const name = operation[1][0].toLowerCase() + operation[1].slice(1);
      expect(repository, name).toContain(`sdk.${name}(getAuthorizationDataConnect(), variables)`);
    }
  });
  it("awaits every member/admin guard and limits raw token role reads to boundary modules", () => {
    for (const name of readdirSync(resolve(root, "functions/src")).filter(name => name.endsWith(".ts"))) {
      const source = read(`functions/src/${name}`);
      if (name === "helpers.ts" || name === "currentAuthorization.ts") continue;
      expect(source, name).not.toMatch(/(?<!await )\brequire(?:Enabled|Admin)\(request\);/);
      expect(source, name).not.toMatch(/request\.auth!?\.token\??\.(?:admin|enabled)/);
    }
  });
  it("does not keep backend imports of guarded client reads", () => {
    const service = read("dataconnect/api/service-queries.gql");
    const operations = [...service.matchAll(/^query Service(\w+)/gm)].map(match => match[1][0].toLowerCase() + match[1].slice(1));
    for (const name of readdirSync(resolve(root, "functions/src")).filter(name => name.endsWith(".ts"))) {
      const source = read(`functions/src/${name}`);
      for (const imports of source.matchAll(/import\s*\{([^}]+)\}\s*from "@dataconnect\/admin-generated"/g)) {
        for (const operation of operations) expect(imports[1], `${name}: ${operation}`).not.toMatch(new RegExp(`(?:^|,)\\s*${operation}(?:\\s+as|\\s*[,}]|\\s*$)`));
      }
    }
  });
  it("keeps Potential Lost denial/version/profile audit atomic and receipt processing delivery-only", () => {
    const review = read("dataconnect/api/member-review.gql");
    expect(review).toContain("userSecurityState_updateMany"); expect(review).toContain("securityTransition_insert");
    expect(review).toContain("potentialLostReview_insert"); expect(review).toContain("@transaction");
    const receipts = read("dataconnect/api/admin-mutations.gql").split("mutation TryApplyNotifyDeliveryUserState")[1].split("# ── GOV.UK Notify callback")[0];
    expect(receipts).not.toContain("membershipStatus:");
  });
});
