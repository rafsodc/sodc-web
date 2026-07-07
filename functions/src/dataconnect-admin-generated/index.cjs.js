const { validateAdminArgs } = require('firebase-admin/data-connect');

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
  serviceId: 'sodc-web-service',
  location: 'europe-west2'
};
exports.connectorConfig = connectorConfig;

function updateUserMembershipStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateUserMembershipStatus', inputVars, inputOpts);
}
exports.updateUserMembershipStatus = updateUserMembershipStatus;

function deleteUser(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DeleteUser', inputVars, inputOpts);
}
exports.deleteUser = deleteUser;

function createUser(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateUser', inputVars, inputOpts);
}
exports.createUser = createUser;

function createUserGroupAdmin(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateUserGroupAdmin', inputVars, inputOpts);
}
exports.createUserGroupAdmin = createUserGroupAdmin;

function addUserToUserGroupAdmin(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AddUserToUserGroupAdmin', inputVars, inputOpts);
}
exports.addUserToUserGroupAdmin = addUserToUserGroupAdmin;

function removeUserFromUserGroupAdmin(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RemoveUserFromUserGroupAdmin', inputVars, inputOpts);
}
exports.removeUserFromUserGroupAdmin = removeUserFromUserGroupAdmin;

function getUserGroupByName(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetUserGroupByName', inputVars, inputOpts);
}
exports.getUserGroupByName = getUserGroupByName;

function getUserUserGroupsForAdmin(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetUserUserGroupsForAdmin', inputVars, inputOpts);
}
exports.getUserUserGroupsForAdmin = getUserUserGroupsForAdmin;

function getUserForCheckout(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetUserForCheckout', inputVars, inputOpts);
}
exports.getUserForCheckout = getUserForCheckout;

function getTicketTypeForCheckout(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetTicketTypeForCheckout', inputVars, inputOpts);
}
exports.getTicketTypeForCheckout = getTicketTypeForCheckout;

function updateUserStripeCustomerId(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateUserStripeCustomerId', inputVars, inputOpts);
}
exports.updateUserStripeCustomerId = updateUserStripeCustomerId;

function getEventByIdForCallable(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetEventByIdForCallable', inputVars, inputOpts);
}
exports.getEventByIdForCallable = getEventByIdForCallable;

function getSectionByIdForCallable(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetSectionByIdForCallable', inputVars, inputOpts);
}
exports.getSectionByIdForCallable = getSectionByIdForCallable;

function getBookingsForBookerAndEvent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetBookingsForBookerAndEvent', inputVars, inputOpts);
}
exports.getBookingsForBookerAndEvent = getBookingsForBookerAndEvent;

function getTicketOrdersForBookerAndEvent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetTicketOrdersForBookerAndEvent', inputVars, inputOpts);
}
exports.getTicketOrdersForBookerAndEvent = getTicketOrdersForBookerAndEvent;

function createBookingDraftForUser(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateBookingDraftForUser', inputVars, inputOpts);
}
exports.createBookingDraftForUser = createBookingDraftForUser;

function createBookingDraftRevisionForUser(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateBookingDraftRevisionForUser', inputVars, inputOpts);
}
exports.createBookingDraftRevisionForUser = createBookingDraftRevisionForUser;

function markBookingSupersededFromCallable(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkBookingSupersededFromCallable', inputVars, inputOpts);
}
exports.markBookingSupersededFromCallable = markBookingSupersededFromCallable;

function createBookingPaymentAdjustmentFromCallable(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateBookingPaymentAdjustmentFromCallable', inputVars, inputOpts);
}
exports.createBookingPaymentAdjustmentFromCallable = createBookingPaymentAdjustmentFromCallable;

function addBookingLineFromCallable(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AddBookingLineFromCallable', inputVars, inputOpts);
}
exports.addBookingLineFromCallable = addBookingLineFromCallable;

function updateBookingStatusFromCallable(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateBookingStatusFromCallable', inputVars, inputOpts);
}
exports.updateBookingStatusFromCallable = updateBookingStatusFromCallable;

function createTicketOrderForCheckout(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateTicketOrderForCheckout', inputVars, inputOpts);
}
exports.createTicketOrderForCheckout = createTicketOrderForCheckout;

function getTicketOrderForWebhook(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetTicketOrderForWebhook', inputVars, inputOpts);
}
exports.getTicketOrderForWebhook = getTicketOrderForWebhook;

function getTicketOrderStripeArtifactsForCallable(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetTicketOrderStripeArtifactsForCallable', inputVars, inputOpts);
}
exports.getTicketOrderStripeArtifactsForCallable = getTicketOrderStripeArtifactsForCallable;

function getPaymentWebhookEventByStripeEventId(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetPaymentWebhookEventByStripeEventId', inputVars, inputOpts);
}
exports.getPaymentWebhookEventByStripeEventId = getPaymentWebhookEventByStripeEventId;

function createPaymentWebhookEvent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreatePaymentWebhookEvent', inputVars, inputOpts);
}
exports.createPaymentWebhookEvent = createPaymentWebhookEvent;

function getNotificationDeliveryByChannelAndKey(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetNotificationDeliveryByChannelAndKey', inputVars, inputOpts);
}
exports.getNotificationDeliveryByChannelAndKey = getNotificationDeliveryByChannelAndKey;

function createNotificationDelivery(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateNotificationDelivery', inputVars, inputOpts);
}
exports.createNotificationDelivery = createNotificationDelivery;

function markNotificationDeliveryPendingById(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkNotificationDeliveryPendingById', inputVars, inputOpts);
}
exports.markNotificationDeliveryPendingById = markNotificationDeliveryPendingById;

function markNotificationDeliverySentById(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkNotificationDeliverySentById', inputVars, inputOpts);
}
exports.markNotificationDeliverySentById = markNotificationDeliverySentById;

function markNotificationDeliveryFailedById(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkNotificationDeliveryFailedById', inputVars, inputOpts);
}
exports.markNotificationDeliveryFailedById = markNotificationDeliveryFailedById;

function markTicketOrderPaidFromWebhook(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkTicketOrderPaidFromWebhook', inputVars, inputOpts);
}
exports.markTicketOrderPaidFromWebhook = markTicketOrderPaidFromWebhook;

function markTicketOrderFailedFromWebhook(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkTicketOrderFailedFromWebhook', inputVars, inputOpts);
}
exports.markTicketOrderFailedFromWebhook = markTicketOrderFailedFromWebhook;

function markTicketOrderRefundedFromWebhook(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkTicketOrderRefundedFromWebhook', inputVars, inputOpts);
}
exports.markTicketOrderRefundedFromWebhook = markTicketOrderRefundedFromWebhook;

function upsertTicketOrderDisputeFromWebhook(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertTicketOrderDisputeFromWebhook', inputVars, inputOpts);
}
exports.upsertTicketOrderDisputeFromWebhook = upsertTicketOrderDisputeFromWebhook;

function getPaymentReconciliationExceptionByOrderAndType(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetPaymentReconciliationExceptionByOrderAndType', inputVars, inputOpts);
}
exports.getPaymentReconciliationExceptionByOrderAndType = getPaymentReconciliationExceptionByOrderAndType;

function createPaymentReconciliationException(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreatePaymentReconciliationException', inputVars, inputOpts);
}
exports.createPaymentReconciliationException = createPaymentReconciliationException;

function updatePaymentReconciliationExceptionById(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdatePaymentReconciliationExceptionById', inputVars, inputOpts);
}
exports.updatePaymentReconciliationExceptionById = updatePaymentReconciliationExceptionById;

function updateBookingPreferencesFromCallable(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateBookingPreferencesFromCallable', inputVars, inputOpts);
}
exports.updateBookingPreferencesFromCallable = updateBookingPreferencesFromCallable;

function deleteBookingLineFromCallable(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DeleteBookingLineFromCallable', inputVars, inputOpts);
}
exports.deleteBookingLineFromCallable = deleteBookingLineFromCallable;

function createGuestTicketRequestFromCallable(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateGuestTicketRequestFromCallable', inputVars, inputOpts);
}
exports.createGuestTicketRequestFromCallable = createGuestTicketRequestFromCallable;

function adminReviewGuestTicketRequestFromCallable(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AdminReviewGuestTicketRequestFromCallable', inputVars, inputOpts);
}
exports.adminReviewGuestTicketRequestFromCallable = adminReviewGuestTicketRequestFromCallable;

function getBookingForGuestTicketCallable(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetBookingForGuestTicketCallable', inputVars, inputOpts);
}
exports.getBookingForGuestTicketCallable = getBookingForGuestTicketCallable;

function getBookingForNotification(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetBookingForNotification', inputVars, inputOpts);
}
exports.getBookingForNotification = getBookingForNotification;

function listStaleDraftBookingsForScheduler(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListStaleDraftBookingsForScheduler', inputVars, inputOpts);
}
exports.listStaleDraftBookingsForScheduler = listStaleDraftBookingsForScheduler;

function listStalePendingTicketOrdersForScheduler(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListStalePendingTicketOrdersForScheduler', inputVars, inputOpts);
}
exports.listStalePendingTicketOrdersForScheduler = listStalePendingTicketOrdersForScheduler;

function getGuestTicketRequestForNotification(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetGuestTicketRequestForNotification', inputVars, inputOpts);
}
exports.getGuestTicketRequestForNotification = getGuestTicketRequestForNotification;

function getSectionAnnouncementOptOuts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetSectionAnnouncementOptOuts', inputVars, inputOpts);
}
exports.getSectionAnnouncementOptOuts = getSectionAnnouncementOptOuts;

function createBookingDraft(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateBookingDraft', inputVars, inputOpts);
}
exports.createBookingDraft = createBookingDraft;

function addBookingLine(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AddBookingLine', inputVars, inputOpts);
}
exports.addBookingLine = addBookingLine;

function updateBookingStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateBookingStatus', inputVars, inputOpts);
}
exports.updateBookingStatus = updateBookingStatus;

function createGuestTicketRequest(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateGuestTicketRequest', inputVars, inputOpts);
}
exports.createGuestTicketRequest = createGuestTicketRequest;

function adminDeleteGuestTicketRequest(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AdminDeleteGuestTicketRequest', inputVars, inputOpts);
}
exports.adminDeleteGuestTicketRequest = adminDeleteGuestTicketRequest;

function adminReviewGuestTicketRequest(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AdminReviewGuestTicketRequest', inputVars, inputOpts);
}
exports.adminReviewGuestTicketRequest = adminReviewGuestTicketRequest;

function adminDeleteBookingLine(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AdminDeleteBookingLine', inputVars, inputOpts);
}
exports.adminDeleteBookingLine = adminDeleteBookingLine;

function adminDeleteBooking(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AdminDeleteBooking', inputVars, inputOpts);
}
exports.adminDeleteBooking = adminDeleteBooking;

function resolvePaymentReconciliationException(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ResolvePaymentReconciliationException', inputVars, inputOpts);
}
exports.resolvePaymentReconciliationException = resolvePaymentReconciliationException;

function getCurrentUser(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetCurrentUser', undefined, inputOpts);
}
exports.getCurrentUser = getCurrentUser;

function getUserById(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetUserById', inputVars, inputOpts);
}
exports.getUserById = getUserById;

function listUsers(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListUsers', undefined, inputOpts);
}
exports.listUsers = listUsers;

function listSections(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListSections', undefined, inputOpts);
}
exports.listSections = listSections;

function getSectionsForUser(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetSectionsForUser', undefined, inputOpts);
}
exports.getSectionsForUser = getSectionsForUser;

function listUserGroups(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListUserGroups', undefined, inputOpts);
}
exports.listUserGroups = listUserGroups;

function getUserAccessGroups(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetUserAccessGroups', undefined, inputOpts);
}
exports.getUserAccessGroups = getUserAccessGroups;

function checkUserProfileExists(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('CheckUserProfileExists', undefined, inputOpts);
}
exports.checkUserProfileExists = checkUserProfileExists;

function getUserMembershipStatus(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetUserMembershipStatus', inputVars, inputOpts);
}
exports.getUserMembershipStatus = getUserMembershipStatus;

function getUserWithAccessGroups(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetUserWithAccessGroups', inputVars, inputOpts);
}
exports.getUserWithAccessGroups = getUserWithAccessGroups;

function getUserAccessGroupsById(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetUserAccessGroupsById', inputVars, inputOpts);
}
exports.getUserAccessGroupsById = getUserAccessGroupsById;

function getEventsForSection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetEventsForSection', inputVars, inputOpts);
}
exports.getEventsForSection = getEventsForSection;

function getEventById(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetEventById', inputVars, inputOpts);
}
exports.getEventById = getEventById;

function getSectionById(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetSectionById', inputVars, inputOpts);
}
exports.getSectionById = getSectionById;

function getUserGroupById(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetUserGroupById', inputVars, inputOpts);
}
exports.getUserGroupById = getUserGroupById;

function getAllUserGroupsWithStatuses(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAllUserGroupsWithStatuses', undefined, inputOpts);
}
exports.getAllUserGroupsWithStatuses = getAllUserGroupsWithStatuses;

function getSectionMembers(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetSectionMembers', inputVars, inputOpts);
}
exports.getSectionMembers = getSectionMembers;

function getMyBookingsForEvent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyBookingsForEvent', inputVars, inputOpts);
}
exports.getMyBookingsForEvent = getMyBookingsForEvent;

function getMyBookings(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyBookings', undefined, inputOpts);
}
exports.getMyBookings = getMyBookings;

function getMyTicketOrderById(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyTicketOrderById', inputVars, inputOpts);
}
exports.getMyTicketOrderById = getMyTicketOrderById;

function getMyTicketOrders(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyTicketOrders', undefined, inputOpts);
}
exports.getMyTicketOrders = getMyTicketOrders;

function getMyBookingPaymentAdjustments(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyBookingPaymentAdjustments', undefined, inputOpts);
}
exports.getMyBookingPaymentAdjustments = getMyBookingPaymentAdjustments;

function listEventBookingsForAdmin(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListEventBookingsForAdmin', inputVars, inputOpts);
}
exports.listEventBookingsForAdmin = listEventBookingsForAdmin;

function listGuestTicketRequestsForAdmin(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListGuestTicketRequestsForAdmin', inputVars, inputOpts);
}
exports.listGuestTicketRequestsForAdmin = listGuestTicketRequestsForAdmin;

function listTicketOrdersForAdmin(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListTicketOrdersForAdmin', inputVars, inputOpts);
}
exports.listTicketOrdersForAdmin = listTicketOrdersForAdmin;

function listBookingPaymentAdjustmentsForAdmin(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListBookingPaymentAdjustmentsForAdmin', inputVars, inputOpts);
}
exports.listBookingPaymentAdjustmentsForAdmin = listBookingPaymentAdjustmentsForAdmin;

function listOpenPaymentReconciliationExceptions(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListOpenPaymentReconciliationExceptions', undefined, inputOpts);
}
exports.listOpenPaymentReconciliationExceptions = listOpenPaymentReconciliationExceptions;

function getSectionAnnouncementOptOut(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetSectionAnnouncementOptOut', inputVars, inputOpts);
}
exports.getSectionAnnouncementOptOut = getSectionAnnouncementOptOut;

function getMyAnnouncementPreferences(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyAnnouncementPreferences', undefined, inputOpts);
}
exports.getMyAnnouncementPreferences = getMyAnnouncementPreferences;

function createSection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateSection', inputVars, inputOpts);
}
exports.createSection = createSection;

function createUserGroup(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateUserGroup', inputVars, inputOpts);
}
exports.createUserGroup = createUserGroup;

function addUserToUserGroup(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AddUserToUserGroup', inputVars, inputOpts);
}
exports.addUserToUserGroup = addUserToUserGroup;

function removeUserFromUserGroup(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RemoveUserFromUserGroup', inputVars, inputOpts);
}
exports.removeUserFromUserGroup = removeUserFromUserGroup;

function grantUserGroupToSectionForPurpose(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('GrantUserGroupToSectionForPurpose', inputVars, inputOpts);
}
exports.grantUserGroupToSectionForPurpose = grantUserGroupToSectionForPurpose;

function revokeUserGroupFromSectionForPurpose(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RevokeUserGroupFromSectionForPurpose', inputVars, inputOpts);
}
exports.revokeUserGroupFromSectionForPurpose = revokeUserGroupFromSectionForPurpose;

function updateUserGroup(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateUserGroup', inputVars, inputOpts);
}
exports.updateUserGroup = updateUserGroup;

function deleteUserGroup(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DeleteUserGroup', inputVars, inputOpts);
}
exports.deleteUserGroup = deleteUserGroup;

function updateSection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateSection', inputVars, inputOpts);
}
exports.updateSection = updateSection;

function deleteSection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DeleteSection', inputVars, inputOpts);
}
exports.deleteSection = deleteSection;

function createEvent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateEvent', inputVars, inputOpts);
}
exports.createEvent = createEvent;

function updateEvent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateEvent', inputVars, inputOpts);
}
exports.updateEvent = updateEvent;

function deleteEvent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DeleteEvent', inputVars, inputOpts);
}
exports.deleteEvent = deleteEvent;

function createTicketType(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateTicketType', inputVars, inputOpts);
}
exports.createTicketType = createTicketType;

function updateTicketType(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateTicketType', inputVars, inputOpts);
}
exports.updateTicketType = updateTicketType;

function deleteTicketType(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DeleteTicketType', inputVars, inputOpts);
}
exports.deleteTicketType = deleteTicketType;

function createUserProfile(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateUserProfile', inputVars, inputOpts);
}
exports.createUserProfile = createUserProfile;

function upsertUser(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertUser', inputVars, inputOpts);
}
exports.upsertUser = upsertUser;

function updateUser(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateUser', inputVars, inputOpts);
}
exports.updateUser = updateUser;

function registerForSection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RegisterForSection', inputVars, inputOpts);
}
exports.registerForSection = registerForSection;

function unregisterFromSection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UnregisterFromSection', inputVars, inputOpts);
}
exports.unregisterFromSection = unregisterFromSection;

function subscribeToUserGroup(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SubscribeToUserGroup', inputVars, inputOpts);
}
exports.subscribeToUserGroup = subscribeToUserGroup;

function unsubscribeFromUserGroup(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UnsubscribeFromUserGroup', inputVars, inputOpts);
}
exports.unsubscribeFromUserGroup = unsubscribeFromUserGroup;

function optOutSectionAnnouncement(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('OptOutSectionAnnouncement', inputVars, inputOpts);
}
exports.optOutSectionAnnouncement = optOutSectionAnnouncement;

function optInSectionAnnouncement(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('OptInSectionAnnouncement', inputVars, inputOpts);
}
exports.optInSectionAnnouncement = optInSectionAnnouncement;

function createAnnouncementSend(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateAnnouncementSend', inputVars, inputOpts);
}
exports.createAnnouncementSend = createAnnouncementSend;

function createAnnouncementRecipient(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateAnnouncementRecipient', inputVars, inputOpts);
}
exports.createAnnouncementRecipient = createAnnouncementRecipient;

function getAnnouncementSendHistory(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAnnouncementSendHistory', inputVars, inputOpts);
}
exports.getAnnouncementSendHistory = getAnnouncementSendHistory;

function getAnnouncementSendRecipients(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAnnouncementSendRecipients', inputVars, inputOpts);
}
exports.getAnnouncementSendRecipients = getAnnouncementSendRecipients;

function adminOptOutSectionAnnouncement(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AdminOptOutSectionAnnouncement', inputVars, inputOpts);
}
exports.adminOptOutSectionAnnouncement = adminOptOutSectionAnnouncement;

function adminOptInSectionAnnouncement(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AdminOptInSectionAnnouncement', inputVars, inputOpts);
}
exports.adminOptInSectionAnnouncement = adminOptInSectionAnnouncement;

function getUserByEmail(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetUserByEmail', inputVars, inputOpts);
}
exports.getUserByEmail = getUserByEmail;

function updateEmailBounceStats(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateEmailBounceStats', inputVars, inputOpts);
}
exports.updateEmailBounceStats = updateEmailBounceStats;

