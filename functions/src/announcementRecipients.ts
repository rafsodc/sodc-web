import {
  isNonRestrictedStatus,
  type MembershipStatus,
} from "./validation";

export interface AnnouncementAudienceRecipient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  membershipStatus: string;
}

export interface AnnouncementPurposeLink {
  purpose?: string;
  purposes?: readonly string[] | null;
  userGroup: {
    id: string;
    membershipStatuses?: readonly string[] | null;
    users?: readonly { user: AnnouncementAudienceRecipient }[] | null;
  };
}

function linkHasAudiencePurpose(link: AnnouncementPurposeLink): boolean {
  const purposes = link.purposes ?? (link.purpose ? [link.purpose] : []);
  return purposes.includes("ACCESS") || purposes.includes("MODERATOR");
}

function isEligibleRecipientStatus(status: string): boolean {
  return isNonRestrictedStatus(status as MembershipStatus);
}

/**
 * Returns the non-restricted membership statuses that inherit an announcement
 * audience through an ACCESS or MODERATOR group.
 */
export function getAnnouncementStatusFilters(
  purposeLinks: readonly AnnouncementPurposeLink[]
): Set<string> {
  const statuses = new Set<string>();

  for (const link of purposeLinks) {
    if (!linkHasAudiencePurpose(link)) continue;
    for (const status of link.userGroup.membershipStatuses ?? []) {
      if (isEligibleRecipientStatus(status)) statuses.add(status);
    }
  }

  return statuses;
}

/**
 * Merges explicit ACCESS/MODERATOR group users with users inherited through
 * those groups' membershipStatuses. Explicit users win when a user appears in
 * both sources, and restricted users are excluded from either source.
 */
export function mergeAnnouncementRecipients(
  purposeLinks: readonly AnnouncementPurposeLink[],
  statusCandidates: readonly AnnouncementAudienceRecipient[]
): AnnouncementAudienceRecipient[] {
  const statusFilters = getAnnouncementStatusFilters(purposeLinks);
  const recipients = new Map<string, AnnouncementAudienceRecipient>();

  const addRecipient = (user: AnnouncementAudienceRecipient) => {
    if (!isEligibleRecipientStatus(user.membershipStatus)) return;
    if (!recipients.has(user.id)) recipients.set(user.id, user);
  };

  for (const link of purposeLinks) {
    if (!linkHasAudiencePurpose(link)) continue;
    for (const { user } of link.userGroup.users ?? []) addRecipient(user);
  }

  for (const user of statusCandidates) {
    if (statusFilters.has(user.membershipStatus)) addRecipient(user);
  }

  return [...recipients.values()];
}

/** Applies the same section opt-out set after explicit and inherited users are merged. */
export function partitionAnnouncementRecipients(
  recipients: readonly AnnouncementAudienceRecipient[],
  optedOutUserIds: ReadonlySet<string>
): { deliverable: AnnouncementAudienceRecipient[]; optedOut: AnnouncementAudienceRecipient[] } {
  const deliverable: AnnouncementAudienceRecipient[] = [];
  const optedOut: AnnouncementAudienceRecipient[] = [];

  for (const recipient of recipients) {
    (optedOutUserIds.has(recipient.id) ? optedOut : deliverable).push(recipient);
  }

  return { deliverable, optedOut };
}
