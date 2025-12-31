import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export enum MembershipStatus {
  PENDING = "PENDING",
  SERVING = "SERVING",
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

export interface AddUserToAccessGroupData {
  userAccessGroup_upsert: UserAccessGroup_Key;
}

export interface AddUserToAccessGroupVariables {
  userId: string;
  accessGroupId: UUIDString;
}

export interface CreateAccessGroupData {
  accessGroup_insert: AccessGroup_Key;
}

export interface CreateAccessGroupVariables {
  name: string;
  description?: string | null;
}

export interface CreateSectionData {
  section_insert: Section_Key;
}

export interface CreateSectionVariables {
  name: string;
  type: SectionType;
  description?: string | null;
}

export interface GetCurrentUserData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    membershipStatus: MembershipStatus;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & User_Key;
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

export interface GetUserByIdData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    membershipStatus: MembershipStatus;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy?: string | null;
    updatedBy?: string | null;
  } & User_Key;
}

export interface GetUserByIdVariables {
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
    createdAt: TimestampString;
    updatedAt: TimestampString;
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
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & User_Key)[];
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

export interface UpsertUserData {
  user_upsert: User_Key;
}

export interface UpsertUserVariables {
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  membershipStatus?: MembershipStatus | null;
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

interface GrantAccessGroupToSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GrantAccessGroupToSectionVariables): MutationRef<GrantAccessGroupToSectionData, GrantAccessGroupToSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GrantAccessGroupToSectionVariables): MutationRef<GrantAccessGroupToSectionData, GrantAccessGroupToSectionVariables>;
  operationName: string;
}
export const grantAccessGroupToSectionRef: GrantAccessGroupToSectionRef;

export function grantAccessGroupToSection(vars: GrantAccessGroupToSectionVariables): MutationPromise<GrantAccessGroupToSectionData, GrantAccessGroupToSectionVariables>;
export function grantAccessGroupToSection(dc: DataConnect, vars: GrantAccessGroupToSectionVariables): MutationPromise<GrantAccessGroupToSectionData, GrantAccessGroupToSectionVariables>;

interface RevokeAccessGroupFromSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RevokeAccessGroupFromSectionVariables): MutationRef<RevokeAccessGroupFromSectionData, RevokeAccessGroupFromSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RevokeAccessGroupFromSectionVariables): MutationRef<RevokeAccessGroupFromSectionData, RevokeAccessGroupFromSectionVariables>;
  operationName: string;
}
export const revokeAccessGroupFromSectionRef: RevokeAccessGroupFromSectionRef;

export function revokeAccessGroupFromSection(vars: RevokeAccessGroupFromSectionVariables): MutationPromise<RevokeAccessGroupFromSectionData, RevokeAccessGroupFromSectionVariables>;
export function revokeAccessGroupFromSection(dc: DataConnect, vars: RevokeAccessGroupFromSectionVariables): MutationPromise<RevokeAccessGroupFromSectionData, RevokeAccessGroupFromSectionVariables>;

