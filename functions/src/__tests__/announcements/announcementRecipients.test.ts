import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  ANNOUNCEMENT_NAME_COMPATIBILITY_FOLDS,
  mergeAnnouncementRecipients,
  partitionAnnouncementRecipients,
  announcementRecipientInitial,
  announcementRecipientSortKey,
  announcementRecipientSearchText,
  foldAnnouncementName,
  type AnnouncementPurposeLink,
  type AnnouncementAudienceRecipient,
} from "../../announcementRecipients";

function user(
  id: string,
  membershipStatus = "REGULAR"
): AnnouncementAudienceRecipient {
  return {
    id,
    firstName: id,
    lastName: "Member",
    email: `${id}@example.com`,
    serviceNumber: `S-${id}`,
    membershipStatus,
  };
}

function link(args: {
  purposes: string[];
  statuses?: string[];
  users?: AnnouncementAudienceRecipient[];
}): AnnouncementPurposeLink {
  return {
    purposes: args.purposes,
    userGroup: {
      id: args.purposes.join("-") || "group",
      membershipStatuses: args.statuses ?? null,
      users: (args.users ?? []).map((member) => ({ user: member })),
    },
  };
}

describe("announcement recipient resolution", () => {
  it("includes explicit ACCESS and MODERATOR members but not unrelated purpose groups", () => {
    const recipients = mergeAnnouncementRecipients(
      [
        link({ purposes: ["ACCESS"], users: [user("access")] }),
        link({ purposes: ["MODERATOR"], users: [user("moderator")] }),
        link({ purposes: ["MEMBER"], users: [user("member-only")] }),
      ],
      []
    );

    expect(recipients.map(({ id }) => id)).toEqual(["access", "moderator"]);
  });

  it("includes status-derived users only when their non-restricted status matches the audience", () => {
    const recipients = mergeAnnouncementRecipients(
      [link({ purposes: ["ACCESS"], statuses: ["REGULAR", "LOST"] })],
      [user("regular", "REGULAR"), user("reserve", "RESERVE"), user("lost", "LOST")]
    );

    expect(recipients.map(({ id }) => id)).toEqual(["regular"]);
  });

  it("deduplicates a user present explicitly and through membership status", () => {
    const overlappingUser = user("overlap", "REGULAR");
    const recipients = mergeAnnouncementRecipients(
      [link({ purposes: ["MODERATOR"], statuses: ["REGULAR"], users: [overlappingUser] })],
      [overlappingUser]
    );

    expect(recipients).toEqual([overlappingUser]);
  });

  it("applies opt-outs equally to explicit and status-derived recipients", () => {
    const explicit = user("explicit");
    const inherited = user("inherited");
    const recipients = mergeAnnouncementRecipients(
      [link({ purposes: ["ACCESS"], statuses: ["REGULAR"], users: [explicit] })],
      [inherited]
    );

    const partitioned = partitionAnnouncementRecipients(
      recipients,
      new Set([explicit.id, inherited.id])
    );

    expect(partitioned.deliverable).toEqual([]);
    expect(partitioned.optedOut.map(({ id }) => id)).toEqual(["explicit", "inherited"]);
  });

  it("applies the global announcement opt-out even without a section opt-out", () => {
    const globallyOptedOut = {
      ...user("global"),
      announcementOptOutAll: true,
    };

    const partitioned = partitionAnnouncementRecipients(
      [globallyOptedOut, user("subscribed")],
      new Set(),
    );

    expect(partitioned.deliverable.map(({ id }) => id)).toEqual(["subscribed"]);
    expect(partitioned.optedOut.map(({ id }) => id)).toEqual(["global"]);
  });

  it("returns an empty audience when no eligible links or users exist", () => {
    expect(mergeAnnouncementRecipients([], [])).toEqual([]);
    expect(
      mergeAnnouncementRecipients(
        [link({ purposes: ["MEMBER"], statuses: ["REGULAR"], users: [user("member-only")] })],
        [user("status-only")]
      )
    ).toEqual([]);
  });

  it("excludes restricted explicit users even if a stale group link remains", () => {
    const recipients = mergeAnnouncementRecipients(
      [link({ purposes: ["ACCESS"], users: [user("resigned", "RESIGNED")] })],
      []
    );

    expect(recipients).toEqual([]);
  });
});

describe("announcement recipient query keys", () => {
  it.each([
    ["Łukasz", "L"],
    ["Øystein", "O"],
    ["Đorđe", "D"],
    ["Ěva", "E"],
    ["Ĺudovít", "L"],
    ["Ċetina", "C"],
    ["Éclair", "E"],
    ["123 Services", "OTHER"],
  ])("buckets %s consistently as %s", (surname, expected) => {
    expect(announcementRecipientInitial(surname)).toBe(expected);
  });

  it("builds accent-folded, numeric-aware sort keys", () => {
    expect(
      announcementRecipientSortKey("Müller 2")
        < announcementRecipientSortKey("Muller 10"),
    ).toBe(true);
    expect(announcementRecipientSortKey("Łukasz")).toBe("lukasz");
    expect(announcementRecipientSortKey(`Agent ${"1".repeat(21)}`))
      .toBe(`agent ${"1".repeat(21)}`);
  });

  it("trims JavaScript Unicode whitespace before folding", () => {
    expect(foldAnnouncementName("\t\u00a0Ěva\ufeff\n")).toBe("eva");
  });

  it("builds the combined multi-word recipient search surface", () => {
    expect(announcementRecipientSearchText({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
    })).toBe("Jane Doe jane@example.com");
  });

  it("keeps the SQL backfill contract in parity with live name folding", () => {
    const migration = fs.readFileSync(path.resolve(
      process.cwd(),
      "..",
      "dataconnect",
      "migrations",
      "2026-08-16-issue-609-announcement-recipient-indexes.sql",
    ), "utf8");
    const sqlFolds = [...migration.matchAll(/ARRAY\['\[([^']+)]', '([^']+)'\]/g)]
      .map((match) => [match[1], match[2]]);
    const javaScriptTrimCodePoints = [
      ...Array.from({ length: 5 }, (_, index) => index + 0x0009),
      0x0020,
      0x00a0,
      0x1680,
      ...Array.from({ length: 11 }, (_, index) => index + 0x2000),
      0x2028,
      0x2029,
      0x202f,
      0x205f,
      0x3000,
      0xfeff,
    ];
    const expectedSqlTrimSet = javaScriptTrimCodePoints
      .map((codePoint) => `\\${codePoint.toString(16).toUpperCase().padStart(4, "0")}`)
      .join("");

    expect(sqlFolds).toEqual(ANNOUNCEMENT_NAME_COMPATIBILITY_FOLDS);
    expect(javaScriptTrimCodePoints.every((codePoint) =>
      String.fromCodePoint(codePoint).trim() === ""
    )).toBe(true);
    expect(migration).toContain(`U&'${expectedSqlTrimSet}'`);
    expect(migration).toContain(
      "search_text = public.announcement_unicode_trim(first_name || ' ' || last_name || ' ' || email)",
    );
    expect(migration).toContain("normalize(public.announcement_unicode_trim(input_value), NFKD)");
    expect(migration).toContain("U&'[\\0300-\\036F]'");
    expect(migration).toContain("RETURN translate(result, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')");
    expect(migration).toContain("length(token_value) < 20");
    expect(migration).not.toMatch(/\blower\s*\(/i);
  });
});
