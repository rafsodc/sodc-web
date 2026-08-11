import { getSectionMembers, listUsers, SectionUserGroupPurpose } from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { getAdminUsers } from "./helpers";

function linkHasPurpose(
  purposes: SectionUserGroupPurpose[] | null | undefined,
  target: SectionUserGroupPurpose
): boolean {
  return purposes?.includes(target) ?? false;
}

/** Resolve deduplicated organiser/admin recipients for booking approval alerts. */
export async function resolveBookingModeratorEmails(args: {
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
  if (!section) return Array.from(emails);

  const moderatorLinks = (section.purposeLinks ?? []).filter((link) =>
    linkHasPurpose(link.purposes, SectionUserGroupPurpose.MODERATOR)
  );
  const statuses = new Set<string>();
  for (const relation of moderatorLinks) {
    const group = relation.userGroup;
    group.membershipStatuses?.forEach((status) => statuses.add(status));
    for (const userGroup of group.users ?? []) {
      const user = userGroup.user;
      if (args.excludeUserId && user.id === args.excludeUserId) continue;
      if (user.email) emails.add(user.email.trim().toLowerCase());
    }
  }

  if (statuses.size > 0) {
    const listResult = await listUsers();
    for (const user of listResult.data?.users ?? []) {
      if (args.excludeUserId && user.id === args.excludeUserId) continue;
      if (statuses.has(user.membershipStatus) && user.email) {
        emails.add(user.email.trim().toLowerCase());
      }
    }
  }

  return Array.from(emails);
}
