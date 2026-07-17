import { describe, expect, it } from "vitest";
import {
  mergeAnnouncementRecipients,
  partitionAnnouncementRecipients,
  type AnnouncementPurposeLink,
  type AnnouncementAudienceRecipient,
} from "../announcementRecipients";

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
