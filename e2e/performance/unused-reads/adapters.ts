// Deliberately inert adapters: this component probe never imports Firebase/config.
export const auth = { currentUser: { uid: "synthetic-probe" } };
export const dataConnect = {};
export const MembershipStatus = { REGULAR: "REGULAR" };
export const SectionType = { EVENTS: "EVENTS", MEMBERS: "MEMBERS" };
export const SectionUserGroupPurpose = { ACCESS: "ACCESS", MODERATOR: "MODERATOR", MEMBER: "MEMBER" };
const access = { data: { user: { membershipStatus: "REGULAR", userGroups: [] }, allUserGroups: [] }, isLoading: false };
export const useGetUserAccessGroups = () => access;
export const useGetSectionsForUser = () => access;
export const invalidateUserSectionAccess = async () => {};
export const reportError = (_scope: string, error: unknown) => { globalThis.probe.errors.push(String(error)); };
const noWrites = () => { throw new Error("Writes are forbidden in the local read probe"); };
export const executeDataConnectMutation = noWrites;
export const subscribeToUserGroup = noWrites;
export const unsubscribeFromUserGroupRef = noWrites;

async function read(operation: string, id: string, options: { content?: string; eventId?: string } = {}) {
  globalThis.probe.inFlight++;
  try {
    const parameters = new URLSearchParams({ id, phase: globalThis.probe.phase, ...options });
    const response = await fetch(`/__probe/${operation}?${parameters}`);
    if (!response.ok) throw new Error(`Local probe HTTP ${response.status}`);
    return await response.json();
  } finally { globalThis.probe.inFlight--; }
}
export const getSectionForUser = (id: string, options?: { content: "SECTION" | "EVENT"; eventId?: string }) => read("getSectionForUser", id, options);
export const getSectionEventsForUser = (id: string) => read("getSectionEventsForUser", id);
export const getSectionMembersMerged = (id: string) => read("getSectionMembersMerged", id);
export const getEventForUser = (id: string) => read("getEventForUser", id);
