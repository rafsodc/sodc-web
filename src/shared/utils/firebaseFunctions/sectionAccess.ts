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
  /** Null whenever sharesContactInfo is false or no number is stored. */
  mobileNumber?: string | null;
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

export interface SearchSectionMembersRequest {
  sectionId: string;
  searchTerm: string;
  includeIds?: string[];
}

export interface SearchSectionMembersMember {
  id: string;
  firstName: string;
  lastName: string;
}

export interface SearchSectionMembersResponse {
  members: SearchSectionMembersMember[];
  /** Search is deliberately cursorless; refine the typeahead when more matches exist. */
  hasMore: boolean;
}

/**
 * Typeahead search over a section's eligible population (name match, capped result set) —
 * for pickers like the booking wizard's "sit next to" field, where a section's full member
 * list can run into the hundreds and is too large for a plain dropdown. `includeIds` are
 * always resolved and returned regardless of match, so already-selected people (e.g. from an
 * existing booking being edited) can be labelled without needing to reappear in a search.
 */
export async function searchSectionMembers(
  sectionId: string,
  searchTerm: string,
  includeIds?: string[]
): Promise<SearchSectionMembersResponse> {
  const callable = httpsCallable<SearchSectionMembersRequest, SearchSectionMembersResponse>(
    functions,
    "searchSectionMembers"
  );
  const result = await callable({ sectionId, searchTerm, includeIds });
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
