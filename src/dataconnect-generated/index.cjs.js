const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

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

const updateUserMembershipStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUserMembershipStatus', inputVars);
}
updateUserMembershipStatusRef.operationName = 'UpdateUserMembershipStatus';
exports.updateUserMembershipStatusRef = updateUserMembershipStatusRef;

exports.updateUserMembershipStatus = function updateUserMembershipStatus(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateUserMembershipStatusRef(dcInstance, inputVars));
}
;

const deleteUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteUser', inputVars);
}
deleteUserRef.operationName = 'DeleteUser';
exports.deleteUserRef = deleteUserRef;

exports.deleteUser = function deleteUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteUserRef(dcInstance, inputVars));
}
;

const createUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUser', inputVars);
}
createUserRef.operationName = 'CreateUser';
exports.createUserRef = createUserRef;

exports.createUser = function createUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createUserRef(dcInstance, inputVars));
}
;

const createUserGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUserGroupAdmin', inputVars);
}
createUserGroupAdminRef.operationName = 'CreateUserGroupAdmin';
exports.createUserGroupAdminRef = createUserGroupAdminRef;

exports.createUserGroupAdmin = function createUserGroupAdmin(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createUserGroupAdminRef(dcInstance, inputVars));
}
;

const addUserToUserGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddUserToUserGroupAdmin', inputVars);
}
addUserToUserGroupAdminRef.operationName = 'AddUserToUserGroupAdmin';
exports.addUserToUserGroupAdminRef = addUserToUserGroupAdminRef;

exports.addUserToUserGroupAdmin = function addUserToUserGroupAdmin(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(addUserToUserGroupAdminRef(dcInstance, inputVars));
}
;

const removeUserFromUserGroupAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveUserFromUserGroupAdmin', inputVars);
}
removeUserFromUserGroupAdminRef.operationName = 'RemoveUserFromUserGroupAdmin';
exports.removeUserFromUserGroupAdminRef = removeUserFromUserGroupAdminRef;

exports.removeUserFromUserGroupAdmin = function removeUserFromUserGroupAdmin(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(removeUserFromUserGroupAdminRef(dcInstance, inputVars));
}
;

const getUserGroupByNameRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserGroupByName', inputVars);
}
getUserGroupByNameRef.operationName = 'GetUserGroupByName';
exports.getUserGroupByNameRef = getUserGroupByNameRef;

exports.getUserGroupByName = function getUserGroupByName(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserGroupByNameRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getUserUserGroupsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserUserGroupsForAdmin', inputVars);
}
getUserUserGroupsForAdminRef.operationName = 'GetUserUserGroupsForAdmin';
exports.getUserUserGroupsForAdminRef = getUserUserGroupsForAdminRef;

exports.getUserUserGroupsForAdmin = function getUserUserGroupsForAdmin(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserUserGroupsForAdminRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getUserForCheckoutRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserForCheckout', inputVars);
}
getUserForCheckoutRef.operationName = 'GetUserForCheckout';
exports.getUserForCheckoutRef = getUserForCheckoutRef;

exports.getUserForCheckout = function getUserForCheckout(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserForCheckoutRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getTicketTypeForCheckoutRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTicketTypeForCheckout', inputVars);
}
getTicketTypeForCheckoutRef.operationName = 'GetTicketTypeForCheckout';
exports.getTicketTypeForCheckoutRef = getTicketTypeForCheckoutRef;

exports.getTicketTypeForCheckout = function getTicketTypeForCheckout(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getTicketTypeForCheckoutRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const updateUserStripeCustomerIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUserStripeCustomerId', inputVars);
}
updateUserStripeCustomerIdRef.operationName = 'UpdateUserStripeCustomerId';
exports.updateUserStripeCustomerIdRef = updateUserStripeCustomerIdRef;

exports.updateUserStripeCustomerId = function updateUserStripeCustomerId(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateUserStripeCustomerIdRef(dcInstance, inputVars));
}
;

const getEventByIdForCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEventByIdForCallable', inputVars);
}
getEventByIdForCallableRef.operationName = 'GetEventByIdForCallable';
exports.getEventByIdForCallableRef = getEventByIdForCallableRef;

exports.getEventByIdForCallable = function getEventByIdForCallable(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getEventByIdForCallableRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getSectionByIdForCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionByIdForCallable', inputVars);
}
getSectionByIdForCallableRef.operationName = 'GetSectionByIdForCallable';
exports.getSectionByIdForCallableRef = getSectionByIdForCallableRef;

exports.getSectionByIdForCallable = function getSectionByIdForCallable(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getSectionByIdForCallableRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getBookingsForBookerAndEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBookingsForBookerAndEvent', inputVars);
}
getBookingsForBookerAndEventRef.operationName = 'GetBookingsForBookerAndEvent';
exports.getBookingsForBookerAndEventRef = getBookingsForBookerAndEventRef;

exports.getBookingsForBookerAndEvent = function getBookingsForBookerAndEvent(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getBookingsForBookerAndEventRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getTicketOrdersForBookerAndEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTicketOrdersForBookerAndEvent', inputVars);
}
getTicketOrdersForBookerAndEventRef.operationName = 'GetTicketOrdersForBookerAndEvent';
exports.getTicketOrdersForBookerAndEventRef = getTicketOrdersForBookerAndEventRef;

exports.getTicketOrdersForBookerAndEvent = function getTicketOrdersForBookerAndEvent(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getTicketOrdersForBookerAndEventRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const createBookingDraftForUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingDraftForUser', inputVars);
}
createBookingDraftForUserRef.operationName = 'CreateBookingDraftForUser';
exports.createBookingDraftForUserRef = createBookingDraftForUserRef;

exports.createBookingDraftForUser = function createBookingDraftForUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createBookingDraftForUserRef(dcInstance, inputVars));
}
;

const createBookingDraftRevisionForUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingDraftRevisionForUser', inputVars);
}
createBookingDraftRevisionForUserRef.operationName = 'CreateBookingDraftRevisionForUser';
exports.createBookingDraftRevisionForUserRef = createBookingDraftRevisionForUserRef;

exports.createBookingDraftRevisionForUser = function createBookingDraftRevisionForUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createBookingDraftRevisionForUserRef(dcInstance, inputVars));
}
;

const markBookingSupersededFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkBookingSupersededFromCallable', inputVars);
}
markBookingSupersededFromCallableRef.operationName = 'MarkBookingSupersededFromCallable';
exports.markBookingSupersededFromCallableRef = markBookingSupersededFromCallableRef;

exports.markBookingSupersededFromCallable = function markBookingSupersededFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markBookingSupersededFromCallableRef(dcInstance, inputVars));
}
;

const createBookingPaymentAdjustmentFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingPaymentAdjustmentFromCallable', inputVars);
}
createBookingPaymentAdjustmentFromCallableRef.operationName = 'CreateBookingPaymentAdjustmentFromCallable';
exports.createBookingPaymentAdjustmentFromCallableRef = createBookingPaymentAdjustmentFromCallableRef;

exports.createBookingPaymentAdjustmentFromCallable = function createBookingPaymentAdjustmentFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createBookingPaymentAdjustmentFromCallableRef(dcInstance, inputVars));
}
;

const addBookingLineFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddBookingLineFromCallable', inputVars);
}
addBookingLineFromCallableRef.operationName = 'AddBookingLineFromCallable';
exports.addBookingLineFromCallableRef = addBookingLineFromCallableRef;

exports.addBookingLineFromCallable = function addBookingLineFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(addBookingLineFromCallableRef(dcInstance, inputVars));
}
;

const updateBookingStatusFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateBookingStatusFromCallable', inputVars);
}
updateBookingStatusFromCallableRef.operationName = 'UpdateBookingStatusFromCallable';
exports.updateBookingStatusFromCallableRef = updateBookingStatusFromCallableRef;

exports.updateBookingStatusFromCallable = function updateBookingStatusFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateBookingStatusFromCallableRef(dcInstance, inputVars));
}
;

const createTicketOrderForCheckoutRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateTicketOrderForCheckout', inputVars);
}
createTicketOrderForCheckoutRef.operationName = 'CreateTicketOrderForCheckout';
exports.createTicketOrderForCheckoutRef = createTicketOrderForCheckoutRef;

exports.createTicketOrderForCheckout = function createTicketOrderForCheckout(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createTicketOrderForCheckoutRef(dcInstance, inputVars));
}
;

const getTicketOrderForWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTicketOrderForWebhook', inputVars);
}
getTicketOrderForWebhookRef.operationName = 'GetTicketOrderForWebhook';
exports.getTicketOrderForWebhookRef = getTicketOrderForWebhookRef;

exports.getTicketOrderForWebhook = function getTicketOrderForWebhook(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getTicketOrderForWebhookRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getTicketOrderStripeArtifactsForCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTicketOrderStripeArtifactsForCallable', inputVars);
}
getTicketOrderStripeArtifactsForCallableRef.operationName = 'GetTicketOrderStripeArtifactsForCallable';
exports.getTicketOrderStripeArtifactsForCallableRef = getTicketOrderStripeArtifactsForCallableRef;

exports.getTicketOrderStripeArtifactsForCallable = function getTicketOrderStripeArtifactsForCallable(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getTicketOrderStripeArtifactsForCallableRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getPaymentWebhookEventByStripeEventIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPaymentWebhookEventByStripeEventId', inputVars);
}
getPaymentWebhookEventByStripeEventIdRef.operationName = 'GetPaymentWebhookEventByStripeEventId';
exports.getPaymentWebhookEventByStripeEventIdRef = getPaymentWebhookEventByStripeEventIdRef;

exports.getPaymentWebhookEventByStripeEventId = function getPaymentWebhookEventByStripeEventId(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getPaymentWebhookEventByStripeEventIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const createPaymentWebhookEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePaymentWebhookEvent', inputVars);
}
createPaymentWebhookEventRef.operationName = 'CreatePaymentWebhookEvent';
exports.createPaymentWebhookEventRef = createPaymentWebhookEventRef;

exports.createPaymentWebhookEvent = function createPaymentWebhookEvent(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createPaymentWebhookEventRef(dcInstance, inputVars));
}
;

const getNotificationDeliveryByChannelAndKeyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetNotificationDeliveryByChannelAndKey', inputVars);
}
getNotificationDeliveryByChannelAndKeyRef.operationName = 'GetNotificationDeliveryByChannelAndKey';
exports.getNotificationDeliveryByChannelAndKeyRef = getNotificationDeliveryByChannelAndKeyRef;

exports.getNotificationDeliveryByChannelAndKey = function getNotificationDeliveryByChannelAndKey(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getNotificationDeliveryByChannelAndKeyRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const createNotificationDeliveryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateNotificationDelivery', inputVars);
}
createNotificationDeliveryRef.operationName = 'CreateNotificationDelivery';
exports.createNotificationDeliveryRef = createNotificationDeliveryRef;

exports.createNotificationDelivery = function createNotificationDelivery(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createNotificationDeliveryRef(dcInstance, inputVars));
}
;

const markNotificationDeliveryPendingByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkNotificationDeliveryPendingById', inputVars);
}
markNotificationDeliveryPendingByIdRef.operationName = 'MarkNotificationDeliveryPendingById';
exports.markNotificationDeliveryPendingByIdRef = markNotificationDeliveryPendingByIdRef;

exports.markNotificationDeliveryPendingById = function markNotificationDeliveryPendingById(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markNotificationDeliveryPendingByIdRef(dcInstance, inputVars));
}
;

const markNotificationDeliverySentByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkNotificationDeliverySentById', inputVars);
}
markNotificationDeliverySentByIdRef.operationName = 'MarkNotificationDeliverySentById';
exports.markNotificationDeliverySentByIdRef = markNotificationDeliverySentByIdRef;

exports.markNotificationDeliverySentById = function markNotificationDeliverySentById(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markNotificationDeliverySentByIdRef(dcInstance, inputVars));
}
;

const markNotificationDeliveryFailedByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkNotificationDeliveryFailedById', inputVars);
}
markNotificationDeliveryFailedByIdRef.operationName = 'MarkNotificationDeliveryFailedById';
exports.markNotificationDeliveryFailedByIdRef = markNotificationDeliveryFailedByIdRef;

exports.markNotificationDeliveryFailedById = function markNotificationDeliveryFailedById(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markNotificationDeliveryFailedByIdRef(dcInstance, inputVars));
}
;

const markTicketOrderPaidFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkTicketOrderPaidFromWebhook', inputVars);
}
markTicketOrderPaidFromWebhookRef.operationName = 'MarkTicketOrderPaidFromWebhook';
exports.markTicketOrderPaidFromWebhookRef = markTicketOrderPaidFromWebhookRef;

exports.markTicketOrderPaidFromWebhook = function markTicketOrderPaidFromWebhook(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markTicketOrderPaidFromWebhookRef(dcInstance, inputVars));
}
;

const markTicketOrderFailedFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkTicketOrderFailedFromWebhook', inputVars);
}
markTicketOrderFailedFromWebhookRef.operationName = 'MarkTicketOrderFailedFromWebhook';
exports.markTicketOrderFailedFromWebhookRef = markTicketOrderFailedFromWebhookRef;

exports.markTicketOrderFailedFromWebhook = function markTicketOrderFailedFromWebhook(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markTicketOrderFailedFromWebhookRef(dcInstance, inputVars));
}
;

const markTicketOrderRefundedFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkTicketOrderRefundedFromWebhook', inputVars);
}
markTicketOrderRefundedFromWebhookRef.operationName = 'MarkTicketOrderRefundedFromWebhook';
exports.markTicketOrderRefundedFromWebhookRef = markTicketOrderRefundedFromWebhookRef;

exports.markTicketOrderRefundedFromWebhook = function markTicketOrderRefundedFromWebhook(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markTicketOrderRefundedFromWebhookRef(dcInstance, inputVars));
}
;

const upsertTicketOrderDisputeFromWebhookRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertTicketOrderDisputeFromWebhook', inputVars);
}
upsertTicketOrderDisputeFromWebhookRef.operationName = 'UpsertTicketOrderDisputeFromWebhook';
exports.upsertTicketOrderDisputeFromWebhookRef = upsertTicketOrderDisputeFromWebhookRef;

exports.upsertTicketOrderDisputeFromWebhook = function upsertTicketOrderDisputeFromWebhook(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(upsertTicketOrderDisputeFromWebhookRef(dcInstance, inputVars));
}
;

const getPaymentReconciliationExceptionByOrderAndTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPaymentReconciliationExceptionByOrderAndType', inputVars);
}
getPaymentReconciliationExceptionByOrderAndTypeRef.operationName = 'GetPaymentReconciliationExceptionByOrderAndType';
exports.getPaymentReconciliationExceptionByOrderAndTypeRef = getPaymentReconciliationExceptionByOrderAndTypeRef;

exports.getPaymentReconciliationExceptionByOrderAndType = function getPaymentReconciliationExceptionByOrderAndType(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getPaymentReconciliationExceptionByOrderAndTypeRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const createPaymentReconciliationExceptionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePaymentReconciliationException', inputVars);
}
createPaymentReconciliationExceptionRef.operationName = 'CreatePaymentReconciliationException';
exports.createPaymentReconciliationExceptionRef = createPaymentReconciliationExceptionRef;

exports.createPaymentReconciliationException = function createPaymentReconciliationException(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createPaymentReconciliationExceptionRef(dcInstance, inputVars));
}
;

const updatePaymentReconciliationExceptionByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdatePaymentReconciliationExceptionById', inputVars);
}
updatePaymentReconciliationExceptionByIdRef.operationName = 'UpdatePaymentReconciliationExceptionById';
exports.updatePaymentReconciliationExceptionByIdRef = updatePaymentReconciliationExceptionByIdRef;

exports.updatePaymentReconciliationExceptionById = function updatePaymentReconciliationExceptionById(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updatePaymentReconciliationExceptionByIdRef(dcInstance, inputVars));
}
;

const updateBookingPreferencesFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateBookingPreferencesFromCallable', inputVars);
}
updateBookingPreferencesFromCallableRef.operationName = 'UpdateBookingPreferencesFromCallable';
exports.updateBookingPreferencesFromCallableRef = updateBookingPreferencesFromCallableRef;

exports.updateBookingPreferencesFromCallable = function updateBookingPreferencesFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateBookingPreferencesFromCallableRef(dcInstance, inputVars));
}
;

const deleteBookingLineFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteBookingLineFromCallable', inputVars);
}
deleteBookingLineFromCallableRef.operationName = 'DeleteBookingLineFromCallable';
exports.deleteBookingLineFromCallableRef = deleteBookingLineFromCallableRef;

exports.deleteBookingLineFromCallable = function deleteBookingLineFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteBookingLineFromCallableRef(dcInstance, inputVars));
}
;

const createGuestTicketRequestFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateGuestTicketRequestFromCallable', inputVars);
}
createGuestTicketRequestFromCallableRef.operationName = 'CreateGuestTicketRequestFromCallable';
exports.createGuestTicketRequestFromCallableRef = createGuestTicketRequestFromCallableRef;

exports.createGuestTicketRequestFromCallable = function createGuestTicketRequestFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createGuestTicketRequestFromCallableRef(dcInstance, inputVars));
}
;

const adminReviewGuestTicketRequestFromCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminReviewGuestTicketRequestFromCallable', inputVars);
}
adminReviewGuestTicketRequestFromCallableRef.operationName = 'AdminReviewGuestTicketRequestFromCallable';
exports.adminReviewGuestTicketRequestFromCallableRef = adminReviewGuestTicketRequestFromCallableRef;

exports.adminReviewGuestTicketRequestFromCallable = function adminReviewGuestTicketRequestFromCallable(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminReviewGuestTicketRequestFromCallableRef(dcInstance, inputVars));
}
;

const getBookingForGuestTicketCallableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBookingForGuestTicketCallable', inputVars);
}
getBookingForGuestTicketCallableRef.operationName = 'GetBookingForGuestTicketCallable';
exports.getBookingForGuestTicketCallableRef = getBookingForGuestTicketCallableRef;

exports.getBookingForGuestTicketCallable = function getBookingForGuestTicketCallable(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getBookingForGuestTicketCallableRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getBookingForNotificationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetBookingForNotification', inputVars);
}
getBookingForNotificationRef.operationName = 'GetBookingForNotification';
exports.getBookingForNotificationRef = getBookingForNotificationRef;

exports.getBookingForNotification = function getBookingForNotification(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getBookingForNotificationRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listStaleDraftBookingsForSchedulerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListStaleDraftBookingsForScheduler', inputVars);
}
listStaleDraftBookingsForSchedulerRef.operationName = 'ListStaleDraftBookingsForScheduler';
exports.listStaleDraftBookingsForSchedulerRef = listStaleDraftBookingsForSchedulerRef;

exports.listStaleDraftBookingsForScheduler = function listStaleDraftBookingsForScheduler(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listStaleDraftBookingsForSchedulerRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listStalePendingTicketOrdersForSchedulerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListStalePendingTicketOrdersForScheduler', inputVars);
}
listStalePendingTicketOrdersForSchedulerRef.operationName = 'ListStalePendingTicketOrdersForScheduler';
exports.listStalePendingTicketOrdersForSchedulerRef = listStalePendingTicketOrdersForSchedulerRef;

exports.listStalePendingTicketOrdersForScheduler = function listStalePendingTicketOrdersForScheduler(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listStalePendingTicketOrdersForSchedulerRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getGuestTicketRequestForNotificationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetGuestTicketRequestForNotification', inputVars);
}
getGuestTicketRequestForNotificationRef.operationName = 'GetGuestTicketRequestForNotification';
exports.getGuestTicketRequestForNotificationRef = getGuestTicketRequestForNotificationRef;

exports.getGuestTicketRequestForNotification = function getGuestTicketRequestForNotification(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getGuestTicketRequestForNotificationRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getSectionAnnouncementOptOutsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionAnnouncementOptOuts', inputVars);
}
getSectionAnnouncementOptOutsRef.operationName = 'GetSectionAnnouncementOptOuts';
exports.getSectionAnnouncementOptOutsRef = getSectionAnnouncementOptOutsRef;

exports.getSectionAnnouncementOptOuts = function getSectionAnnouncementOptOuts(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getSectionAnnouncementOptOutsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const createAnnouncementSendRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAnnouncementSend', inputVars);
}
createAnnouncementSendRef.operationName = 'CreateAnnouncementSend';
exports.createAnnouncementSendRef = createAnnouncementSendRef;

exports.createAnnouncementSend = function createAnnouncementSend(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createAnnouncementSendRef(dcInstance, inputVars));
}
;

const createAnnouncementRecipientRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAnnouncementRecipient', inputVars);
}
createAnnouncementRecipientRef.operationName = 'CreateAnnouncementRecipient';
exports.createAnnouncementRecipientRef = createAnnouncementRecipientRef;

exports.createAnnouncementRecipient = function createAnnouncementRecipient(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createAnnouncementRecipientRef(dcInstance, inputVars));
}
;

const getAnnouncementRecipientCountRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAnnouncementRecipientCount', inputVars);
}
getAnnouncementRecipientCountRef.operationName = 'GetAnnouncementRecipientCount';
exports.getAnnouncementRecipientCountRef = getAnnouncementRecipientCountRef;

exports.getAnnouncementRecipientCount = function getAnnouncementRecipientCount(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getAnnouncementRecipientCountRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getAnnouncementSendHistoryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAnnouncementSendHistory', inputVars);
}
getAnnouncementSendHistoryRef.operationName = 'GetAnnouncementSendHistory';
exports.getAnnouncementSendHistoryRef = getAnnouncementSendHistoryRef;

exports.getAnnouncementSendHistory = function getAnnouncementSendHistory(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getAnnouncementSendHistoryRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getAnnouncementSendRecipientsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAnnouncementSendRecipients', inputVars);
}
getAnnouncementSendRecipientsRef.operationName = 'GetAnnouncementSendRecipients';
exports.getAnnouncementSendRecipientsRef = getAnnouncementSendRecipientsRef;

exports.getAnnouncementSendRecipients = function getAnnouncementSendRecipients(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getAnnouncementSendRecipientsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getAnnouncementSendByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAnnouncementSendById', inputVars);
}
getAnnouncementSendByIdRef.operationName = 'GetAnnouncementSendById';
exports.getAnnouncementSendByIdRef = getAnnouncementSendByIdRef;

exports.getAnnouncementSendById = function getAnnouncementSendById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getAnnouncementSendByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getUserByEmailRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserByEmail', inputVars);
}
getUserByEmailRef.operationName = 'GetUserByEmail';
exports.getUserByEmailRef = getUserByEmailRef;

exports.getUserByEmail = function getUserByEmail(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserByEmailRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const updateEmailBounceStatsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateEmailBounceStats', inputVars);
}
updateEmailBounceStatsRef.operationName = 'UpdateEmailBounceStats';
exports.updateEmailBounceStatsRef = updateEmailBounceStatsRef;

exports.updateEmailBounceStats = function updateEmailBounceStats(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateEmailBounceStatsRef(dcInstance, inputVars));
}
;

const adminOptOutSectionAnnouncementRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminOptOutSectionAnnouncement', inputVars);
}
adminOptOutSectionAnnouncementRef.operationName = 'AdminOptOutSectionAnnouncement';
exports.adminOptOutSectionAnnouncementRef = adminOptOutSectionAnnouncementRef;

exports.adminOptOutSectionAnnouncement = function adminOptOutSectionAnnouncement(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminOptOutSectionAnnouncementRef(dcInstance, inputVars));
}
;

const adminOptInSectionAnnouncementRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminOptInSectionAnnouncement', inputVars);
}
adminOptInSectionAnnouncementRef.operationName = 'AdminOptInSectionAnnouncement';
exports.adminOptInSectionAnnouncementRef = adminOptInSectionAnnouncementRef;

exports.adminOptInSectionAnnouncement = function adminOptInSectionAnnouncement(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminOptInSectionAnnouncementRef(dcInstance, inputVars));
}
;

const getCallableInvocationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetCallableInvocation', inputVars);
}
getCallableInvocationRef.operationName = 'GetCallableInvocation';
exports.getCallableInvocationRef = getCallableInvocationRef;

exports.getCallableInvocation = function getCallableInvocation(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getCallableInvocationRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const upsertCallableInvocationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertCallableInvocation', inputVars);
}
upsertCallableInvocationRef.operationName = 'UpsertCallableInvocation';
exports.upsertCallableInvocationRef = upsertCallableInvocationRef;

exports.upsertCallableInvocation = function upsertCallableInvocation(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(upsertCallableInvocationRef(dcInstance, inputVars));
}
;

const createBookingDraftRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateBookingDraft', inputVars);
}
createBookingDraftRef.operationName = 'CreateBookingDraft';
exports.createBookingDraftRef = createBookingDraftRef;

exports.createBookingDraft = function createBookingDraft(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createBookingDraftRef(dcInstance, inputVars));
}
;

const addBookingLineRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddBookingLine', inputVars);
}
addBookingLineRef.operationName = 'AddBookingLine';
exports.addBookingLineRef = addBookingLineRef;

exports.addBookingLine = function addBookingLine(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(addBookingLineRef(dcInstance, inputVars));
}
;

const updateBookingStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateBookingStatus', inputVars);
}
updateBookingStatusRef.operationName = 'UpdateBookingStatus';
exports.updateBookingStatusRef = updateBookingStatusRef;

exports.updateBookingStatus = function updateBookingStatus(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateBookingStatusRef(dcInstance, inputVars));
}
;

const createGuestTicketRequestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateGuestTicketRequest', inputVars);
}
createGuestTicketRequestRef.operationName = 'CreateGuestTicketRequest';
exports.createGuestTicketRequestRef = createGuestTicketRequestRef;

exports.createGuestTicketRequest = function createGuestTicketRequest(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createGuestTicketRequestRef(dcInstance, inputVars));
}
;

const adminDeleteGuestTicketRequestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminDeleteGuestTicketRequest', inputVars);
}
adminDeleteGuestTicketRequestRef.operationName = 'AdminDeleteGuestTicketRequest';
exports.adminDeleteGuestTicketRequestRef = adminDeleteGuestTicketRequestRef;

exports.adminDeleteGuestTicketRequest = function adminDeleteGuestTicketRequest(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminDeleteGuestTicketRequestRef(dcInstance, inputVars));
}
;

const adminReviewGuestTicketRequestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminReviewGuestTicketRequest', inputVars);
}
adminReviewGuestTicketRequestRef.operationName = 'AdminReviewGuestTicketRequest';
exports.adminReviewGuestTicketRequestRef = adminReviewGuestTicketRequestRef;

exports.adminReviewGuestTicketRequest = function adminReviewGuestTicketRequest(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminReviewGuestTicketRequestRef(dcInstance, inputVars));
}
;

const adminDeleteBookingLineRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminDeleteBookingLine', inputVars);
}
adminDeleteBookingLineRef.operationName = 'AdminDeleteBookingLine';
exports.adminDeleteBookingLineRef = adminDeleteBookingLineRef;

exports.adminDeleteBookingLine = function adminDeleteBookingLine(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminDeleteBookingLineRef(dcInstance, inputVars));
}
;

const adminDeleteBookingRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminDeleteBooking', inputVars);
}
adminDeleteBookingRef.operationName = 'AdminDeleteBooking';
exports.adminDeleteBookingRef = adminDeleteBookingRef;

exports.adminDeleteBooking = function adminDeleteBooking(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminDeleteBookingRef(dcInstance, inputVars));
}
;

const resolvePaymentReconciliationExceptionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ResolvePaymentReconciliationException', inputVars);
}
resolvePaymentReconciliationExceptionRef.operationName = 'ResolvePaymentReconciliationException';
exports.resolvePaymentReconciliationExceptionRef = resolvePaymentReconciliationExceptionRef;

exports.resolvePaymentReconciliationException = function resolvePaymentReconciliationException(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(resolvePaymentReconciliationExceptionRef(dcInstance, inputVars));
}
;

const getCurrentUserRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetCurrentUser');
}
getCurrentUserRef.operationName = 'GetCurrentUser';
exports.getCurrentUserRef = getCurrentUserRef;

exports.getCurrentUser = function getCurrentUser(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getCurrentUserRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getUserByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserById', inputVars);
}
getUserByIdRef.operationName = 'GetUserById';
exports.getUserByIdRef = getUserByIdRef;

exports.getUserById = function getUserById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listUsersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListUsers');
}
listUsersRef.operationName = 'ListUsers';
exports.listUsersRef = listUsersRef;

exports.listUsers = function listUsers(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listUsersRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listSectionsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSections');
}
listSectionsRef.operationName = 'ListSections';
exports.listSectionsRef = listSectionsRef;

exports.listSections = function listSections(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listSectionsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getSectionsForUserRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionsForUser');
}
getSectionsForUserRef.operationName = 'GetSectionsForUser';
exports.getSectionsForUserRef = getSectionsForUserRef;

exports.getSectionsForUser = function getSectionsForUser(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getSectionsForUserRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listUserGroupsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListUserGroups');
}
listUserGroupsRef.operationName = 'ListUserGroups';
exports.listUserGroupsRef = listUserGroupsRef;

exports.listUserGroups = function listUserGroups(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listUserGroupsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getUserAccessGroupsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserAccessGroups');
}
getUserAccessGroupsRef.operationName = 'GetUserAccessGroups';
exports.getUserAccessGroupsRef = getUserAccessGroupsRef;

exports.getUserAccessGroups = function getUserAccessGroups(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getUserAccessGroupsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const checkUserProfileExistsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'CheckUserProfileExists');
}
checkUserProfileExistsRef.operationName = 'CheckUserProfileExists';
exports.checkUserProfileExistsRef = checkUserProfileExistsRef;

exports.checkUserProfileExists = function checkUserProfileExists(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(checkUserProfileExistsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getUserMembershipStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserMembershipStatus', inputVars);
}
getUserMembershipStatusRef.operationName = 'GetUserMembershipStatus';
exports.getUserMembershipStatusRef = getUserMembershipStatusRef;

exports.getUserMembershipStatus = function getUserMembershipStatus(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserMembershipStatusRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getUserWithAccessGroupsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserWithAccessGroups', inputVars);
}
getUserWithAccessGroupsRef.operationName = 'GetUserWithAccessGroups';
exports.getUserWithAccessGroupsRef = getUserWithAccessGroupsRef;

exports.getUserWithAccessGroups = function getUserWithAccessGroups(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserWithAccessGroupsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getUserAccessGroupsByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserAccessGroupsById', inputVars);
}
getUserAccessGroupsByIdRef.operationName = 'GetUserAccessGroupsById';
exports.getUserAccessGroupsByIdRef = getUserAccessGroupsByIdRef;

exports.getUserAccessGroupsById = function getUserAccessGroupsById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserAccessGroupsByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getEventsForSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEventsForSection', inputVars);
}
getEventsForSectionRef.operationName = 'GetEventsForSection';
exports.getEventsForSectionRef = getEventsForSectionRef;

exports.getEventsForSection = function getEventsForSection(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getEventsForSectionRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getEventByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetEventById', inputVars);
}
getEventByIdRef.operationName = 'GetEventById';
exports.getEventByIdRef = getEventByIdRef;

exports.getEventById = function getEventById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getEventByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getSectionByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionById', inputVars);
}
getSectionByIdRef.operationName = 'GetSectionById';
exports.getSectionByIdRef = getSectionByIdRef;

exports.getSectionById = function getSectionById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getSectionByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getUserGroupByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserGroupById', inputVars);
}
getUserGroupByIdRef.operationName = 'GetUserGroupById';
exports.getUserGroupByIdRef = getUserGroupByIdRef;

exports.getUserGroupById = function getUserGroupById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUserGroupByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getAllUserGroupsWithStatusesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAllUserGroupsWithStatuses');
}
getAllUserGroupsWithStatusesRef.operationName = 'GetAllUserGroupsWithStatuses';
exports.getAllUserGroupsWithStatusesRef = getAllUserGroupsWithStatusesRef;

exports.getAllUserGroupsWithStatuses = function getAllUserGroupsWithStatuses(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getAllUserGroupsWithStatusesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getSectionMembersRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionMembers', inputVars);
}
getSectionMembersRef.operationName = 'GetSectionMembers';
exports.getSectionMembersRef = getSectionMembersRef;

exports.getSectionMembers = function getSectionMembers(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getSectionMembersRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getMyBookingsForEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyBookingsForEvent', inputVars);
}
getMyBookingsForEventRef.operationName = 'GetMyBookingsForEvent';
exports.getMyBookingsForEventRef = getMyBookingsForEventRef;

exports.getMyBookingsForEvent = function getMyBookingsForEvent(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getMyBookingsForEventRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getMyBookingsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyBookings');
}
getMyBookingsRef.operationName = 'GetMyBookings';
exports.getMyBookingsRef = getMyBookingsRef;

exports.getMyBookings = function getMyBookings(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getMyBookingsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getMyTicketOrderByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyTicketOrderById', inputVars);
}
getMyTicketOrderByIdRef.operationName = 'GetMyTicketOrderById';
exports.getMyTicketOrderByIdRef = getMyTicketOrderByIdRef;

exports.getMyTicketOrderById = function getMyTicketOrderById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getMyTicketOrderByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getMyTicketOrdersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyTicketOrders');
}
getMyTicketOrdersRef.operationName = 'GetMyTicketOrders';
exports.getMyTicketOrdersRef = getMyTicketOrdersRef;

exports.getMyTicketOrders = function getMyTicketOrders(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getMyTicketOrdersRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getMyBookingPaymentAdjustmentsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyBookingPaymentAdjustments');
}
getMyBookingPaymentAdjustmentsRef.operationName = 'GetMyBookingPaymentAdjustments';
exports.getMyBookingPaymentAdjustmentsRef = getMyBookingPaymentAdjustmentsRef;

exports.getMyBookingPaymentAdjustments = function getMyBookingPaymentAdjustments(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getMyBookingPaymentAdjustmentsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listEventBookingsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListEventBookingsForAdmin', inputVars);
}
listEventBookingsForAdminRef.operationName = 'ListEventBookingsForAdmin';
exports.listEventBookingsForAdminRef = listEventBookingsForAdminRef;

exports.listEventBookingsForAdmin = function listEventBookingsForAdmin(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listEventBookingsForAdminRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listGuestTicketRequestsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListGuestTicketRequestsForAdmin', inputVars);
}
listGuestTicketRequestsForAdminRef.operationName = 'ListGuestTicketRequestsForAdmin';
exports.listGuestTicketRequestsForAdminRef = listGuestTicketRequestsForAdminRef;

exports.listGuestTicketRequestsForAdmin = function listGuestTicketRequestsForAdmin(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listGuestTicketRequestsForAdminRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listTicketOrdersForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListTicketOrdersForAdmin', inputVars);
}
listTicketOrdersForAdminRef.operationName = 'ListTicketOrdersForAdmin';
exports.listTicketOrdersForAdminRef = listTicketOrdersForAdminRef;

exports.listTicketOrdersForAdmin = function listTicketOrdersForAdmin(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listTicketOrdersForAdminRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listBookingPaymentAdjustmentsForAdminRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListBookingPaymentAdjustmentsForAdmin', inputVars);
}
listBookingPaymentAdjustmentsForAdminRef.operationName = 'ListBookingPaymentAdjustmentsForAdmin';
exports.listBookingPaymentAdjustmentsForAdminRef = listBookingPaymentAdjustmentsForAdminRef;

exports.listBookingPaymentAdjustmentsForAdmin = function listBookingPaymentAdjustmentsForAdmin(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listBookingPaymentAdjustmentsForAdminRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listOpenPaymentReconciliationExceptionsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListOpenPaymentReconciliationExceptions');
}
listOpenPaymentReconciliationExceptionsRef.operationName = 'ListOpenPaymentReconciliationExceptions';
exports.listOpenPaymentReconciliationExceptionsRef = listOpenPaymentReconciliationExceptionsRef;

exports.listOpenPaymentReconciliationExceptions = function listOpenPaymentReconciliationExceptions(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listOpenPaymentReconciliationExceptionsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getSectionAnnouncementOptOutRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSectionAnnouncementOptOut', inputVars);
}
getSectionAnnouncementOptOutRef.operationName = 'GetSectionAnnouncementOptOut';
exports.getSectionAnnouncementOptOutRef = getSectionAnnouncementOptOutRef;

exports.getSectionAnnouncementOptOut = function getSectionAnnouncementOptOut(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getSectionAnnouncementOptOutRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getMyAnnouncementPreferencesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyAnnouncementPreferences');
}
getMyAnnouncementPreferencesRef.operationName = 'GetMyAnnouncementPreferences';
exports.getMyAnnouncementPreferencesRef = getMyAnnouncementPreferencesRef;

exports.getMyAnnouncementPreferences = function getMyAnnouncementPreferences(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getMyAnnouncementPreferencesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const createSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSection', inputVars);
}
createSectionRef.operationName = 'CreateSection';
exports.createSectionRef = createSectionRef;

exports.createSection = function createSection(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createSectionRef(dcInstance, inputVars));
}
;

const createUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUserGroup', inputVars);
}
createUserGroupRef.operationName = 'CreateUserGroup';
exports.createUserGroupRef = createUserGroupRef;

exports.createUserGroup = function createUserGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createUserGroupRef(dcInstance, inputVars));
}
;

const addUserToUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddUserToUserGroup', inputVars);
}
addUserToUserGroupRef.operationName = 'AddUserToUserGroup';
exports.addUserToUserGroupRef = addUserToUserGroupRef;

exports.addUserToUserGroup = function addUserToUserGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(addUserToUserGroupRef(dcInstance, inputVars));
}
;

const removeUserFromUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveUserFromUserGroup', inputVars);
}
removeUserFromUserGroupRef.operationName = 'RemoveUserFromUserGroup';
exports.removeUserFromUserGroupRef = removeUserFromUserGroupRef;

exports.removeUserFromUserGroup = function removeUserFromUserGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(removeUserFromUserGroupRef(dcInstance, inputVars));
}
;

const grantUserGroupToSectionForPurposeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'GrantUserGroupToSectionForPurpose', inputVars);
}
grantUserGroupToSectionForPurposeRef.operationName = 'GrantUserGroupToSectionForPurpose';
exports.grantUserGroupToSectionForPurposeRef = grantUserGroupToSectionForPurposeRef;

exports.grantUserGroupToSectionForPurpose = function grantUserGroupToSectionForPurpose(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(grantUserGroupToSectionForPurposeRef(dcInstance, inputVars));
}
;

const revokeUserGroupFromSectionForPurposeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RevokeUserGroupFromSectionForPurpose', inputVars);
}
revokeUserGroupFromSectionForPurposeRef.operationName = 'RevokeUserGroupFromSectionForPurpose';
exports.revokeUserGroupFromSectionForPurposeRef = revokeUserGroupFromSectionForPurposeRef;

exports.revokeUserGroupFromSectionForPurpose = function revokeUserGroupFromSectionForPurpose(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(revokeUserGroupFromSectionForPurposeRef(dcInstance, inputVars));
}
;

const updateUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUserGroup', inputVars);
}
updateUserGroupRef.operationName = 'UpdateUserGroup';
exports.updateUserGroupRef = updateUserGroupRef;

exports.updateUserGroup = function updateUserGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateUserGroupRef(dcInstance, inputVars));
}
;

const deleteUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteUserGroup', inputVars);
}
deleteUserGroupRef.operationName = 'DeleteUserGroup';
exports.deleteUserGroupRef = deleteUserGroupRef;

exports.deleteUserGroup = function deleteUserGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteUserGroupRef(dcInstance, inputVars));
}
;

const updateSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSection', inputVars);
}
updateSectionRef.operationName = 'UpdateSection';
exports.updateSectionRef = updateSectionRef;

exports.updateSection = function updateSection(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateSectionRef(dcInstance, inputVars));
}
;

const deleteSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteSection', inputVars);
}
deleteSectionRef.operationName = 'DeleteSection';
exports.deleteSectionRef = deleteSectionRef;

exports.deleteSection = function deleteSection(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteSectionRef(dcInstance, inputVars));
}
;

const createEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateEvent', inputVars);
}
createEventRef.operationName = 'CreateEvent';
exports.createEventRef = createEventRef;

exports.createEvent = function createEvent(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createEventRef(dcInstance, inputVars));
}
;

const updateEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateEvent', inputVars);
}
updateEventRef.operationName = 'UpdateEvent';
exports.updateEventRef = updateEventRef;

exports.updateEvent = function updateEvent(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateEventRef(dcInstance, inputVars));
}
;

const deleteEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteEvent', inputVars);
}
deleteEventRef.operationName = 'DeleteEvent';
exports.deleteEventRef = deleteEventRef;

exports.deleteEvent = function deleteEvent(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteEventRef(dcInstance, inputVars));
}
;

const createTicketTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateTicketType', inputVars);
}
createTicketTypeRef.operationName = 'CreateTicketType';
exports.createTicketTypeRef = createTicketTypeRef;

exports.createTicketType = function createTicketType(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createTicketTypeRef(dcInstance, inputVars));
}
;

const updateTicketTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateTicketType', inputVars);
}
updateTicketTypeRef.operationName = 'UpdateTicketType';
exports.updateTicketTypeRef = updateTicketTypeRef;

exports.updateTicketType = function updateTicketType(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateTicketTypeRef(dcInstance, inputVars));
}
;

const deleteTicketTypeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteTicketType', inputVars);
}
deleteTicketTypeRef.operationName = 'DeleteTicketType';
exports.deleteTicketTypeRef = deleteTicketTypeRef;

exports.deleteTicketType = function deleteTicketType(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteTicketTypeRef(dcInstance, inputVars));
}
;

const createUserProfileRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUserProfile', inputVars);
}
createUserProfileRef.operationName = 'CreateUserProfile';
exports.createUserProfileRef = createUserProfileRef;

exports.createUserProfile = function createUserProfile(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createUserProfileRef(dcInstance, inputVars));
}
;

const upsertUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertUser', inputVars);
}
upsertUserRef.operationName = 'UpsertUser';
exports.upsertUserRef = upsertUserRef;

exports.upsertUser = function upsertUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(upsertUserRef(dcInstance, inputVars));
}
;

const updateUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUser', inputVars);
}
updateUserRef.operationName = 'UpdateUser';
exports.updateUserRef = updateUserRef;

exports.updateUser = function updateUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateUserRef(dcInstance, inputVars));
}
;

const registerForSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RegisterForSection', inputVars);
}
registerForSectionRef.operationName = 'RegisterForSection';
exports.registerForSectionRef = registerForSectionRef;

exports.registerForSection = function registerForSection(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(registerForSectionRef(dcInstance, inputVars));
}
;

const unregisterFromSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UnregisterFromSection', inputVars);
}
unregisterFromSectionRef.operationName = 'UnregisterFromSection';
exports.unregisterFromSectionRef = unregisterFromSectionRef;

exports.unregisterFromSection = function unregisterFromSection(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(unregisterFromSectionRef(dcInstance, inputVars));
}
;

const subscribeToUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'SubscribeToUserGroup', inputVars);
}
subscribeToUserGroupRef.operationName = 'SubscribeToUserGroup';
exports.subscribeToUserGroupRef = subscribeToUserGroupRef;

exports.subscribeToUserGroup = function subscribeToUserGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(subscribeToUserGroupRef(dcInstance, inputVars));
}
;

const unsubscribeFromUserGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UnsubscribeFromUserGroup', inputVars);
}
unsubscribeFromUserGroupRef.operationName = 'UnsubscribeFromUserGroup';
exports.unsubscribeFromUserGroupRef = unsubscribeFromUserGroupRef;

exports.unsubscribeFromUserGroup = function unsubscribeFromUserGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(unsubscribeFromUserGroupRef(dcInstance, inputVars));
}
;

const optOutSectionAnnouncementRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'OptOutSectionAnnouncement', inputVars);
}
optOutSectionAnnouncementRef.operationName = 'OptOutSectionAnnouncement';
exports.optOutSectionAnnouncementRef = optOutSectionAnnouncementRef;

exports.optOutSectionAnnouncement = function optOutSectionAnnouncement(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(optOutSectionAnnouncementRef(dcInstance, inputVars));
}
;

const optInSectionAnnouncementRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'OptInSectionAnnouncement', inputVars);
}
optInSectionAnnouncementRef.operationName = 'OptInSectionAnnouncement';
exports.optInSectionAnnouncementRef = optInSectionAnnouncementRef;

exports.optInSectionAnnouncement = function optInSectionAnnouncement(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(optInSectionAnnouncementRef(dcInstance, inputVars));
}
;
