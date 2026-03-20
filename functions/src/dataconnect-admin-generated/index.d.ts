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

export interface AddUserToUserGroupAdminData {
  userUserGroup_upsert: UserUserGroup_Key;
}

export interface AddUserToUserGroupAdminVariables {
  userId: string;
  userGroupId: UUIDString;
  now: TimestampString;
}

export interface AddUserToUserGroupData {
  userUserGroup_upsert: UserUserGroup_Key;
}

export interface AddUserToUserGroupVariables {
  userId: string;
  userGroupId: UUIDString;
}

export interface CheckUserProfileExistsData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    membershipStatus: MembershipStatus;
  } & User_Key;
}

export interface CreateEventData {
  event_insert: Event_Key;
}

export interface CreateEventVariables {
  sectionId: UUIDString;
  title: string;
  location?: string | null;
  guestOfHonour?: string | null;
  startDateTime: TimestampString;
  endDateTime: TimestampString;
  bookingStartDateTime: TimestampString;
  bookingEndDateTime: TimestampString;
}

export interface CreateSectionData {
  section_insert: Section_Key;
}

export interface CreateSectionVariables {
  name: string;
  type: SectionType;
  description?: string | null;
}

export interface CreateTicketTypeData {
  ticketType_insert: TicketType_Key;
}

export interface CreateTicketTypeVariables {
  eventId: UUIDString;
  userGroupId: UUIDString;
  title: string;
  description?: string | null;
  price: number;
  sortOrder?: number | null;
}

export interface CreateUserData {
  user_upsert: User_Key;
}

export interface CreateUserGroupAdminData {
  userGroup_insert: UserGroup_Key;
}

export interface CreateUserGroupAdminVariables {
  name: string;
  description?: string | null;
  now: TimestampString;
}

export interface CreateUserGroupData {
  userGroup_insert: UserGroup_Key;
}

export interface CreateUserGroupVariables {
  name: string;
  description?: string | null;
  membershipStatuses?: MembershipStatus[] | null;
  subscribable?: boolean | null;
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

export interface DeleteEventData {
  event_delete?: Event_Key | null;
}

export interface DeleteEventVariables {
  id: UUIDString;
}

export interface DeleteSectionData {
  section_delete?: Section_Key | null;
}

export interface DeleteSectionVariables {
  id: UUIDString;
}

export interface DeleteTicketTypeData {
  ticketType_delete?: TicketType_Key | null;
}

export interface DeleteTicketTypeVariables {
  id: UUIDString;
}

export interface DeleteUserData {
  user_delete?: User_Key | null;
}

export interface DeleteUserGroupData {
  userGroup_delete?: UserGroup_Key | null;
}

export interface DeleteUserGroupVariables {
  id: UUIDString;
}

export interface DeleteUserVariables {
  userId: string;
}

export interface Event_Key {
  id: UUIDString;
  __typename?: 'Event_Key';
}

export interface GetAllUserGroupsWithStatusesData {
  userGroups: ({
    id: UUIDString;
    name: string;
    membershipStatuses?: MembershipStatus[] | null;
  } & UserGroup_Key)[];
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

export interface GetEventByIdData {
  event?: {
    id: UUIDString;
    section: {
      id: UUIDString;
    } & Section_Key;
      title: string;
      location?: string | null;
      guestOfHonour?: string | null;
      startDateTime: TimestampString;
      endDateTime: TimestampString;
      bookingStartDateTime: TimestampString;
      bookingEndDateTime: TimestampString;
      ticketTypes: ({
        id: UUIDString;
        title: string;
        description?: string | null;
        price: number;
        sortOrder: number;
        userGroup: {
          id: UUIDString;
          name: string;
        } & UserGroup_Key;
      } & TicketType_Key)[];
  } & Event_Key;
}

export interface GetEventByIdVariables {
  id: UUIDString;
}

export interface GetEventsForSectionData {
  section?: {
    id: UUIDString;
    events: ({
      id: UUIDString;
      title: string;
      location?: string | null;
      guestOfHonour?: string | null;
      startDateTime: TimestampString;
      endDateTime: TimestampString;
      bookingStartDateTime: TimestampString;
      bookingEndDateTime: TimestampString;
    } & Event_Key)[];
  } & Section_Key;
}

export interface GetEventsForSectionVariables {
  sectionId: UUIDString;
}

export interface GetSectionByIdData {
  section?: {
    id: UUIDString;
    name: string;
    type: SectionType;
    description?: string | null;
    isOpenForRegistration?: boolean | null;
    allowedUserGroups?: UUIDString[] | null;
    accessGroups: ({
      userGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
        subscribable?: boolean | null;
      } & UserGroup_Key;
    })[];
      memberGroups: ({
        userGroup: {
          id: UUIDString;
          name: string;
          description?: string | null;
          subscribable?: boolean | null;
        } & UserGroup_Key;
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
    memberGroups: ({
      userGroup: {
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
      } & UserGroup_Key;
    })[];
      accessGroups: ({
        userGroup: {
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
        } & UserGroup_Key;
      })[];
  } & Section_Key;
}

export interface GetSectionMembersVariables {
  sectionId: UUIDString;
}

export interface GetSectionsForUserData {
  user?: {
    id: string;
    membershipStatus: MembershipStatus;
    userGroups: ({
      userGroup: {
        id: UUIDString;
        name: string;
        membershipStatuses?: MembershipStatus[] | null;
        accessSections: ({
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
      } & UserGroup_Key;
    })[];
  } & User_Key;
    allUserGroups: ({
      id: UUIDString;
      name: string;
      membershipStatuses?: MembershipStatus[] | null;
      accessSections: ({
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
    } & UserGroup_Key)[];
}

export interface GetUserAccessGroupsByIdData {
  user?: {
    id: string;
    userGroups: ({
      userGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
      } & UserGroup_Key;
    })[];
  } & User_Key;
}

export interface GetUserAccessGroupsByIdVariables {
  userId: string;
}

export interface GetUserAccessGroupsData {
  user?: {
    id: string;
    userGroups: ({
      userGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
      } & UserGroup_Key;
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

export interface GetUserGroupByIdData {
  userGroup?: {
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
      accessSections: ({
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
  } & UserGroup_Key;
}

export interface GetUserGroupByIdVariables {
  id: UUIDString;
}

export interface GetUserGroupByNameData {
  userGroups: ({
    id: UUIDString;
    name: string;
    description?: string | null;
  } & UserGroup_Key)[];
}

export interface GetUserGroupByNameVariables {
  name: string;
}

export interface GetUserMembershipStatusData {
  user?: {
    membershipStatus: MembershipStatus;
  };
}

export interface GetUserMembershipStatusVariables {
  id: string;
}

export interface GetUserUserGroupsForAdminData {
  user?: {
    id: string;
    userGroups: ({
      userGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
      } & UserGroup_Key;
    })[];
  } & User_Key;
}

export interface GetUserUserGroupsForAdminVariables {
  userId: string;
}

export interface GetUserWithAccessGroupsData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    membershipStatus: MembershipStatus;
    userGroups: ({
      userGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
        membershipStatuses?: MembershipStatus[] | null;
      } & UserGroup_Key;
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
  userGroupId: UUIDString;
}

export interface GrantMemberGroupToSectionData {
  sectionMemberGroup_upsert: SectionMemberGroup_Key;
}

export interface GrantMemberGroupToSectionVariables {
  sectionId: UUIDString;
  userGroupId: UUIDString;
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

export interface ListUserGroupsData {
  userGroups: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    membershipStatuses?: MembershipStatus[] | null;
    subscribable?: boolean | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy?: string | null;
    updatedBy?: string | null;
  } & UserGroup_Key)[];
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
  userUserGroup_upsert: UserUserGroup_Key;
}

export interface RegisterForSectionVariables {
  userGroupId: UUIDString;
}

export interface RemoveUserFromUserGroupAdminData {
  userUserGroup_delete?: UserUserGroup_Key | null;
}

export interface RemoveUserFromUserGroupAdminVariables {
  userId: string;
  userGroupId: UUIDString;
}

export interface RemoveUserFromUserGroupData {
  userUserGroup_delete?: UserUserGroup_Key | null;
}

export interface RemoveUserFromUserGroupVariables {
  userId: string;
  userGroupId: UUIDString;
}

export interface RevokeAccessGroupFromSectionData {
  sectionAccessGroup_delete?: SectionAccessGroup_Key | null;
}

export interface RevokeAccessGroupFromSectionVariables {
  sectionId: UUIDString;
  userGroupId: UUIDString;
}

export interface RevokeMemberGroupFromSectionData {
  sectionMemberGroup_delete?: SectionMemberGroup_Key | null;
}

export interface RevokeMemberGroupFromSectionVariables {
  sectionId: UUIDString;
  userGroupId: UUIDString;
}

export interface SectionAccessGroup_Key {
  sectionId: UUIDString;
  userGroupId: UUIDString;
  __typename?: 'SectionAccessGroup_Key';
}

export interface SectionMemberGroup_Key {
  sectionId: UUIDString;
  userGroupId: UUIDString;
  __typename?: 'SectionMemberGroup_Key';
}

export interface Section_Key {
  id: UUIDString;
  __typename?: 'Section_Key';
}

export interface SubscribeToUserGroupData {
  userUserGroup_upsert: UserUserGroup_Key;
}

export interface SubscribeToUserGroupVariables {
  userGroupId: UUIDString;
}

export interface TicketType_Key {
  id: UUIDString;
  __typename?: 'TicketType_Key';
}

export interface UnregisterFromSectionData {
  userUserGroup_delete?: UserUserGroup_Key | null;
}

export interface UnregisterFromSectionVariables {
  userGroupId: UUIDString;
}

export interface UnsubscribeFromUserGroupData {
  userUserGroup_delete?: UserUserGroup_Key | null;
}

export interface UnsubscribeFromUserGroupVariables {
  userGroupId: UUIDString;
}

export interface UpdateEventData {
  event_update?: Event_Key | null;
}

export interface UpdateEventVariables {
  id: UUIDString;
  title: string;
  location?: string | null;
  guestOfHonour?: string | null;
  startDateTime: TimestampString;
  endDateTime: TimestampString;
  bookingStartDateTime: TimestampString;
  bookingEndDateTime: TimestampString;
}

export interface UpdateSectionData {
  section_update?: Section_Key | null;
}

export interface UpdateSectionVariables {
  id: UUIDString;
  name: string;
  description?: string | null;
}

export interface UpdateTicketTypeData {
  ticketType_update?: TicketType_Key | null;
}

export interface UpdateTicketTypeVariables {
  id: UUIDString;
  userGroupId: UUIDString;
  title: string;
  description?: string | null;
  price: number;
  sortOrder: number;
}

export interface UpdateUserData {
  user_upsert: User_Key;
}

export interface UpdateUserGroupData {
  userGroup_update?: UserGroup_Key | null;
}

export interface UpdateUserGroupVariables {
  id: UUIDString;
  name: string;
  description?: string | null;
  membershipStatuses?: MembershipStatus[] | null;
  subscribable?: boolean | null;
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

export interface UserGroup_Key {
  id: UUIDString;
  __typename?: 'UserGroup_Key';
}

export interface UserUserGroup_Key {
  userId: string;
  userGroupId: UUIDString;
  __typename?: 'UserUserGroup_Key';
}

export interface User_Key {
  id: string;
  __typename?: 'User_Key';
}

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

/** Generated Node Admin SDK operation action function for the 'SubscribeToUserGroup' Mutation. Allow users to execute without passing in DataConnect. */
export function subscribeToUserGroup(dc: DataConnect, vars: SubscribeToUserGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubscribeToUserGroupData>>;
/** Generated Node Admin SDK operation action function for the 'SubscribeToUserGroup' Mutation. Allow users to pass in custom DataConnect instances. */
export function subscribeToUserGroup(vars: SubscribeToUserGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubscribeToUserGroupData>>;

/** Generated Node Admin SDK operation action function for the 'UnsubscribeFromUserGroup' Mutation. Allow users to execute without passing in DataConnect. */
export function unsubscribeFromUserGroup(dc: DataConnect, vars: UnsubscribeFromUserGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UnsubscribeFromUserGroupData>>;
/** Generated Node Admin SDK operation action function for the 'UnsubscribeFromUserGroup' Mutation. Allow users to pass in custom DataConnect instances. */
export function unsubscribeFromUserGroup(vars: UnsubscribeFromUserGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UnsubscribeFromUserGroupData>>;

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

/** Generated Node Admin SDK operation action function for the 'CreateUserGroupAdmin' Mutation. Allow users to execute without passing in DataConnect. */
export function createUserGroupAdmin(dc: DataConnect, vars: CreateUserGroupAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserGroupAdminData>>;
/** Generated Node Admin SDK operation action function for the 'CreateUserGroupAdmin' Mutation. Allow users to pass in custom DataConnect instances. */
export function createUserGroupAdmin(vars: CreateUserGroupAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserGroupAdminData>>;

/** Generated Node Admin SDK operation action function for the 'AddUserToUserGroupAdmin' Mutation. Allow users to execute without passing in DataConnect. */
export function addUserToUserGroupAdmin(dc: DataConnect, vars: AddUserToUserGroupAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddUserToUserGroupAdminData>>;
/** Generated Node Admin SDK operation action function for the 'AddUserToUserGroupAdmin' Mutation. Allow users to pass in custom DataConnect instances. */
export function addUserToUserGroupAdmin(vars: AddUserToUserGroupAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddUserToUserGroupAdminData>>;

/** Generated Node Admin SDK operation action function for the 'RemoveUserFromUserGroupAdmin' Mutation. Allow users to execute without passing in DataConnect. */
export function removeUserFromUserGroupAdmin(dc: DataConnect, vars: RemoveUserFromUserGroupAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemoveUserFromUserGroupAdminData>>;
/** Generated Node Admin SDK operation action function for the 'RemoveUserFromUserGroupAdmin' Mutation. Allow users to pass in custom DataConnect instances. */
export function removeUserFromUserGroupAdmin(vars: RemoveUserFromUserGroupAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemoveUserFromUserGroupAdminData>>;

/** Generated Node Admin SDK operation action function for the 'GetUserGroupByName' Query. Allow users to execute without passing in DataConnect. */
export function getUserGroupByName(dc: DataConnect, vars: GetUserGroupByNameVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserGroupByNameData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserGroupByName' Query. Allow users to pass in custom DataConnect instances. */
export function getUserGroupByName(vars: GetUserGroupByNameVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserGroupByNameData>>;

/** Generated Node Admin SDK operation action function for the 'GetUserUserGroupsForAdmin' Query. Allow users to execute without passing in DataConnect. */
export function getUserUserGroupsForAdmin(dc: DataConnect, vars: GetUserUserGroupsForAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserUserGroupsForAdminData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserUserGroupsForAdmin' Query. Allow users to pass in custom DataConnect instances. */
export function getUserUserGroupsForAdmin(vars: GetUserUserGroupsForAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserUserGroupsForAdminData>>;

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

/** Generated Node Admin SDK operation action function for the 'ListUserGroups' Query. Allow users to execute without passing in DataConnect. */
export function listUserGroups(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListUserGroupsData>>;
/** Generated Node Admin SDK operation action function for the 'ListUserGroups' Query. Allow users to pass in custom DataConnect instances. */
export function listUserGroups(options?: OperationOptions): Promise<ExecuteOperationResponse<ListUserGroupsData>>;

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

/** Generated Node Admin SDK operation action function for the 'GetEventsForSection' Query. Allow users to execute without passing in DataConnect. */
export function getEventsForSection(dc: DataConnect, vars: GetEventsForSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetEventsForSectionData>>;
/** Generated Node Admin SDK operation action function for the 'GetEventsForSection' Query. Allow users to pass in custom DataConnect instances. */
export function getEventsForSection(vars: GetEventsForSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetEventsForSectionData>>;

/** Generated Node Admin SDK operation action function for the 'GetEventById' Query. Allow users to execute without passing in DataConnect. */
export function getEventById(dc: DataConnect, vars: GetEventByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetEventByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetEventById' Query. Allow users to pass in custom DataConnect instances. */
export function getEventById(vars: GetEventByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetEventByIdData>>;

/** Generated Node Admin SDK operation action function for the 'GetSectionById' Query. Allow users to execute without passing in DataConnect. */
export function getSectionById(dc: DataConnect, vars: GetSectionByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetSectionById' Query. Allow users to pass in custom DataConnect instances. */
export function getSectionById(vars: GetSectionByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionByIdData>>;

/** Generated Node Admin SDK operation action function for the 'GetUserGroupById' Query. Allow users to execute without passing in DataConnect. */
export function getUserGroupById(dc: DataConnect, vars: GetUserGroupByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserGroupByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserGroupById' Query. Allow users to pass in custom DataConnect instances. */
export function getUserGroupById(vars: GetUserGroupByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserGroupByIdData>>;

/** Generated Node Admin SDK operation action function for the 'GetAllUserGroupsWithStatuses' Query. Allow users to execute without passing in DataConnect. */
export function getAllUserGroupsWithStatuses(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAllUserGroupsWithStatusesData>>;
/** Generated Node Admin SDK operation action function for the 'GetAllUserGroupsWithStatuses' Query. Allow users to pass in custom DataConnect instances. */
export function getAllUserGroupsWithStatuses(options?: OperationOptions): Promise<ExecuteOperationResponse<GetAllUserGroupsWithStatusesData>>;

/** Generated Node Admin SDK operation action function for the 'GetSectionMembers' Query. Allow users to execute without passing in DataConnect. */
export function getSectionMembers(dc: DataConnect, vars: GetSectionMembersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionMembersData>>;
/** Generated Node Admin SDK operation action function for the 'GetSectionMembers' Query. Allow users to pass in custom DataConnect instances. */
export function getSectionMembers(vars: GetSectionMembersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionMembersData>>;

/** Generated Node Admin SDK operation action function for the 'CreateSection' Mutation. Allow users to execute without passing in DataConnect. */
export function createSection(dc: DataConnect, vars: CreateSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSectionData>>;
/** Generated Node Admin SDK operation action function for the 'CreateSection' Mutation. Allow users to pass in custom DataConnect instances. */
export function createSection(vars: CreateSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSectionData>>;

/** Generated Node Admin SDK operation action function for the 'CreateUserGroup' Mutation. Allow users to execute without passing in DataConnect. */
export function createUserGroup(dc: DataConnect, vars: CreateUserGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserGroupData>>;
/** Generated Node Admin SDK operation action function for the 'CreateUserGroup' Mutation. Allow users to pass in custom DataConnect instances. */
export function createUserGroup(vars: CreateUserGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserGroupData>>;

/** Generated Node Admin SDK operation action function for the 'AddUserToUserGroup' Mutation. Allow users to execute without passing in DataConnect. */
export function addUserToUserGroup(dc: DataConnect, vars: AddUserToUserGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddUserToUserGroupData>>;
/** Generated Node Admin SDK operation action function for the 'AddUserToUserGroup' Mutation. Allow users to pass in custom DataConnect instances. */
export function addUserToUserGroup(vars: AddUserToUserGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddUserToUserGroupData>>;

/** Generated Node Admin SDK operation action function for the 'RemoveUserFromUserGroup' Mutation. Allow users to execute without passing in DataConnect. */
export function removeUserFromUserGroup(dc: DataConnect, vars: RemoveUserFromUserGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemoveUserFromUserGroupData>>;
/** Generated Node Admin SDK operation action function for the 'RemoveUserFromUserGroup' Mutation. Allow users to pass in custom DataConnect instances. */
export function removeUserFromUserGroup(vars: RemoveUserFromUserGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemoveUserFromUserGroupData>>;

/** Generated Node Admin SDK operation action function for the 'GrantAccessGroupToSection' Mutation. Allow users to execute without passing in DataConnect. */
export function grantAccessGroupToSection(dc: DataConnect, vars: GrantAccessGroupToSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GrantAccessGroupToSectionData>>;
/** Generated Node Admin SDK operation action function for the 'GrantAccessGroupToSection' Mutation. Allow users to pass in custom DataConnect instances. */
export function grantAccessGroupToSection(vars: GrantAccessGroupToSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GrantAccessGroupToSectionData>>;

/** Generated Node Admin SDK operation action function for the 'RevokeAccessGroupFromSection' Mutation. Allow users to execute without passing in DataConnect. */
export function revokeAccessGroupFromSection(dc: DataConnect, vars: RevokeAccessGroupFromSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RevokeAccessGroupFromSectionData>>;
/** Generated Node Admin SDK operation action function for the 'RevokeAccessGroupFromSection' Mutation. Allow users to pass in custom DataConnect instances. */
export function revokeAccessGroupFromSection(vars: RevokeAccessGroupFromSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RevokeAccessGroupFromSectionData>>;

/** Generated Node Admin SDK operation action function for the 'GrantMemberGroupToSection' Mutation. Allow users to execute without passing in DataConnect. */
export function grantMemberGroupToSection(dc: DataConnect, vars: GrantMemberGroupToSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GrantMemberGroupToSectionData>>;
/** Generated Node Admin SDK operation action function for the 'GrantMemberGroupToSection' Mutation. Allow users to pass in custom DataConnect instances. */
export function grantMemberGroupToSection(vars: GrantMemberGroupToSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GrantMemberGroupToSectionData>>;

/** Generated Node Admin SDK operation action function for the 'RevokeMemberGroupFromSection' Mutation. Allow users to execute without passing in DataConnect. */
export function revokeMemberGroupFromSection(dc: DataConnect, vars: RevokeMemberGroupFromSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RevokeMemberGroupFromSectionData>>;
/** Generated Node Admin SDK operation action function for the 'RevokeMemberGroupFromSection' Mutation. Allow users to pass in custom DataConnect instances. */
export function revokeMemberGroupFromSection(vars: RevokeMemberGroupFromSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RevokeMemberGroupFromSectionData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateUserGroup' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUserGroup(dc: DataConnect, vars: UpdateUserGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserGroupData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUserGroup' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUserGroup(vars: UpdateUserGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserGroupData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteUserGroup' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteUserGroup(dc: DataConnect, vars: DeleteUserGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserGroupData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteUserGroup' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteUserGroup(vars: DeleteUserGroupVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserGroupData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateSection' Mutation. Allow users to execute without passing in DataConnect. */
export function updateSection(dc: DataConnect, vars: UpdateSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSectionData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateSection' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateSection(vars: UpdateSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSectionData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteSection' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteSection(dc: DataConnect, vars: DeleteSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteSectionData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteSection' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteSection(vars: DeleteSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteSectionData>>;

/** Generated Node Admin SDK operation action function for the 'CreateEvent' Mutation. Allow users to execute without passing in DataConnect. */
export function createEvent(dc: DataConnect, vars: CreateEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateEventData>>;
/** Generated Node Admin SDK operation action function for the 'CreateEvent' Mutation. Allow users to pass in custom DataConnect instances. */
export function createEvent(vars: CreateEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateEventData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateEvent' Mutation. Allow users to execute without passing in DataConnect. */
export function updateEvent(dc: DataConnect, vars: UpdateEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateEventData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateEvent' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateEvent(vars: UpdateEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateEventData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteEvent' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteEvent(dc: DataConnect, vars: DeleteEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteEventData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteEvent' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteEvent(vars: DeleteEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteEventData>>;

/** Generated Node Admin SDK operation action function for the 'CreateTicketType' Mutation. Allow users to execute without passing in DataConnect. */
export function createTicketType(dc: DataConnect, vars: CreateTicketTypeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTicketTypeData>>;
/** Generated Node Admin SDK operation action function for the 'CreateTicketType' Mutation. Allow users to pass in custom DataConnect instances. */
export function createTicketType(vars: CreateTicketTypeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTicketTypeData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateTicketType' Mutation. Allow users to execute without passing in DataConnect. */
export function updateTicketType(dc: DataConnect, vars: UpdateTicketTypeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateTicketTypeData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateTicketType' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateTicketType(vars: UpdateTicketTypeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateTicketTypeData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteTicketType' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteTicketType(dc: DataConnect, vars: DeleteTicketTypeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteTicketTypeData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteTicketType' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteTicketType(vars: DeleteTicketTypeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteTicketTypeData>>;

