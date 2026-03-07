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
 * Returns merged section members (explicit UserUserGroup + inherited by membership status).
 * Caller must have ACCESS or MEMBER to the section (so both can open the section and load this data).
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

      const accessGroupIds = new Set(
        (section.accessGroups || []).map((ag: { userGroup: { id: string } }) => ag.userGroup.id)
      );
      const memberGroupIds = new Set(
        (section.memberGroups || []).map((mg: { userGroup: { id: string } }) => mg.userGroup.id)
      );
      const callerGroupIds = new Set(
        (callerGroupsResult.data?.user?.userGroups || []).map(
          (ug: { userGroup: { id: string } }) => ug.userGroup.id
        )
      );
      const canAccess = [...accessGroupIds].some((id) => callerGroupIds.has(id));
      const canMember = [...memberGroupIds].some((id) => callerGroupIds.has(id));

      // Allow access by membership status when user has no explicit group but their status matches a member group
      let canMemberByStatus = false;
      if (!canAccess && !canMember) {
        const sectionData = membersResult.data?.section;
        const userStatus = userStatusResult.data?.user?.membershipStatus;
        if (sectionData?.memberGroups?.length && userStatus) {
          canMemberByStatus = sectionData.memberGroups.some(
            (rel) => rel.userGroup.membershipStatuses?.includes(userStatus) ?? false
          );
        }
      }

      if (!canAccess && !canMember && !canMemberByStatus) {
        throw new HttpsError("permission-denied", "You do not have permission to view this section");
      }

      const sectionData = membersResult.data?.section;
      if (!sectionData) {
        return { members: [] };
      }

      const memberGroups =
        sectionData.memberGroups?.length > 0
          ? sectionData.memberGroups
          : sectionData.accessGroups || [];
      const statuses = new Set<string>();
      const explicitMap = new Map<string, SectionMemberResponse>();

      for (const rel of memberGroups) {
        const group = (rel as { userGroup: { membershipStatuses?: string[]; users: Array<{ user: SectionMemberResponse }> } }).userGroup;
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
