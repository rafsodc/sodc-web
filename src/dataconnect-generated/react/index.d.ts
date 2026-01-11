import { CreateUserProfileData, CreateUserProfileVariables, UpsertUserData, UpsertUserVariables, UpdateUserData, UpdateUserVariables, CreateSectionData, CreateSectionVariables, CreateAccessGroupData, CreateAccessGroupVariables, AddUserToAccessGroupData, AddUserToAccessGroupVariables, RemoveUserFromAccessGroupData, RemoveUserFromAccessGroupVariables, GrantAccessGroupToSectionData, GrantAccessGroupToSectionVariables, RevokeAccessGroupFromSectionData, RevokeAccessGroupFromSectionVariables, GetCurrentUserData, GetUserByIdData, GetUserByIdVariables, ListUsersData, ListSectionsData, GetSectionsForUserData, ListAccessGroupsData, GetUserAccessGroupsData, CheckUserProfileExistsData, GetUserMembershipStatusData, GetUserMembershipStatusVariables, UpdateUserMembershipStatusData, UpdateUserMembershipStatusVariables, DeleteUserData, DeleteUserVariables, CreateUserData, CreateUserVariables, UpdateUserByAdminData, UpdateUserByAdminVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateUserProfile(options?: useDataConnectMutationOptions<CreateUserProfileData, FirebaseError, CreateUserProfileVariables>): UseDataConnectMutationResult<CreateUserProfileData, CreateUserProfileVariables>;
export function useCreateUserProfile(dc: DataConnect, options?: useDataConnectMutationOptions<CreateUserProfileData, FirebaseError, CreateUserProfileVariables>): UseDataConnectMutationResult<CreateUserProfileData, CreateUserProfileVariables>;

export function useUpsertUser(options?: useDataConnectMutationOptions<UpsertUserData, FirebaseError, UpsertUserVariables>): UseDataConnectMutationResult<UpsertUserData, UpsertUserVariables>;
export function useUpsertUser(dc: DataConnect, options?: useDataConnectMutationOptions<UpsertUserData, FirebaseError, UpsertUserVariables>): UseDataConnectMutationResult<UpsertUserData, UpsertUserVariables>;

export function useUpdateUser(options?: useDataConnectMutationOptions<UpdateUserData, FirebaseError, UpdateUserVariables>): UseDataConnectMutationResult<UpdateUserData, UpdateUserVariables>;
export function useUpdateUser(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateUserData, FirebaseError, UpdateUserVariables>): UseDataConnectMutationResult<UpdateUserData, UpdateUserVariables>;

export function useCreateSection(options?: useDataConnectMutationOptions<CreateSectionData, FirebaseError, CreateSectionVariables>): UseDataConnectMutationResult<CreateSectionData, CreateSectionVariables>;
export function useCreateSection(dc: DataConnect, options?: useDataConnectMutationOptions<CreateSectionData, FirebaseError, CreateSectionVariables>): UseDataConnectMutationResult<CreateSectionData, CreateSectionVariables>;

export function useCreateAccessGroup(options?: useDataConnectMutationOptions<CreateAccessGroupData, FirebaseError, CreateAccessGroupVariables>): UseDataConnectMutationResult<CreateAccessGroupData, CreateAccessGroupVariables>;
export function useCreateAccessGroup(dc: DataConnect, options?: useDataConnectMutationOptions<CreateAccessGroupData, FirebaseError, CreateAccessGroupVariables>): UseDataConnectMutationResult<CreateAccessGroupData, CreateAccessGroupVariables>;

export function useAddUserToAccessGroup(options?: useDataConnectMutationOptions<AddUserToAccessGroupData, FirebaseError, AddUserToAccessGroupVariables>): UseDataConnectMutationResult<AddUserToAccessGroupData, AddUserToAccessGroupVariables>;
export function useAddUserToAccessGroup(dc: DataConnect, options?: useDataConnectMutationOptions<AddUserToAccessGroupData, FirebaseError, AddUserToAccessGroupVariables>): UseDataConnectMutationResult<AddUserToAccessGroupData, AddUserToAccessGroupVariables>;

export function useRemoveUserFromAccessGroup(options?: useDataConnectMutationOptions<RemoveUserFromAccessGroupData, FirebaseError, RemoveUserFromAccessGroupVariables>): UseDataConnectMutationResult<RemoveUserFromAccessGroupData, RemoveUserFromAccessGroupVariables>;
export function useRemoveUserFromAccessGroup(dc: DataConnect, options?: useDataConnectMutationOptions<RemoveUserFromAccessGroupData, FirebaseError, RemoveUserFromAccessGroupVariables>): UseDataConnectMutationResult<RemoveUserFromAccessGroupData, RemoveUserFromAccessGroupVariables>;

export function useGrantAccessGroupToSection(options?: useDataConnectMutationOptions<GrantAccessGroupToSectionData, FirebaseError, GrantAccessGroupToSectionVariables>): UseDataConnectMutationResult<GrantAccessGroupToSectionData, GrantAccessGroupToSectionVariables>;
export function useGrantAccessGroupToSection(dc: DataConnect, options?: useDataConnectMutationOptions<GrantAccessGroupToSectionData, FirebaseError, GrantAccessGroupToSectionVariables>): UseDataConnectMutationResult<GrantAccessGroupToSectionData, GrantAccessGroupToSectionVariables>;

export function useRevokeAccessGroupFromSection(options?: useDataConnectMutationOptions<RevokeAccessGroupFromSectionData, FirebaseError, RevokeAccessGroupFromSectionVariables>): UseDataConnectMutationResult<RevokeAccessGroupFromSectionData, RevokeAccessGroupFromSectionVariables>;
export function useRevokeAccessGroupFromSection(dc: DataConnect, options?: useDataConnectMutationOptions<RevokeAccessGroupFromSectionData, FirebaseError, RevokeAccessGroupFromSectionVariables>): UseDataConnectMutationResult<RevokeAccessGroupFromSectionData, RevokeAccessGroupFromSectionVariables>;

export function useGetCurrentUser(options?: useDataConnectQueryOptions<GetCurrentUserData>): UseDataConnectQueryResult<GetCurrentUserData, undefined>;
export function useGetCurrentUser(dc: DataConnect, options?: useDataConnectQueryOptions<GetCurrentUserData>): UseDataConnectQueryResult<GetCurrentUserData, undefined>;

export function useGetUserById(vars: GetUserByIdVariables, options?: useDataConnectQueryOptions<GetUserByIdData>): UseDataConnectQueryResult<GetUserByIdData, GetUserByIdVariables>;
export function useGetUserById(dc: DataConnect, vars: GetUserByIdVariables, options?: useDataConnectQueryOptions<GetUserByIdData>): UseDataConnectQueryResult<GetUserByIdData, GetUserByIdVariables>;

export function useListUsers(options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;
export function useListUsers(dc: DataConnect, options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;

export function useListSections(options?: useDataConnectQueryOptions<ListSectionsData>): UseDataConnectQueryResult<ListSectionsData, undefined>;
export function useListSections(dc: DataConnect, options?: useDataConnectQueryOptions<ListSectionsData>): UseDataConnectQueryResult<ListSectionsData, undefined>;

export function useGetSectionsForUser(options?: useDataConnectQueryOptions<GetSectionsForUserData>): UseDataConnectQueryResult<GetSectionsForUserData, undefined>;
export function useGetSectionsForUser(dc: DataConnect, options?: useDataConnectQueryOptions<GetSectionsForUserData>): UseDataConnectQueryResult<GetSectionsForUserData, undefined>;

export function useListAccessGroups(options?: useDataConnectQueryOptions<ListAccessGroupsData>): UseDataConnectQueryResult<ListAccessGroupsData, undefined>;
export function useListAccessGroups(dc: DataConnect, options?: useDataConnectQueryOptions<ListAccessGroupsData>): UseDataConnectQueryResult<ListAccessGroupsData, undefined>;

export function useGetUserAccessGroups(options?: useDataConnectQueryOptions<GetUserAccessGroupsData>): UseDataConnectQueryResult<GetUserAccessGroupsData, undefined>;
export function useGetUserAccessGroups(dc: DataConnect, options?: useDataConnectQueryOptions<GetUserAccessGroupsData>): UseDataConnectQueryResult<GetUserAccessGroupsData, undefined>;

export function useCheckUserProfileExists(options?: useDataConnectQueryOptions<CheckUserProfileExistsData>): UseDataConnectQueryResult<CheckUserProfileExistsData, undefined>;
export function useCheckUserProfileExists(dc: DataConnect, options?: useDataConnectQueryOptions<CheckUserProfileExistsData>): UseDataConnectQueryResult<CheckUserProfileExistsData, undefined>;

export function useGetUserMembershipStatus(vars: GetUserMembershipStatusVariables, options?: useDataConnectQueryOptions<GetUserMembershipStatusData>): UseDataConnectQueryResult<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;
export function useGetUserMembershipStatus(dc: DataConnect, vars: GetUserMembershipStatusVariables, options?: useDataConnectQueryOptions<GetUserMembershipStatusData>): UseDataConnectQueryResult<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;

export function useUpdateUserMembershipStatus(options?: useDataConnectMutationOptions<UpdateUserMembershipStatusData, FirebaseError, UpdateUserMembershipStatusVariables>): UseDataConnectMutationResult<UpdateUserMembershipStatusData, UpdateUserMembershipStatusVariables>;
export function useUpdateUserMembershipStatus(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateUserMembershipStatusData, FirebaseError, UpdateUserMembershipStatusVariables>): UseDataConnectMutationResult<UpdateUserMembershipStatusData, UpdateUserMembershipStatusVariables>;

export function useDeleteUser(options?: useDataConnectMutationOptions<DeleteUserData, FirebaseError, DeleteUserVariables>): UseDataConnectMutationResult<DeleteUserData, DeleteUserVariables>;
export function useDeleteUser(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteUserData, FirebaseError, DeleteUserVariables>): UseDataConnectMutationResult<DeleteUserData, DeleteUserVariables>;

export function useCreateUser(options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, CreateUserVariables>): UseDataConnectMutationResult<CreateUserData, CreateUserVariables>;
export function useCreateUser(dc: DataConnect, options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, CreateUserVariables>): UseDataConnectMutationResult<CreateUserData, CreateUserVariables>;

export function useUpdateUserByAdmin(options?: useDataConnectMutationOptions<UpdateUserByAdminData, FirebaseError, UpdateUserByAdminVariables>): UseDataConnectMutationResult<UpdateUserByAdminData, UpdateUserByAdminVariables>;
export function useUpdateUserByAdmin(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateUserByAdminData, FirebaseError, UpdateUserByAdminVariables>): UseDataConnectMutationResult<UpdateUserByAdminData, UpdateUserByAdminVariables>;
