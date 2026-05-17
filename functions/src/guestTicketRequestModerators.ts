import { getSectionMembers, listUsers, SectionUserGroupPurpose } from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { getAdminUsers } from "./helpers";

function linkHasPurpose(purposes: SectionUserGroupPurpose[] | null | undefined, target: SectionUserGroupPurpose): boolean {
  return purposes?.includes(target) ?? false;
}

/**
 * Resolves deduped moderator/admin emails for a new guest ticket request.
 * See docs/operations/govuk-notify-guest-ticket-request-templates.md.
 */
export async function resolveGuestTicketModeratorEmails(args: {
  sectionId: UUIDString;
  excludeUserId?: string;
}): Promise<string[]> {
  const emails = new Set<string>();

  const admins = await getAdminUsers();
  for (const adminUser of admins) {
    if (!adminUser.email) continue;
    if (args.excludeUserId && adminUser.uid === args.excludeUserId) continue;
    emails.add(adminUser.email.trim().toLowerCase());
  }

  const sectionResult = await getSectionMembers({ sectionId: args.sectionId });
  const section = sectionResult.data?.section;
  if (!section) {
    return Array.from(emails);
  }

  const moderatorLinks = (section.purposeLinks ?? []).filter((pl) =>
    linkHasPurpose(pl.purposes, SectionUserGroupPurpose.MODERATOR)
  );

  const statuses = new Set<string>();
  for (const rel of moderatorLinks) {
    const group = rel.userGroup;
    group.membershipStatuses?.forEach((s) => statuses.add(s));
    for (const uag of group.users ?? []) {
      const u = uag.user;
      if (args.excludeUserId && u.id === args.excludeUserId) continue;
      if (u.email) {
        emails.add(u.email.trim().toLowerCase());
      }
    }
  }

  if (statuses.size > 0) {
    const listResult = await listUsers();
    for (const u of listResult.data?.users ?? []) {
      if (args.excludeUserId && u.id === args.excludeUserId) continue;
      if (statuses.has(u.membershipStatus) && u.email) {
        emails.add(u.email.trim().toLowerCase());
      }
    }
  }

  return Array.from(emails);
}
