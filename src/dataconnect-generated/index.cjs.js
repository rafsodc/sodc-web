const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const BookingPaymentAdjustmentStatus = {
  NOT_REQUIRED: "NOT_REQUIRED",
  PENDING_AUTO_REFUND: "PENDING_AUTO_REFUND",
  PENDING_AUTO_CHARGE: "PENDING_AUTO_CHARGE",
}
exports.BookingPaymentAdjustmentStatus = BookingPaymentAdjustmentStatus;

const BookingStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
}
exports.BookingStatus = BookingStatus;

const GuestTicketRequestStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
}
exports.GuestTicketRequestStatus = GuestTicketRequestStatus;

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

const NotificationChannel = {
  EMAIL: "EMAIL",
  SMS: "SMS",
  PUSH: "PUSH",
}
exports.NotificationChannel = NotificationChannel;

const NotificationDeliveryStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
}
exports.NotificationDeliveryStatus = NotificationDeliveryStatus;

const PaymentReconciliationExceptionStatus = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
}
exports.PaymentReconciliationExceptionStatus = PaymentReconciliationExceptionStatus;

const PaymentReconciliationExceptionType = {
  MISSING_PAYMENT_INTENT: "MISSING_PAYMENT_INTENT",
  REFUND_AMOUNT_MISMATCH: "REFUND_AMOUNT_MISMATCH",
  ACTIVE_DISPUTE: "ACTIVE_DISPUTE",
}
exports.PaymentReconciliationExceptionType = PaymentReconciliationExceptionType;

const PaymentWebhookEventOutcome = {
  PROCESSED: "PROCESSED",
  IGNORED: "IGNORED",
  DUPLICATE: "DUPLICATE",
  FAILED: "FAILED",
}
exports.PaymentWebhookEventOutcome = PaymentWebhookEventOutcome;

const SectionType = {
  MEMBERS: "MEMBERS",
  EVENTS: "EVENTS",
}
exports.SectionType = SectionType;

const SectionUserGroupPurpose = {
  ACCESS: "ACCESS",
  MEMBER: "MEMBER",
  BOOKER: "BOOKER",
  MESSAGE: "MESSAGE",
  MODERATOR: "MODERATOR",
}
exports.SectionUserGroupPurpose = SectionUserGroupPurpose;

const TicketAudience = {
  MEMBER: "MEMBER",
  GUEST: "GUEST",
}
exports.TicketAudience = TicketAudience;

const TicketOrderStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
}
exports.TicketOrderStatus = TicketOrderStatus;

const connectorConfig = {
  connector: 'api',
  service: 'sodc-web-service',
  location: 'europe-west2'
};
exports.connectorConfig = connectorConfig;

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

const listUserGroupsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListUserGroups');
}
listUserGroupsRef.operationName = 'ListUserGroups';
exports.listUserGroupsRef = listUserGroupsRef;

exports.listUserGroups = function listUserGroups(dc) {
  return executeQuery(listUserGroupsRef(dc));
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

const getEventsForSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEventsForSection', inputVars);
}
getEventsForSectionRef.operationName = 'GetEventsForSection';
exports.getEventsForSectionRef = getEventsForSectionRef;

exports.getEventsForSection = function getEventsForSection(dcOrVars, vars) {
  return executeQuery(getEventsForSectionRef(dcOrVars, vars));
};

const getEventByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEventById', inputVars);
}
getEventByIdRef.operationName = 'GetEventById';
exports.getEventByIdRef = getEventByIdRef;

exports.getEventById = function getEventById(dcOrVars, vars) {
  return executeQuery(getEventByIdRef(dcOrVars, vars));
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

const getUserGroupByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserGroupById', inputVars);
}
getUserGroupByIdRef.operationName = 'GetUserGroupById';
exports.getUserGroupByIdRef = getUserGroupByIdRef;

exports.getUserGroupById = function getUserGroupById(dcOrVars, vars) {
  return executeQuery(getUserGroupByIdRef(dcOrVars, vars));
};

const getAllUserGroupsWithStatusesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAllUserGroupsWithStatuses');
}
getAllUserGroupsWithStatusesRef.operationName = 'GetAllUserGroupsWithStatuses';
exports.getAllUserGroupsWithStatusesRef = getAllUserGroupsWithStatusesRef;

exports.getAllUserGroupsWithStatuses = function getAllUserGroupsWithStatuses(dc) {
  return executeQuery(getAllUserGroupsWithStatusesRef(dc));
};

const getSectionMembersRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionMembers', inputVars);
}
getSectionMembersRef.operationName = 'GetSectionMembers';
exports.getSectionMembersRef = getSectionMembersRef;

exports.getSectionMembers = function getSectionMembers(dcOrVars, vars) {
  return executeQuery(getSectionMembersRef(dcOrVars, vars));
};

const getMyBookingsForEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyBookingsForEvent', inputVars);
}
getMyBookingsForEventRef.operationName = 'GetMyBookingsForEvent';
exports.getMyBookingsForEventRef = getMyBookingsForEventRef;

exports.getMyBookingsForEvent = function getMyBookingsForEvent(dcOrVars, vars) {
  return executeQuery(getMyBookingsForEventRef(dcOrVars, vars));
};

const getMyTicketOrderByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyTicketOrderById', inputVars);
}
getMyTicketOrderByIdRef.operationName = 'GetMyTicketOrderById';
exports.getMyTicketOrderByIdRef = getMyTicketOrderByIdRef;

exports.getMyTicketOrderById = function getMyTicketOrderById(dcOrVars, vars) {
  return executeQuery(getMyTicketOrderByIdRef(dcOrVars, vars));
};

const getMyTicketOrdersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyTicketOrders');
}
getMyTicketOrdersRef.operationName = 'GetMyTicketOrders';
exports.getMyTicketOrdersRef = getMyTicketOrdersRef;

exports.getMyTicketOrders = function getMyTicketOrders(dc) {
  return executeQuery(getMyTicketOrdersRef(dc));
};

const getMyBookingPaymentAdjustmentsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyBookingPaymentAdjustments');
}
getMyBookingPaymentAdjustmentsRef.operationName = 'GetMyBookingPaymentAdjustments';
exports.getMyBookingPaymentAdjustmentsRef = getMyBookingPaymentAdjustmentsRef;

exports.getMyBookingPaymentAdjustments = function getMyBookingPaymentAdjustments(dc) {
  return executeQuery(getMyBookingPaymentAdjustmentsRef(dc));
};

const listEventBookingsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListEventBookingsForAdmin', inputVars);
}
listEventBookingsForAdminRef.operationName = 'ListEventBookingsForAdmin';
exports.listEventBookingsForAdminRef = listEventBookingsForAdminRef;

exports.listEventBookingsForAdmin = function listEventBookingsForAdmin(dcOrVars, vars) {
  return executeQuery(listEventBookingsForAdminRef(dcOrVars, vars));
};

const listGuestTicketRequestsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListGuestTicketRequestsForAdmin', inputVars);
}
listGuestTicketRequestsForAdminRef.operationName = 'ListGuestTicketRequestsForAdmin';
exports.listGuestTicketRequestsForAdminRef = listGuestTicketRequestsForAdminRef;

exports.listGuestTicketRequestsForAdmin = function listGuestTicketRequestsForAdmin(dcOrVars, vars) {
  return executeQuery(listGuestTicketRequestsForAdminRef(dcOrVars, vars));
};

const listTicketOrdersForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListTicketOrdersForAdmin', inputVars);
}
listTicketOrdersForAdminRef.operationName = 'ListTicketOrdersForAdmin';
exports.listTicketOrdersForAdminRef = listTicketOrdersForAdminRef;

exports.listTicketOrdersForAdmin = function listTicketOrdersForAdmin(dcOrVars, vars) {
  return executeQuery(listTicketOrdersForAdminRef(dcOrVars, vars));
};

const listBookingPaymentAdjustmentsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListBookingPaymentAdjustmentsForAdmin', inputVars);
}
listBookingPaymentAdjustmentsForAdminRef.operationName = 'ListBookingPaymentAdjustmentsForAdmin';
exports.listBookingPaymentAdjustmentsForAdminRef = listBookingPaymentAdjustmentsForAdminRef;

exports.listBookingPaymentAdjustmentsForAdmin = function listBookingPaymentAdjustmentsForAdmin(dcOrVars, vars) {
  return executeQuery(listBookingPaymentAdjustmentsForAdminRef(dcOrVars, vars));
};

const listOpenPaymentReconciliationExceptionsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListOpenPaymentReconciliationExceptions');
}
listOpenPaymentReconciliationExceptionsRef.operationName = 'ListOpenPaymentReconciliationExceptions';
exports.listOpenPaymentReconciliationExceptionsRef = listOpenPaymentReconciliationExceptionsRef;

exports.listOpenPaymentReconciliationExceptions = function listOpenPaymentReconciliationExceptions(dc) {
  return executeQuery(listOpenPaymentReconciliationExceptionsRef(dc));
};

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

const createUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUserGroup', inputVars);
}
createUserGroupRef.operationName = 'CreateUserGroup';
exports.createUserGroupRef = createUserGroupRef;

exports.createUserGroup = function createUserGroup(dcOrVars, vars) {
  return executeMutation(createUserGroupRef(dcOrVars, vars));
};

const addUserToUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddUserToUserGroup', inputVars);
}
addUserToUserGroupRef.operationName = 'AddUserToUserGroup';
exports.addUserToUserGroupRef = addUserToUserGroupRef;

exports.addUserToUserGroup = function addUserToUserGroup(dcOrVars, vars) {
  return executeMutation(addUserToUserGroupRef(dcOrVars, vars));
};

const removeUserFromUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveUserFromUserGroup', inputVars);
}
removeUserFromUserGroupRef.operationName = 'RemoveUserFromUserGroup';
exports.removeUserFromUserGroupRef = removeUserFromUserGroupRef;

exports.removeUserFromUserGroup = function removeUserFromUserGroup(dcOrVars, vars) {
  return executeMutation(removeUserFromUserGroupRef(dcOrVars, vars));
};

const grantUserGroupToSectionForPurposeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'GrantUserGroupToSectionForPurpose', inputVars);
}
grantUserGroupToSectionForPurposeRef.operationName = 'GrantUserGroupToSectionForPurpose';
exports.grantUserGroupToSectionForPurposeRef = grantUserGroupToSectionForPurposeRef;

exports.grantUserGroupToSectionForPurpose = function grantUserGroupToSectionForPurpose(dcOrVars, vars) {
  return executeMutation(grantUserGroupToSectionForPurposeRef(dcOrVars, vars));
};

const revokeUserGroupFromSectionForPurposeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RevokeUserGroupFromSectionForPurpose', inputVars);
}
revokeUserGroupFromSectionForPurposeRef.operationName = 'RevokeUserGroupFromSectionForPurpose';
exports.revokeUserGroupFromSectionForPurposeRef = revokeUserGroupFromSectionForPurposeRef;

exports.revokeUserGroupFromSectionForPurpose = function revokeUserGroupFromSectionForPurpose(dcOrVars, vars) {
  return executeMutation(revokeUserGroupFromSectionForPurposeRef(dcOrVars, vars));
};

const updateUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUserGroup', inputVars);
}
updateUserGroupRef.operationName = 'UpdateUserGroup';
exports.updateUserGroupRef = updateUserGroupRef;

exports.updateUserGroup = function updateUserGroup(dcOrVars, vars) {
  return executeMutation(updateUserGroupRef(dcOrVars, vars));
};

const deleteUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteUserGroup', inputVars);
}
deleteUserGroupRef.operationName = 'DeleteUserGroup';
exports.deleteUserGroupRef = deleteUserGroupRef;

exports.deleteUserGroup = function deleteUserGroup(dcOrVars, vars) {
  return executeMutation(deleteUserGroupRef(dcOrVars, vars));
};

const updateSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSection', inputVars);
}
updateSectionRef.operationName = 'UpdateSection';
exports.updateSectionRef = updateSectionRef;

exports.updateSection = function updateSection(dcOrVars, vars) {
  return executeMutation(updateSectionRef(dcOrVars, vars));
};

const deleteSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteSection', inputVars);
}
deleteSectionRef.operationName = 'DeleteSection';
exports.deleteSectionRef = deleteSectionRef;

exports.deleteSection = function deleteSection(dcOrVars, vars) {
  return executeMutation(deleteSectionRef(dcOrVars, vars));
};

const createEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateEvent', inputVars);
}
createEventRef.operationName = 'CreateEvent';
exports.createEventRef = createEventRef;

exports.createEvent = function createEvent(dcOrVars, vars) {
  return executeMutation(createEventRef(dcOrVars, vars));
};

const updateEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateEvent', inputVars);
}
updateEventRef.operationName = 'UpdateEvent';
exports.updateEventRef = updateEventRef;

exports.updateEvent = function updateEvent(dcOrVars, vars) {
  return executeMutation(updateEventRef(dcOrVars, vars));
};

const deleteEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteEvent', inputVars);
}
deleteEventRef.operationName = 'DeleteEvent';
exports.deleteEventRef = deleteEventRef;

exports.deleteEvent = function deleteEvent(dcOrVars, vars) {
  return executeMutation(deleteEventRef(dcOrVars, vars));
};

const createTicketTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateTicketType', inputVars);
}
createTicketTypeRef.operationName = 'CreateTicketType';
exports.createTicketTypeRef = createTicketTypeRef;

exports.createTicketType = function createTicketType(dcOrVars, vars) {
  return executeMutation(createTicketTypeRef(dcOrVars, vars));
};

const updateTicketTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateTicketType', inputVars);
}
updateTicketTypeRef.operationName = 'UpdateTicketType';
exports.updateTicketTypeRef = updateTicketTypeRef;

exports.updateTicketType = function updateTicketType(dcOrVars, vars) {
  return executeMutation(updateTicketTypeRef(dcOrVars, vars));
};

const deleteTicketTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteTicketType', inputVars);
}
deleteTicketTypeRef.operationName = 'DeleteTicketType';
exports.deleteTicketTypeRef = deleteTicketTypeRef;

exports.deleteTicketType = function deleteTicketType(dcOrVars, vars) {
  return executeMutation(deleteTicketTypeRef(dcOrVars, vars));
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

const subscribeToUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'SubscribeToUserGroup', inputVars);
}
subscribeToUserGroupRef.operationName = 'SubscribeToUserGroup';
exports.subscribeToUserGroupRef = subscribeToUserGroupRef;

exports.subscribeToUserGroup = function subscribeToUserGroup(dcOrVars, vars) {
  return executeMutation(subscribeToUserGroupRef(dcOrVars, vars));
};

const unsubscribeFromUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UnsubscribeFromUserGroup', inputVars);
}
unsubscribeFromUserGroupRef.operationName = 'UnsubscribeFromUserGroup';
exports.unsubscribeFromUserGroupRef = unsubscribeFromUserGroupRef;

exports.unsubscribeFromUserGroup = function unsubscribeFromUserGroup(dcOrVars, vars) {
  return executeMutation(unsubscribeFromUserGroupRef(dcOrVars, vars));
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

const createUserGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUserGroupAdmin', inputVars);
}
createUserGroupAdminRef.operationName = 'CreateUserGroupAdmin';
exports.createUserGroupAdminRef = createUserGroupAdminRef;

exports.createUserGroupAdmin = function createUserGroupAdmin(dcOrVars, vars) {
  return executeMutation(createUserGroupAdminRef(dcOrVars, vars));
};

const addUserToUserGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddUserToUserGroupAdmin', inputVars);
}
addUserToUserGroupAdminRef.operationName = 'AddUserToUserGroupAdmin';
exports.addUserToUserGroupAdminRef = addUserToUserGroupAdminRef;

exports.addUserToUserGroupAdmin = function addUserToUserGroupAdmin(dcOrVars, vars) {
  return executeMutation(addUserToUserGroupAdminRef(dcOrVars, vars));
};

const removeUserFromUserGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveUserFromUserGroupAdmin', inputVars);
}
removeUserFromUserGroupAdminRef.operationName = 'RemoveUserFromUserGroupAdmin';
exports.removeUserFromUserGroupAdminRef = removeUserFromUserGroupAdminRef;

exports.removeUserFromUserGroupAdmin = function removeUserFromUserGroupAdmin(dcOrVars, vars) {
  return executeMutation(removeUserFromUserGroupAdminRef(dcOrVars, vars));
};

const getUserGroupByNameRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserGroupByName', inputVars);
}
getUserGroupByNameRef.operationName = 'GetUserGroupByName';
exports.getUserGroupByNameRef = getUserGroupByNameRef;

exports.getUserGroupByName = function getUserGroupByName(dcOrVars, vars) {
  return executeQuery(getUserGroupByNameRef(dcOrVars, vars));
};

const getUserUserGroupsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserUserGroupsForAdmin', inputVars);
}
getUserUserGroupsForAdminRef.operationName = 'GetUserUserGroupsForAdmin';
exports.getUserUserGroupsForAdminRef = getUserUserGroupsForAdminRef;

exports.getUserUserGroupsForAdmin = function getUserUserGroupsForAdmin(dcOrVars, vars) {
  return executeQuery(getUserUserGroupsForAdminRef(dcOrVars, vars));
};

const getUserForCheckoutRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserForCheckout', inputVars);
}
getUserForCheckoutRef.operationName = 'GetUserForCheckout';
exports.getUserForCheckoutRef = getUserForCheckoutRef;

exports.getUserForCheckout = function getUserForCheckout(dcOrVars, vars) {
  return executeQuery(getUserForCheckoutRef(dcOrVars, vars));
};

const getTicketTypeForCheckoutRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTicketTypeForCheckout', inputVars);
}
getTicketTypeForCheckoutRef.operationName = 'GetTicketTypeForCheckout';
exports.getTicketTypeForCheckoutRef = getTicketTypeForCheckoutRef;

exports.getTicketTypeForCheckout = function getTicketTypeForCheckout(dcOrVars, vars) {
  return executeQuery(getTicketTypeForCheckoutRef(dcOrVars, vars));
};

const updateUserStripeCustomerIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUserStripeCustomerId', inputVars);
}
updateUserStripeCustomerIdRef.operationName = 'UpdateUserStripeCustomerId';
exports.updateUserStripeCustomerIdRef = updateUserStripeCustomerIdRef;

exports.updateUserStripeCustomerId = function updateUserStripeCustomerId(dcOrVars, vars) {
  return executeMutation(updateUserStripeCustomerIdRef(dcOrVars, vars));
};

const getEventByIdForCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEventByIdForCallable', inputVars);
}
getEventByIdForCallableRef.operationName = 'GetEventByIdForCallable';
exports.getEventByIdForCallableRef = getEventByIdForCallableRef;

exports.getEventByIdForCallable = function getEventByIdForCallable(dcOrVars, vars) {
  return executeQuery(getEventByIdForCallableRef(dcOrVars, vars));
};

const getSectionByIdForCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionByIdForCallable', inputVars);
}
getSectionByIdForCallableRef.operationName = 'GetSectionByIdForCallable';
exports.getSectionByIdForCallableRef = getSectionByIdForCallableRef;

exports.getSectionByIdForCallable = function getSectionByIdForCallable(dcOrVars, vars) {
  return executeQuery(getSectionByIdForCallableRef(dcOrVars, vars));
};

const getBookingsForBookerAndEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBookingsForBookerAndEvent', inputVars);
}
getBookingsForBookerAndEventRef.operationName = 'GetBookingsForBookerAndEvent';
exports.getBookingsForBookerAndEventRef = getBookingsForBookerAndEventRef;

exports.getBookingsForBookerAndEvent = function getBookingsForBookerAndEvent(dcOrVars, vars) {
  return executeQuery(getBookingsForBookerAndEventRef(dcOrVars, vars));
};

const createBookingDraftForUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingDraftForUser', inputVars);
}
createBookingDraftForUserRef.operationName = 'CreateBookingDraftForUser';
exports.createBookingDraftForUserRef = createBookingDraftForUserRef;

exports.createBookingDraftForUser = function createBookingDraftForUser(dcOrVars, vars) {
  return executeMutation(createBookingDraftForUserRef(dcOrVars, vars));
};

const createBookingDraftRevisionForUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingDraftRevisionForUser', inputVars);
}
createBookingDraftRevisionForUserRef.operationName = 'CreateBookingDraftRevisionForUser';
exports.createBookingDraftRevisionForUserRef = createBookingDraftRevisionForUserRef;

exports.createBookingDraftRevisionForUser = function createBookingDraftRevisionForUser(dcOrVars, vars) {
  return executeMutation(createBookingDraftRevisionForUserRef(dcOrVars, vars));
};

const markBookingSupersededFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkBookingSupersededFromCallable', inputVars);
}
markBookingSupersededFromCallableRef.operationName = 'MarkBookingSupersededFromCallable';
exports.markBookingSupersededFromCallableRef = markBookingSupersededFromCallableRef;

exports.markBookingSupersededFromCallable = function markBookingSupersededFromCallable(dcOrVars, vars) {
  return executeMutation(markBookingSupersededFromCallableRef(dcOrVars, vars));
};

const createBookingPaymentAdjustmentFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingPaymentAdjustmentFromCallable', inputVars);
}
createBookingPaymentAdjustmentFromCallableRef.operationName = 'CreateBookingPaymentAdjustmentFromCallable';
exports.createBookingPaymentAdjustmentFromCallableRef = createBookingPaymentAdjustmentFromCallableRef;

exports.createBookingPaymentAdjustmentFromCallable = function createBookingPaymentAdjustmentFromCallable(dcOrVars, vars) {
  return executeMutation(createBookingPaymentAdjustmentFromCallableRef(dcOrVars, vars));
};

const addBookingLineFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddBookingLineFromCallable', inputVars);
}
addBookingLineFromCallableRef.operationName = 'AddBookingLineFromCallable';
exports.addBookingLineFromCallableRef = addBookingLineFromCallableRef;

exports.addBookingLineFromCallable = function addBookingLineFromCallable(dcOrVars, vars) {
  return executeMutation(addBookingLineFromCallableRef(dcOrVars, vars));
};

const updateBookingStatusFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateBookingStatusFromCallable', inputVars);
}
updateBookingStatusFromCallableRef.operationName = 'UpdateBookingStatusFromCallable';
exports.updateBookingStatusFromCallableRef = updateBookingStatusFromCallableRef;

exports.updateBookingStatusFromCallable = function updateBookingStatusFromCallable(dcOrVars, vars) {
  return executeMutation(updateBookingStatusFromCallableRef(dcOrVars, vars));
};

const createTicketOrderForCheckoutRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateTicketOrderForCheckout', inputVars);
}
createTicketOrderForCheckoutRef.operationName = 'CreateTicketOrderForCheckout';
exports.createTicketOrderForCheckoutRef = createTicketOrderForCheckoutRef;

exports.createTicketOrderForCheckout = function createTicketOrderForCheckout(dcOrVars, vars) {
  return executeMutation(createTicketOrderForCheckoutRef(dcOrVars, vars));
};

const getTicketOrderForWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTicketOrderForWebhook', inputVars);
}
getTicketOrderForWebhookRef.operationName = 'GetTicketOrderForWebhook';
exports.getTicketOrderForWebhookRef = getTicketOrderForWebhookRef;

exports.getTicketOrderForWebhook = function getTicketOrderForWebhook(dcOrVars, vars) {
  return executeQuery(getTicketOrderForWebhookRef(dcOrVars, vars));
};

const getTicketOrderStripeArtifactsForCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTicketOrderStripeArtifactsForCallable', inputVars);
}
getTicketOrderStripeArtifactsForCallableRef.operationName = 'GetTicketOrderStripeArtifactsForCallable';
exports.getTicketOrderStripeArtifactsForCallableRef = getTicketOrderStripeArtifactsForCallableRef;

exports.getTicketOrderStripeArtifactsForCallable = function getTicketOrderStripeArtifactsForCallable(dcOrVars, vars) {
  return executeQuery(getTicketOrderStripeArtifactsForCallableRef(dcOrVars, vars));
};

const getPaymentWebhookEventByStripeEventIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPaymentWebhookEventByStripeEventId', inputVars);
}
getPaymentWebhookEventByStripeEventIdRef.operationName = 'GetPaymentWebhookEventByStripeEventId';
exports.getPaymentWebhookEventByStripeEventIdRef = getPaymentWebhookEventByStripeEventIdRef;

exports.getPaymentWebhookEventByStripeEventId = function getPaymentWebhookEventByStripeEventId(dcOrVars, vars) {
  return executeQuery(getPaymentWebhookEventByStripeEventIdRef(dcOrVars, vars));
};

const createPaymentWebhookEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePaymentWebhookEvent', inputVars);
}
createPaymentWebhookEventRef.operationName = 'CreatePaymentWebhookEvent';
exports.createPaymentWebhookEventRef = createPaymentWebhookEventRef;

exports.createPaymentWebhookEvent = function createPaymentWebhookEvent(dcOrVars, vars) {
  return executeMutation(createPaymentWebhookEventRef(dcOrVars, vars));
};

const getNotificationDeliveryByChannelAndKeyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetNotificationDeliveryByChannelAndKey', inputVars);
}
getNotificationDeliveryByChannelAndKeyRef.operationName = 'GetNotificationDeliveryByChannelAndKey';
exports.getNotificationDeliveryByChannelAndKeyRef = getNotificationDeliveryByChannelAndKeyRef;

exports.getNotificationDeliveryByChannelAndKey = function getNotificationDeliveryByChannelAndKey(dcOrVars, vars) {
  return executeQuery(getNotificationDeliveryByChannelAndKeyRef(dcOrVars, vars));
};

const createNotificationDeliveryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateNotificationDelivery', inputVars);
}
createNotificationDeliveryRef.operationName = 'CreateNotificationDelivery';
exports.createNotificationDeliveryRef = createNotificationDeliveryRef;

exports.createNotificationDelivery = function createNotificationDelivery(dcOrVars, vars) {
  return executeMutation(createNotificationDeliveryRef(dcOrVars, vars));
};

const markNotificationDeliveryPendingByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkNotificationDeliveryPendingById', inputVars);
}
markNotificationDeliveryPendingByIdRef.operationName = 'MarkNotificationDeliveryPendingById';
exports.markNotificationDeliveryPendingByIdRef = markNotificationDeliveryPendingByIdRef;

exports.markNotificationDeliveryPendingById = function markNotificationDeliveryPendingById(dcOrVars, vars) {
  return executeMutation(markNotificationDeliveryPendingByIdRef(dcOrVars, vars));
};

const markNotificationDeliverySentByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkNotificationDeliverySentById', inputVars);
}
markNotificationDeliverySentByIdRef.operationName = 'MarkNotificationDeliverySentById';
exports.markNotificationDeliverySentByIdRef = markNotificationDeliverySentByIdRef;

exports.markNotificationDeliverySentById = function markNotificationDeliverySentById(dcOrVars, vars) {
  return executeMutation(markNotificationDeliverySentByIdRef(dcOrVars, vars));
};

const markNotificationDeliveryFailedByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkNotificationDeliveryFailedById', inputVars);
}
markNotificationDeliveryFailedByIdRef.operationName = 'MarkNotificationDeliveryFailedById';
exports.markNotificationDeliveryFailedByIdRef = markNotificationDeliveryFailedByIdRef;

exports.markNotificationDeliveryFailedById = function markNotificationDeliveryFailedById(dcOrVars, vars) {
  return executeMutation(markNotificationDeliveryFailedByIdRef(dcOrVars, vars));
};

const markTicketOrderPaidFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkTicketOrderPaidFromWebhook', inputVars);
}
markTicketOrderPaidFromWebhookRef.operationName = 'MarkTicketOrderPaidFromWebhook';
exports.markTicketOrderPaidFromWebhookRef = markTicketOrderPaidFromWebhookRef;

exports.markTicketOrderPaidFromWebhook = function markTicketOrderPaidFromWebhook(dcOrVars, vars) {
  return executeMutation(markTicketOrderPaidFromWebhookRef(dcOrVars, vars));
};

const markTicketOrderFailedFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkTicketOrderFailedFromWebhook', inputVars);
}
markTicketOrderFailedFromWebhookRef.operationName = 'MarkTicketOrderFailedFromWebhook';
exports.markTicketOrderFailedFromWebhookRef = markTicketOrderFailedFromWebhookRef;

exports.markTicketOrderFailedFromWebhook = function markTicketOrderFailedFromWebhook(dcOrVars, vars) {
  return executeMutation(markTicketOrderFailedFromWebhookRef(dcOrVars, vars));
};

const markTicketOrderRefundedFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkTicketOrderRefundedFromWebhook', inputVars);
}
markTicketOrderRefundedFromWebhookRef.operationName = 'MarkTicketOrderRefundedFromWebhook';
exports.markTicketOrderRefundedFromWebhookRef = markTicketOrderRefundedFromWebhookRef;

exports.markTicketOrderRefundedFromWebhook = function markTicketOrderRefundedFromWebhook(dcOrVars, vars) {
  return executeMutation(markTicketOrderRefundedFromWebhookRef(dcOrVars, vars));
};

const upsertTicketOrderDisputeFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertTicketOrderDisputeFromWebhook', inputVars);
}
upsertTicketOrderDisputeFromWebhookRef.operationName = 'UpsertTicketOrderDisputeFromWebhook';
exports.upsertTicketOrderDisputeFromWebhookRef = upsertTicketOrderDisputeFromWebhookRef;

exports.upsertTicketOrderDisputeFromWebhook = function upsertTicketOrderDisputeFromWebhook(dcOrVars, vars) {
  return executeMutation(upsertTicketOrderDisputeFromWebhookRef(dcOrVars, vars));
};

const getPaymentReconciliationExceptionByOrderAndTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPaymentReconciliationExceptionByOrderAndType', inputVars);
}
getPaymentReconciliationExceptionByOrderAndTypeRef.operationName = 'GetPaymentReconciliationExceptionByOrderAndType';
exports.getPaymentReconciliationExceptionByOrderAndTypeRef = getPaymentReconciliationExceptionByOrderAndTypeRef;

exports.getPaymentReconciliationExceptionByOrderAndType = function getPaymentReconciliationExceptionByOrderAndType(dcOrVars, vars) {
  return executeQuery(getPaymentReconciliationExceptionByOrderAndTypeRef(dcOrVars, vars));
};

const createPaymentReconciliationExceptionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePaymentReconciliationException', inputVars);
}
createPaymentReconciliationExceptionRef.operationName = 'CreatePaymentReconciliationException';
exports.createPaymentReconciliationExceptionRef = createPaymentReconciliationExceptionRef;

exports.createPaymentReconciliationException = function createPaymentReconciliationException(dcOrVars, vars) {
  return executeMutation(createPaymentReconciliationExceptionRef(dcOrVars, vars));
};

const updatePaymentReconciliationExceptionByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdatePaymentReconciliationExceptionById', inputVars);
}
updatePaymentReconciliationExceptionByIdRef.operationName = 'UpdatePaymentReconciliationExceptionById';
exports.updatePaymentReconciliationExceptionByIdRef = updatePaymentReconciliationExceptionByIdRef;

exports.updatePaymentReconciliationExceptionById = function updatePaymentReconciliationExceptionById(dcOrVars, vars) {
  return executeMutation(updatePaymentReconciliationExceptionByIdRef(dcOrVars, vars));
};

const updateBookingPreferencesFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateBookingPreferencesFromCallable', inputVars);
}
updateBookingPreferencesFromCallableRef.operationName = 'UpdateBookingPreferencesFromCallable';
exports.updateBookingPreferencesFromCallableRef = updateBookingPreferencesFromCallableRef;

exports.updateBookingPreferencesFromCallable = function updateBookingPreferencesFromCallable(dcOrVars, vars) {
  return executeMutation(updateBookingPreferencesFromCallableRef(dcOrVars, vars));
};

const deleteBookingLineFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteBookingLineFromCallable', inputVars);
}
deleteBookingLineFromCallableRef.operationName = 'DeleteBookingLineFromCallable';
exports.deleteBookingLineFromCallableRef = deleteBookingLineFromCallableRef;

exports.deleteBookingLineFromCallable = function deleteBookingLineFromCallable(dcOrVars, vars) {
  return executeMutation(deleteBookingLineFromCallableRef(dcOrVars, vars));
};

const createGuestTicketRequestFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateGuestTicketRequestFromCallable', inputVars);
}
createGuestTicketRequestFromCallableRef.operationName = 'CreateGuestTicketRequestFromCallable';
exports.createGuestTicketRequestFromCallableRef = createGuestTicketRequestFromCallableRef;

exports.createGuestTicketRequestFromCallable = function createGuestTicketRequestFromCallable(dcOrVars, vars) {
  return executeMutation(createGuestTicketRequestFromCallableRef(dcOrVars, vars));
};

const adminReviewGuestTicketRequestFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminReviewGuestTicketRequestFromCallable', inputVars);
}
adminReviewGuestTicketRequestFromCallableRef.operationName = 'AdminReviewGuestTicketRequestFromCallable';
exports.adminReviewGuestTicketRequestFromCallableRef = adminReviewGuestTicketRequestFromCallableRef;

exports.adminReviewGuestTicketRequestFromCallable = function adminReviewGuestTicketRequestFromCallable(dcOrVars, vars) {
  return executeMutation(adminReviewGuestTicketRequestFromCallableRef(dcOrVars, vars));
};

const getBookingForGuestTicketCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBookingForGuestTicketCallable', inputVars);
}
getBookingForGuestTicketCallableRef.operationName = 'GetBookingForGuestTicketCallable';
exports.getBookingForGuestTicketCallableRef = getBookingForGuestTicketCallableRef;

exports.getBookingForGuestTicketCallable = function getBookingForGuestTicketCallable(dcOrVars, vars) {
  return executeQuery(getBookingForGuestTicketCallableRef(dcOrVars, vars));
};

const getBookingForNotificationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBookingForNotification', inputVars);
}
getBookingForNotificationRef.operationName = 'GetBookingForNotification';
exports.getBookingForNotificationRef = getBookingForNotificationRef;

exports.getBookingForNotification = function getBookingForNotification(dcOrVars, vars) {
  return executeQuery(getBookingForNotificationRef(dcOrVars, vars));
};

const getGuestTicketRequestForNotificationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetGuestTicketRequestForNotification', inputVars);
}
getGuestTicketRequestForNotificationRef.operationName = 'GetGuestTicketRequestForNotification';
exports.getGuestTicketRequestForNotificationRef = getGuestTicketRequestForNotificationRef;

exports.getGuestTicketRequestForNotification = function getGuestTicketRequestForNotification(dcOrVars, vars) {
  return executeQuery(getGuestTicketRequestForNotificationRef(dcOrVars, vars));
};

const createBookingDraftRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingDraft', inputVars);
}
createBookingDraftRef.operationName = 'CreateBookingDraft';
exports.createBookingDraftRef = createBookingDraftRef;

exports.createBookingDraft = function createBookingDraft(dcOrVars, vars) {
  return executeMutation(createBookingDraftRef(dcOrVars, vars));
};

const addBookingLineRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddBookingLine', inputVars);
}
addBookingLineRef.operationName = 'AddBookingLine';
exports.addBookingLineRef = addBookingLineRef;

exports.addBookingLine = function addBookingLine(dcOrVars, vars) {
  return executeMutation(addBookingLineRef(dcOrVars, vars));
};

const updateBookingStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateBookingStatus', inputVars);
}
updateBookingStatusRef.operationName = 'UpdateBookingStatus';
exports.updateBookingStatusRef = updateBookingStatusRef;

exports.updateBookingStatus = function updateBookingStatus(dcOrVars, vars) {
  return executeMutation(updateBookingStatusRef(dcOrVars, vars));
};

const createGuestTicketRequestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateGuestTicketRequest', inputVars);
}
createGuestTicketRequestRef.operationName = 'CreateGuestTicketRequest';
exports.createGuestTicketRequestRef = createGuestTicketRequestRef;

exports.createGuestTicketRequest = function createGuestTicketRequest(dcOrVars, vars) {
  return executeMutation(createGuestTicketRequestRef(dcOrVars, vars));
};

const adminDeleteGuestTicketRequestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminDeleteGuestTicketRequest', inputVars);
}
adminDeleteGuestTicketRequestRef.operationName = 'AdminDeleteGuestTicketRequest';
exports.adminDeleteGuestTicketRequestRef = adminDeleteGuestTicketRequestRef;

exports.adminDeleteGuestTicketRequest = function adminDeleteGuestTicketRequest(dcOrVars, vars) {
  return executeMutation(adminDeleteGuestTicketRequestRef(dcOrVars, vars));
};

const adminReviewGuestTicketRequestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminReviewGuestTicketRequest', inputVars);
}
adminReviewGuestTicketRequestRef.operationName = 'AdminReviewGuestTicketRequest';
exports.adminReviewGuestTicketRequestRef = adminReviewGuestTicketRequestRef;

exports.adminReviewGuestTicketRequest = function adminReviewGuestTicketRequest(dcOrVars, vars) {
  return executeMutation(adminReviewGuestTicketRequestRef(dcOrVars, vars));
};

const adminDeleteBookingLineRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminDeleteBookingLine', inputVars);
}
adminDeleteBookingLineRef.operationName = 'AdminDeleteBookingLine';
exports.adminDeleteBookingLineRef = adminDeleteBookingLineRef;

exports.adminDeleteBookingLine = function adminDeleteBookingLine(dcOrVars, vars) {
  return executeMutation(adminDeleteBookingLineRef(dcOrVars, vars));
};

const adminDeleteBookingRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminDeleteBooking', inputVars);
}
adminDeleteBookingRef.operationName = 'AdminDeleteBooking';
exports.adminDeleteBookingRef = adminDeleteBookingRef;

exports.adminDeleteBooking = function adminDeleteBooking(dcOrVars, vars) {
  return executeMutation(adminDeleteBookingRef(dcOrVars, vars));
};

const resolvePaymentReconciliationExceptionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ResolvePaymentReconciliationException', inputVars);
}
resolvePaymentReconciliationExceptionRef.operationName = 'ResolvePaymentReconciliationException';
exports.resolvePaymentReconciliationExceptionRef = resolvePaymentReconciliationExceptionRef;

exports.resolvePaymentReconciliationException = function resolvePaymentReconciliationException(dcOrVars, vars) {
  return executeMutation(resolvePaymentReconciliationExceptionRef(dcOrVars, vars));
};
