import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

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
};

export enum SectionType {
  MEMBERS = "MEMBERS",
  EVENTS = "EVENTS",
};



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
  subscribable?: boolean | null;
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

export interface DeleteSectionData {
  section_delete?: Section_Key | null;
}

export interface DeleteSectionVariables {
  id: UUIDString;
}

export interface DeleteUserData {
  user_delete?: User_Key | null;
}

export interface DeleteUserVariables {
  userId: string;
}

export interface Event_Key {
  id: UUIDString;
  __typename?: 'Event_Key';
}

export interface GetAccessGroupByIdData {
  accessGroup?: {
    id: UUIDString;
    name: string;
    description?: string | null;
    membershipStatuses?: MembershipStatus[] | null;
    subscribable?: boolean | null;
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
      viewingSections: ({
        section: {
          id: UUIDString;
          name: string;
          type: SectionType;
          description?: string | null;
        } & Section_Key;
      })[];
        memberSections: ({
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
    viewingAccessGroups: ({
      accessGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
        subscribable?: boolean | null;
      } & AccessGroup_Key;
    })[];
      memberAccessGroups: ({
        accessGroup: {
          id: UUIDString;
          name: string;
          description?: string | null;
          subscribable?: boolean | null;
        } & AccessGroup_Key;
      })[];
  } & Section_Key;
}

export interface GetSectionByIdVariables {
  id: UUIDString;
}

export interface GetSectionMembersData {
  section?: {
    id: UUIDString;
    name: string;
    type: SectionType;
    description?: string | null;
    memberAccessGroups: ({
      accessGroup: {
        id: UUIDString;
        name: string;
        membershipStatuses?: MembershipStatus[] | null;
        users: ({
          user: {
            id: string;
            firstName: string;
            lastName: string;
            email: string;
            membershipStatus: MembershipStatus;
          } & User_Key;
        })[];
      } & AccessGroup_Key;
    })[];
      viewingAccessGroups: ({
        accessGroup: {
          id: UUIDString;
          name: string;
          membershipStatuses?: MembershipStatus[] | null;
          users: ({
            user: {
              id: string;
              firstName: string;
              lastName: string;
              email: string;
              membershipStatus: MembershipStatus;
            } & User_Key;
          })[];
        } & AccessGroup_Key;
      })[];
  } & Section_Key;
}

export interface GetSectionMembersVariables {
  sectionId: UUIDString;
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

export interface GrantMemberAccessGroupToSectionData {
  sectionMemberAccessGroup_upsert: SectionMemberAccessGroup_Key;
}

export interface GrantMemberAccessGroupToSectionVariables {
  sectionId: UUIDString;
  accessGroupId: UUIDString;
}

export interface GrantViewAccessGroupToSectionData {
  sectionViewAccessGroup_upsert: SectionViewAccessGroup_Key;
}

export interface GrantViewAccessGroupToSectionVariables {
  sectionId: UUIDString;
  accessGroupId: UUIDString;
}

export interface ListAccessGroupsData {
  accessGroups: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    membershipStatuses?: MembershipStatus[] | null;
    subscribable?: boolean | null;
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

export interface RevokeMemberAccessGroupFromSectionData {
  sectionMemberAccessGroup_delete?: SectionMemberAccessGroup_Key | null;
}

export interface RevokeMemberAccessGroupFromSectionVariables {
  sectionId: UUIDString;
  accessGroupId: UUIDString;
}

export interface RevokeViewAccessGroupFromSectionData {
  sectionViewAccessGroup_delete?: SectionViewAccessGroup_Key | null;
}

export interface RevokeViewAccessGroupFromSectionVariables {
  sectionId: UUIDString;
  accessGroupId: UUIDString;
}

export interface SectionMemberAccessGroup_Key {
  sectionId: UUIDString;
  accessGroupId: UUIDString;
  __typename?: 'SectionMemberAccessGroup_Key';
}

export interface SectionViewAccessGroup_Key {
  sectionId: UUIDString;
  accessGroupId: UUIDString;
  __typename?: 'SectionViewAccessGroup_Key';
}

export interface Section_Key {
  id: UUIDString;
  __typename?: 'Section_Key';
}

export interface SubscribeToAccessGroupData {
  userAccessGroup_upsert: UserAccessGroup_Key;
}

export interface SubscribeToAccessGroupVariables {
  accessGroupId: UUIDString;
}

export interface TicketType_Key {
  id: UUIDString;
  __typename?: 'TicketType_Key';
}

export interface UnregisterFromSectionData {
  userAccessGroup_delete?: UserAccessGroup_Key | null;
}

export interface UnregisterFromSectionVariables {
  accessGroupId: UUIDString;
}

export interface UnsubscribeFromAccessGroupData {
  userAccessGroup_delete?: UserAccessGroup_Key | null;
}

export interface UnsubscribeFromAccessGroupVariables {
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
  subscribable?: boolean | null;
}

export interface UpdateSectionData {
  section_update?: Section_Key | null;
}

export interface UpdateSectionVariables {
  id: UUIDString;
  name: string;
  description?: string | null;
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

interface CreateSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSectionVariables): MutationRef<CreateSectionData, CreateSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateSectionVariables): MutationRef<CreateSectionData, CreateSectionVariables>;
  operationName: string;
}
export const createSectionRef: CreateSectionRef;

export function createSection(vars: CreateSectionVariables): MutationPromise<CreateSectionData, CreateSectionVariables>;
export function createSection(dc: DataConnect, vars: CreateSectionVariables): MutationPromise<CreateSectionData, CreateSectionVariables>;

interface CreateAccessGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAccessGroupVariables): MutationRef<CreateAccessGroupData, CreateAccessGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAccessGroupVariables): MutationRef<CreateAccessGroupData, CreateAccessGroupVariables>;
  operationName: string;
}
export const createAccessGroupRef: CreateAccessGroupRef;

export function createAccessGroup(vars: CreateAccessGroupVariables): MutationPromise<CreateAccessGroupData, CreateAccessGroupVariables>;
export function createAccessGroup(dc: DataConnect, vars: CreateAccessGroupVariables): MutationPromise<CreateAccessGroupData, CreateAccessGroupVariables>;

interface AddUserToAccessGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddUserToAccessGroupVariables): MutationRef<AddUserToAccessGroupData, AddUserToAccessGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddUserToAccessGroupVariables): MutationRef<AddUserToAccessGroupData, AddUserToAccessGroupVariables>;
  operationName: string;
}
export const addUserToAccessGroupRef: AddUserToAccessGroupRef;

export function addUserToAccessGroup(vars: AddUserToAccessGroupVariables): MutationPromise<AddUserToAccessGroupData, AddUserToAccessGroupVariables>;
export function addUserToAccessGroup(dc: DataConnect, vars: AddUserToAccessGroupVariables): MutationPromise<AddUserToAccessGroupData, AddUserToAccessGroupVariables>;

interface RemoveUserFromAccessGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveUserFromAccessGroupVariables): MutationRef<RemoveUserFromAccessGroupData, RemoveUserFromAccessGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RemoveUserFromAccessGroupVariables): MutationRef<RemoveUserFromAccessGroupData, RemoveUserFromAccessGroupVariables>;
  operationName: string;
}
export const removeUserFromAccessGroupRef: RemoveUserFromAccessGroupRef;

export function removeUserFromAccessGroup(vars: RemoveUserFromAccessGroupVariables): MutationPromise<RemoveUserFromAccessGroupData, RemoveUserFromAccessGroupVariables>;
export function removeUserFromAccessGroup(dc: DataConnect, vars: RemoveUserFromAccessGroupVariables): MutationPromise<RemoveUserFromAccessGroupData, RemoveUserFromAccessGroupVariables>;

interface GrantViewAccessGroupToSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GrantViewAccessGroupToSectionVariables): MutationRef<GrantViewAccessGroupToSectionData, GrantViewAccessGroupToSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GrantViewAccessGroupToSectionVariables): MutationRef<GrantViewAccessGroupToSectionData, GrantViewAccessGroupToSectionVariables>;
  operationName: string;
}
export const grantViewAccessGroupToSectionRef: GrantViewAccessGroupToSectionRef;

export function grantViewAccessGroupToSection(vars: GrantViewAccessGroupToSectionVariables): MutationPromise<GrantViewAccessGroupToSectionData, GrantViewAccessGroupToSectionVariables>;
export function grantViewAccessGroupToSection(dc: DataConnect, vars: GrantViewAccessGroupToSectionVariables): MutationPromise<GrantViewAccessGroupToSectionData, GrantViewAccessGroupToSectionVariables>;

interface RevokeViewAccessGroupFromSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RevokeViewAccessGroupFromSectionVariables): MutationRef<RevokeViewAccessGroupFromSectionData, RevokeViewAccessGroupFromSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RevokeViewAccessGroupFromSectionVariables): MutationRef<RevokeViewAccessGroupFromSectionData, RevokeViewAccessGroupFromSectionVariables>;
  operationName: string;
}
export const revokeViewAccessGroupFromSectionRef: RevokeViewAccessGroupFromSectionRef;

export function revokeViewAccessGroupFromSection(vars: RevokeViewAccessGroupFromSectionVariables): MutationPromise<RevokeViewAccessGroupFromSectionData, RevokeViewAccessGroupFromSectionVariables>;
export function revokeViewAccessGroupFromSection(dc: DataConnect, vars: RevokeViewAccessGroupFromSectionVariables): MutationPromise<RevokeViewAccessGroupFromSectionData, RevokeViewAccessGroupFromSectionVariables>;

interface GrantMemberAccessGroupToSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GrantMemberAccessGroupToSectionVariables): MutationRef<GrantMemberAccessGroupToSectionData, GrantMemberAccessGroupToSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GrantMemberAccessGroupToSectionVariables): MutationRef<GrantMemberAccessGroupToSectionData, GrantMemberAccessGroupToSectionVariables>;
  operationName: string;
}
export const grantMemberAccessGroupToSectionRef: GrantMemberAccessGroupToSectionRef;

export function grantMemberAccessGroupToSection(vars: GrantMemberAccessGroupToSectionVariables): MutationPromise<GrantMemberAccessGroupToSectionData, GrantMemberAccessGroupToSectionVariables>;
export function grantMemberAccessGroupToSection(dc: DataConnect, vars: GrantMemberAccessGroupToSectionVariables): MutationPromise<GrantMemberAccessGroupToSectionData, GrantMemberAccessGroupToSectionVariables>;

interface RevokeMemberAccessGroupFromSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RevokeMemberAccessGroupFromSectionVariables): MutationRef<RevokeMemberAccessGroupFromSectionData, RevokeMemberAccessGroupFromSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RevokeMemberAccessGroupFromSectionVariables): MutationRef<RevokeMemberAccessGroupFromSectionData, RevokeMemberAccessGroupFromSectionVariables>;
  operationName: string;
}
export const revokeMemberAccessGroupFromSectionRef: RevokeMemberAccessGroupFromSectionRef;

export function revokeMemberAccessGroupFromSection(vars: RevokeMemberAccessGroupFromSectionVariables): MutationPromise<RevokeMemberAccessGroupFromSectionData, RevokeMemberAccessGroupFromSectionVariables>;
export function revokeMemberAccessGroupFromSection(dc: DataConnect, vars: RevokeMemberAccessGroupFromSectionVariables): MutationPromise<RevokeMemberAccessGroupFromSectionData, RevokeMemberAccessGroupFromSectionVariables>;

interface UpdateAccessGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAccessGroupVariables): MutationRef<UpdateAccessGroupData, UpdateAccessGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateAccessGroupVariables): MutationRef<UpdateAccessGroupData, UpdateAccessGroupVariables>;
  operationName: string;
}
export const updateAccessGroupRef: UpdateAccessGroupRef;

export function updateAccessGroup(vars: UpdateAccessGroupVariables): MutationPromise<UpdateAccessGroupData, UpdateAccessGroupVariables>;
export function updateAccessGroup(dc: DataConnect, vars: UpdateAccessGroupVariables): MutationPromise<UpdateAccessGroupData, UpdateAccessGroupVariables>;

interface DeleteAccessGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteAccessGroupVariables): MutationRef<DeleteAccessGroupData, DeleteAccessGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteAccessGroupVariables): MutationRef<DeleteAccessGroupData, DeleteAccessGroupVariables>;
  operationName: string;
}
export const deleteAccessGroupRef: DeleteAccessGroupRef;

export function deleteAccessGroup(vars: DeleteAccessGroupVariables): MutationPromise<DeleteAccessGroupData, DeleteAccessGroupVariables>;
export function deleteAccessGroup(dc: DataConnect, vars: DeleteAccessGroupVariables): MutationPromise<DeleteAccessGroupData, DeleteAccessGroupVariables>;

interface UpdateSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateSectionVariables): MutationRef<UpdateSectionData, UpdateSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateSectionVariables): MutationRef<UpdateSectionData, UpdateSectionVariables>;
  operationName: string;
}
export const updateSectionRef: UpdateSectionRef;

export function updateSection(vars: UpdateSectionVariables): MutationPromise<UpdateSectionData, UpdateSectionVariables>;
export function updateSection(dc: DataConnect, vars: UpdateSectionVariables): MutationPromise<UpdateSectionData, UpdateSectionVariables>;

interface DeleteSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteSectionVariables): MutationRef<DeleteSectionData, DeleteSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteSectionVariables): MutationRef<DeleteSectionData, DeleteSectionVariables>;
  operationName: string;
}
export const deleteSectionRef: DeleteSectionRef;

export function deleteSection(vars: DeleteSectionVariables): MutationPromise<DeleteSectionData, DeleteSectionVariables>;
export function deleteSection(dc: DataConnect, vars: DeleteSectionVariables): MutationPromise<DeleteSectionData, DeleteSectionVariables>;

interface UpdateUserMembershipStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserMembershipStatusVariables): MutationRef<UpdateUserMembershipStatusData, UpdateUserMembershipStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateUserMembershipStatusVariables): MutationRef<UpdateUserMembershipStatusData, UpdateUserMembershipStatusVariables>;
  operationName: string;
}
export const updateUserMembershipStatusRef: UpdateUserMembershipStatusRef;

export function updateUserMembershipStatus(vars: UpdateUserMembershipStatusVariables): MutationPromise<UpdateUserMembershipStatusData, UpdateUserMembershipStatusVariables>;
export function updateUserMembershipStatus(dc: DataConnect, vars: UpdateUserMembershipStatusVariables): MutationPromise<UpdateUserMembershipStatusData, UpdateUserMembershipStatusVariables>;

interface DeleteUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteUserVariables): MutationRef<DeleteUserData, DeleteUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteUserVariables): MutationRef<DeleteUserData, DeleteUserVariables>;
  operationName: string;
}
export const deleteUserRef: DeleteUserRef;

export function deleteUser(vars: DeleteUserVariables): MutationPromise<DeleteUserData, DeleteUserVariables>;
export function deleteUser(dc: DataConnect, vars: DeleteUserVariables): MutationPromise<DeleteUserData, DeleteUserVariables>;

interface CreateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  operationName: string;
}
export const createUserRef: CreateUserRef;

export function createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;
export function createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateAccessGroupAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAccessGroupAdminVariables): MutationRef<CreateAccessGroupAdminData, CreateAccessGroupAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAccessGroupAdminVariables): MutationRef<CreateAccessGroupAdminData, CreateAccessGroupAdminVariables>;
  operationName: string;
}
export const createAccessGroupAdminRef: CreateAccessGroupAdminRef;

export function createAccessGroupAdmin(vars: CreateAccessGroupAdminVariables): MutationPromise<CreateAccessGroupAdminData, CreateAccessGroupAdminVariables>;
export function createAccessGroupAdmin(dc: DataConnect, vars: CreateAccessGroupAdminVariables): MutationPromise<CreateAccessGroupAdminData, CreateAccessGroupAdminVariables>;

interface AddUserToAccessGroupAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddUserToAccessGroupAdminVariables): MutationRef<AddUserToAccessGroupAdminData, AddUserToAccessGroupAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddUserToAccessGroupAdminVariables): MutationRef<AddUserToAccessGroupAdminData, AddUserToAccessGroupAdminVariables>;
  operationName: string;
}
export const addUserToAccessGroupAdminRef: AddUserToAccessGroupAdminRef;

export function addUserToAccessGroupAdmin(vars: AddUserToAccessGroupAdminVariables): MutationPromise<AddUserToAccessGroupAdminData, AddUserToAccessGroupAdminVariables>;
export function addUserToAccessGroupAdmin(dc: DataConnect, vars: AddUserToAccessGroupAdminVariables): MutationPromise<AddUserToAccessGroupAdminData, AddUserToAccessGroupAdminVariables>;

interface RemoveUserFromAccessGroupAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveUserFromAccessGroupAdminVariables): MutationRef<RemoveUserFromAccessGroupAdminData, RemoveUserFromAccessGroupAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RemoveUserFromAccessGroupAdminVariables): MutationRef<RemoveUserFromAccessGroupAdminData, RemoveUserFromAccessGroupAdminVariables>;
  operationName: string;
}
export const removeUserFromAccessGroupAdminRef: RemoveUserFromAccessGroupAdminRef;

export function removeUserFromAccessGroupAdmin(vars: RemoveUserFromAccessGroupAdminVariables): MutationPromise<RemoveUserFromAccessGroupAdminData, RemoveUserFromAccessGroupAdminVariables>;
export function removeUserFromAccessGroupAdmin(dc: DataConnect, vars: RemoveUserFromAccessGroupAdminVariables): MutationPromise<RemoveUserFromAccessGroupAdminData, RemoveUserFromAccessGroupAdminVariables>;

interface GetAccessGroupByNameRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAccessGroupByNameVariables): QueryRef<GetAccessGroupByNameData, GetAccessGroupByNameVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetAccessGroupByNameVariables): QueryRef<GetAccessGroupByNameData, GetAccessGroupByNameVariables>;
  operationName: string;
}
export const getAccessGroupByNameRef: GetAccessGroupByNameRef;

export function getAccessGroupByName(vars: GetAccessGroupByNameVariables): QueryPromise<GetAccessGroupByNameData, GetAccessGroupByNameVariables>;
export function getAccessGroupByName(dc: DataConnect, vars: GetAccessGroupByNameVariables): QueryPromise<GetAccessGroupByNameData, GetAccessGroupByNameVariables>;

interface GetUserAccessGroupsForAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserAccessGroupsForAdminVariables): QueryRef<GetUserAccessGroupsForAdminData, GetUserAccessGroupsForAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserAccessGroupsForAdminVariables): QueryRef<GetUserAccessGroupsForAdminData, GetUserAccessGroupsForAdminVariables>;
  operationName: string;
}
export const getUserAccessGroupsForAdminRef: GetUserAccessGroupsForAdminRef;

export function getUserAccessGroupsForAdmin(vars: GetUserAccessGroupsForAdminVariables): QueryPromise<GetUserAccessGroupsForAdminData, GetUserAccessGroupsForAdminVariables>;
export function getUserAccessGroupsForAdmin(dc: DataConnect, vars: GetUserAccessGroupsForAdminVariables): QueryPromise<GetUserAccessGroupsForAdminData, GetUserAccessGroupsForAdminVariables>;

interface GetCurrentUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetCurrentUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetCurrentUserData, undefined>;
  operationName: string;
}
export const getCurrentUserRef: GetCurrentUserRef;

export function getCurrentUser(): QueryPromise<GetCurrentUserData, undefined>;
export function getCurrentUser(dc: DataConnect): QueryPromise<GetCurrentUserData, undefined>;

interface GetUserByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
  operationName: string;
}
export const getUserByIdRef: GetUserByIdRef;

export function getUserById(vars: GetUserByIdVariables): QueryPromise<GetUserByIdData, GetUserByIdVariables>;
export function getUserById(dc: DataConnect, vars: GetUserByIdVariables): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

interface ListUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
  operationName: string;
}
export const listUsersRef: ListUsersRef;

export function listUsers(): QueryPromise<ListUsersData, undefined>;
export function listUsers(dc: DataConnect): QueryPromise<ListUsersData, undefined>;

interface ListSectionsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSectionsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListSectionsData, undefined>;
  operationName: string;
}
export const listSectionsRef: ListSectionsRef;

export function listSections(): QueryPromise<ListSectionsData, undefined>;
export function listSections(dc: DataConnect): QueryPromise<ListSectionsData, undefined>;

interface GetSectionsForUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetSectionsForUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetSectionsForUserData, undefined>;
  operationName: string;
}
export const getSectionsForUserRef: GetSectionsForUserRef;

export function getSectionsForUser(): QueryPromise<GetSectionsForUserData, undefined>;
export function getSectionsForUser(dc: DataConnect): QueryPromise<GetSectionsForUserData, undefined>;

interface ListAccessGroupsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAccessGroupsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListAccessGroupsData, undefined>;
  operationName: string;
}
export const listAccessGroupsRef: ListAccessGroupsRef;

export function listAccessGroups(): QueryPromise<ListAccessGroupsData, undefined>;
export function listAccessGroups(dc: DataConnect): QueryPromise<ListAccessGroupsData, undefined>;

interface GetUserAccessGroupsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetUserAccessGroupsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetUserAccessGroupsData, undefined>;
  operationName: string;
}
export const getUserAccessGroupsRef: GetUserAccessGroupsRef;

export function getUserAccessGroups(): QueryPromise<GetUserAccessGroupsData, undefined>;
export function getUserAccessGroups(dc: DataConnect): QueryPromise<GetUserAccessGroupsData, undefined>;

interface CheckUserProfileExistsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<CheckUserProfileExistsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<CheckUserProfileExistsData, undefined>;
  operationName: string;
}
export const checkUserProfileExistsRef: CheckUserProfileExistsRef;

export function checkUserProfileExists(): QueryPromise<CheckUserProfileExistsData, undefined>;
export function checkUserProfileExists(dc: DataConnect): QueryPromise<CheckUserProfileExistsData, undefined>;

interface GetUserMembershipStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserMembershipStatusVariables): QueryRef<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserMembershipStatusVariables): QueryRef<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;
  operationName: string;
}
export const getUserMembershipStatusRef: GetUserMembershipStatusRef;

export function getUserMembershipStatus(vars: GetUserMembershipStatusVariables): QueryPromise<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;
export function getUserMembershipStatus(dc: DataConnect, vars: GetUserMembershipStatusVariables): QueryPromise<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;

interface GetUserWithAccessGroupsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserWithAccessGroupsVariables): QueryRef<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserWithAccessGroupsVariables): QueryRef<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;
  operationName: string;
}
export const getUserWithAccessGroupsRef: GetUserWithAccessGroupsRef;

export function getUserWithAccessGroups(vars: GetUserWithAccessGroupsVariables): QueryPromise<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;
export function getUserWithAccessGroups(dc: DataConnect, vars: GetUserWithAccessGroupsVariables): QueryPromise<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;

interface GetUserAccessGroupsByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserAccessGroupsByIdVariables): QueryRef<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserAccessGroupsByIdVariables): QueryRef<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;
  operationName: string;
}
export const getUserAccessGroupsByIdRef: GetUserAccessGroupsByIdRef;

export function getUserAccessGroupsById(vars: GetUserAccessGroupsByIdVariables): QueryPromise<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;
export function getUserAccessGroupsById(dc: DataConnect, vars: GetUserAccessGroupsByIdVariables): QueryPromise<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;

interface GetSectionByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionByIdVariables): QueryRef<GetSectionByIdData, GetSectionByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSectionByIdVariables): QueryRef<GetSectionByIdData, GetSectionByIdVariables>;
  operationName: string;
}
export const getSectionByIdRef: GetSectionByIdRef;

export function getSectionById(vars: GetSectionByIdVariables): QueryPromise<GetSectionByIdData, GetSectionByIdVariables>;
export function getSectionById(dc: DataConnect, vars: GetSectionByIdVariables): QueryPromise<GetSectionByIdData, GetSectionByIdVariables>;

interface GetAccessGroupByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAccessGroupByIdVariables): QueryRef<GetAccessGroupByIdData, GetAccessGroupByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetAccessGroupByIdVariables): QueryRef<GetAccessGroupByIdData, GetAccessGroupByIdVariables>;
  operationName: string;
}
export const getAccessGroupByIdRef: GetAccessGroupByIdRef;

export function getAccessGroupById(vars: GetAccessGroupByIdVariables): QueryPromise<GetAccessGroupByIdData, GetAccessGroupByIdVariables>;
export function getAccessGroupById(dc: DataConnect, vars: GetAccessGroupByIdVariables): QueryPromise<GetAccessGroupByIdData, GetAccessGroupByIdVariables>;

interface GetAllAccessGroupsWithStatusesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetAllAccessGroupsWithStatusesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetAllAccessGroupsWithStatusesData, undefined>;
  operationName: string;
}
export const getAllAccessGroupsWithStatusesRef: GetAllAccessGroupsWithStatusesRef;

export function getAllAccessGroupsWithStatuses(): QueryPromise<GetAllAccessGroupsWithStatusesData, undefined>;
export function getAllAccessGroupsWithStatuses(dc: DataConnect): QueryPromise<GetAllAccessGroupsWithStatusesData, undefined>;

interface GetSectionMembersRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionMembersVariables): QueryRef<GetSectionMembersData, GetSectionMembersVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSectionMembersVariables): QueryRef<GetSectionMembersData, GetSectionMembersVariables>;
  operationName: string;
}
export const getSectionMembersRef: GetSectionMembersRef;

export function getSectionMembers(vars: GetSectionMembersVariables): QueryPromise<GetSectionMembersData, GetSectionMembersVariables>;
export function getSectionMembers(dc: DataConnect, vars: GetSectionMembersVariables): QueryPromise<GetSectionMembersData, GetSectionMembersVariables>;

interface CreateUserProfileRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserProfileVariables): MutationRef<CreateUserProfileData, CreateUserProfileVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserProfileVariables): MutationRef<CreateUserProfileData, CreateUserProfileVariables>;
  operationName: string;
}
export const createUserProfileRef: CreateUserProfileRef;

export function createUserProfile(vars: CreateUserProfileVariables): MutationPromise<CreateUserProfileData, CreateUserProfileVariables>;
export function createUserProfile(dc: DataConnect, vars: CreateUserProfileVariables): MutationPromise<CreateUserProfileData, CreateUserProfileVariables>;

interface UpsertUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
  operationName: string;
}
export const upsertUserRef: UpsertUserRef;

export function upsertUser(vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;
export function upsertUser(dc: DataConnect, vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;

interface UpdateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
  operationName: string;
}
export const updateUserRef: UpdateUserRef;

export function updateUser(vars: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;
export function updateUser(dc: DataConnect, vars: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;

interface RegisterForSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RegisterForSectionVariables): MutationRef<RegisterForSectionData, RegisterForSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RegisterForSectionVariables): MutationRef<RegisterForSectionData, RegisterForSectionVariables>;
  operationName: string;
}
export const registerForSectionRef: RegisterForSectionRef;

export function registerForSection(vars: RegisterForSectionVariables): MutationPromise<RegisterForSectionData, RegisterForSectionVariables>;
export function registerForSection(dc: DataConnect, vars: RegisterForSectionVariables): MutationPromise<RegisterForSectionData, RegisterForSectionVariables>;

interface UnregisterFromSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UnregisterFromSectionVariables): MutationRef<UnregisterFromSectionData, UnregisterFromSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UnregisterFromSectionVariables): MutationRef<UnregisterFromSectionData, UnregisterFromSectionVariables>;
  operationName: string;
}
export const unregisterFromSectionRef: UnregisterFromSectionRef;

export function unregisterFromSection(vars: UnregisterFromSectionVariables): MutationPromise<UnregisterFromSectionData, UnregisterFromSectionVariables>;
export function unregisterFromSection(dc: DataConnect, vars: UnregisterFromSectionVariables): MutationPromise<UnregisterFromSectionData, UnregisterFromSectionVariables>;

interface SubscribeToAccessGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SubscribeToAccessGroupVariables): MutationRef<SubscribeToAccessGroupData, SubscribeToAccessGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SubscribeToAccessGroupVariables): MutationRef<SubscribeToAccessGroupData, SubscribeToAccessGroupVariables>;
  operationName: string;
}
export const subscribeToAccessGroupRef: SubscribeToAccessGroupRef;

export function subscribeToAccessGroup(vars: SubscribeToAccessGroupVariables): MutationPromise<SubscribeToAccessGroupData, SubscribeToAccessGroupVariables>;
export function subscribeToAccessGroup(dc: DataConnect, vars: SubscribeToAccessGroupVariables): MutationPromise<SubscribeToAccessGroupData, SubscribeToAccessGroupVariables>;

interface UnsubscribeFromAccessGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UnsubscribeFromAccessGroupVariables): MutationRef<UnsubscribeFromAccessGroupData, UnsubscribeFromAccessGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UnsubscribeFromAccessGroupVariables): MutationRef<UnsubscribeFromAccessGroupData, UnsubscribeFromAccessGroupVariables>;
  operationName: string;
}
export const unsubscribeFromAccessGroupRef: UnsubscribeFromAccessGroupRef;

export function unsubscribeFromAccessGroup(vars: UnsubscribeFromAccessGroupVariables): MutationPromise<UnsubscribeFromAccessGroupData, UnsubscribeFromAccessGroupVariables>;
export function unsubscribeFromAccessGroup(dc: DataConnect, vars: UnsubscribeFromAccessGroupVariables): MutationPromise<UnsubscribeFromAccessGroupData, UnsubscribeFromAccessGroupVariables>;

