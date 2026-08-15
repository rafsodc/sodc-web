import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import {
  bcryptPilotSucceeded,
  generateSyntheticLegacyCredential,
} from "../../legacyBcryptPilot";
import { passwordDisposition } from "../../legacyUserMigration";

describe("generateSyntheticLegacyCredential", () => {
  it("produces a $2y$-prefixed hash matching the importer's compatible-bcrypt pattern", () => {
    const { hash } = generateSyntheticLegacyCredential();
    expect(hash.startsWith("$2y$")).toBe(true);
    expect(passwordDisposition(hash)).toBe("compatible-bcrypt");
  });

  it("produces a hash that verifies against its own password via bcryptjs", () => {
    const { password, hash } = generateSyntheticLegacyCredential();
    expect(bcrypt.compareSync(password, hash)).toBe(true);
  });

  it("does not verify against a different password", () => {
    const { hash } = generateSyntheticLegacyCredential();
    expect(bcrypt.compareSync("definitely-not-the-password", hash)).toBe(false);
  });

  it("generates a fresh password each call", () => {
    const first = generateSyntheticLegacyCredential();
    const second = generateSyntheticLegacyCredential();
    expect(first.password).not.toBe(second.password);
    expect(first.hash).not.toBe(second.hash);
  });

  it("respects a custom cost factor", () => {
    const { hash } = generateSyntheticLegacyCredential(10);
    expect(bcrypt.getRounds(hash)).toBe(10);
  });
});

describe("bcryptPilotSucceeded", () => {
  it("is true only when both the import and sign-in succeeded", () => {
    expect(
      bcryptPilotSucceeded({ hashImported: true, signInVerified: true, costFactor: 12 })
    ).toBe(true);
    expect(
      bcryptPilotSucceeded({ hashImported: true, signInVerified: false, costFactor: 12 })
    ).toBe(false);
    expect(
      bcryptPilotSucceeded({ hashImported: false, signInVerified: false, costFactor: 12 })
    ).toBe(false);
  });
});
