import type { GetUserGroupByIdData, MembershipStatus } from "@dataconnect/generated";

export interface UserGroupWithDetails {
  id: string;
  name: string;
  description?: string | null;
  membershipStatuses?: MembershipStatus[] | null;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  sectionCount?: number;
}

export type UserGroupDetails = NonNullable<GetUserGroupByIdData["userGroup"]>;

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  membershipStatus: MembershipStatus;
}

export type UserSearchResult = UserSummary;

export type MergedUser = UserSummary & {
  isExplicit: boolean;
};

export interface SectionWithPurpose {
  section: { id: string; name: string; type: string; description?: string | null };
  purpose: string;
}
