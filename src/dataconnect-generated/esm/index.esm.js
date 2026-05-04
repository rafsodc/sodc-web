import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const BookingPaymentAdjustmentStatus = {
  NOT_REQUIRED: "NOT_REQUIRED",
  PENDING_AUTO_REFUND: "PENDING_AUTO_REFUND",
  PENDING_AUTO_CHARGE: "PENDING_AUTO_CHARGE",
}

export const BookingStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
}

export const GuestTicketRequestStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
}

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

export const PaymentReconciliationExceptionStatus = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
}

export const PaymentReconciliationExceptionType = {
  MISSING_PAYMENT_INTENT: "MISSING_PAYMENT_INTENT",
  REFUND_AMOUNT_MISMATCH: "REFUND_AMOUNT_MISMATCH",
  ACTIVE_DISPUTE: "ACTIVE_DISPUTE",
}

export const PaymentWebhookEventOutcome = {
  PROCESSED: "PROCESSED",
  IGNORED: "IGNORED",
  DUPLICATE: "DUPLICATE",
  FAILED: "FAILED",
}

export const SectionType = {
  MEMBERS: "MEMBERS",
  EVENTS: "EVENTS",
}

export const SectionUserGroupPurpose = {
  ACCESS: "ACCESS",
  MEMBER: "MEMBER",
  BOOKER: "BOOKER",
  MESSAGE: "MESSAGE",
  MODERATOR: "MODERATOR",
}

export const TicketAudience = {
  MEMBER: "MEMBER",
  GUEST: "GUEST",
}

export const TicketOrderStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
}

export const connectorConfig = {
  connector: 'api',
  service: 'sodc-web-service',
  location: 'europe-west2'
};

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

export const createUserGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUserGroupAdmin', inputVars);
}
createUserGroupAdminRef.operationName = 'CreateUserGroupAdmin';

export function createUserGroupAdmin(dcOrVars, vars) {
  return executeMutation(createUserGroupAdminRef(dcOrVars, vars));
}

export const addUserToUserGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddUserToUserGroupAdmin', inputVars);
}
addUserToUserGroupAdminRef.operationName = 'AddUserToUserGroupAdmin';

export function addUserToUserGroupAdmin(dcOrVars, vars) {
  return executeMutation(addUserToUserGroupAdminRef(dcOrVars, vars));
}

export const removeUserFromUserGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveUserFromUserGroupAdmin', inputVars);
}
removeUserFromUserGroupAdminRef.operationName = 'RemoveUserFromUserGroupAdmin';

export function removeUserFromUserGroupAdmin(dcOrVars, vars) {
  return executeMutation(removeUserFromUserGroupAdminRef(dcOrVars, vars));
}

export const getUserGroupByNameRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserGroupByName', inputVars);
}
getUserGroupByNameRef.operationName = 'GetUserGroupByName';

export function getUserGroupByName(dcOrVars, vars) {
  return executeQuery(getUserGroupByNameRef(dcOrVars, vars));
}

export const getUserUserGroupsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserUserGroupsForAdmin', inputVars);
}
getUserUserGroupsForAdminRef.operationName = 'GetUserUserGroupsForAdmin';

export function getUserUserGroupsForAdmin(dcOrVars, vars) {
  return executeQuery(getUserUserGroupsForAdminRef(dcOrVars, vars));
}

export const getUserForCheckoutRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserForCheckout', inputVars);
}
getUserForCheckoutRef.operationName = 'GetUserForCheckout';

export function getUserForCheckout(dcOrVars, vars) {
  return executeQuery(getUserForCheckoutRef(dcOrVars, vars));
}

export const getTicketTypeForCheckoutRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTicketTypeForCheckout', inputVars);
}
getTicketTypeForCheckoutRef.operationName = 'GetTicketTypeForCheckout';

export function getTicketTypeForCheckout(dcOrVars, vars) {
  return executeQuery(getTicketTypeForCheckoutRef(dcOrVars, vars));
}

export const updateUserStripeCustomerIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUserStripeCustomerId', inputVars);
}
updateUserStripeCustomerIdRef.operationName = 'UpdateUserStripeCustomerId';

export function updateUserStripeCustomerId(dcOrVars, vars) {
  return executeMutation(updateUserStripeCustomerIdRef(dcOrVars, vars));
}

export const getEventByIdForCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEventByIdForCallable', inputVars);
}
getEventByIdForCallableRef.operationName = 'GetEventByIdForCallable';

export function getEventByIdForCallable(dcOrVars, vars) {
  return executeQuery(getEventByIdForCallableRef(dcOrVars, vars));
}

export const getSectionByIdForCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionByIdForCallable', inputVars);
}
getSectionByIdForCallableRef.operationName = 'GetSectionByIdForCallable';

export function getSectionByIdForCallable(dcOrVars, vars) {
  return executeQuery(getSectionByIdForCallableRef(dcOrVars, vars));
}

export const getBookingsForBookerAndEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBookingsForBookerAndEvent', inputVars);
}
getBookingsForBookerAndEventRef.operationName = 'GetBookingsForBookerAndEvent';

export function getBookingsForBookerAndEvent(dcOrVars, vars) {
  return executeQuery(getBookingsForBookerAndEventRef(dcOrVars, vars));
}

export const createBookingDraftForUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingDraftForUser', inputVars);
}
createBookingDraftForUserRef.operationName = 'CreateBookingDraftForUser';

export function createBookingDraftForUser(dcOrVars, vars) {
  return executeMutation(createBookingDraftForUserRef(dcOrVars, vars));
}

export const createBookingDraftRevisionForUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingDraftRevisionForUser', inputVars);
}
createBookingDraftRevisionForUserRef.operationName = 'CreateBookingDraftRevisionForUser';

export function createBookingDraftRevisionForUser(dcOrVars, vars) {
  return executeMutation(createBookingDraftRevisionForUserRef(dcOrVars, vars));
}

export const markBookingSupersededFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkBookingSupersededFromCallable', inputVars);
}
markBookingSupersededFromCallableRef.operationName = 'MarkBookingSupersededFromCallable';

export function markBookingSupersededFromCallable(dcOrVars, vars) {
  return executeMutation(markBookingSupersededFromCallableRef(dcOrVars, vars));
}

export const createBookingPaymentAdjustmentFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingPaymentAdjustmentFromCallable', inputVars);
}
createBookingPaymentAdjustmentFromCallableRef.operationName = 'CreateBookingPaymentAdjustmentFromCallable';

export function createBookingPaymentAdjustmentFromCallable(dcOrVars, vars) {
  return executeMutation(createBookingPaymentAdjustmentFromCallableRef(dcOrVars, vars));
}

export const addBookingLineFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddBookingLineFromCallable', inputVars);
}
addBookingLineFromCallableRef.operationName = 'AddBookingLineFromCallable';

export function addBookingLineFromCallable(dcOrVars, vars) {
  return executeMutation(addBookingLineFromCallableRef(dcOrVars, vars));
}

export const updateBookingStatusFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateBookingStatusFromCallable', inputVars);
}
updateBookingStatusFromCallableRef.operationName = 'UpdateBookingStatusFromCallable';

export function updateBookingStatusFromCallable(dcOrVars, vars) {
  return executeMutation(updateBookingStatusFromCallableRef(dcOrVars, vars));
}

export const createTicketOrderForCheckoutRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateTicketOrderForCheckout', inputVars);
}
createTicketOrderForCheckoutRef.operationName = 'CreateTicketOrderForCheckout';

export function createTicketOrderForCheckout(dcOrVars, vars) {
  return executeMutation(createTicketOrderForCheckoutRef(dcOrVars, vars));
}

export const getTicketOrderForWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTicketOrderForWebhook', inputVars);
}
getTicketOrderForWebhookRef.operationName = 'GetTicketOrderForWebhook';

export function getTicketOrderForWebhook(dcOrVars, vars) {
  return executeQuery(getTicketOrderForWebhookRef(dcOrVars, vars));
}

export const getPaymentWebhookEventByStripeEventIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPaymentWebhookEventByStripeEventId', inputVars);
}
getPaymentWebhookEventByStripeEventIdRef.operationName = 'GetPaymentWebhookEventByStripeEventId';

export function getPaymentWebhookEventByStripeEventId(dcOrVars, vars) {
  return executeQuery(getPaymentWebhookEventByStripeEventIdRef(dcOrVars, vars));
}

export const createPaymentWebhookEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePaymentWebhookEvent', inputVars);
}
createPaymentWebhookEventRef.operationName = 'CreatePaymentWebhookEvent';

export function createPaymentWebhookEvent(dcOrVars, vars) {
  return executeMutation(createPaymentWebhookEventRef(dcOrVars, vars));
}

export const markTicketOrderPaidFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkTicketOrderPaidFromWebhook', inputVars);
}
markTicketOrderPaidFromWebhookRef.operationName = 'MarkTicketOrderPaidFromWebhook';

export function markTicketOrderPaidFromWebhook(dcOrVars, vars) {
  return executeMutation(markTicketOrderPaidFromWebhookRef(dcOrVars, vars));
}

export const markTicketOrderFailedFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkTicketOrderFailedFromWebhook', inputVars);
}
markTicketOrderFailedFromWebhookRef.operationName = 'MarkTicketOrderFailedFromWebhook';

export function markTicketOrderFailedFromWebhook(dcOrVars, vars) {
  return executeMutation(markTicketOrderFailedFromWebhookRef(dcOrVars, vars));
}

export const markTicketOrderRefundedFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkTicketOrderRefundedFromWebhook', inputVars);
}
markTicketOrderRefundedFromWebhookRef.operationName = 'MarkTicketOrderRefundedFromWebhook';

export function markTicketOrderRefundedFromWebhook(dcOrVars, vars) {
  return executeMutation(markTicketOrderRefundedFromWebhookRef(dcOrVars, vars));
}

export const upsertTicketOrderDisputeFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertTicketOrderDisputeFromWebhook', inputVars);
}
upsertTicketOrderDisputeFromWebhookRef.operationName = 'UpsertTicketOrderDisputeFromWebhook';

export function upsertTicketOrderDisputeFromWebhook(dcOrVars, vars) {
  return executeMutation(upsertTicketOrderDisputeFromWebhookRef(dcOrVars, vars));
}

export const getPaymentReconciliationExceptionByOrderAndTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPaymentReconciliationExceptionByOrderAndType', inputVars);
}
getPaymentReconciliationExceptionByOrderAndTypeRef.operationName = 'GetPaymentReconciliationExceptionByOrderAndType';

export function getPaymentReconciliationExceptionByOrderAndType(dcOrVars, vars) {
  return executeQuery(getPaymentReconciliationExceptionByOrderAndTypeRef(dcOrVars, vars));
}

export const createPaymentReconciliationExceptionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePaymentReconciliationException', inputVars);
}
createPaymentReconciliationExceptionRef.operationName = 'CreatePaymentReconciliationException';

export function createPaymentReconciliationException(dcOrVars, vars) {
  return executeMutation(createPaymentReconciliationExceptionRef(dcOrVars, vars));
}

export const updatePaymentReconciliationExceptionByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdatePaymentReconciliationExceptionById', inputVars);
}
updatePaymentReconciliationExceptionByIdRef.operationName = 'UpdatePaymentReconciliationExceptionById';

export function updatePaymentReconciliationExceptionById(dcOrVars, vars) {
  return executeMutation(updatePaymentReconciliationExceptionByIdRef(dcOrVars, vars));
}

export const updateBookingPreferencesFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateBookingPreferencesFromCallable', inputVars);
}
updateBookingPreferencesFromCallableRef.operationName = 'UpdateBookingPreferencesFromCallable';

export function updateBookingPreferencesFromCallable(dcOrVars, vars) {
  return executeMutation(updateBookingPreferencesFromCallableRef(dcOrVars, vars));
}

export const deleteBookingLineFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteBookingLineFromCallable', inputVars);
}
deleteBookingLineFromCallableRef.operationName = 'DeleteBookingLineFromCallable';

export function deleteBookingLineFromCallable(dcOrVars, vars) {
  return executeMutation(deleteBookingLineFromCallableRef(dcOrVars, vars));
}

export const createBookingDraftRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingDraft', inputVars);
}
createBookingDraftRef.operationName = 'CreateBookingDraft';

export function createBookingDraft(dcOrVars, vars) {
  return executeMutation(createBookingDraftRef(dcOrVars, vars));
}

export const addBookingLineRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddBookingLine', inputVars);
}
addBookingLineRef.operationName = 'AddBookingLine';

export function addBookingLine(dcOrVars, vars) {
  return executeMutation(addBookingLineRef(dcOrVars, vars));
}

export const updateBookingStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateBookingStatus', inputVars);
}
updateBookingStatusRef.operationName = 'UpdateBookingStatus';

export function updateBookingStatus(dcOrVars, vars) {
  return executeMutation(updateBookingStatusRef(dcOrVars, vars));
}

export const createGuestTicketRequestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateGuestTicketRequest', inputVars);
}
createGuestTicketRequestRef.operationName = 'CreateGuestTicketRequest';

export function createGuestTicketRequest(dcOrVars, vars) {
  return executeMutation(createGuestTicketRequestRef(dcOrVars, vars));
}

export const adminDeleteGuestTicketRequestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminDeleteGuestTicketRequest', inputVars);
}
adminDeleteGuestTicketRequestRef.operationName = 'AdminDeleteGuestTicketRequest';

export function adminDeleteGuestTicketRequest(dcOrVars, vars) {
  return executeMutation(adminDeleteGuestTicketRequestRef(dcOrVars, vars));
}

export const adminReviewGuestTicketRequestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminReviewGuestTicketRequest', inputVars);
}
adminReviewGuestTicketRequestRef.operationName = 'AdminReviewGuestTicketRequest';

export function adminReviewGuestTicketRequest(dcOrVars, vars) {
  return executeMutation(adminReviewGuestTicketRequestRef(dcOrVars, vars));
}

export const adminDeleteBookingLineRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminDeleteBookingLine', inputVars);
}
adminDeleteBookingLineRef.operationName = 'AdminDeleteBookingLine';

export function adminDeleteBookingLine(dcOrVars, vars) {
  return executeMutation(adminDeleteBookingLineRef(dcOrVars, vars));
}

export const adminDeleteBookingRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminDeleteBooking', inputVars);
}
adminDeleteBookingRef.operationName = 'AdminDeleteBooking';

export function adminDeleteBooking(dcOrVars, vars) {
  return executeMutation(adminDeleteBookingRef(dcOrVars, vars));
}

export const resolvePaymentReconciliationExceptionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ResolvePaymentReconciliationException', inputVars);
}
resolvePaymentReconciliationExceptionRef.operationName = 'ResolvePaymentReconciliationException';

export function resolvePaymentReconciliationException(dcOrVars, vars) {
  return executeMutation(resolvePaymentReconciliationExceptionRef(dcOrVars, vars));
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

export const listUserGroupsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListUserGroups');
}
listUserGroupsRef.operationName = 'ListUserGroups';

export function listUserGroups(dc) {
  return executeQuery(listUserGroupsRef(dc));
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

export const getUserGroupByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserGroupById', inputVars);
}
getUserGroupByIdRef.operationName = 'GetUserGroupById';

export function getUserGroupById(dcOrVars, vars) {
  return executeQuery(getUserGroupByIdRef(dcOrVars, vars));
}

export const getAllUserGroupsWithStatusesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAllUserGroupsWithStatuses');
}
getAllUserGroupsWithStatusesRef.operationName = 'GetAllUserGroupsWithStatuses';

export function getAllUserGroupsWithStatuses(dc) {
  return executeQuery(getAllUserGroupsWithStatusesRef(dc));
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

export const getMyBookingsForEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyBookingsForEvent', inputVars);
}
getMyBookingsForEventRef.operationName = 'GetMyBookingsForEvent';

export function getMyBookingsForEvent(dcOrVars, vars) {
  return executeQuery(getMyBookingsForEventRef(dcOrVars, vars));
}

export const getMyTicketOrderByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyTicketOrderById', inputVars);
}
getMyTicketOrderByIdRef.operationName = 'GetMyTicketOrderById';

export function getMyTicketOrderById(dcOrVars, vars) {
  return executeQuery(getMyTicketOrderByIdRef(dcOrVars, vars));
}

export const getMyTicketOrdersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyTicketOrders');
}
getMyTicketOrdersRef.operationName = 'GetMyTicketOrders';

export function getMyTicketOrders(dc) {
  return executeQuery(getMyTicketOrdersRef(dc));
}

export const getMyBookingPaymentAdjustmentsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyBookingPaymentAdjustments');
}
getMyBookingPaymentAdjustmentsRef.operationName = 'GetMyBookingPaymentAdjustments';

export function getMyBookingPaymentAdjustments(dc) {
  return executeQuery(getMyBookingPaymentAdjustmentsRef(dc));
}

export const listEventBookingsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListEventBookingsForAdmin', inputVars);
}
listEventBookingsForAdminRef.operationName = 'ListEventBookingsForAdmin';

export function listEventBookingsForAdmin(dcOrVars, vars) {
  return executeQuery(listEventBookingsForAdminRef(dcOrVars, vars));
}

export const listGuestTicketRequestsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListGuestTicketRequestsForAdmin', inputVars);
}
listGuestTicketRequestsForAdminRef.operationName = 'ListGuestTicketRequestsForAdmin';

export function listGuestTicketRequestsForAdmin(dcOrVars, vars) {
  return executeQuery(listGuestTicketRequestsForAdminRef(dcOrVars, vars));
}

export const listTicketOrdersForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListTicketOrdersForAdmin', inputVars);
}
listTicketOrdersForAdminRef.operationName = 'ListTicketOrdersForAdmin';

export function listTicketOrdersForAdmin(dcOrVars, vars) {
  return executeQuery(listTicketOrdersForAdminRef(dcOrVars, vars));
}

export const listBookingPaymentAdjustmentsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListBookingPaymentAdjustmentsForAdmin', inputVars);
}
listBookingPaymentAdjustmentsForAdminRef.operationName = 'ListBookingPaymentAdjustmentsForAdmin';

export function listBookingPaymentAdjustmentsForAdmin(dcOrVars, vars) {
  return executeQuery(listBookingPaymentAdjustmentsForAdminRef(dcOrVars, vars));
}

export const listOpenPaymentReconciliationExceptionsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListOpenPaymentReconciliationExceptions');
}
listOpenPaymentReconciliationExceptionsRef.operationName = 'ListOpenPaymentReconciliationExceptions';

export function listOpenPaymentReconciliationExceptions(dc) {
  return executeQuery(listOpenPaymentReconciliationExceptionsRef(dc));
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

export const createUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUserGroup', inputVars);
}
createUserGroupRef.operationName = 'CreateUserGroup';

export function createUserGroup(dcOrVars, vars) {
  return executeMutation(createUserGroupRef(dcOrVars, vars));
}

export const addUserToUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddUserToUserGroup', inputVars);
}
addUserToUserGroupRef.operationName = 'AddUserToUserGroup';

export function addUserToUserGroup(dcOrVars, vars) {
  return executeMutation(addUserToUserGroupRef(dcOrVars, vars));
}

export const removeUserFromUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveUserFromUserGroup', inputVars);
}
removeUserFromUserGroupRef.operationName = 'RemoveUserFromUserGroup';

export function removeUserFromUserGroup(dcOrVars, vars) {
  return executeMutation(removeUserFromUserGroupRef(dcOrVars, vars));
}

export const grantUserGroupToSectionForPurposeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'GrantUserGroupToSectionForPurpose', inputVars);
}
grantUserGroupToSectionForPurposeRef.operationName = 'GrantUserGroupToSectionForPurpose';

export function grantUserGroupToSectionForPurpose(dcOrVars, vars) {
  return executeMutation(grantUserGroupToSectionForPurposeRef(dcOrVars, vars));
}

export const revokeUserGroupFromSectionForPurposeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RevokeUserGroupFromSectionForPurpose', inputVars);
}
revokeUserGroupFromSectionForPurposeRef.operationName = 'RevokeUserGroupFromSectionForPurpose';

export function revokeUserGroupFromSectionForPurpose(dcOrVars, vars) {
  return executeMutation(revokeUserGroupFromSectionForPurposeRef(dcOrVars, vars));
}

export const updateUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUserGroup', inputVars);
}
updateUserGroupRef.operationName = 'UpdateUserGroup';

export function updateUserGroup(dcOrVars, vars) {
  return executeMutation(updateUserGroupRef(dcOrVars, vars));
}

export const deleteUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteUserGroup', inputVars);
}
deleteUserGroupRef.operationName = 'DeleteUserGroup';

export function deleteUserGroup(dcOrVars, vars) {
  return executeMutation(deleteUserGroupRef(dcOrVars, vars));
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

export const createEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateEvent', inputVars);
}
createEventRef.operationName = 'CreateEvent';

export function createEvent(dcOrVars, vars) {
  return executeMutation(createEventRef(dcOrVars, vars));
}

export const updateEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateEvent', inputVars);
}
updateEventRef.operationName = 'UpdateEvent';

export function updateEvent(dcOrVars, vars) {
  return executeMutation(updateEventRef(dcOrVars, vars));
}

export const deleteEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteEvent', inputVars);
}
deleteEventRef.operationName = 'DeleteEvent';

export function deleteEvent(dcOrVars, vars) {
  return executeMutation(deleteEventRef(dcOrVars, vars));
}

export const createTicketTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateTicketType', inputVars);
}
createTicketTypeRef.operationName = 'CreateTicketType';

export function createTicketType(dcOrVars, vars) {
  return executeMutation(createTicketTypeRef(dcOrVars, vars));
}

export const updateTicketTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateTicketType', inputVars);
}
updateTicketTypeRef.operationName = 'UpdateTicketType';

export function updateTicketType(dcOrVars, vars) {
  return executeMutation(updateTicketTypeRef(dcOrVars, vars));
}

export const deleteTicketTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteTicketType', inputVars);
}
deleteTicketTypeRef.operationName = 'DeleteTicketType';

export function deleteTicketType(dcOrVars, vars) {
  return executeMutation(deleteTicketTypeRef(dcOrVars, vars));
}

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

export const subscribeToUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'SubscribeToUserGroup', inputVars);
}
subscribeToUserGroupRef.operationName = 'SubscribeToUserGroup';

export function subscribeToUserGroup(dcOrVars, vars) {
  return executeMutation(subscribeToUserGroupRef(dcOrVars, vars));
}

export const unsubscribeFromUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UnsubscribeFromUserGroup', inputVars);
}
unsubscribeFromUserGroupRef.operationName = 'UnsubscribeFromUserGroup';

export function unsubscribeFromUserGroup(dcOrVars, vars) {
  return executeMutation(unsubscribeFromUserGroupRef(dcOrVars, vars));
}

