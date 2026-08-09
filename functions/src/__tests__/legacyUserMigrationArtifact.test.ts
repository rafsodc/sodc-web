import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  effectiveLegacySourceChecksum,
  assertLegacyPreflightSourceBinding,
  emailLessLegacyUserIds,
  readLegacyPreflight,
} from "../legacyUserMigrationArtifact";
import { sha256Hex } from "../legacyUserMigration";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("legacy migration artifact helpers", () => {
  it("validates the preflight contract", () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "sodc-preflight-")
    );
    temporaryDirectories.push(directory);
    const preflightPath = path.join(directory, "preflight.json");
    fs.writeFileSync(
      preflightPath,
      JSON.stringify({
        schemaVersion: "sodc-legacy-user-preflight/v3",
        recordSchemaVersion: "sodc-legacy-user/v1",
        sourceChecksum: "a".repeat(64),
        overall: { recordCount: 918 },
      })
    );

    expect(readLegacyPreflight(preflightPath).overall.recordCount).toBe(918);
  });

  it("rejects a same-count preflight produced from different source bytes", () => {
    const preflight = {
      schemaVersion: "sodc-legacy-user-preflight/v3",
      recordSchemaVersion: "sodc-legacy-user/v1",
      sourceChecksum: "a".repeat(64),
      overall: { recordCount: 918 },
    };

    expect(() => assertLegacyPreflightSourceBinding(preflight, "b".repeat(64))).toThrow(
      /does not match/
    );
    expect(() => assertLegacyPreflightSourceBinding(preflight, "a".repeat(64))).not.toThrow();
  });

  it("binds remediation decisions into the effective checksum", () => {
    const artifactChecksum = "a".repeat(64);
    const remediations = [{ line: 3, mobileNumber: null }];

    expect(effectiveLegacySourceChecksum(artifactChecksum, [])).toBe(
      artifactChecksum
    );
    expect(
      effectiveLegacySourceChecksum(artifactChecksum, remediations)
    ).toBe(sha256Hex(JSON.stringify({ artifactChecksum, remediations })));
  });

  it("derives only explicitly remediated email-less LOST identities", () => {
    const record = {
      legacyUserId: "19eb78b8-d258-46f0-a3b7-d01a44a86bd9",
      oldUid: null,
      email: null,
      firstName: "Lost",
      lastName: "Member",
      mobileNumber: null,
      postNominals: null,
      serviceNumber: null,
      rank: null,
      membershipStatus: "LOST",
      isShared: null,
      hasSubscriptions: false,
      passwordHash: null,
    };
    const lines = [JSON.stringify(record)];

    expect(
      emailLessLegacyUserIds(lines, [
        { line: 1, email: null, membershipStatus: "LOST" },
      ])
    ).toEqual(new Set([record.legacyUserId]));
    expect(emailLessLegacyUserIds(lines, [{ line: 1, mobileNumber: null }])).toEqual(
      new Set()
    );
  });
});
