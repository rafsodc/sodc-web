import { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

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

export const NotificationChannel = {
  EMAIL: "EMAIL",
  SMS: "SMS",
  PUSH: "PUSH",
}

export const NotificationDeliveryStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
}

export const NotifyDeliveryReceiptOutcome = {
  APPLIED: "APPLIED",
  IGNORED_STATUS: "IGNORED_STATUS",
  IGNORED_NO_USER: "IGNORED_NO_USER",
  IGNORED_NO_RECIPIENT: "IGNORED_NO_RECIPIENT",
  NO_STATE_CHANGE: "NO_STATE_CHANGE",
}

export const NotifyDeliveryReceiptProcessingStatus = {
  PENDING: "PENDING",
  PROCESSED: "PROCESSED",
  FAILED: "FAILED",
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
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateUserMembershipStatusRef(dcInstance, inputVars));
}

export const deleteUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteUser', inputVars);
}
deleteUserRef.operationName = 'DeleteUser';

export function deleteUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteUserRef(dcInstance, inputVars));
}

export const createUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUser', inputVars);
}
createUserRef.operationName = 'CreateUser';

export function createUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createUserRef(dcInstance, inputVars));
}

export const createUserGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUserGroupAdmin', inputVars);
}
createUserGroupAdminRef.operationName = 'CreateUserGroupAdmin';

export function createUserGroupAdmin(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createUserGroupAdminRef(dcInstance, inputVars));
}

export const addUserToUserGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddUserToUserGroupAdmin', inputVars);
}
addUserToUserGroupAdminRef.operationName = 'AddUserToUserGroupAdmin';

export function addUserToUserGroupAdmin(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(addUserToUserGroupAdminRef(dcInstance, inputVars));
}

export const removeUserFromUserGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveUserFromUserGroupAdmin', inputVars);
}
removeUserFromUserGroupAdminRef.operationName = 'RemoveUserFromUserGroupAdmin';

export function removeUserFromUserGroupAdmin(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(removeUserFromUserGroupAdminRef(dcInstance, inputVars));
}

export const getUserGroupByNameRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserGroupByName', inputVars);
}
getUserGroupByNameRef.operationName = 'GetUserGroupByName';

export function getUserGroupByName(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserGroupByNameRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getUserUserGroupsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserUserGroupsForAdmin', inputVars);
}
getUserUserGroupsForAdminRef.operationName = 'GetUserUserGroupsForAdmin';

export function getUserUserGroupsForAdmin(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserUserGroupsForAdminRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getUserForCheckoutRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserForCheckout', inputVars);
}
getUserForCheckoutRef.operationName = 'GetUserForCheckout';

export function getUserForCheckout(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserForCheckoutRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getTicketTypeForCheckoutRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTicketTypeForCheckout', inputVars);
}
getTicketTypeForCheckoutRef.operationName = 'GetTicketTypeForCheckout';

export function getTicketTypeForCheckout(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getTicketTypeForCheckoutRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const updateUserStripeCustomerIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUserStripeCustomerId', inputVars);
}
updateUserStripeCustomerIdRef.operationName = 'UpdateUserStripeCustomerId';

export function updateUserStripeCustomerId(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateUserStripeCustomerIdRef(dcInstance, inputVars));
}

export const getEventByIdForCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEventByIdForCallable', inputVars);
}
getEventByIdForCallableRef.operationName = 'GetEventByIdForCallable';

export function getEventByIdForCallable(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getEventByIdForCallableRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getSectionByIdForCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionByIdForCallable', inputVars);
}
getSectionByIdForCallableRef.operationName = 'GetSectionByIdForCallable';

export function getSectionByIdForCallable(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getSectionByIdForCallableRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getBookingsForBookerAndEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBookingsForBookerAndEvent', inputVars);
}
getBookingsForBookerAndEventRef.operationName = 'GetBookingsForBookerAndEvent';

export function getBookingsForBookerAndEvent(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getBookingsForBookerAndEventRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getTicketOrdersForBookerAndEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTicketOrdersForBookerAndEvent', inputVars);
}
getTicketOrdersForBookerAndEventRef.operationName = 'GetTicketOrdersForBookerAndEvent';

export function getTicketOrdersForBookerAndEvent(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getTicketOrdersForBookerAndEventRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const createBookingDraftForUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingDraftForUser', inputVars);
}
createBookingDraftForUserRef.operationName = 'CreateBookingDraftForUser';

export function createBookingDraftForUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createBookingDraftForUserRef(dcInstance, inputVars));
}

export const createBookingDraftRevisionForUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingDraftRevisionForUser', inputVars);
}
createBookingDraftRevisionForUserRef.operationName = 'CreateBookingDraftRevisionForUser';

export function createBookingDraftRevisionForUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createBookingDraftRevisionForUserRef(dcInstance, inputVars));
}

export const markBookingSupersededFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkBookingSupersededFromCallable', inputVars);
}
markBookingSupersededFromCallableRef.operationName = 'MarkBookingSupersededFromCallable';

export function markBookingSupersededFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markBookingSupersededFromCallableRef(dcInstance, inputVars));
}

export const createBookingPaymentAdjustmentFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingPaymentAdjustmentFromCallable', inputVars);
}
createBookingPaymentAdjustmentFromCallableRef.operationName = 'CreateBookingPaymentAdjustmentFromCallable';

export function createBookingPaymentAdjustmentFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createBookingPaymentAdjustmentFromCallableRef(dcInstance, inputVars));
}

export const addBookingLineFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddBookingLineFromCallable', inputVars);
}
addBookingLineFromCallableRef.operationName = 'AddBookingLineFromCallable';

export function addBookingLineFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(addBookingLineFromCallableRef(dcInstance, inputVars));
}

export const updateBookingStatusFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateBookingStatusFromCallable', inputVars);
}
updateBookingStatusFromCallableRef.operationName = 'UpdateBookingStatusFromCallable';

export function updateBookingStatusFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateBookingStatusFromCallableRef(dcInstance, inputVars));
}

export const createTicketOrderForCheckoutRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateTicketOrderForCheckout', inputVars);
}
createTicketOrderForCheckoutRef.operationName = 'CreateTicketOrderForCheckout';

export function createTicketOrderForCheckout(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createTicketOrderForCheckoutRef(dcInstance, inputVars));
}

export const getTicketOrderForWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTicketOrderForWebhook', inputVars);
}
getTicketOrderForWebhookRef.operationName = 'GetTicketOrderForWebhook';

export function getTicketOrderForWebhook(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getTicketOrderForWebhookRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getTicketOrderStripeArtifactsForCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTicketOrderStripeArtifactsForCallable', inputVars);
}
getTicketOrderStripeArtifactsForCallableRef.operationName = 'GetTicketOrderStripeArtifactsForCallable';

export function getTicketOrderStripeArtifactsForCallable(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getTicketOrderStripeArtifactsForCallableRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getPaymentWebhookEventByStripeEventIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPaymentWebhookEventByStripeEventId', inputVars);
}
getPaymentWebhookEventByStripeEventIdRef.operationName = 'GetPaymentWebhookEventByStripeEventId';

export function getPaymentWebhookEventByStripeEventId(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getPaymentWebhookEventByStripeEventIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const createPaymentWebhookEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePaymentWebhookEvent', inputVars);
}
createPaymentWebhookEventRef.operationName = 'CreatePaymentWebhookEvent';

export function createPaymentWebhookEvent(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createPaymentWebhookEventRef(dcInstance, inputVars));
}

export const getNotificationDeliveryByChannelAndKeyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetNotificationDeliveryByChannelAndKey', inputVars);
}
getNotificationDeliveryByChannelAndKeyRef.operationName = 'GetNotificationDeliveryByChannelAndKey';

export function getNotificationDeliveryByChannelAndKey(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getNotificationDeliveryByChannelAndKeyRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const listFailedNotificationDeliveriesForRecoveryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListFailedNotificationDeliveriesForRecovery', inputVars);
}
listFailedNotificationDeliveriesForRecoveryRef.operationName = 'ListFailedNotificationDeliveriesForRecovery';

export function listFailedNotificationDeliveriesForRecovery(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listFailedNotificationDeliveriesForRecoveryRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const listStalePendingNotificationDeliveriesForRecoveryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListStalePendingNotificationDeliveriesForRecovery', inputVars);
}
listStalePendingNotificationDeliveriesForRecoveryRef.operationName = 'ListStalePendingNotificationDeliveriesForRecovery';

export function listStalePendingNotificationDeliveriesForRecovery(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listStalePendingNotificationDeliveriesForRecoveryRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const createNotificationDeliveryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateNotificationDelivery', inputVars);
}
createNotificationDeliveryRef.operationName = 'CreateNotificationDelivery';

export function createNotificationDelivery(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createNotificationDeliveryRef(dcInstance, inputVars));
}

export const claimNotificationDeliveryByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ClaimNotificationDeliveryById', inputVars);
}
claimNotificationDeliveryByIdRef.operationName = 'ClaimNotificationDeliveryById';

export function claimNotificationDeliveryById(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(claimNotificationDeliveryByIdRef(dcInstance, inputVars));
}

export const recordNotificationRecoveryFailureByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RecordNotificationRecoveryFailureById', inputVars);
}
recordNotificationRecoveryFailureByIdRef.operationName = 'RecordNotificationRecoveryFailureById';

export function recordNotificationRecoveryFailureById(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(recordNotificationRecoveryFailureByIdRef(dcInstance, inputVars));
}

export const markNotificationDeliverySentByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkNotificationDeliverySentById', inputVars);
}
markNotificationDeliverySentByIdRef.operationName = 'MarkNotificationDeliverySentById';

export function markNotificationDeliverySentById(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markNotificationDeliverySentByIdRef(dcInstance, inputVars));
}

export const markNotificationDeliveryFailedByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkNotificationDeliveryFailedById', inputVars);
}
markNotificationDeliveryFailedByIdRef.operationName = 'MarkNotificationDeliveryFailedById';

export function markNotificationDeliveryFailedById(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markNotificationDeliveryFailedByIdRef(dcInstance, inputVars));
}

export const markTicketOrderPaidFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkTicketOrderPaidFromWebhook', inputVars);
}
markTicketOrderPaidFromWebhookRef.operationName = 'MarkTicketOrderPaidFromWebhook';

export function markTicketOrderPaidFromWebhook(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markTicketOrderPaidFromWebhookRef(dcInstance, inputVars));
}

export const markTicketOrderFailedFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkTicketOrderFailedFromWebhook', inputVars);
}
markTicketOrderFailedFromWebhookRef.operationName = 'MarkTicketOrderFailedFromWebhook';

export function markTicketOrderFailedFromWebhook(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markTicketOrderFailedFromWebhookRef(dcInstance, inputVars));
}

export const markTicketOrderRefundedFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkTicketOrderRefundedFromWebhook', inputVars);
}
markTicketOrderRefundedFromWebhookRef.operationName = 'MarkTicketOrderRefundedFromWebhook';

export function markTicketOrderRefundedFromWebhook(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markTicketOrderRefundedFromWebhookRef(dcInstance, inputVars));
}

export const upsertTicketOrderDisputeFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertTicketOrderDisputeFromWebhook', inputVars);
}
upsertTicketOrderDisputeFromWebhookRef.operationName = 'UpsertTicketOrderDisputeFromWebhook';

export function upsertTicketOrderDisputeFromWebhook(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(upsertTicketOrderDisputeFromWebhookRef(dcInstance, inputVars));
}

export const getPaymentReconciliationExceptionByOrderAndTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPaymentReconciliationExceptionByOrderAndType', inputVars);
}
getPaymentReconciliationExceptionByOrderAndTypeRef.operationName = 'GetPaymentReconciliationExceptionByOrderAndType';

export function getPaymentReconciliationExceptionByOrderAndType(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getPaymentReconciliationExceptionByOrderAndTypeRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const upsertPaymentReconciliationExceptionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertPaymentReconciliationException', inputVars);
}
upsertPaymentReconciliationExceptionRef.operationName = 'UpsertPaymentReconciliationException';

export function upsertPaymentReconciliationException(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(upsertPaymentReconciliationExceptionRef(dcInstance, inputVars));
}

export const updateBookingPreferencesFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateBookingPreferencesFromCallable', inputVars);
}
updateBookingPreferencesFromCallableRef.operationName = 'UpdateBookingPreferencesFromCallable';

export function updateBookingPreferencesFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateBookingPreferencesFromCallableRef(dcInstance, inputVars));
}

export const deleteBookingLineFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteBookingLineFromCallable', inputVars);
}
deleteBookingLineFromCallableRef.operationName = 'DeleteBookingLineFromCallable';

export function deleteBookingLineFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteBookingLineFromCallableRef(dcInstance, inputVars));
}

export const createGuestTicketRequestFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateGuestTicketRequestFromCallable', inputVars);
}
createGuestTicketRequestFromCallableRef.operationName = 'CreateGuestTicketRequestFromCallable';

export function createGuestTicketRequestFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createGuestTicketRequestFromCallableRef(dcInstance, inputVars));
}

export const adminReviewGuestTicketRequestFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminReviewGuestTicketRequestFromCallable', inputVars);
}
adminReviewGuestTicketRequestFromCallableRef.operationName = 'AdminReviewGuestTicketRequestFromCallable';

export function adminReviewGuestTicketRequestFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminReviewGuestTicketRequestFromCallableRef(dcInstance, inputVars));
}

export const getBookingForGuestTicketCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBookingForGuestTicketCallable', inputVars);
}
getBookingForGuestTicketCallableRef.operationName = 'GetBookingForGuestTicketCallable';

export function getBookingForGuestTicketCallable(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getBookingForGuestTicketCallableRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getBookingForNotificationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBookingForNotification', inputVars);
}
getBookingForNotificationRef.operationName = 'GetBookingForNotification';

export function getBookingForNotification(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getBookingForNotificationRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const listStaleDraftBookingsForSchedulerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListStaleDraftBookingsForScheduler', inputVars);
}
listStaleDraftBookingsForSchedulerRef.operationName = 'ListStaleDraftBookingsForScheduler';

export function listStaleDraftBookingsForScheduler(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listStaleDraftBookingsForSchedulerRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const listStalePendingTicketOrdersForSchedulerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListStalePendingTicketOrdersForScheduler', inputVars);
}
listStalePendingTicketOrdersForSchedulerRef.operationName = 'ListStalePendingTicketOrdersForScheduler';

export function listStalePendingTicketOrdersForScheduler(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listStalePendingTicketOrdersForSchedulerRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getGuestTicketRequestForNotificationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetGuestTicketRequestForNotification', inputVars);
}
getGuestTicketRequestForNotificationRef.operationName = 'GetGuestTicketRequestForNotification';

export function getGuestTicketRequestForNotification(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getGuestTicketRequestForNotificationRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getSectionAnnouncementOptOutsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionAnnouncementOptOuts', inputVars);
}
getSectionAnnouncementOptOutsRef.operationName = 'GetSectionAnnouncementOptOuts';

export function getSectionAnnouncementOptOuts(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getSectionAnnouncementOptOutsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const createAnnouncementSendRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAnnouncementSend', inputVars);
}
createAnnouncementSendRef.operationName = 'CreateAnnouncementSend';

export function createAnnouncementSend(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createAnnouncementSendRef(dcInstance, inputVars));
}

export const createAnnouncementRecipientRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAnnouncementRecipient', inputVars);
}
createAnnouncementRecipientRef.operationName = 'CreateAnnouncementRecipient';

export function createAnnouncementRecipient(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createAnnouncementRecipientRef(dcInstance, inputVars));
}

export const getAnnouncementRecipientCountRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAnnouncementRecipientCount', inputVars);
}
getAnnouncementRecipientCountRef.operationName = 'GetAnnouncementRecipientCount';

export function getAnnouncementRecipientCount(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getAnnouncementRecipientCountRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getAnnouncementSendHistoryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAnnouncementSendHistory', inputVars);
}
getAnnouncementSendHistoryRef.operationName = 'GetAnnouncementSendHistory';

export function getAnnouncementSendHistory(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getAnnouncementSendHistoryRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getAnnouncementSendRecipientsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAnnouncementSendRecipients', inputVars);
}
getAnnouncementSendRecipientsRef.operationName = 'GetAnnouncementSendRecipients';

export function getAnnouncementSendRecipients(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getAnnouncementSendRecipientsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getAnnouncementSendByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAnnouncementSendById', inputVars);
}
getAnnouncementSendByIdRef.operationName = 'GetAnnouncementSendById';

export function getAnnouncementSendById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getAnnouncementSendByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getAnnouncementRecipientBySendAndUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAnnouncementRecipientBySendAndUser', inputVars);
}
getAnnouncementRecipientBySendAndUserRef.operationName = 'GetAnnouncementRecipientBySendAndUser';

export function getAnnouncementRecipientBySendAndUser(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getAnnouncementRecipientBySendAndUserRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const tryUpdateAnnouncementRecipientDeliveryStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'TryUpdateAnnouncementRecipientDeliveryStatus', inputVars);
}
tryUpdateAnnouncementRecipientDeliveryStatusRef.operationName = 'TryUpdateAnnouncementRecipientDeliveryStatus';

export function tryUpdateAnnouncementRecipientDeliveryStatus(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(tryUpdateAnnouncementRecipientDeliveryStatusRef(dcInstance, inputVars));
}

export const getUserByEmailRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserByEmail', inputVars);
}
getUserByEmailRef.operationName = 'GetUserByEmail';

export function getUserByEmail(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserByEmailRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getNotifyCallbackUserByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetNotifyCallbackUserById', inputVars);
}
getNotifyCallbackUserByIdRef.operationName = 'GetNotifyCallbackUserById';

export function getNotifyCallbackUserById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getNotifyCallbackUserByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const tryApplyNotifyDeliveryUserStateRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'TryApplyNotifyDeliveryUserState', inputVars);
}
tryApplyNotifyDeliveryUserStateRef.operationName = 'TryApplyNotifyDeliveryUserState';

export function tryApplyNotifyDeliveryUserState(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(tryApplyNotifyDeliveryUserStateRef(dcInstance, inputVars));
}

export const tryApplyNotifyDeliveryUserStateAndMarkLostRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'TryApplyNotifyDeliveryUserStateAndMarkLost', inputVars);
}
tryApplyNotifyDeliveryUserStateAndMarkLostRef.operationName = 'TryApplyNotifyDeliveryUserStateAndMarkLost';

export function tryApplyNotifyDeliveryUserStateAndMarkLost(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(tryApplyNotifyDeliveryUserStateAndMarkLostRef(dcInstance, inputVars));
}

export const getNotifyDeliveryReceiptRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetNotifyDeliveryReceipt', inputVars);
}
getNotifyDeliveryReceiptRef.operationName = 'GetNotifyDeliveryReceipt';

export function getNotifyDeliveryReceipt(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getNotifyDeliveryReceiptRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const createNotifyDeliveryReceiptRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateNotifyDeliveryReceipt', inputVars);
}
createNotifyDeliveryReceiptRef.operationName = 'CreateNotifyDeliveryReceipt';

export function createNotifyDeliveryReceipt(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createNotifyDeliveryReceiptRef(dcInstance, inputVars));
}

export const claimNotifyDeliveryReceiptRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ClaimNotifyDeliveryReceipt', inputVars);
}
claimNotifyDeliveryReceiptRef.operationName = 'ClaimNotifyDeliveryReceipt';

export function claimNotifyDeliveryReceipt(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(claimNotifyDeliveryReceiptRef(dcInstance, inputVars));
}

export const markNotifyDeliveryReceiptProcessedRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkNotifyDeliveryReceiptProcessed', inputVars);
}
markNotifyDeliveryReceiptProcessedRef.operationName = 'MarkNotifyDeliveryReceiptProcessed';

export function markNotifyDeliveryReceiptProcessed(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markNotifyDeliveryReceiptProcessedRef(dcInstance, inputVars));
}

export const markNotifyDeliveryReceiptFailedRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkNotifyDeliveryReceiptFailed', inputVars);
}
markNotifyDeliveryReceiptFailedRef.operationName = 'MarkNotifyDeliveryReceiptFailed';

export function markNotifyDeliveryReceiptFailed(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markNotifyDeliveryReceiptFailedRef(dcInstance, inputVars));
}

export const getRecentNotifyDeliveryReceiptsForUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetRecentNotifyDeliveryReceiptsForUser', inputVars);
}
getRecentNotifyDeliveryReceiptsForUserRef.operationName = 'GetRecentNotifyDeliveryReceiptsForUser';

export function getRecentNotifyDeliveryReceiptsForUser(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getRecentNotifyDeliveryReceiptsForUserRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getLatestNotifyDeliveryReceiptForReferenceRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetLatestNotifyDeliveryReceiptForReference', inputVars);
}
getLatestNotifyDeliveryReceiptForReferenceRef.operationName = 'GetLatestNotifyDeliveryReceiptForReference';

export function getLatestNotifyDeliveryReceiptForReference(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getLatestNotifyDeliveryReceiptForReferenceRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const adminOptOutSectionAnnouncementRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminOptOutSectionAnnouncement', inputVars);
}
adminOptOutSectionAnnouncementRef.operationName = 'AdminOptOutSectionAnnouncement';

export function adminOptOutSectionAnnouncement(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminOptOutSectionAnnouncementRef(dcInstance, inputVars));
}

export const adminOptInSectionAnnouncementRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminOptInSectionAnnouncement', inputVars);
}
adminOptInSectionAnnouncementRef.operationName = 'AdminOptInSectionAnnouncement';

export function adminOptInSectionAnnouncement(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminOptInSectionAnnouncementRef(dcInstance, inputVars));
}

export const getCallableInvocationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetCallableInvocation', inputVars);
}
getCallableInvocationRef.operationName = 'GetCallableInvocation';

export function getCallableInvocation(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getCallableInvocationRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const upsertCallableInvocationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertCallableInvocation', inputVars);
}
upsertCallableInvocationRef.operationName = 'UpsertCallableInvocation';

export function upsertCallableInvocation(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(upsertCallableInvocationRef(dcInstance, inputVars));
}

export const ensureCallableRateLimitBucketRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'EnsureCallableRateLimitBucket', inputVars);
}
ensureCallableRateLimitBucketRef.operationName = 'EnsureCallableRateLimitBucket';

export function ensureCallableRateLimitBucket(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(ensureCallableRateLimitBucketRef(dcInstance, inputVars));
}

export const consumeCallableRateLimitRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ConsumeCallableRateLimit', inputVars);
}
consumeCallableRateLimitRef.operationName = 'ConsumeCallableRateLimit';

export function consumeCallableRateLimit(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(consumeCallableRateLimitRef(dcInstance, inputVars));
}

export const createBookingDraftRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingDraft', inputVars);
}
createBookingDraftRef.operationName = 'CreateBookingDraft';

export function createBookingDraft(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createBookingDraftRef(dcInstance, inputVars));
}

export const addBookingLineRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddBookingLine', inputVars);
}
addBookingLineRef.operationName = 'AddBookingLine';

export function addBookingLine(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(addBookingLineRef(dcInstance, inputVars));
}

export const updateBookingStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateBookingStatus', inputVars);
}
updateBookingStatusRef.operationName = 'UpdateBookingStatus';

export function updateBookingStatus(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateBookingStatusRef(dcInstance, inputVars));
}

export const createGuestTicketRequestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateGuestTicketRequest', inputVars);
}
createGuestTicketRequestRef.operationName = 'CreateGuestTicketRequest';

export function createGuestTicketRequest(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createGuestTicketRequestRef(dcInstance, inputVars));
}

export const adminDeleteGuestTicketRequestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminDeleteGuestTicketRequest', inputVars);
}
adminDeleteGuestTicketRequestRef.operationName = 'AdminDeleteGuestTicketRequest';

export function adminDeleteGuestTicketRequest(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminDeleteGuestTicketRequestRef(dcInstance, inputVars));
}

export const adminReviewGuestTicketRequestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminReviewGuestTicketRequest', inputVars);
}
adminReviewGuestTicketRequestRef.operationName = 'AdminReviewGuestTicketRequest';

export function adminReviewGuestTicketRequest(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminReviewGuestTicketRequestRef(dcInstance, inputVars));
}

export const adminDeleteBookingLineRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminDeleteBookingLine', inputVars);
}
adminDeleteBookingLineRef.operationName = 'AdminDeleteBookingLine';

export function adminDeleteBookingLine(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminDeleteBookingLineRef(dcInstance, inputVars));
}

export const adminDeleteBookingRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminDeleteBooking', inputVars);
}
adminDeleteBookingRef.operationName = 'AdminDeleteBooking';

export function adminDeleteBooking(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminDeleteBookingRef(dcInstance, inputVars));
}

export const resolvePaymentReconciliationExceptionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ResolvePaymentReconciliationException', inputVars);
}
resolvePaymentReconciliationExceptionRef.operationName = 'ResolvePaymentReconciliationException';

export function resolvePaymentReconciliationException(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(resolvePaymentReconciliationExceptionRef(dcInstance, inputVars));
}

export const getCurrentUserRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetCurrentUser');
}
getCurrentUserRef.operationName = 'GetCurrentUser';

export function getCurrentUser(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getCurrentUserRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getUserByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserById', inputVars);
}
getUserByIdRef.operationName = 'GetUserById';

export function getUserById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const listUsersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListUsers');
}
listUsersRef.operationName = 'ListUsers';

export function listUsers(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listUsersRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const listSectionsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSections');
}
listSectionsRef.operationName = 'ListSections';

export function listSections(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listSectionsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getSectionsForUserRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionsForUser');
}
getSectionsForUserRef.operationName = 'GetSectionsForUser';

export function getSectionsForUser(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getSectionsForUserRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const listUserGroupsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListUserGroups');
}
listUserGroupsRef.operationName = 'ListUserGroups';

export function listUserGroups(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listUserGroupsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getUserAccessGroupsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserAccessGroups');
}
getUserAccessGroupsRef.operationName = 'GetUserAccessGroups';

export function getUserAccessGroups(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getUserAccessGroupsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const checkUserProfileExistsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'CheckUserProfileExists');
}
checkUserProfileExistsRef.operationName = 'CheckUserProfileExists';

export function checkUserProfileExists(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(checkUserProfileExistsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getUserMembershipStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserMembershipStatus', inputVars);
}
getUserMembershipStatusRef.operationName = 'GetUserMembershipStatus';

export function getUserMembershipStatus(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserMembershipStatusRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getUserWithAccessGroupsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserWithAccessGroups', inputVars);
}
getUserWithAccessGroupsRef.operationName = 'GetUserWithAccessGroups';

export function getUserWithAccessGroups(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserWithAccessGroupsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getUserAccessGroupsByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserAccessGroupsById', inputVars);
}
getUserAccessGroupsByIdRef.operationName = 'GetUserAccessGroupsById';

export function getUserAccessGroupsById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserAccessGroupsByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getEventsForSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEventsForSection', inputVars);
}
getEventsForSectionRef.operationName = 'GetEventsForSection';

export function getEventsForSection(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getEventsForSectionRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getEventByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEventById', inputVars);
}
getEventByIdRef.operationName = 'GetEventById';

export function getEventById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getEventByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getSectionByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionById', inputVars);
}
getSectionByIdRef.operationName = 'GetSectionById';

export function getSectionById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getSectionByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getUserGroupByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserGroupById', inputVars);
}
getUserGroupByIdRef.operationName = 'GetUserGroupById';

export function getUserGroupById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserGroupByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getAllUserGroupsWithStatusesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAllUserGroupsWithStatuses');
}
getAllUserGroupsWithStatusesRef.operationName = 'GetAllUserGroupsWithStatuses';

export function getAllUserGroupsWithStatuses(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getAllUserGroupsWithStatusesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getSectionMembersRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionMembers', inputVars);
}
getSectionMembersRef.operationName = 'GetSectionMembers';

export function getSectionMembers(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getSectionMembersRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getMyBookingsForEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyBookingsForEvent', inputVars);
}
getMyBookingsForEventRef.operationName = 'GetMyBookingsForEvent';

export function getMyBookingsForEvent(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getMyBookingsForEventRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getMyBookingsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyBookings');
}
getMyBookingsRef.operationName = 'GetMyBookings';

export function getMyBookings(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getMyBookingsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getMyTicketOrderByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyTicketOrderById', inputVars);
}
getMyTicketOrderByIdRef.operationName = 'GetMyTicketOrderById';

export function getMyTicketOrderById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getMyTicketOrderByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getMyTicketOrdersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyTicketOrders');
}
getMyTicketOrdersRef.operationName = 'GetMyTicketOrders';

export function getMyTicketOrders(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getMyTicketOrdersRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getMyBookingPaymentAdjustmentsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyBookingPaymentAdjustments');
}
getMyBookingPaymentAdjustmentsRef.operationName = 'GetMyBookingPaymentAdjustments';

export function getMyBookingPaymentAdjustments(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getMyBookingPaymentAdjustmentsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const listEventBookingsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListEventBookingsForAdmin', inputVars);
}
listEventBookingsForAdminRef.operationName = 'ListEventBookingsForAdmin';

export function listEventBookingsForAdmin(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listEventBookingsForAdminRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const listGuestTicketRequestsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListGuestTicketRequestsForAdmin', inputVars);
}
listGuestTicketRequestsForAdminRef.operationName = 'ListGuestTicketRequestsForAdmin';

export function listGuestTicketRequestsForAdmin(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listGuestTicketRequestsForAdminRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const listTicketOrdersForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListTicketOrdersForAdmin', inputVars);
}
listTicketOrdersForAdminRef.operationName = 'ListTicketOrdersForAdmin';

export function listTicketOrdersForAdmin(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listTicketOrdersForAdminRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const listBookingPaymentAdjustmentsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListBookingPaymentAdjustmentsForAdmin', inputVars);
}
listBookingPaymentAdjustmentsForAdminRef.operationName = 'ListBookingPaymentAdjustmentsForAdmin';

export function listBookingPaymentAdjustmentsForAdmin(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listBookingPaymentAdjustmentsForAdminRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const listOpenPaymentReconciliationExceptionsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListOpenPaymentReconciliationExceptions');
}
listOpenPaymentReconciliationExceptionsRef.operationName = 'ListOpenPaymentReconciliationExceptions';

export function listOpenPaymentReconciliationExceptions(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listOpenPaymentReconciliationExceptionsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getSectionAnnouncementOptOutRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionAnnouncementOptOut', inputVars);
}
getSectionAnnouncementOptOutRef.operationName = 'GetSectionAnnouncementOptOut';

export function getSectionAnnouncementOptOut(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getSectionAnnouncementOptOutRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const getMyAnnouncementPreferencesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyAnnouncementPreferences');
}
getMyAnnouncementPreferencesRef.operationName = 'GetMyAnnouncementPreferences';

export function getMyAnnouncementPreferences(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getMyAnnouncementPreferencesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const createSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSection', inputVars);
}
createSectionRef.operationName = 'CreateSection';

export function createSection(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createSectionRef(dcInstance, inputVars));
}

export const createUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUserGroup', inputVars);
}
createUserGroupRef.operationName = 'CreateUserGroup';

export function createUserGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createUserGroupRef(dcInstance, inputVars));
}

export const addUserToUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddUserToUserGroup', inputVars);
}
addUserToUserGroupRef.operationName = 'AddUserToUserGroup';

export function addUserToUserGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(addUserToUserGroupRef(dcInstance, inputVars));
}

export const removeUserFromUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveUserFromUserGroup', inputVars);
}
removeUserFromUserGroupRef.operationName = 'RemoveUserFromUserGroup';

export function removeUserFromUserGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(removeUserFromUserGroupRef(dcInstance, inputVars));
}

export const grantUserGroupToSectionForPurposeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'GrantUserGroupToSectionForPurpose', inputVars);
}
grantUserGroupToSectionForPurposeRef.operationName = 'GrantUserGroupToSectionForPurpose';

export function grantUserGroupToSectionForPurpose(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(grantUserGroupToSectionForPurposeRef(dcInstance, inputVars));
}

export const revokeUserGroupFromSectionForPurposeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RevokeUserGroupFromSectionForPurpose', inputVars);
}
revokeUserGroupFromSectionForPurposeRef.operationName = 'RevokeUserGroupFromSectionForPurpose';

export function revokeUserGroupFromSectionForPurpose(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(revokeUserGroupFromSectionForPurposeRef(dcInstance, inputVars));
}

export const updateUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUserGroup', inputVars);
}
updateUserGroupRef.operationName = 'UpdateUserGroup';

export function updateUserGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateUserGroupRef(dcInstance, inputVars));
}

export const deleteUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteUserGroup', inputVars);
}
deleteUserGroupRef.operationName = 'DeleteUserGroup';

export function deleteUserGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteUserGroupRef(dcInstance, inputVars));
}

export const updateSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSection', inputVars);
}
updateSectionRef.operationName = 'UpdateSection';

export function updateSection(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateSectionRef(dcInstance, inputVars));
}

export const deleteSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteSection', inputVars);
}
deleteSectionRef.operationName = 'DeleteSection';

export function deleteSection(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteSectionRef(dcInstance, inputVars));
}

export const createEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateEvent', inputVars);
}
createEventRef.operationName = 'CreateEvent';

export function createEvent(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createEventRef(dcInstance, inputVars));
}

export const updateEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateEvent', inputVars);
}
updateEventRef.operationName = 'UpdateEvent';

export function updateEvent(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateEventRef(dcInstance, inputVars));
}

export const deleteEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteEvent', inputVars);
}
deleteEventRef.operationName = 'DeleteEvent';

export function deleteEvent(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteEventRef(dcInstance, inputVars));
}

export const createTicketTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateTicketType', inputVars);
}
createTicketTypeRef.operationName = 'CreateTicketType';

export function createTicketType(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createTicketTypeRef(dcInstance, inputVars));
}

export const updateTicketTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateTicketType', inputVars);
}
updateTicketTypeRef.operationName = 'UpdateTicketType';

export function updateTicketType(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateTicketTypeRef(dcInstance, inputVars));
}

export const deleteTicketTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteTicketType', inputVars);
}
deleteTicketTypeRef.operationName = 'DeleteTicketType';

export function deleteTicketType(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteTicketTypeRef(dcInstance, inputVars));
}

export const createUserProfileRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUserProfile', inputVars);
}
createUserProfileRef.operationName = 'CreateUserProfile';

export function createUserProfile(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createUserProfileRef(dcInstance, inputVars));
}

export const upsertUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertUser', inputVars);
}
upsertUserRef.operationName = 'UpsertUser';

export function upsertUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(upsertUserRef(dcInstance, inputVars));
}

export const updateUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUser', inputVars);
}
updateUserRef.operationName = 'UpdateUser';

export function updateUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateUserRef(dcInstance, inputVars));
}

export const registerForSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RegisterForSection', inputVars);
}
registerForSectionRef.operationName = 'RegisterForSection';

export function registerForSection(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(registerForSectionRef(dcInstance, inputVars));
}

export const unregisterFromSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UnregisterFromSection', inputVars);
}
unregisterFromSectionRef.operationName = 'UnregisterFromSection';

export function unregisterFromSection(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(unregisterFromSectionRef(dcInstance, inputVars));
}

export const subscribeToUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'SubscribeToUserGroup', inputVars);
}
subscribeToUserGroupRef.operationName = 'SubscribeToUserGroup';

export function subscribeToUserGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(subscribeToUserGroupRef(dcInstance, inputVars));
}

export const unsubscribeFromUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UnsubscribeFromUserGroup', inputVars);
}
unsubscribeFromUserGroupRef.operationName = 'UnsubscribeFromUserGroup';

export function unsubscribeFromUserGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(unsubscribeFromUserGroupRef(dcInstance, inputVars));
}

export const optOutSectionAnnouncementRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'OptOutSectionAnnouncement', inputVars);
}
optOutSectionAnnouncementRef.operationName = 'OptOutSectionAnnouncement';

export function optOutSectionAnnouncement(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(optOutSectionAnnouncementRef(dcInstance, inputVars));
}

export const optInSectionAnnouncementRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'OptInSectionAnnouncement', inputVars);
}
optInSectionAnnouncementRef.operationName = 'OptInSectionAnnouncement';

export function optInSectionAnnouncement(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(optInSectionAnnouncementRef(dcInstance, inputVars));
}

