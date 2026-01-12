const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const MembershipStatus = {
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
exports.MembershipStatus = MembershipStatus;

const SectionType = {
  MEMBERS: "MEMBERS",
  EVENTS: "EVENTS",
}
exports.SectionType = SectionType;

const connectorConfig = {
  connector: 'api',
  service: 'sodc-web-service',
  location: 'europe-west2'
};
exports.connectorConfig = connectorConfig;

const createSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSection', inputVars);
}
createSectionRef.operationName = 'CreateSection';
exports.createSectionRef = createSectionRef;

exports.createSection = function createSection(dcOrVars, vars) {
  return executeMutation(createSectionRef(dcOrVars, vars));
};

const createAccessGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAccessGroup', inputVars);
}
createAccessGroupRef.operationName = 'CreateAccessGroup';
exports.createAccessGroupRef = createAccessGroupRef;

exports.createAccessGroup = function createAccessGroup(dcOrVars, vars) {
  return executeMutation(createAccessGroupRef(dcOrVars, vars));
};

const addUserToAccessGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddUserToAccessGroup', inputVars);
}
addUserToAccessGroupRef.operationName = 'AddUserToAccessGroup';
exports.addUserToAccessGroupRef = addUserToAccessGroupRef;

exports.addUserToAccessGroup = function addUserToAccessGroup(dcOrVars, vars) {
  return executeMutation(addUserToAccessGroupRef(dcOrVars, vars));
};

const removeUserFromAccessGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveUserFromAccessGroup', inputVars);
}
removeUserFromAccessGroupRef.operationName = 'RemoveUserFromAccessGroup';
exports.removeUserFromAccessGroupRef = removeUserFromAccessGroupRef;

exports.removeUserFromAccessGroup = function removeUserFromAccessGroup(dcOrVars, vars) {
  return executeMutation(removeUserFromAccessGroupRef(dcOrVars, vars));
};

const grantAccessGroupToSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'GrantAccessGroupToSection', inputVars);
}
grantAccessGroupToSectionRef.operationName = 'GrantAccessGroupToSection';
exports.grantAccessGroupToSectionRef = grantAccessGroupToSectionRef;

exports.grantAccessGroupToSection = function grantAccessGroupToSection(dcOrVars, vars) {
  return executeMutation(grantAccessGroupToSectionRef(dcOrVars, vars));
};

const revokeAccessGroupFromSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RevokeAccessGroupFromSection', inputVars);
}
revokeAccessGroupFromSectionRef.operationName = 'RevokeAccessGroupFromSection';
exports.revokeAccessGroupFromSectionRef = revokeAccessGroupFromSectionRef;

exports.revokeAccessGroupFromSection = function revokeAccessGroupFromSection(dcOrVars, vars) {
  return executeMutation(revokeAccessGroupFromSectionRef(dcOrVars, vars));
};

const updateAccessGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAccessGroup', inputVars);
}
updateAccessGroupRef.operationName = 'UpdateAccessGroup';
exports.updateAccessGroupRef = updateAccessGroupRef;

exports.updateAccessGroup = function updateAccessGroup(dcOrVars, vars) {
  return executeMutation(updateAccessGroupRef(dcOrVars, vars));
};

const deleteAccessGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteAccessGroup', inputVars);
}
deleteAccessGroupRef.operationName = 'DeleteAccessGroup';
exports.deleteAccessGroupRef = deleteAccessGroupRef;

exports.deleteAccessGroup = function deleteAccessGroup(dcOrVars, vars) {
  return executeMutation(deleteAccessGroupRef(dcOrVars, vars));
};

const updateUserMembershipStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUserMembershipStatus', inputVars);
}
updateUserMembershipStatusRef.operationName = 'UpdateUserMembershipStatus';
exports.updateUserMembershipStatusRef = updateUserMembershipStatusRef;

exports.updateUserMembershipStatus = function updateUserMembershipStatus(dcOrVars, vars) {
  return executeMutation(updateUserMembershipStatusRef(dcOrVars, vars));
};

const deleteUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteUser', inputVars);
}
deleteUserRef.operationName = 'DeleteUser';
exports.deleteUserRef = deleteUserRef;

exports.deleteUser = function deleteUser(dcOrVars, vars) {
  return executeMutation(deleteUserRef(dcOrVars, vars));
};

const createUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUser', inputVars);
}
createUserRef.operationName = 'CreateUser';
exports.createUserRef = createUserRef;

exports.createUser = function createUser(dcOrVars, vars) {
  return executeMutation(createUserRef(dcOrVars, vars));
};

const createAccessGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAccessGroupAdmin', inputVars);
}
createAccessGroupAdminRef.operationName = 'CreateAccessGroupAdmin';
exports.createAccessGroupAdminRef = createAccessGroupAdminRef;

exports.createAccessGroupAdmin = function createAccessGroupAdmin(dcOrVars, vars) {
  return executeMutation(createAccessGroupAdminRef(dcOrVars, vars));
};

const addUserToAccessGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddUserToAccessGroupAdmin', inputVars);
}
addUserToAccessGroupAdminRef.operationName = 'AddUserToAccessGroupAdmin';
exports.addUserToAccessGroupAdminRef = addUserToAccessGroupAdminRef;

exports.addUserToAccessGroupAdmin = function addUserToAccessGroupAdmin(dcOrVars, vars) {
  return executeMutation(addUserToAccessGroupAdminRef(dcOrVars, vars));
};

const removeUserFromAccessGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveUserFromAccessGroupAdmin', inputVars);
}
removeUserFromAccessGroupAdminRef.operationName = 'RemoveUserFromAccessGroupAdmin';
exports.removeUserFromAccessGroupAdminRef = removeUserFromAccessGroupAdminRef;

exports.removeUserFromAccessGroupAdmin = function removeUserFromAccessGroupAdmin(dcOrVars, vars) {
  return executeMutation(removeUserFromAccessGroupAdminRef(dcOrVars, vars));
};

const getAccessGroupByNameRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAccessGroupByName', inputVars);
}
getAccessGroupByNameRef.operationName = 'GetAccessGroupByName';
exports.getAccessGroupByNameRef = getAccessGroupByNameRef;

exports.getAccessGroupByName = function getAccessGroupByName(dcOrVars, vars) {
  return executeQuery(getAccessGroupByNameRef(dcOrVars, vars));
};

const getUserAccessGroupsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserAccessGroupsForAdmin', inputVars);
}
getUserAccessGroupsForAdminRef.operationName = 'GetUserAccessGroupsForAdmin';
exports.getUserAccessGroupsForAdminRef = getUserAccessGroupsForAdminRef;

exports.getUserAccessGroupsForAdmin = function getUserAccessGroupsForAdmin(dcOrVars, vars) {
  return executeQuery(getUserAccessGroupsForAdminRef(dcOrVars, vars));
};

const getCurrentUserRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetCurrentUser');
}
getCurrentUserRef.operationName = 'GetCurrentUser';
exports.getCurrentUserRef = getCurrentUserRef;

exports.getCurrentUser = function getCurrentUser(dc) {
  return executeQuery(getCurrentUserRef(dc));
};

const getUserByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserById', inputVars);
}
getUserByIdRef.operationName = 'GetUserById';
exports.getUserByIdRef = getUserByIdRef;

exports.getUserById = function getUserById(dcOrVars, vars) {
  return executeQuery(getUserByIdRef(dcOrVars, vars));
};

const listUsersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListUsers');
}
listUsersRef.operationName = 'ListUsers';
exports.listUsersRef = listUsersRef;

exports.listUsers = function listUsers(dc) {
  return executeQuery(listUsersRef(dc));
};

const listSectionsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSections');
}
listSectionsRef.operationName = 'ListSections';
exports.listSectionsRef = listSectionsRef;

exports.listSections = function listSections(dc) {
  return executeQuery(listSectionsRef(dc));
};

const getSectionsForUserRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionsForUser');
}
getSectionsForUserRef.operationName = 'GetSectionsForUser';
exports.getSectionsForUserRef = getSectionsForUserRef;

exports.getSectionsForUser = function getSectionsForUser(dc) {
  return executeQuery(getSectionsForUserRef(dc));
};

const listAccessGroupsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAccessGroups');
}
listAccessGroupsRef.operationName = 'ListAccessGroups';
exports.listAccessGroupsRef = listAccessGroupsRef;

exports.listAccessGroups = function listAccessGroups(dc) {
  return executeQuery(listAccessGroupsRef(dc));
};

const getUserAccessGroupsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserAccessGroups');
}
getUserAccessGroupsRef.operationName = 'GetUserAccessGroups';
exports.getUserAccessGroupsRef = getUserAccessGroupsRef;

exports.getUserAccessGroups = function getUserAccessGroups(dc) {
  return executeQuery(getUserAccessGroupsRef(dc));
};

const checkUserProfileExistsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'CheckUserProfileExists');
}
checkUserProfileExistsRef.operationName = 'CheckUserProfileExists';
exports.checkUserProfileExistsRef = checkUserProfileExistsRef;

exports.checkUserProfileExists = function checkUserProfileExists(dc) {
  return executeQuery(checkUserProfileExistsRef(dc));
};

const getUserMembershipStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserMembershipStatus', inputVars);
}
getUserMembershipStatusRef.operationName = 'GetUserMembershipStatus';
exports.getUserMembershipStatusRef = getUserMembershipStatusRef;

exports.getUserMembershipStatus = function getUserMembershipStatus(dcOrVars, vars) {
  return executeQuery(getUserMembershipStatusRef(dcOrVars, vars));
};

const getUserWithAccessGroupsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserWithAccessGroups', inputVars);
}
getUserWithAccessGroupsRef.operationName = 'GetUserWithAccessGroups';
exports.getUserWithAccessGroupsRef = getUserWithAccessGroupsRef;

exports.getUserWithAccessGroups = function getUserWithAccessGroups(dcOrVars, vars) {
  return executeQuery(getUserWithAccessGroupsRef(dcOrVars, vars));
};

const getUserAccessGroupsByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserAccessGroupsById', inputVars);
}
getUserAccessGroupsByIdRef.operationName = 'GetUserAccessGroupsById';
exports.getUserAccessGroupsByIdRef = getUserAccessGroupsByIdRef;

exports.getUserAccessGroupsById = function getUserAccessGroupsById(dcOrVars, vars) {
  return executeQuery(getUserAccessGroupsByIdRef(dcOrVars, vars));
};

const getSectionByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionById', inputVars);
}
getSectionByIdRef.operationName = 'GetSectionById';
exports.getSectionByIdRef = getSectionByIdRef;

exports.getSectionById = function getSectionById(dcOrVars, vars) {
  return executeQuery(getSectionByIdRef(dcOrVars, vars));
};

const getAccessGroupByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAccessGroupById', inputVars);
}
getAccessGroupByIdRef.operationName = 'GetAccessGroupById';
exports.getAccessGroupByIdRef = getAccessGroupByIdRef;

exports.getAccessGroupById = function getAccessGroupById(dcOrVars, vars) {
  return executeQuery(getAccessGroupByIdRef(dcOrVars, vars));
};

const getAllAccessGroupsWithStatusesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAllAccessGroupsWithStatuses');
}
getAllAccessGroupsWithStatusesRef.operationName = 'GetAllAccessGroupsWithStatuses';
exports.getAllAccessGroupsWithStatusesRef = getAllAccessGroupsWithStatusesRef;

exports.getAllAccessGroupsWithStatuses = function getAllAccessGroupsWithStatuses(dc) {
  return executeQuery(getAllAccessGroupsWithStatusesRef(dc));
};

const createUserProfileRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUserProfile', inputVars);
}
createUserProfileRef.operationName = 'CreateUserProfile';
exports.createUserProfileRef = createUserProfileRef;

exports.createUserProfile = function createUserProfile(dcOrVars, vars) {
  return executeMutation(createUserProfileRef(dcOrVars, vars));
};

const upsertUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertUser', inputVars);
}
upsertUserRef.operationName = 'UpsertUser';
exports.upsertUserRef = upsertUserRef;

exports.upsertUser = function upsertUser(dcOrVars, vars) {
  return executeMutation(upsertUserRef(dcOrVars, vars));
};

const updateUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUser', inputVars);
}
updateUserRef.operationName = 'UpdateUser';
exports.updateUserRef = updateUserRef;

exports.updateUser = function updateUser(dcOrVars, vars) {
  return executeMutation(updateUserRef(dcOrVars, vars));
};

const registerForSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RegisterForSection', inputVars);
}
registerForSectionRef.operationName = 'RegisterForSection';
exports.registerForSectionRef = registerForSectionRef;

exports.registerForSection = function registerForSection(dcOrVars, vars) {
  return executeMutation(registerForSectionRef(dcOrVars, vars));
};

const unregisterFromSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UnregisterFromSection', inputVars);
}
unregisterFromSectionRef.operationName = 'UnregisterFromSection';
exports.unregisterFromSectionRef = unregisterFromSectionRef;

exports.unregisterFromSection = function unregisterFromSection(dcOrVars, vars) {
  return executeMutation(unregisterFromSectionRef(dcOrVars, vars));
};
