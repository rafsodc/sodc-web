import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;

export enum MembershipStatus {
  PENDING = "PENDING",
  REGULAR = "REGULAR",
  RESERVE = "RESERVE",
  CIVIL_SERVICE = "CIVIL_SERVICE",
  INDUSTRY = "INDUSTRY",
  RETIRED = "RETIRED",
  RESIGNED = "RESIGNED",
  LOST = "LOST",
  DECEASED = "DECEASED",
}
export enum SectionType {
  MEMBERS = "MEMBERS",
  EVENTS = "EVENTS",
}

export interface AccessGroup_Key {
  id: UUIDString;
  __typename?: 'AccessGroup_Key';
}

export interface AddUserToAccessGroupAdminData {
  userAccessGroup_upsert: UserAccessGroup_Key;
}

export interface AddUserToAccessGroupAdminVariables {
  userId: string;
  accessGroupId: UUIDString;
  now: TimestampString;
}

export interface AddUserToAccessGroupData {
  userAccessGroup_upsert: UserAccessGroup_Key;
}

export interface AddUserToAccessGroupVariables {
  userId: string;
  accessGroupId: UUIDString;
}

export interface CheckUserProfileExistsData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    membershipStatus: MembershipStatus;
  } & User_Key;
}

export interface CreateAccessGroupAdminData {
  accessGroup_insert: AccessGroup_Key;
}

export interface CreateAccessGroupAdminVariables {
  name: string;
  description?: string | null;
  now: TimestampString;
}

export interface CreateAccessGroupData {
  accessGroup_insert: AccessGroup_Key;
}

export interface CreateAccessGroupVariables {
  name: string;
  description?: string | null;
  membershipStatuses?: MembershipStatus[] | null;
}

export interface CreateSectionData {
  section_insert: Section_Key;
}

export interface CreateSectionVariables {
  name: string;
  type: SectionType;
  description?: string | null;
}

export interface CreateUserData {
  user_upsert: User_Key;
}

export interface CreateUserProfileData {
  user_upsert: User_Key;
}

export interface CreateUserProfileVariables {
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  requestedMembershipStatus: MembershipStatus;
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
}

export interface CreateUserVariables {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  membershipStatus: MembershipStatus;
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
  now: TimestampString;
}

export interface DeleteAccessGroupData {
  accessGroup_delete?: AccessGroup_Key | null;
}

export interface DeleteAccessGroupVariables {
  id: UUIDString;
}

export interface DeleteUserData {
  user_delete?: User_Key | null;
}

export interface DeleteUserVariables {
  userId: string;
}

export interface GetAccessGroupByIdData {
  accessGroup?: {
    id: UUIDString;
    name: string;
    description?: string | null;
    membershipStatuses?: MembershipStatus[] | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy?: string | null;
    updatedBy?: string | null;
    users: ({
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        membershipStatus: MembershipStatus;
      } & User_Key;
    })[];
      sections: ({
        section: {
          id: UUIDString;
          name: string;
          type: SectionType;
          description?: string | null;
        } & Section_Key;
      })[];
  } & AccessGroup_Key;
}

export interface GetAccessGroupByIdVariables {
  id: UUIDString;
}

export interface GetAccessGroupByNameData {
  accessGroups: ({
    id: UUIDString;
    name: string;
    description?: string | null;
  } & AccessGroup_Key)[];
}

export interface GetAccessGroupByNameVariables {
  name: string;
}

export interface GetAllAccessGroupsWithStatusesData {
  accessGroups: ({
    id: UUIDString;
    name: string;
    membershipStatuses?: MembershipStatus[] | null;
  } & AccessGroup_Key)[];
}

export interface GetCurrentUserData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    membershipStatus: MembershipStatus;
    requestedMembershipStatus?: MembershipStatus | null;
    isRegular?: boolean | null;
    isReserve?: boolean | null;
    isCivilServant?: boolean | null;
    isIndustry?: boolean | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & User_Key;
}

export interface GetSectionByIdData {
  section?: {
    id: UUIDString;
    name: string;
    type: SectionType;
    description?: string | null;
    isOpenForRegistration?: boolean | null;
    allowedAccessGroups?: UUIDString[] | null;
    accessGroups: ({
      accessGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
      } & AccessGroup_Key;
    })[];
  } & Section_Key;
}

export interface GetSectionByIdVariables {
  id: UUIDString;
}

export interface GetSectionsForUserData {
  user?: {
    id: string;
    accessGroups: ({
      accessGroup: {
        id: UUIDString;
        name: string;
        sections: ({
          section: {
            id: UUIDString;
            name: string;
            type: SectionType;
            description?: string | null;
          } & Section_Key;
        })[];
      } & AccessGroup_Key;
    })[];
  } & User_Key;
}

export interface GetUserAccessGroupsByIdData {
  user?: {
    id: string;
    accessGroups: ({
      accessGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
      } & AccessGroup_Key;
    })[];
  } & User_Key;
}

export interface GetUserAccessGroupsByIdVariables {
  userId: string;
}

export interface GetUserAccessGroupsData {
  user?: {
    id: string;
    accessGroups: ({
      accessGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
      } & AccessGroup_Key;
    })[];
  } & User_Key;
}

export interface GetUserAccessGroupsForAdminData {
  user?: {
    id: string;
    accessGroups: ({
      accessGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
      } & AccessGroup_Key;
    })[];
  } & User_Key;
}

export interface GetUserAccessGroupsForAdminVariables {
  userId: string;
}

export interface GetUserByIdData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    membershipStatus: MembershipStatus;
    requestedMembershipStatus?: MembershipStatus | null;
    isRegular?: boolean | null;
    isReserve?: boolean | null;
    isCivilServant?: boolean | null;
    isIndustry?: boolean | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy?: string | null;
    updatedBy?: string | null;
  } & User_Key;
}

export interface GetUserByIdVariables {
  id: string;
}

export interface GetUserMembershipStatusData {
  user?: {
    membershipStatus: MembershipStatus;
  };
}

export interface GetUserMembershipStatusVariables {
  id: string;
}

export interface GetUserWithAccessGroupsData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    membershipStatus: MembershipStatus;
    accessGroups: ({
      accessGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
        membershipStatuses?: MembershipStatus[] | null;
      } & AccessGroup_Key;
    })[];
  } & User_Key;
}

export interface GetUserWithAccessGroupsVariables {
  id: string;
}

export interface GrantAccessGroupToSectionData {
  sectionAccessGroup_upsert: SectionAccessGroup_Key;
}

export interface GrantAccessGroupToSectionVariables {
  sectionId: UUIDString;
  accessGroupId: UUIDString;
}

export interface ListAccessGroupsData {
  accessGroups: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    membershipStatuses?: MembershipStatus[] | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy?: string | null;
    updatedBy?: string | null;
  } & AccessGroup_Key)[];
}

export interface ListSectionsData {
  sections: ({
    id: UUIDString;
    name: string;
    type: SectionType;
    description?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy?: string | null;
    updatedBy?: string | null;
  } & Section_Key)[];
}

export interface ListUsersData {
  users: ({
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    membershipStatus: MembershipStatus;
    requestedMembershipStatus?: MembershipStatus | null;
    isRegular?: boolean | null;
    isReserve?: boolean | null;
    isCivilServant?: boolean | null;
    isIndustry?: boolean | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy?: string | null;
    updatedBy?: string | null;
  } & User_Key)[];
}

export interface RegisterForSectionData {
  userAccessGroup_upsert: UserAccessGroup_Key;
}

export interface RegisterForSectionVariables {
  accessGroupId: UUIDString;
}

export interface RemoveUserFromAccessGroupAdminData {
  userAccessGroup_delete?: UserAccessGroup_Key | null;
}

export interface RemoveUserFromAccessGroupAdminVariables {
  userId: string;
  accessGroupId: UUIDString;
}

export interface RemoveUserFromAccessGroupData {
  userAccessGroup_delete?: UserAccessGroup_Key | null;
}

export interface RemoveUserFromAccessGroupVariables {
  userId: string;
  accessGroupId: UUIDString;
}

export interface RevokeAccessGroupFromSectionData {
  sectionAccessGroup_delete?: SectionAccessGroup_Key | null;
}

export interface RevokeAccessGroupFromSectionVariables {
  sectionId: UUIDString;
  accessGroupId: UUIDString;
}

export interface SectionAccessGroup_Key {
  sectionId: UUIDString;
  accessGroupId: UUIDString;
  __typename?: 'SectionAccessGroup_Key';
}

export interface Section_Key {
  id: UUIDString;
  __typename?: 'Section_Key';
}

export interface UnregisterFromSectionData {
  userAccessGroup_delete?: UserAccessGroup_Key | null;
}

export interface UnregisterFromSectionVariables {
  accessGroupId: UUIDString;
}

export interface UpdateAccessGroupData {
  accessGroup_update?: AccessGroup_Key | null;
}

export interface UpdateAccessGroupVariables {
  id: UUIDString;
  name: string;
  description?: string | null;
  membershipStatuses?: MembershipStatus[] | null;
}

export interface UpdateUserData {
  user_upsert: User_Key;
}

export interface UpdateUserMembershipStatusData {
  user_update?: User_Key | null;
}

export interface UpdateUserMembershipStatusVariables {
  userId: string;
  membershipStatus: MembershipStatus;
}

export interface UpdateUserVariables {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
}

export interface UpsertUserData {
  user_upsert: User_Key;
}

export interface UpsertUserVariables {
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
}

export interface UserAccessGroup_Key {
  userId: string;
  accessGroupId: UUIDString;
  __typename?: 'UserAccessGroup_Key';
}

export interface User_Key {
  id: string;
  __typename?: 'User_Key';
}

/** Generated Node Admin SDK operation action function for the 'UpdateUserMembershipStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUserMembershipStatus(dc: DataConnect, vars: UpdateUserMembershipStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserMembershipStatusData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUserMembershipStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUserMembershipStatus(vars: UpdateUserMembershipStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserMembershipStatusData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteUser' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteUser(dc: DataConnect, vars: DeleteUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteUser(vars: DeleteUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserData>>;

/** Generated Node Admin SDK operation action function for the 'CreateUser' Mutation. Allow users to execute without passing in DataConnect. */
export function createUser(dc: DataConnect, vars: CreateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserData>>;
/** Generated Node Admin SDK operation action function for the 'CreateUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function createUser(vars: CreateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAccessGroupAdmin' Mutation. Allow users to execute without passing in DataConnect. */
export function createAccessGroupAdmin(dc: DataConnect, vars: CreateAccessGroupAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAccessGroupAdminData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAccessGroupAdmin' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAccessGroupAdmin(vars: CreateAccessGroupAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAccessGroupAdminData>>;

/** Generated Node Admin SDK operation action function for the 'AddUserToAccessGroupAdmin' Mutation. Allow users to execute without passing in DataConnect. */
export function addUserToAccessGroupAdmin(dc: DataConnect, vars: AddUserToAccessGroupAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddUserToAccessGroupAdminData>>;
/** Generated Node Admin SDK operation action function for the 'AddUserToAccessGroupAdmin' Mutation. Allow users to pass in custom DataConnect instances. */
export function addUserToAccessGroupAdmin(vars: AddUserToAccessGroupAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddUserToAccessGroupAdminData>>;

/** Generated Node Admin SDK operation action function for the 'RemoveUserFromAccessGroupAdmin' Mutation. Allow users to execute without passing in DataConnect. */
export function removeUserFromAccessGroupAdmin(dc: DataConnect, vars: RemoveUserFromAccessGroupAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemoveUserFromAccessGroupAdminData>>;
/** Generated Node Admin SDK operation action function for the 'RemoveUserFromAccessGroupAdmin' Mutation. Allow users to pass in custom DataConnect instances. */
export function removeUserFromAccessGroupAdmin(vars: RemoveUserFromAccessGroupAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemoveUserFromAccessGroupAdminData>>;

/** Generated Node Admin SDK operation action function for the 'GetAccessGroupByName' Query. Allow users to execute without passing in DataConnect. */
export function getAccessGroupByName(dc: DataConnect, vars: GetAccessGroupByNameVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAccessGroupByNameData>>;
/** Generated Node Admin SDK operation action function for the 'GetAccessGroupByName' Query. Allow users to pass in custom DataConnect instances. */
export function getAccessGroupByName(vars: GetAccessGroupByNameVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAccessGroupByNameData>>;

/** Generated Node Admin SDK operation action function for the 'GetUserAccessGroupsForAdmin' Query. Allow users to execute without passing in DataConnect. */
export function getUserAccessGroupsForAdmin(dc: DataConnect, vars: GetUserAccessGroupsForAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserAccessGroupsForAdminData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserAccessGroupsForAdmin' Query. Allow users to pass in custom DataConnect instances. */
export function getUserAccessGroupsForAdmin(vars: GetUserAccessGroupsForAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserAccessGroupsForAdminData>>;

/** Generated Node Admin SDK operation action function for the 'GetCurrentUser' Query. Allow users to execute without passing in DataConnect. */
export function getCurrentUser(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCurrentUserData>>;
/** Generated Node Admin SDK operation action function for the 'GetCurrentUser' Query. Allow users to pass in custom DataConnect instances. */
export function getCurrentUser(options?: OperationOptions): Promise<ExecuteOperationResponse<GetCurrentUserData>>;

/** Generated Node Admin SDK operation action function for the 'GetUserById' Query. Allow users to execute without passing in DataConnect. */
export function getUserById(dc: DataConnect, vars: GetUserByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserById' Query. Allow users to pass in custom DataConnect instances. */
export function getUserById(vars: GetUserByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserByIdData>>;

/** Generated Node Admin SDK operation action function for the 'ListUsers' Query. Allow users to execute without passing in DataConnect. */
export function listUsers(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListUsersData>>;
/** Generated Node Admin SDK operation action function for the 'ListUsers' Query. Allow users to pass in custom DataConnect instances. */
export function listUsers(options?: OperationOptions): Promise<ExecuteOperationResponse<ListUsersData>>;

/** Generated Node Admin SDK operation action function for the 'ListSections' Query. Allow users to execute without passing in DataConnect. */
export function listSections(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSectionsData>>;
/** Generated Node Admin SDK operation action function for the 'ListSections' Query. Allow users to pass in custom DataConnect instances. */
export function listSections(options?: OperationOptions): Promise<ExecuteOperationResponse<ListSectionsData>>;

/** Generated Node Admin SDK operation action function for the 'GetSectionsForUser' Query. Allow users to execute without passing in DataConnect. */
export function getSectionsForUser(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionsForUserData>>;
/** Generated Node Admin SDK operation action function for the 'GetSectionsForUser' Query. Allow users to pass in custom DataConnect instances. */
export function getSectionsForUser(options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionsForUserData>>;

/** Generated Node Admin SDK operation action function for the 'ListAccessGroups' Query. Allow users to execute without passing in DataConnect. */
export function listAccessGroups(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAccessGroupsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAccessGroups' Query. Allow users to pass in custom DataConnect instances. */
export function listAccessGroups(options?: OperationOptions): Promise<ExecuteOperationResponse<ListAccessGroupsData>>;

/** Generated Node Admin SDK operation action function for the 'GetUserAccessGroups' Query. Allow users to execute without passing in DataConnect. */
export function getUserAccessGroups(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserAccessGroupsData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserAccessGroups' Query. Allow users to pass in custom DataConnect instances. */
export function getUserAccessGroups(options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserAccessGroupsData>>;

/** Generated Node Admin SDK operation action function for the 'CheckUserProfileExists' Query. Allow users to execute without passing in DataConnect. */
export function checkUserProfileExists(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<CheckUserProfileExistsData>>;
/** Generated Node Admin SDK operation action function for the 'CheckUserProfileExists' Query. Allow users to pass in custom DataConnect instances. */
export function checkUserProfileExists(options?: OperationOptions): Promise<ExecuteOperationResponse<CheckUserProfileExistsData>>;

/** Generated Node Admin SDK operation action function for the 'GetUserMembershipStatus' Query. Allow users to execute without passing in DataConnect. */
export function getUserMembershipStatus(dc: DataConnect, vars: GetUserMembershipStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserMembershipStatusData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserMembershipStatus' Query. Allow users to pass in custom DataConnect instances. */
export function getUserMembershipStatus(vars: GetUserMembershipStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserMembershipStatusData>>;

/** Generated Node Admin SDK operation action function for the 'GetUserWithAccessGroups' Query. Allow users to execute without passing in DataConnect. */
export function getUserWithAccessGroups(dc: DataConnect, vars: GetUserWithAccessGroupsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserWithAccessGroupsData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserWithAccessGroups' Query. Allow users to pass in custom DataConnect instances. */
export function getUserWithAccessGroups(vars: GetUserWithAccessGroupsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserWithAccessGroupsData>>;

/** Generated Node Admin SDK operation action function for the 'GetUserAccessGroupsById' Query. Allow users to execute without passing in DataConnect. */
export function getUserAccessGroupsById(dc: DataConnect, vars: GetUserAccessGroupsByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserAccessGroupsByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserAccessGroupsById' Query. Allow users to pass in custom DataConnect instances. */
export function getUserAccessGroupsById(vars: GetUserAccessGroupsByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserAccessGroupsByIdData>>;

/** Generated Node Admin SDK operation action function for the 'GetSectionById' Query. Allow users to execute without passing in DataConnect. */
export function getSectionById(dc: DataConnect, vars: GetSectionByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetSectionById' Query. Allow users to pass in custom DataConnect instances. */
export function getSectionById(vars: GetSectionByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionByIdData>>;

/** Generated Node Admin SDK operation action function for the 'GetAccessGroupById' Query. Allow users to execute without passing in DataConnect. */
export function getAccessGroupById(dc: DataConnect, vars: GetAccessGroupByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAccessGroupByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetAccessGroupById' Query. Allow users to pass in custom DataConnect instances. */
export function getAccessGroupById(vars: GetAccessGroupByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAccessGroupByIdData>>;

/** Generated Node Admin SDK operation action function for the 'GetAllAccessGroupsWithStatuses' Query. Allow users to execute without passing in DataConnect. */
export function getAllAccessGroupsWithStatuses(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAllAccessGroupsWithStatusesData>>;
/** Generated Node Admin SDK operation action function for the 'GetAllAccessGroupsWithStatuses' Query. Allow users to pass in custom DataConnect instances. */
export function getAllAccessGroupsWithStatuses(options?: OperationOptions): Promise<ExecuteOperationResponse<GetAllAccessGroupsWithStatusesData>>;

/** Generated Node Admin SDK operation action function for the 'CreateUserProfile' Mutation. Allow users to execute without passing in DataConnect. */
export function createUserProfile(dc: DataConnect, vars: CreateUserProfileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserProfileData>>;
/** Generated Node Admin SDK operation action function for the 'CreateUserProfile' Mutation. Allow users to pass in custom DataConnect instances. */
export function createUserProfile(vars: CreateUserProfileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserProfileData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertUser' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertUser(dc: DataConnect, vars: UpsertUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertUserData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertUser(vars: UpsertUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertUserData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateUser' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUser(dc: DataConnect, vars: UpdateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUser(vars: UpdateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserData>>;

/** Generated Node Admin SDK operation action function for the 'RegisterForSection' Mutation. Allow users to execute without passing in DataConnect. */
export function registerForSection(dc: DataConnect, vars: RegisterForSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RegisterForSectionData>>;
/** Generated Node Admin SDK operation action function for the 'RegisterForSection' Mutation. Allow users to pass in custom DataConnect instances. */
export function registerForSection(vars: RegisterForSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RegisterForSectionData>>;

/** Generated Node Admin SDK operation action function for the 'UnregisterFromSection' Mutation. Allow users to execute without passing in DataConnect. */
export function unregisterFromSection(dc: DataConnect, vars: UnregisterFromSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UnregisterFromSectionData>>;
/** Generated Node Admin SDK operation action function for the 'UnregisterFromSection' Mutation. Allow users to pass in custom DataConnect instances. */
export function unregisterFromSection(vars: UnregisterFromSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UnregisterFromSectionData>>;

/** Generated Node Admin SDK operation action function for the 'CreateSection' Mutation. Allow users to execute without passing in DataConnect. */
export function createSection(dc: DataConnect, vars: CreateSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSectionData>>;
/** Generated Node Admin SDK operation action function for the 'CreateSection' Mutation. Allow users to pass in custom DataConnect instances. */
export function createSection(vars: CreateSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSectionData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAccessGroup' Mutation. Allow users to execute without passing in DataConnect. */
export function createAccessGroup(dc: DataConnect, vars: CreateAccessGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAccessGroupData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAccessGroup' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAccessGroup(vars: CreateAccessGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAccessGroupData>>;

/** Generated Node Admin SDK operation action function for the 'AddUserToAccessGroup' Mutation. Allow users to execute without passing in DataConnect. */
export function addUserToAccessGroup(dc: DataConnect, vars: AddUserToAccessGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddUserToAccessGroupData>>;
/** Generated Node Admin SDK operation action function for the 'AddUserToAccessGroup' Mutation. Allow users to pass in custom DataConnect instances. */
export function addUserToAccessGroup(vars: AddUserToAccessGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddUserToAccessGroupData>>;

/** Generated Node Admin SDK operation action function for the 'RemoveUserFromAccessGroup' Mutation. Allow users to execute without passing in DataConnect. */
export function removeUserFromAccessGroup(dc: DataConnect, vars: RemoveUserFromAccessGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemoveUserFromAccessGroupData>>;
/** Generated Node Admin SDK operation action function for the 'RemoveUserFromAccessGroup' Mutation. Allow users to pass in custom DataConnect instances. */
export function removeUserFromAccessGroup(vars: RemoveUserFromAccessGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemoveUserFromAccessGroupData>>;

/** Generated Node Admin SDK operation action function for the 'GrantAccessGroupToSection' Mutation. Allow users to execute without passing in DataConnect. */
export function grantAccessGroupToSection(dc: DataConnect, vars: GrantAccessGroupToSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GrantAccessGroupToSectionData>>;
/** Generated Node Admin SDK operation action function for the 'GrantAccessGroupToSection' Mutation. Allow users to pass in custom DataConnect instances. */
export function grantAccessGroupToSection(vars: GrantAccessGroupToSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GrantAccessGroupToSectionData>>;

/** Generated Node Admin SDK operation action function for the 'RevokeAccessGroupFromSection' Mutation. Allow users to execute without passing in DataConnect. */
export function revokeAccessGroupFromSection(dc: DataConnect, vars: RevokeAccessGroupFromSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RevokeAccessGroupFromSectionData>>;
/** Generated Node Admin SDK operation action function for the 'RevokeAccessGroupFromSection' Mutation. Allow users to pass in custom DataConnect instances. */
export function revokeAccessGroupFromSection(vars: RevokeAccessGroupFromSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RevokeAccessGroupFromSectionData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateAccessGroup' Mutation. Allow users to execute without passing in DataConnect. */
export function updateAccessGroup(dc: DataConnect, vars: UpdateAccessGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAccessGroupData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateAccessGroup' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateAccessGroup(vars: UpdateAccessGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAccessGroupData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteAccessGroup' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteAccessGroup(dc: DataConnect, vars: DeleteAccessGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAccessGroupData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteAccessGroup' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteAccessGroup(vars: DeleteAccessGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAccessGroupData>>;

