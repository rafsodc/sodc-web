import { HttpsError } from "firebase-functions/v2/https";
import {
  getSectionById,
  getUserAccessGroupsById,
  getUserMembershipStatus,
  type GetSectionByIdData,
} from "@dataconnect/admin-generated";

export interface SectionAccess {
  section: NonNullable<GetSectionByIdData["section"]>;
  hasAccess: boolean;
  canModerate: boolean;
}

export function linkHasPurpose(
  link: { purpose?: string; purposes?: string[] | null },
  target: string,
): boolean {
  return link.purpose === target || (link.purposes?.includes(target) ?? false);
}

export async function resolveSectionAccess(
  sectionId: string,
  callerUid: string,
): Promise<SectionAccess> {
  const [sectionResult, callerGroupsResult, userStatusResult] = await Promise.all([
    getSectionById({ id: sectionId }),
    getUserAccessGroupsById({ userId: callerUid }),
    getUserMembershipStatus({ id: callerUid }),
  ]);

  const section = sectionResult.data?.section;
  if (!section) {
    throw new HttpsError("not-found", "Resource not found");
  }

  const purposeLinks = section.purposeLinks ?? [];
  const callerGroupIds = new Set(
    (callerGroupsResult.data?.user?.userGroups ?? []).map(
      (ug: { userGroup: { id: string } }) => ug.userGroup.id,
    ),
  );
  const userStatus = userStatusResult.data?.user?.membershipStatus;
  const matchesPurpose = (target: string) =>
    purposeLinks.some((link) => {
      if (!linkHasPurpose(link, target)) return false;
      if (callerGroupIds.has(link.userGroup.id)) return true;
      return userStatus
        ? (link.userGroup.membershipStatuses?.includes(userStatus) ?? false)
        : false;
    });

  const canModerate = matchesPurpose("MODERATOR");
  return {
    section,
    canModerate,
    hasAccess: canModerate || matchesPurpose("ACCESS"),
  };
}

export async function requireSectionAccess(
  sectionId: string,
  callerUid: string,
  callerIsAdmin: boolean,
): Promise<SectionAccess> {
  const access = await resolveSectionAccess(sectionId, callerUid);
  if (!callerIsAdmin && !access.hasAccess) {
    throw new HttpsError("not-found", "Resource not found");
  }
  return access;
}

export async function requireSectionModerator(
  sectionId: string,
  callerUid: string,
  callerIsAdmin: boolean,
): Promise<SectionAccess> {
  const access = await resolveSectionAccess(sectionId, callerUid);
  if (!callerIsAdmin && !access.canModerate) {
    throw new HttpsError("not-found", "Resource not found");
  }
  return access;
}
