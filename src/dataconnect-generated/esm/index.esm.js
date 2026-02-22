import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const MembershipStatus = {
  PENDING: "PENDING",
  REGULAR: "REGULAR",
  RESERVE: "RESERVE",
  CIVIL_SERVICE: "CIVIL_SERVICE",
  INDUSTRY: "INDUSTRY",
  RETIRED: "RETIRED",
  RESIGNED: "RESIGNED",
  LOST: "LOST",
  DECEASED: "DECEASED",
}

export const SectionType = {
  MEMBERS: "MEMBERS",
  EVENTS: "EVENTS",
}

export const connectorConfig = {
  connector: 'api',
  service: 'sodc-web-service',
  location: 'europe-west2'
};

export const createUserProfileRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUserProfile', inputVars);
}
createUserProfileRef.operationName = 'CreateUserProfile';

export function createUserProfile(dcOrVars, vars) {
  return executeMutation(createUserProfileRef(dcOrVars, vars));
}

export const upsertUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertUser', inputVars);
}
upsertUserRef.operationName = 'UpsertUser';

export function upsertUser(dcOrVars, vars) {
  return executeMutation(upsertUserRef(dcOrVars, vars));
}

export const updateUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUser', inputVars);
}
updateUserRef.operationName = 'UpdateUser';

export function updateUser(dcOrVars, vars) {
  return executeMutation(updateUserRef(dcOrVars, vars));
}

export const registerForSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RegisterForSection', inputVars);
}
registerForSectionRef.operationName = 'RegisterForSection';

export function registerForSection(dcOrVars, vars) {
  return executeMutation(registerForSectionRef(dcOrVars, vars));
}

export const unregisterFromSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UnregisterFromSection', inputVars);
}
unregisterFromSectionRef.operationName = 'UnregisterFromSection';

export function unregisterFromSection(dcOrVars, vars) {
  return executeMutation(unregisterFromSectionRef(dcOrVars, vars));
}

export const subscribeToAccessGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'SubscribeToAccessGroup', inputVars);
}
subscribeToAccessGroupRef.operationName = 'SubscribeToAccessGroup';

export function subscribeToAccessGroup(dcOrVars, vars) {
  return executeMutation(subscribeToAccessGroupRef(dcOrVars, vars));
}

export const unsubscribeFromAccessGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UnsubscribeFromAccessGroup', inputVars);
}
unsubscribeFromAccessGroupRef.operationName = 'UnsubscribeFromAccessGroup';

export function unsubscribeFromAccessGroup(dcOrVars, vars) {
  return executeMutation(unsubscribeFromAccessGroupRef(dcOrVars, vars));
}

export const createSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSection', inputVars);
}
createSectionRef.operationName = 'CreateSection';

export function createSection(dcOrVars, vars) {
  return executeMutation(createSectionRef(dcOrVars, vars));
}

export const createAccessGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAccessGroup', inputVars);
}
createAccessGroupRef.operationName = 'CreateAccessGroup';

export function createAccessGroup(dcOrVars, vars) {
  return executeMutation(createAccessGroupRef(dcOrVars, vars));
}

export const addUserToAccessGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddUserToAccessGroup', inputVars);
}
addUserToAccessGroupRef.operationName = 'AddUserToAccessGroup';

export function addUserToAccessGroup(dcOrVars, vars) {
  return executeMutation(addUserToAccessGroupRef(dcOrVars, vars));
}

export const removeUserFromAccessGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveUserFromAccessGroup', inputVars);
}
removeUserFromAccessGroupRef.operationName = 'RemoveUserFromAccessGroup';

export function removeUserFromAccessGroup(dcOrVars, vars) {
  return executeMutation(removeUserFromAccessGroupRef(dcOrVars, vars));
}

export const grantViewAccessGroupToSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'GrantViewAccessGroupToSection', inputVars);
}
grantViewAccessGroupToSectionRef.operationName = 'GrantViewAccessGroupToSection';

export function grantViewAccessGroupToSection(dcOrVars, vars) {
  return executeMutation(grantViewAccessGroupToSectionRef(dcOrVars, vars));
}

export const revokeViewAccessGroupFromSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RevokeViewAccessGroupFromSection', inputVars);
}
revokeViewAccessGroupFromSectionRef.operationName = 'RevokeViewAccessGroupFromSection';

export function revokeViewAccessGroupFromSection(dcOrVars, vars) {
  return executeMutation(revokeViewAccessGroupFromSectionRef(dcOrVars, vars));
}

export const grantMemberAccessGroupToSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'GrantMemberAccessGroupToSection', inputVars);
}
grantMemberAccessGroupToSectionRef.operationName = 'GrantMemberAccessGroupToSection';

export function grantMemberAccessGroupToSection(dcOrVars, vars) {
  return executeMutation(grantMemberAccessGroupToSectionRef(dcOrVars, vars));
}

export const revokeMemberAccessGroupFromSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RevokeMemberAccessGroupFromSection', inputVars);
}
revokeMemberAccessGroupFromSectionRef.operationName = 'RevokeMemberAccessGroupFromSection';

export function revokeMemberAccessGroupFromSection(dcOrVars, vars) {
  return executeMutation(revokeMemberAccessGroupFromSectionRef(dcOrVars, vars));
}

export const updateAccessGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAccessGroup', inputVars);
}
updateAccessGroupRef.operationName = 'UpdateAccessGroup';

export function updateAccessGroup(dcOrVars, vars) {
  return executeMutation(updateAccessGroupRef(dcOrVars, vars));
}

export const deleteAccessGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteAccessGroup', inputVars);
}
deleteAccessGroupRef.operationName = 'DeleteAccessGroup';

export function deleteAccessGroup(dcOrVars, vars) {
  return executeMutation(deleteAccessGroupRef(dcOrVars, vars));
}

export const updateSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSection', inputVars);
}
updateSectionRef.operationName = 'UpdateSection';

export function updateSection(dcOrVars, vars) {
  return executeMutation(updateSectionRef(dcOrVars, vars));
}

export const deleteSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteSection', inputVars);
}
deleteSectionRef.operationName = 'DeleteSection';

export function deleteSection(dcOrVars, vars) {
  return executeMutation(deleteSectionRef(dcOrVars, vars));
}

export const updateUserMembershipStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUserMembershipStatus', inputVars);
}
updateUserMembershipStatusRef.operationName = 'UpdateUserMembershipStatus';

export function updateUserMembershipStatus(dcOrVars, vars) {
  return executeMutation(updateUserMembershipStatusRef(dcOrVars, vars));
}

export const deleteUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteUser', inputVars);
}
deleteUserRef.operationName = 'DeleteUser';

export function deleteUser(dcOrVars, vars) {
  return executeMutation(deleteUserRef(dcOrVars, vars));
}

export const createUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUser', inputVars);
}
createUserRef.operationName = 'CreateUser';

export function createUser(dcOrVars, vars) {
  return executeMutation(createUserRef(dcOrVars, vars));
}

export const createAccessGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAccessGroupAdmin', inputVars);
}
createAccessGroupAdminRef.operationName = 'CreateAccessGroupAdmin';

export function createAccessGroupAdmin(dcOrVars, vars) {
  return executeMutation(createAccessGroupAdminRef(dcOrVars, vars));
}

export const addUserToAccessGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddUserToAccessGroupAdmin', inputVars);
}
addUserToAccessGroupAdminRef.operationName = 'AddUserToAccessGroupAdmin';

export function addUserToAccessGroupAdmin(dcOrVars, vars) {
  return executeMutation(addUserToAccessGroupAdminRef(dcOrVars, vars));
}

export const removeUserFromAccessGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveUserFromAccessGroupAdmin', inputVars);
}
removeUserFromAccessGroupAdminRef.operationName = 'RemoveUserFromAccessGroupAdmin';

export function removeUserFromAccessGroupAdmin(dcOrVars, vars) {
  return executeMutation(removeUserFromAccessGroupAdminRef(dcOrVars, vars));
}

export const getAccessGroupByNameRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAccessGroupByName', inputVars);
}
getAccessGroupByNameRef.operationName = 'GetAccessGroupByName';

export function getAccessGroupByName(dcOrVars, vars) {
  return executeQuery(getAccessGroupByNameRef(dcOrVars, vars));
}

export const getUserAccessGroupsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserAccessGroupsForAdmin', inputVars);
}
getUserAccessGroupsForAdminRef.operationName = 'GetUserAccessGroupsForAdmin';

export function getUserAccessGroupsForAdmin(dcOrVars, vars) {
  return executeQuery(getUserAccessGroupsForAdminRef(dcOrVars, vars));
}

export const getCurrentUserRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetCurrentUser');
}
getCurrentUserRef.operationName = 'GetCurrentUser';

export function getCurrentUser(dc) {
  return executeQuery(getCurrentUserRef(dc));
}

export const getUserByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserById', inputVars);
}
getUserByIdRef.operationName = 'GetUserById';

export function getUserById(dcOrVars, vars) {
  return executeQuery(getUserByIdRef(dcOrVars, vars));
}

export const listUsersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListUsers');
}
listUsersRef.operationName = 'ListUsers';

export function listUsers(dc) {
  return executeQuery(listUsersRef(dc));
}

export const listSectionsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSections');
}
listSectionsRef.operationName = 'ListSections';

export function listSections(dc) {
  return executeQuery(listSectionsRef(dc));
}

export const getSectionsForUserRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionsForUser');
}
getSectionsForUserRef.operationName = 'GetSectionsForUser';

export function getSectionsForUser(dc) {
  return executeQuery(getSectionsForUserRef(dc));
}

export const listAccessGroupsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAccessGroups');
}
listAccessGroupsRef.operationName = 'ListAccessGroups';

export function listAccessGroups(dc) {
  return executeQuery(listAccessGroupsRef(dc));
}

export const getUserAccessGroupsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserAccessGroups');
}
getUserAccessGroupsRef.operationName = 'GetUserAccessGroups';

export function getUserAccessGroups(dc) {
  return executeQuery(getUserAccessGroupsRef(dc));
}

export const checkUserProfileExistsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'CheckUserProfileExists');
}
checkUserProfileExistsRef.operationName = 'CheckUserProfileExists';

export function checkUserProfileExists(dc) {
  return executeQuery(checkUserProfileExistsRef(dc));
}

export const getUserMembershipStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserMembershipStatus', inputVars);
}
getUserMembershipStatusRef.operationName = 'GetUserMembershipStatus';

export function getUserMembershipStatus(dcOrVars, vars) {
  return executeQuery(getUserMembershipStatusRef(dcOrVars, vars));
}

export const getUserWithAccessGroupsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserWithAccessGroups', inputVars);
}
getUserWithAccessGroupsRef.operationName = 'GetUserWithAccessGroups';

export function getUserWithAccessGroups(dcOrVars, vars) {
  return executeQuery(getUserWithAccessGroupsRef(dcOrVars, vars));
}

export const getUserAccessGroupsByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserAccessGroupsById', inputVars);
}
getUserAccessGroupsByIdRef.operationName = 'GetUserAccessGroupsById';

export function getUserAccessGroupsById(dcOrVars, vars) {
  return executeQuery(getUserAccessGroupsByIdRef(dcOrVars, vars));
}

export const getEventsForSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEventsForSection', inputVars);
}
getEventsForSectionRef.operationName = 'GetEventsForSection';

export function getEventsForSection(dcOrVars, vars) {
  return executeQuery(getEventsForSectionRef(dcOrVars, vars));
}

export const getEventByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEventById', inputVars);
}
getEventByIdRef.operationName = 'GetEventById';

export function getEventById(dcOrVars, vars) {
  return executeQuery(getEventByIdRef(dcOrVars, vars));
}

export const getSectionByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionById', inputVars);
}
getSectionByIdRef.operationName = 'GetSectionById';

export function getSectionById(dcOrVars, vars) {
  return executeQuery(getSectionByIdRef(dcOrVars, vars));
}

export const getAccessGroupByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAccessGroupById', inputVars);
}
getAccessGroupByIdRef.operationName = 'GetAccessGroupById';

export function getAccessGroupById(dcOrVars, vars) {
  return executeQuery(getAccessGroupByIdRef(dcOrVars, vars));
}

export const getAllAccessGroupsWithStatusesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAllAccessGroupsWithStatuses');
}
getAllAccessGroupsWithStatusesRef.operationName = 'GetAllAccessGroupsWithStatuses';

export function getAllAccessGroupsWithStatuses(dc) {
  return executeQuery(getAllAccessGroupsWithStatusesRef(dc));
}

export const getSectionMembersRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionMembers', inputVars);
}
getSectionMembersRef.operationName = 'GetSectionMembers';

export function getSectionMembers(dcOrVars, vars) {
  return executeQuery(getSectionMembersRef(dcOrVars, vars));
}

