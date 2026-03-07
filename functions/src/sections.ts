import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { requireAuth, requireString, handleFunctionError } from "./helpers";
import {
  getSectionById,
  getSectionMembers,
  getUserAccessGroupsById,
  getUserMembershipStatus,
  listUsers,
} from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";

export interface SectionMemberResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  membershipStatus: string;
}

/**
 * Returns merged section members (explicit UserAccessGroup + inherited by membership status).
 * Caller must have VIEW or MEMBER access to the section (so both can open the section and load this data).
 */
export const getSectionMembersMerged = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    requireAuth(request);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const callerUid = request.auth!.uid;

    try {
      const [sectionResult, membersResult, callerGroupsResult, userStatusResult] = await Promise.all([
        getSectionById({ id: sectionId }),
        getSectionMembers({ sectionId }),
        getUserAccessGroupsById({ userId: callerUid }),
        getUserMembershipStatus({ id: callerUid }),
      ]);

      const section = sectionResult.data?.section;
      if (!section) {
        throw new HttpsError("not-found", "Section not found");
      }

      const viewingGroupIds = new Set(
        (section.viewingAccessGroups || []).map((vg: { accessGroup: { id: string } }) => vg.accessGroup.id)
      );
      const memberGroupIds = new Set(
        (section.memberAccessGroups || []).map((mg: { accessGroup: { id: string } }) => mg.accessGroup.id)
      );
      const callerGroupIds = new Set(
        (callerGroupsResult.data?.user?.accessGroups || []).map(
          (ag: { accessGroup: { id: string } }) => ag.accessGroup.id
        )
      );
      const canView = [...viewingGroupIds].some((id) => callerGroupIds.has(id));
      const canMember = [...memberGroupIds].some((id) => callerGroupIds.has(id));

      // Allow access by membership status when user has no explicit group but their status matches a member group
      let canMemberByStatus = false;
      if (!canView && !canMember) {
        const sectionData = membersResult.data?.section;
        const userStatus = userStatusResult.data?.user?.membershipStatus;
        if (sectionData?.memberAccessGroups?.length && userStatus) {
          canMemberByStatus = sectionData.memberAccessGroups.some(
            (rel) => rel.accessGroup.membershipStatuses?.includes(userStatus) ?? false
          );
        }
      }

      if (!canView && !canMember && !canMemberByStatus) {
        throw new HttpsError("permission-denied", "You do not have permission to view this section");
      }

      const sectionData = membersResult.data?.section;
      if (!sectionData) {
        return { members: [] };
      }

      const memberGroups =
        sectionData.memberAccessGroups?.length > 0
          ? sectionData.memberAccessGroups
          : sectionData.viewingAccessGroups || [];
      const statuses = new Set<string>();
      const explicitMap = new Map<string, SectionMemberResponse>();

      for (const rel of memberGroups) {
        const group = (rel as { accessGroup: { membershipStatuses?: string[]; users: Array<{ user: SectionMemberResponse }> } }).accessGroup;
        if (group.membershipStatuses) {
          group.membershipStatuses.forEach((s: string) => statuses.add(s));
        }
        for (const uag of group.users || []) {
          const u = uag.user;
          if (!explicitMap.has(u.id)) {
            explicitMap.set(u.id, {
              id: u.id,
              firstName: u.firstName,
              lastName: u.lastName,
              email: u.email,
              membershipStatus: u.membershipStatus,
            });
          }
        }
      }

      if (statuses.size === 0) {
        return { members: Array.from(explicitMap.values()) };
      }

      const listResult = await listUsers();
      const users = listResult.data?.users || [];
      for (const u of users) {
        if (statuses.has(u.membershipStatus) && !explicitMap.has(u.id)) {
          explicitMap.set(u.id, {
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            membershipStatus: u.membershipStatus,
          });
        }
      }

      const members = Array.from(explicitMap.values());
      logger.info(`getSectionMembersMerged: sectionId=${sectionId}, caller=${callerUid}, count=${members.length}`);
      return { members };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      handleFunctionError(e as Error, "getSectionMembersMerged");
    }
  }
);
