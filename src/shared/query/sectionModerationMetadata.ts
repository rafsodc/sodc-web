import { queryRef, type DataConnect } from "firebase/data-connect";

/** Contract implemented with #646. This narrow operation exposes names of groups
 * already linked to this section or its ticket types, never global group metadata. */
export function listSectionTicketAccessGroupsRef(
  dc: DataConnect,
  variables: { sectionId: string },
) {
  return queryRef<
    { userGroups: Array<{ id: string; name: string }> },
    { sectionId: string }
  >(dc, "ListSectionTicketAccessGroups", variables);
}
