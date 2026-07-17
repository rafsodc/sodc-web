import { httpsCallable } from "firebase/functions";
import type { GetEventByIdData, GetEventsForSectionData, GetSectionByIdData } from "@dataconnect/generated";
import { functions } from "../../../config/firebase";

export interface GetSectionMembersMergedRequest {
  sectionId: string;
}

export interface GetSectionMembersMergedMember {
  id: string;
  firstName: string;
  lastName: string;
  membershipStatus: string;
  rank: string | null;
  sharesContactInfo: boolean;
  /** Null whenever sharesContactInfo is false — withheld server-side, not just hidden client-side. */
  email: string | null;
}

export interface GetSectionMembersMergedResponse {
  members: GetSectionMembersMergedMember[];
}

/**
 * Returns merged section members (explicit + inherited by status). Requires view permission.
 */
export async function getSectionMembersMerged(
  sectionId: string
): Promise<GetSectionMembersMergedResponse> {
  const callable = httpsCallable<
    GetSectionMembersMergedRequest,
    GetSectionMembersMergedResponse
  >(functions, "getSectionMembersMerged");
  const result = await callable({ sectionId });
  return result.data;
}

// ============================================================================
// Section/event lookup (callable — GetSectionById/GetEventsForSection/GetEventById
// are admin-only in Data Connect since they accept an arbitrary id with no relationship
// check; these callables are the only path a non-admin member has to that data, and they
// verify the caller's actual section access server-side first)
// ============================================================================

export interface SectionForUserResponse {
  section: NonNullable<GetSectionByIdData["section"]> | null;
  hasAccess: boolean;
  canModerate: boolean;
}

export async function getSectionForUser(sectionId: string): Promise<SectionForUserResponse> {
  const callable = httpsCallable<{ sectionId: string }, SectionForUserResponse>(
    functions,
    "getSectionForUser"
  );
  const result = await callable({ sectionId });
  return result.data;
}

export interface SectionEventsForUserResponse {
  events: NonNullable<GetEventsForSectionData["section"]>["events"];
}

export async function getSectionEventsForUser(sectionId: string): Promise<SectionEventsForUserResponse> {
  const callable = httpsCallable<{ sectionId: string }, SectionEventsForUserResponse>(
    functions,
    "getSectionEventsForUser"
  );
  const result = await callable({ sectionId });
  return result.data;
}

export interface EventForUserResponse {
  event: NonNullable<GetEventByIdData["event"]> | null;
}

export async function getEventForUser(eventId: string): Promise<EventForUserResponse> {
  const callable = httpsCallable<{ eventId: string }, EventForUserResponse>(
    functions,
    "getEventForUser"
  );
  const result = await callable({ eventId });
  return result.data;
}
