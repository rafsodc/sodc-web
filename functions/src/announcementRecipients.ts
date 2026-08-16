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
  announcementOptOutAll?: boolean | null;
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

export const ANNOUNCEMENT_FAILURE_CATEGORY_NONE = "none";
export const ANNOUNCEMENT_FAILURE_CATEGORY_NOTIFY_TEAM_ONLY = "notify_team_only";

export function isNotifyTeamOnlyFailure(reason: string | null | undefined): boolean {
  return typeof reason === "string" && /team-only api key/i.test(reason);
}

export function announcementFailureCategory(reason: string | null | undefined): string {
  return isNotifyTeamOnlyFailure(reason)
    ? ANNOUNCEMENT_FAILURE_CATEGORY_NOTIFY_TEAM_ONLY
    : ANNOUNCEMENT_FAILURE_CATEGORY_NONE;
}

export const ANNOUNCEMENT_NAME_COMPATIBILITY_FOLDS: ReadonlyArray<readonly [string, string]> = [
  ["Ææ", "ae"],
  ["ÐðĐđ", "d"],
  ["Ħħ", "h"],
  ["ı", "i"],
  ["Łł", "l"],
  ["Œœ", "oe"],
  ["Øø", "o"],
  ["ßẞ", "ss"],
  ["Ŧŧ", "t"],
  ["Þþ", "th"],
];
const ANNOUNCEMENT_NAME_FOLD_MAP = new Map<string, string>(
  ANNOUNCEMENT_NAME_COMPATIBILITY_FOLDS.flatMap(([characters, replacement]) =>
    [...characters].map((character) => [character, replacement] as const)
  ),
);

export function foldAnnouncementName(value: string): string {
  return [...value.trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")]
    .map((character) => ANNOUNCEMENT_NAME_FOLD_MAP.get(character) ?? character)
    .join("")
    .replace(/[A-Z]/g, (character) => character.toLowerCase());
}

export function announcementRecipientInitial(lastName: string): string {
  const initial = foldAnnouncementName(lastName).charAt(0).toUpperCase();
  return /^[A-Z]$/.test(initial) ? initial : "OTHER";
}

export function announcementRecipientSortKey(value: string): string {
  return foldAnnouncementName(value).replace(/\d+/g, (digits) => digits.padStart(20, "0"));
}

export function announcementRecipientSearchText(recipient: {
  firstName: string;
  lastName: string;
  email: string;
}): string {
  return `${recipient.firstName} ${recipient.lastName} ${recipient.email}`.trim();
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

/** Applies the global master preference and section opt-outs after audiences are merged. */
export function partitionAnnouncementRecipients(
  recipients: readonly AnnouncementAudienceRecipient[],
  optedOutUserIds: ReadonlySet<string>
): { deliverable: AnnouncementAudienceRecipient[]; optedOut: AnnouncementAudienceRecipient[] } {
  const deliverable: AnnouncementAudienceRecipient[] = [];
  const optedOut: AnnouncementAudienceRecipient[] = [];

  for (const recipient of recipients) {
    (
      recipient.announcementOptOutAll === true || optedOutUserIds.has(recipient.id)
        ? optedOut
        : deliverable
    ).push(recipient);
  }

  return { deliverable, optedOut };
}
