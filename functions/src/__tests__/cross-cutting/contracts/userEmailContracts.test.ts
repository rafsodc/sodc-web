import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mutations = readFileSync("../dataconnect/api/user-mutations.gql", "utf8");
const adminMutations = readFileSync("../dataconnect/api/admin-mutations.gql", "utf8");
function operation(source: string, name: string) {
  const start = source.indexOf(`mutation ${name}(`);
  const next = source.indexOf("\nmutation ", start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}

describe("profile email write boundaries", () => {
  it("ordinary and administrator profile saves cannot overwrite email from user input or stale tokens", () => {
    for (const name of ["UpsertUser", "UpdateUser"]) {
      const source = operation(mutations, name);
      expect(source).toContain("user_update(");
      expect(source).not.toMatch(/email(?:_expr)?:/);
      expect(source).not.toContain("$email");
    }
    // Onboarding may initialise an email but must never upsert over an existing one.
    expect(operation(mutations, "CreateUserProfile")).toContain("user_insert(");
    expect(operation(mutations, "CreateUserProfile")).not.toContain("user_upsert(");
  });

  it("all shared email writer operations are server-only and use atomic lease checks", () => {
    for (const name of ["AcquireUserEmailLease", "ReleaseUserEmailLease", "UpdateUserEmailFromAuth"]) {
      expect(operation(adminMutations, name)).toContain("@auth(level: NO_ACCESS)");
    }
    expect(operation(adminMutations, "AcquireUserEmailLease")).toContain("le_expr: \"request.time\"");
    const writer = operation(adminMutations, "UpdateUserEmailFromAuth");
    expect(writer).toContain("emailChangeLeaseId: { eq: $leaseId }");
    expect(writer).toContain("gt_expr: \"request.time\"");
    expect(writer).toContain("@check(expr: \"this == 1\"");
    expect(writer).toContain("updatedBy: $changedBy");
  });
});
