import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;

export enum BookingApprovalStatus {
  NOT_REQUIRED = "NOT_REQUIRED",
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}
export enum BookingPaymentAdjustmentStatus {
  NOT_REQUIRED = "NOT_REQUIRED",
  PENDING_AUTO_REFUND = "PENDING_AUTO_REFUND",
  PENDING_AUTO_CHARGE = "PENDING_AUTO_CHARGE",
  SETTLED = "SETTLED",
}
export enum BookingStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
}
export enum GovNotifyDeliveryMode {
  SIMULATION = "SIMULATION",
  TEAM_TEST = "TEAM_TEST",
  LIVE = "LIVE",
}
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
export enum NotificationChannel {
  EMAIL = "EMAIL",
  SMS = "SMS",
  PUSH = "PUSH",
}
export enum NotificationDeliveryStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
}
export enum NotifyDeliveryReceiptOutcome {
  APPLIED = "APPLIED",
  IGNORED_STATUS = "IGNORED_STATUS",
  IGNORED_NO_USER = "IGNORED_NO_USER",
  IGNORED_NO_RECIPIENT = "IGNORED_NO_RECIPIENT",
  NO_STATE_CHANGE = "NO_STATE_CHANGE",
}
export enum NotifyDeliveryReceiptProcessingStatus {
  PENDING = "PENDING",
  PROCESSED = "PROCESSED",
  FAILED = "FAILED",
}
export enum NotifyReplyToAuditAction {
  CREATED = "CREATED",
  UPDATED = "UPDATED",
  DISABLED = "DISABLED",
  PROVIDER_TEST_ACCEPTED = "PROVIDER_TEST_ACCEPTED",
  VERIFIED = "VERIFIED",
  DEFAULT_CHANGED = "DEFAULT_CHANGED",
  TEMPLATE_OVERRIDE_CHANGED = "TEMPLATE_OVERRIDE_CHANGED",
}
export enum NotifyReplyToVerificationStatus {
  UNVERIFIED = "UNVERIFIED",
  PROVIDER_ACCEPTED = "PROVIDER_ACCEPTED",
  VERIFIED = "VERIFIED",
}
export enum NotifyTemplateBindingAuditAction {
  CREATED = "CREATED",
  TEMPLATE_CHANGED = "TEMPLATE_CHANGED",
  VERSION_REVIEWED = "VERSION_REVIEWED",
}
export enum PaymentReconciliationExceptionStatus {
  OPEN = "OPEN",
  RESOLVED = "RESOLVED",
}
export enum PaymentReconciliationExceptionType {
  MISSING_PAYMENT_INTENT = "MISSING_PAYMENT_INTENT",
  REFUND_AMOUNT_MISMATCH = "REFUND_AMOUNT_MISMATCH",
  ACTIVE_DISPUTE = "ACTIVE_DISPUTE",
}
export enum PaymentWebhookEventOutcome {
  PROCESSED = "PROCESSED",
  IGNORED = "IGNORED",
  DUPLICATE = "DUPLICATE",
  FAILED = "FAILED",
}
export enum SectionFileStatus {
  PENDING = "PENDING",
  AVAILABLE = "AVAILABLE",
  REPLACING = "REPLACING",
  DELETING = "DELETING",
  DELETED = "DELETED",
}
export enum SectionType {
  MEMBERS = "MEMBERS",
  EVENTS = "EVENTS",
}
export enum SectionUserGroupPurpose {
  ACCESS = "ACCESS",
  MEMBER = "MEMBER",
  BOOKER = "BOOKER",
  MESSAGE = "MESSAGE",
  MODERATOR = "MODERATOR",
}
export enum TicketAudience {
  MEMBER = "MEMBER",
  GUEST = "GUEST",
}
export enum TicketOrderStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export interface AbandonPendingSectionFileData {
  sectionFile_updateMany: number;
}

export interface AbandonPendingSectionFileVariables {
  id: UUIDString;
  updatedBefore: TimestampString;
}

export interface AbortSectionFileReplacementData {
  sectionFile_updateMany: number;
}

export interface AbortSectionFileReplacementVariables {
  id: UUIDString;
  pendingStorageObjectPath: string;
  updatedBy: string;
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

export interface AdminDeleteBookingData {
  booking_delete?: Booking_Key | null;
}

export interface AdminDeleteBookingLineData {
  bookingLine_delete?: BookingLine_Key | null;
}

export interface AdminDeleteBookingLineVariables {
  id: UUIDString;
}

export interface AdminDeleteBookingVariables {
  id: UUIDString;
}

export interface AdminOptInSectionAnnouncementData {
  sectionAnnouncementOptOut_delete?: SectionAnnouncementOptOut_Key | null;
}

export interface AdminOptInSectionAnnouncementVariables {
  userId: string;
  sectionId: UUIDString;
}

export interface AdminOptOutSectionAnnouncementData {
  sectionAnnouncementOptOut_upsert: SectionAnnouncementOptOut_Key;
}

export interface AdminOptOutSectionAnnouncementVariables {
  userId: string;
  sectionId: UUIDString;
}

export interface AnnouncementRecipient_Key {
  id: UUIDString;
  __typename?: 'AnnouncementRecipient_Key';
}

export interface AnnouncementSend_Key {
  id: UUIDString;
  __typename?: 'AnnouncementSend_Key';
}

export interface BeginSectionFileDeletionData {
  sectionFile_updateMany: number;
}

export interface BeginSectionFileDeletionVariables {
  id: UUIDString;
  updatedBy: string;
}

export interface BeginSectionFileReplacementData {
  sectionFile_updateMany: number;
}

export interface BeginSectionFileReplacementVariables {
  id: UUIDString;
  pendingStorageObjectPath: string;
  pendingOriginalFilename: string;
  pendingContentType: string;
  pendingSizeBytes: number;
  updatedBy: string;
}

export interface BookingLine_Key {
  id: UUIDString;
  __typename?: 'BookingLine_Key';
}

export interface BookingPaymentAdjustment_Key {
  revisionBookingId: UUIDString;
  supersededBookingId: UUIDString;
  __typename?: 'BookingPaymentAdjustment_Key';
}

export interface BookingPlacePaymentAllocation_Key {
  id: UUIDString;
  __typename?: 'BookingPlacePaymentAllocation_Key';
}

export interface BookingPlace_Key {
  id: UUIDString;
  __typename?: 'BookingPlace_Key';
}

export interface Booking_Key {
  id: UUIDString;
  __typename?: 'Booking_Key';
}

export interface CallableInvocation_Key {
  userId: string;
  functionName: string;
  __typename?: 'CallableInvocation_Key';
}

export interface CallableRateLimitBucket_Key {
  userId: string;
  functionName: string;
  windowStart: TimestampString;
  __typename?: 'CallableRateLimitBucket_Key';
}

export interface ChangeGovNotifyDeliveryModeData {
  changed: number;
  govNotifyDeliveryModeAudit_insert: GovNotifyDeliveryModeAudit_Key;
}

export interface ChangeGovNotifyDeliveryModeVariables {
  expectedVersion: number;
  previousMode: GovNotifyDeliveryMode;
  newMode: GovNotifyDeliveryMode;
  deploymentCeiling: GovNotifyDeliveryMode;
  changedBy: string;
  reason: string;
}

export interface ChangeNotifyReplyToDefaultData {
  changed: number;
  notifyReplyToAudit_insert: NotifyReplyToAudit_Key;
}

export interface ChangeNotifyReplyToDefaultVariables {
  expectedVersion: number;
  previousAddressId?: UUIDString | null;
  newAddressId?: UUIDString | null;
  changedBy: string;
  reason?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
}

export interface CheckUserProfileExistsData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    membershipStatus: MembershipStatus;
  } & User_Key;
}

export interface ClaimNotificationDeliveryByIdData {
  notificationDelivery_updateMany: number;
}

export interface ClaimNotificationDeliveryByIdVariables {
  id: UUIDString;
  expectedStatus: NotificationDeliveryStatus;
  expectedAttemptCount: number;
  attemptCount: number;
  lastAttemptedAt: TimestampString;
  provider?: string | null;
  recoveryPayload?: string | null;
}

export interface ClaimNotifyDeliveryReceiptData {
  notifyDeliveryReceipt_updateMany: number;
}

export interface ClaimNotifyDeliveryReceiptVariables {
  id: string;
  expectedProcessingStatus: NotifyDeliveryReceiptProcessingStatus;
  expectedAttemptCount: number;
  attemptCount: number;
  lastAttemptedAt: TimestampString;
}

export interface ClearNotifyTemplateReplyToOverrideData {
  notifyTemplateReplyToOverride_delete?: NotifyTemplateReplyToOverride_Key | null;
  notifyReplyToAudit_insert: NotifyReplyToAudit_Key;
}

export interface ClearNotifyTemplateReplyToOverrideVariables {
  templateKey: string;
  changedBy: string;
  reason?: string | null;
  previousValue: string;
}

export interface ConfirmNotifyReplyToVerificationData {
  changed: number;
  notifyReplyToAudit_insert: NotifyReplyToAudit_Key;
}

export interface ConfirmNotifyReplyToVerificationVariables {
  id: UUIDString;
  expectedVersion: number;
  changedBy: string;
  reason?: string | null;
}

export interface ConfirmProfileReviewData {
  user_update?: User_Key | null;
}

export interface ConfirmProfileReviewVariables {
  firstName: string;
  lastName: string;
  serviceNumber: string;
  mobileNumber: string;
  postNominals?: string | null;
  rank: string;
  shareContactInfo: boolean;
  announcementOptOutAll: boolean;
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
}

export interface ConsumeCallableRateLimitData {
  consumed: number;
  callableRateLimitBucket_deleteMany: number;
}

export interface ConsumeCallableRateLimitVariables {
  userId: string;
  functionName: string;
  windowStart: TimestampString;
  cost: number;
  ceiling: number;
}

export interface CreateAnnouncementRecipientData {
  announcementRecipient_insert: AnnouncementRecipient_Key;
}

export interface CreateAnnouncementRecipientVariables {
  id: UUIDString;
  announcementSendId: UUIDString;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  skippedReason?: string | null;
  sentAt?: TimestampString | null;
  failureReason?: string | null;
}

export interface CreateAnnouncementRecipientWithDeliveryModeData {
  announcementRecipient_insert: AnnouncementRecipient_Key;
}

export interface CreateAnnouncementRecipientWithDeliveryModeVariables {
  id: UUIDString;
  announcementSendId: UUIDString;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  skippedReason?: string | null;
  sentAt?: TimestampString | null;
  failureReason?: string | null;
  effectiveDeliveryMode: GovNotifyDeliveryMode;
}

export interface CreateAnnouncementSendData {
  announcementSend_insert: AnnouncementSend_Key;
}

export interface CreateAnnouncementSendVariables {
  id: UUIDString;
  sectionId: UUIDString;
  templateUuid: string;
  templateName?: string | null;
  sentBy: string;
  recipientCount: number;
  skippedCount: number;
  recipientSnapshot: string;
}

export interface CreateAnnouncementSendWithDeliveryModeData {
  announcementSend_insert: AnnouncementSend_Key;
}

export interface CreateAnnouncementSendWithDeliveryModeVariables {
  id: UUIDString;
  sectionId: UUIDString;
  templateUuid: string;
  templateName?: string | null;
  sentBy: string;
  recipientCount: number;
  skippedCount: number;
  recipientSnapshot: string;
  requestedDeliveryMode: GovNotifyDeliveryMode;
  siteDeliveryMode: GovNotifyDeliveryMode;
  effectiveDeliveryMode: GovNotifyDeliveryMode;
  replyToAddressId?: UUIDString | null;
  replyToDisplayLabel?: string | null;
  replyToEmailAddress?: string | null;
  replyToNotifyUuid?: string | null;
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
  maxGuestsWithoutModeratorApproval: number;
}

export interface CreateGovNotifyDeliveryConfigurationData {
  govNotifyDeliveryConfiguration_insert: GovNotifyDeliveryConfiguration_Key;
}

export interface CreateMigratedUserProfileAndIdentityData {
  user_insert: User_Key;
  legacyUserIdentity_insert: LegacyUserIdentity_Key;
}

export interface CreateMigratedUserProfileAndIdentityVariables {
  userId: string;
  legacyUserId: UUIDString;
  oldUid?: number | null;
  sourceSystem: string;
  migrationBatchId: UUIDString;
  recordSchemaVersion: string;
  sourceChecksum: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  mobileNumber?: string | null;
  postNominals?: string | null;
  rank: string;
  membershipStatus: MembershipStatus;
  shareContactInfo: boolean;
  announcementOptOutAll: boolean;
  legacyPasswordMigrated?: boolean | null;
  now: TimestampString;
}

export interface CreateNotificationDeliveryData {
  notificationDelivery_insert: NotificationDelivery_Key;
}

export interface CreateNotificationDeliveryVariables {
  channel: NotificationChannel;
  notificationType: string;
  deliveryKey: string;
  recoveryPayload?: string | null;
  status: NotificationDeliveryStatus;
  ticketOrderId?: UUIDString | null;
  bookingId?: UUIDString | null;
  userId?: string | null;
  provider?: string | null;
  attemptCount: number;
  lastAttemptedAt?: TimestampString | null;
}

export interface CreateNotifyDeliveryReceiptData {
  notifyDeliveryReceipt_insert: NotifyDeliveryReceipt_Key;
}

export interface CreateNotifyDeliveryReceiptVariables {
  id: string;
  notifyStatus: string;
  reference?: string | null;
  recipientHash: string;
  userId?: string | null;
  eventAt: TimestampString;
  eventOrderingKey: string;
  affectsBounceState: boolean;
  lastAttemptedAt: TimestampString;
}

export interface CreateNotifyEmailConfigurationData {
  notifyEmailConfiguration_insert: NotifyEmailConfiguration_Key;
}

export interface CreateNotifyReplyToAddressData {
  notifyReplyToAddress_insert: NotifyReplyToAddress_Key;
  notifyReplyToAudit_insert: NotifyReplyToAudit_Key;
}

export interface CreateNotifyReplyToAddressVariables {
  id: UUIDString;
  displayLabel: string;
  emailAddress: string;
  notifyUuid: string;
  changedBy: string;
  reason?: string | null;
  newValue: string;
}

export interface CreatePaymentWebhookEventData {
  paymentWebhookEvent_insert: PaymentWebhookEvent_Key;
}

export interface CreatePaymentWebhookEventVariables {
  stripeEventId: string;
  eventType: string;
  outcome: PaymentWebhookEventOutcome;
  reason?: string | null;
  ticketOrderId?: UUIDString | null;
  stripeObjectId?: string | null;
  livemode: boolean;
}

export interface CreatePendingSectionFileData {
  sectionFile_insert: SectionFile_Key;
}

export interface CreatePendingSectionFileVariables {
  id: UUIDString;
  sectionId: UUIDString;
  pendingStorageObjectPath: string;
  displayName: string;
  originalFilename: string;
  description?: string | null;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  now: TimestampString;
}

export interface CreateSectionData {
  section_insert: Section_Key;
}

export interface CreateSectionVariables {
  name: string;
  type: SectionType;
  description?: string | null;
}

export interface CreateTicketOrderForCheckoutData {
  ticketOrder_insert: TicketOrder_Key;
}

export interface CreateTicketOrderForCheckoutVariables {
  userId: string;
  eventId: UUIDString;
  ticketTypeId: UUIDString;
  quantity: number;
  unitAmountMinor: number;
  totalAmountMinor: number;
  currency: string;
}

export interface CreateTicketTypeData {
  ticketType_insert: TicketType_Key;
}

export interface CreateTicketTypeVariables {
  eventId: UUIDString;
  userGroupId: UUIDString;
  audience: TicketAudience;
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
  serviceNumber: string;
  mobileNumber: string;
  postNominals?: string | null;
  requestedMembershipStatus: MembershipStatus;
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
  rank?: string | null;
  shareContactInfo?: boolean | null;
}

export interface CreateUserVariables {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  mobileNumber?: string | null;
  postNominals?: string | null;
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

export interface DisableDefaultNotifyReplyToAddressData {
  addressChanged: number;
  configurationChanged: number;
  notifyReplyToAudit_insert: NotifyReplyToAudit_Key;
}

export interface DisableDefaultNotifyReplyToAddressVariables {
  id: UUIDString;
  expectedAddressVersion: number;
  expectedConfigurationVersion: number;
  replacementAddressId?: UUIDString | null;
  changedBy: string;
  reason?: string | null;
  previousValue: string;
}

export interface EnsureCallableRateLimitBucketData {
  callableRateLimitBucket_upsert: CallableRateLimitBucket_Key;
}

export interface EnsureCallableRateLimitBucketVariables {
  userId: string;
  functionName: string;
  windowStart: TimestampString;
}

export interface Event_Key {
  id: UUIDString;
  __typename?: 'Event_Key';
}

export interface FinalizePendingSectionFileData {
  sectionFile_updateMany: number;
}

export interface FinalizePendingSectionFileVariables {
  id: UUIDString;
  pendingStorageObjectPath: string;
  storageObjectPath: string;
  objectGeneration: string;
  checksumSha256: string;
  contentType: string;
  sizeBytes: number;
  updatedBy: string;
}

export interface FinalizeSectionFileReplacementData {
  sectionFile_updateMany: number;
}

export interface FinalizeSectionFileReplacementVariables {
  id: UUIDString;
  pendingStorageObjectPath: string;
  storageObjectPath: string;
  originalFilename: string;
  objectGeneration: string;
  checksumSha256: string;
  contentType: string;
  sizeBytes: number;
  updatedBy: string;
}

export interface GetAllUserGroupsWithStatusesData {
  userGroups: ({
    id: UUIDString;
    name: string;
    membershipStatuses?: MembershipStatus[] | null;
  } & UserGroup_Key)[];
}

export interface GetAnnouncementRecipientBySendAndUserData {
  announcementRecipients: ({
    id: UUIDString;
    status: string;
    failureReason?: string | null;
    processingVersion: number;
    processingStartedAt?: TimestampString | null;
    providerNotificationId?: string | null;
    effectiveDeliveryMode: GovNotifyDeliveryMode;
    deliveryVersion: number;
    deliveryStatusUpdatedAt?: TimestampString | null;
    deliveryReceiptId?: string | null;
  } & AnnouncementRecipient_Key)[];
}

export interface GetAnnouncementRecipientBySendAndUserVariables {
  announcementSendId: UUIDString;
  userId: string;
}

export interface GetAnnouncementRecipientProgressData {
  announcementRecipients: ({
    status: string;
  })[];
}

export interface GetAnnouncementRecipientProgressVariables {
  sendId: UUIDString;
}

export interface GetAnnouncementRecipientsForResumeData {
  announcementRecipients: ({
    id: UUIDString;
    userId: string;
    status: string;
  } & AnnouncementRecipient_Key)[];
}

export interface GetAnnouncementRecipientsForResumeVariables {
  sendId: UUIDString;
}

export interface GetAnnouncementSendByIdData {
  announcementSend?: {
    id: UUIDString;
    sectionId: UUIDString;
    templateUuid: string;
    templateName?: string | null;
    sentBy: string;
    recipientCount: number;
    skippedCount: number;
    recipientSnapshot?: string | null;
    requestedDeliveryMode: GovNotifyDeliveryMode;
    siteDeliveryMode: GovNotifyDeliveryMode;
    effectiveDeliveryMode: GovNotifyDeliveryMode;
    replyToAddressId?: UUIDString | null;
    replyToDisplayLabel?: string | null;
    replyToEmailAddress?: string | null;
    replyToNotifyUuid?: string | null;
  } & AnnouncementSend_Key;
}

export interface GetAnnouncementSendByIdVariables {
  id: UUIDString;
}

export interface GetAnnouncementSendHistoryData {
  announcementSends: ({
    id: UUIDString;
    templateUuid: string;
    templateName?: string | null;
    sentBy: string;
    sentAt: TimestampString;
    recipientCount: number;
    skippedCount: number;
    requestedDeliveryMode: GovNotifyDeliveryMode;
    siteDeliveryMode: GovNotifyDeliveryMode;
    effectiveDeliveryMode: GovNotifyDeliveryMode;
    replyToAddressId?: UUIDString | null;
    replyToDisplayLabel?: string | null;
    replyToEmailAddress?: string | null;
  } & AnnouncementSend_Key)[];
}

export interface GetAnnouncementSendHistoryVariables {
  sectionId: UUIDString;
}

export interface GetAnnouncementSendRecipientsData {
  announcementRecipients: ({
    id: UUIDString;
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    skippedReason?: string | null;
    sentAt?: TimestampString | null;
    failureReason?: string | null;
    effectiveDeliveryMode: GovNotifyDeliveryMode;
  } & AnnouncementRecipient_Key)[];
}

export interface GetAnnouncementSendRecipientsVariables {
  sendId: UUIDString;
}

export interface GetBookingForNotificationData {
  booking?: {
    id: UUIDString;
    revisionNumber: number;
    approvalStatus: BookingApprovalStatus;
    approvalNote?: string | null;
    sitNextToUserIds?: string[] | null;
    accommodationRequested: boolean;
    accommodationNote?: string | null;
    booker: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } & User_Key;
    event: {
      id: UUIDString;
      title: string;
      location?: string | null;
      startDateTime: TimestampString;
      endDateTime: TimestampString;
      section: {
        id: UUIDString;
        name: string;
      } & Section_Key;
    } & Event_Key;
    lines: ({
      sortOrder: number;
      guestDisplayName?: string | null;
      dietaryNote?: string | null;
      ticketType: {
        title: string;
        audience: TicketAudience;
        price: number;
      };
      guestUser?: {
        firstName: string;
        lastName: string;
      };
    })[];
    supersedesBooking?: {
      id: UUIDString;
      revisionNumber: number;
    } & Booking_Key;
  } & Booking_Key;
}

export interface GetBookingForNotificationVariables {
  bookingId: UUIDString;
}

export interface GetBookingRevisionForApprovalFromCallableData {
  booking?: {
    id: UUIDString;
    status: BookingStatus;
    approvalStatus: BookingApprovalStatus;
    approvalReviewedAt?: TimestampString | null;
    approvalNote?: string | null;
    revisionGroupId: UUIDString;
    revisionNumber: number;
    supersededAt?: TimestampString | null;
    clientSubmissionKey?: string | null;
    booker: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } & User_Key;
    event: {
      id: UUIDString;
      title: string;
      section: {
        id: UUIDString;
        name: string;
      } & Section_Key;
    } & Event_Key;
    supersedesBooking?: {
      id: UUIDString;
      revisionNumber: number;
    } & Booking_Key;
    lines: ({
      id: UUIDString;
      sortOrder: number;
      guestDisplayName?: string | null;
      dietaryNote?: string | null;
      ticketType: {
        id: UUIDString;
        title: string;
        audience: TicketAudience;
        price: number;
      } & TicketType_Key;
      guestUser?: {
        id: string;
        firstName: string;
        lastName: string;
      } & User_Key;
    } & BookingLine_Key)[];
  } & Booking_Key;
}

export interface GetBookingRevisionForApprovalFromCallableVariables {
  id: UUIDString;
}

export interface GetBookingsForBookerAndEventData {
  user?: {
    id: string;
    ticketOrders: ({
      id: UUIDString;
      status: TicketOrderStatus;
      stripePaymentIntentId?: string | null;
    } & TicketOrder_Key)[];
    bookings: ({
      id: UUIDString;
      status: BookingStatus;
      approvalStatus: BookingApprovalStatus;
      approvalReviewedAt?: TimestampString | null;
      approvalNote?: string | null;
      revisionGroupId: UUIDString;
      revisionNumber: number;
      supersededAt?: TimestampString | null;
      supersedesBooking?: {
        id: UUIDString;
      } & Booking_Key;
      clientSubmissionKey?: string | null;
      sitNextToUserIds?: string[] | null;
      accommodationRequested: boolean;
      accommodationNote?: string | null;
      createdAt: TimestampString;
      updatedAt: TimestampString;
      lines: ({
        id: UUIDString;
        bookingPlace: {
          id: UUIDString;
          paymentAllocations: ({
            id: UUIDString;
            ticketOrderId: UUIDString;
            allocatedAmountMinor: number;
            refundedAmountMinor: number;
            stripeRefundId?: string | null;
            createdAt: TimestampString;
          } & BookingPlacePaymentAllocation_Key)[];
        } & BookingPlace_Key;
        sortOrder: number;
        guestDisplayName?: string | null;
        dietaryNote?: string | null;
        guestUser?: {
          id: string;
        } & User_Key;
        ticketType: {
          id: UUIDString;
          audience: TicketAudience;
          price: number;
          title: string;
        } & TicketType_Key;
      } & BookingLine_Key)[];
    } & Booking_Key)[];
  } & User_Key;
}

export interface GetBookingsForBookerAndEventVariables {
  bookerId: string;
  eventId: UUIDString;
}

export interface GetCallableInvocationData {
  callableInvocation?: {
    windowStart: TimestampString;
    count: number;
  };
}

export interface GetCallableInvocationVariables {
  userId: string;
  functionName: string;
}

export interface GetCurrentUserData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    mobileNumber?: string | null;
    postNominals?: string | null;
    membershipStatus: MembershipStatus;
    requestedMembershipStatus?: MembershipStatus | null;
    isRegular?: boolean | null;
    isReserve?: boolean | null;
    isCivilServant?: boolean | null;
    isIndustry?: boolean | null;
    rank?: string | null;
    shareContactInfo?: boolean | null;
    announcementOptOutAll: boolean;
    legacyPasswordMigrated?: boolean | null;
    profileReviewedAt?: TimestampString | null;
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
    maxGuestsWithoutModeratorApproval: number;
    ticketTypes: ({
      id: UUIDString;
      title: string;
      description?: string | null;
      audience: TicketAudience;
      price: number;
      sortOrder: number;
      userGroup: {
        id: UUIDString;
        name: string;
        membershipStatuses?: MembershipStatus[] | null;
      } & UserGroup_Key;
    } & TicketType_Key)[];
  } & Event_Key;
}

export interface GetEventByIdForCallableData {
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
    maxGuestsWithoutModeratorApproval: number;
    ticketTypes: ({
      id: UUIDString;
      title: string;
      description?: string | null;
      audience: TicketAudience;
      price: number;
      sortOrder: number;
      userGroup: {
        id: UUIDString;
        name: string;
        membershipStatuses?: MembershipStatus[] | null;
      } & UserGroup_Key;
    } & TicketType_Key)[];
  } & Event_Key;
}

export interface GetEventByIdForCallableVariables {
  id: UUIDString;
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
      maxGuestsWithoutModeratorApproval: number;
    } & Event_Key)[];
  } & Section_Key;
}

export interface GetEventsForSectionVariables {
  sectionId: UUIDString;
}

export interface GetGovNotifyDeliveryConfigurationData {
  govNotifyDeliveryConfiguration?: {
    mode: GovNotifyDeliveryMode;
    version: number;
    updatedAt: TimestampString;
    updatedBy?: string | null;
  };
}

export interface GetLatestNotifyDeliveryReceiptForReferenceData {
  notifyDeliveryReceipts: ({
    id: string;
    notifyStatus: string;
    eventAt: TimestampString;
    eventOrderingKey: string;
  } & NotifyDeliveryReceipt_Key)[];
}

export interface GetLatestNotifyDeliveryReceiptForReferenceVariables {
  reference: string;
}

export interface GetLegacyUserIdentityData {
  legacyUserIdentity?: {
    sourceSystem: string;
    legacyUserId: UUIDString;
    oldUid?: number | null;
    user: {
      id: string;
    } & User_Key;
    migrationBatchId: UUIDString;
    recordSchemaVersion: string;
    sourceChecksum: string;
    importedAt: TimestampString;
  } & LegacyUserIdentity_Key;
}

export interface GetLegacyUserIdentityVariables {
  sourceSystem: string;
  legacyUserId: UUIDString;
}

export interface GetMyAnnouncementPreferencesData {
  user?: {
    membershipStatus: MembershipStatus;
    announcementOptOutAll: boolean;
    userGroups: ({
      userGroup: {
        membershipStatuses?: MembershipStatus[] | null;
        purposeLinks: ({
          purposes?: SectionUserGroupPurpose[] | null;
          section: {
            id: UUIDString;
            name: string;
          } & Section_Key;
        })[];
      };
    })[];
    optOuts: ({
      section: {
        id: UUIDString;
      } & Section_Key;
    })[];
  };
  allUserGroups: ({
    membershipStatuses?: MembershipStatus[] | null;
    purposeLinks: ({
      purposes?: SectionUserGroupPurpose[] | null;
      section: {
        id: UUIDString;
        name: string;
      } & Section_Key;
    })[];
  })[];
}

export interface GetMyBookingPaymentAdjustmentsData {
  user?: {
    id: string;
    bookings: ({
      id: UUIDString;
      revisionNumber: number;
      event: {
        id: UUIDString;
        title: string;
      } & Event_Key;
      adjustments: ({
        id: UUIDString;
        deltaAmountMinor: number;
        status: BookingPaymentAdjustmentStatus;
        orchestrationKey: string;
        createdAt: TimestampString;
        updatedAt: TimestampString;
        supersededBooking: {
          id: UUIDString;
          revisionNumber: number;
        } & Booking_Key;
      })[];
    } & Booking_Key)[];
  } & User_Key;
}

export interface GetMyBookingsData {
  user?: {
    id: string;
    bookings: ({
      id: UUIDString;
      status: BookingStatus;
      approvalStatus: BookingApprovalStatus;
      approvalReviewedAt?: TimestampString | null;
      approvalNote?: string | null;
      revisionNumber: number;
      updatedAt: TimestampString;
      event: {
        id: UUIDString;
        title: string;
        startDateTime: TimestampString;
        endDateTime: TimestampString;
        section: {
          id: UUIDString;
          name: string;
        } & Section_Key;
      } & Event_Key;
      lines: ({
        id: UUIDString;
        bookingPlace: {
          id: UUIDString;
        } & BookingPlace_Key;
        ticketType: {
          id: UUIDString;
          title: string;
          audience: TicketAudience;
          price: number;
        } & TicketType_Key;
      } & BookingLine_Key)[];
    } & Booking_Key)[];
  } & User_Key;
}

export interface GetMyBookingsForEventData {
  user?: {
    id: string;
    bookingTicketOrders: ({
      id: UUIDString;
      status: TicketOrderStatus;
    } & TicketOrder_Key)[];
    bookings: ({
      id: UUIDString;
      status: BookingStatus;
      approvalStatus: BookingApprovalStatus;
      approvalReviewedAt?: TimestampString | null;
      approvalNote?: string | null;
      revisionNumber: number;
      supersededAt?: TimestampString | null;
      clientSubmissionKey?: string | null;
      sitNextToUserIds?: string[] | null;
      accommodationRequested: boolean;
      accommodationNote?: string | null;
      createdAt: TimestampString;
      updatedAt: TimestampString;
      lines: ({
        id: UUIDString;
        bookingPlace: {
          id: UUIDString;
          paymentAllocations: ({
            id: UUIDString;
            ticketOrderId: UUIDString;
            refundedAmountMinor: number;
          } & BookingPlacePaymentAllocation_Key)[];
        } & BookingPlace_Key;
        sortOrder: number;
        guestDisplayName?: string | null;
        dietaryNote?: string | null;
        ticketType: {
          id: UUIDString;
          title: string;
          audience: TicketAudience;
          price: number;
        } & TicketType_Key;
        guestUser?: {
          id: string;
          firstName: string;
          lastName: string;
        } & User_Key;
      } & BookingLine_Key)[];
    } & Booking_Key)[];
  } & User_Key;
}

export interface GetMyBookingsForEventVariables {
  eventId: UUIDString;
}

export interface GetMyTicketOrderByIdData {
  user?: {
    id: string;
    ticketOrders: ({
      id: UUIDString;
      status: TicketOrderStatus;
      quantity: number;
      totalAmountMinor: number;
      currency: string;
      updatedAt: TimestampString;
      ticketType: {
        id: UUIDString;
        title: string;
      } & TicketType_Key;
      event: {
        id: UUIDString;
        title: string;
      } & Event_Key;
    } & TicketOrder_Key)[];
  } & User_Key;
}

export interface GetMyTicketOrderByIdVariables {
  id: UUIDString;
}

export interface GetMyTicketOrdersData {
  user?: {
    id: string;
    ticketOrders: ({
      id: UUIDString;
      status: TicketOrderStatus;
      quantity: number;
      totalAmountMinor: number;
      currency: string;
      refundedAmountMinor?: number | null;
      refundedAt?: TimestampString | null;
      disputeStatus?: string | null;
      disputeReason?: string | null;
      stripeCheckoutSessionId?: string | null;
      stripePaymentIntentId?: string | null;
      createdAt: TimestampString;
      updatedAt: TimestampString;
      ticketType: {
        id: UUIDString;
        title: string;
      } & TicketType_Key;
      event: {
        id: UUIDString;
        title: string;
        startDateTime: TimestampString;
      } & Event_Key;
    } & TicketOrder_Key)[];
  } & User_Key;
}

export interface GetNotificationDeliveryByChannelAndKeyData {
  notificationDeliveries: ({
    id: UUIDString;
    channel: NotificationChannel;
    deliveryKey: string;
    notificationType: string;
    recoveryPayload?: string | null;
    status: NotificationDeliveryStatus;
    provider?: string | null;
    providerMessageId?: string | null;
    attemptCount: number;
    lastAttemptedAt?: TimestampString | null;
    sentAt?: TimestampString | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    createdAt: TimestampString;
  } & NotificationDelivery_Key)[];
}

export interface GetNotificationDeliveryByChannelAndKeyVariables {
  channel: NotificationChannel;
  deliveryKey: string;
}

export interface GetNotifyCallbackUserByIdData {
  user?: {
    id: string;
    membershipStatus: MembershipStatus;
    emailBounceCount: number;
    emailLastBounceAt?: TimestampString | null;
    emailDeliveryVersion: number;
    emailDeliveryStatus?: string | null;
    emailDeliveryStatusUpdatedAt?: TimestampString | null;
    emailDeliveryReceiptId?: string | null;
  } & User_Key;
}

export interface GetNotifyCallbackUserByIdVariables {
  userId: string;
}

export interface GetNotifyDeliveryReceiptData {
  notifyDeliveryReceipt?: {
    id: string;
    notifyStatus: string;
    reference?: string | null;
    recipientHash: string;
    userId?: string | null;
    eventAt: TimestampString;
    eventOrderingKey: string;
    affectsBounceState: boolean;
    processingStatus: NotifyDeliveryReceiptProcessingStatus;
    outcome?: NotifyDeliveryReceiptOutcome | null;
    attemptCount: number;
    lastAttemptedAt: TimestampString;
    processedAt?: TimestampString | null;
  } & NotifyDeliveryReceipt_Key;
}

export interface GetNotifyDeliveryReceiptVariables {
  id: string;
}

export interface GetNotifyReplyToConfigurationData {
  notifyEmailConfiguration?: {
    version: number;
    updatedAt: TimestampString;
    updatedBy?: string | null;
    defaultReplyToAddress?: {
      id: UUIDString;
      displayLabel: string;
      emailAddress: string;
      notifyUuid: string;
      enabled: boolean;
      announcementSelectable: boolean;
      verificationStatus: NotifyReplyToVerificationStatus;
      providerAcceptedAt?: TimestampString | null;
      providerNotificationId?: string | null;
      verificationMode?: GovNotifyDeliveryMode | null;
      verifiedAt?: TimestampString | null;
      verifiedBy?: string | null;
      version: number;
      createdAt: TimestampString;
      updatedAt: TimestampString;
      createdBy: string;
      updatedBy: string;
    } & NotifyReplyToAddress_Key;
  };
  notifyReplyToAddresses: ({
    id: UUIDString;
    displayLabel: string;
    emailAddress: string;
    notifyUuid: string;
    enabled: boolean;
    announcementSelectable: boolean;
    verificationStatus: NotifyReplyToVerificationStatus;
    providerAcceptedAt?: TimestampString | null;
    providerNotificationId?: string | null;
    verificationMode?: GovNotifyDeliveryMode | null;
    verifiedAt?: TimestampString | null;
    verifiedBy?: string | null;
    version: number;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy: string;
    updatedBy: string;
  } & NotifyReplyToAddress_Key)[];
  notifyTemplateReplyToOverrides: ({
    templateKey: string;
    replyToAddress: {
      id: UUIDString;
      displayLabel: string;
      emailAddress: string;
      notifyUuid: string;
      enabled: boolean;
      verificationStatus: NotifyReplyToVerificationStatus;
    } & NotifyReplyToAddress_Key;
    updatedAt: TimestampString;
    updatedBy: string;
  } & NotifyTemplateReplyToOverride_Key)[];
}

export interface GetNotifyTemplateBindingsData {
  notifyTemplateBindings: ({
    templateKey: string;
    notifyTemplateId: string;
    reviewedVersion: number;
    version: number;
    updatedAt: TimestampString;
    updatedBy: string;
  } & NotifyTemplateBinding_Key)[];
}

export interface GetPaymentReconciliationExceptionByOrderAndTypeData {
  paymentReconciliationExceptions: ({
    id: UUIDString;
    status: PaymentReconciliationExceptionStatus;
  } & PaymentReconciliationException_Key)[];
}

export interface GetPaymentReconciliationExceptionByOrderAndTypeVariables {
  ticketOrderId: UUIDString;
  exceptionType: PaymentReconciliationExceptionType;
}

export interface GetPaymentWebhookEventByStripeEventIdData {
  paymentWebhookEvents: ({
    id: UUIDString;
    stripeEventId: string;
    eventType: string;
    outcome: PaymentWebhookEventOutcome;
    reason?: string | null;
    ticketOrder?: {
      id: UUIDString;
    } & TicketOrder_Key;
    stripeObjectId?: string | null;
    livemode: boolean;
    createdAt: TimestampString;
  } & PaymentWebhookEvent_Key)[];
}

export interface GetPaymentWebhookEventByStripeEventIdVariables {
  stripeEventId: string;
}

export interface GetRecentNotifyDeliveryReceiptsForUserData {
  notifyDeliveryReceipts: ({
    id: string;
    notifyStatus: string;
    eventAt: TimestampString;
    eventOrderingKey: string;
  } & NotifyDeliveryReceipt_Key)[];
}

export interface GetRecentNotifyDeliveryReceiptsForUserVariables {
  userId: string;
}

export interface GetSectionAnnouncementOptOutData {
  sectionAnnouncementOptOut?: {
    createdAt: TimestampString;
  };
}

export interface GetSectionAnnouncementOptOutVariables {
  sectionId: UUIDString;
}

export interface GetSectionAnnouncementOptOutsData {
  sectionAnnouncementOptOuts: ({
    user: {
      id: string;
    } & User_Key;
  })[];
}

export interface GetSectionAnnouncementOptOutsVariables {
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
    purposeLinks: ({
      purposes?: SectionUserGroupPurpose[] | null;
      userGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
        subscribable?: boolean | null;
        membershipStatuses?: MembershipStatus[] | null;
      } & UserGroup_Key;
    })[];
  } & Section_Key;
}

export interface GetSectionByIdForCallableData {
  section?: {
    id: UUIDString;
    name: string;
    type: SectionType;
    description?: string | null;
    isOpenForRegistration?: boolean | null;
    allowedUserGroups?: UUIDString[] | null;
    purposeLinks: ({
      purposes?: SectionUserGroupPurpose[] | null;
      userGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
        subscribable?: boolean | null;
        membershipStatuses?: MembershipStatus[] | null;
      } & UserGroup_Key;
    })[];
  } & Section_Key;
}

export interface GetSectionByIdForCallableVariables {
  id: UUIDString;
}

export interface GetSectionByIdVariables {
  id: UUIDString;
}

export interface GetSectionFileByIdData {
  sectionFile?: {
    id: UUIDString;
    sectionId: UUIDString;
    storageObjectPath?: string | null;
    pendingStorageObjectPath?: string | null;
    pendingOriginalFilename?: string | null;
    pendingContentType?: string | null;
    pendingSizeBytes?: number | null;
    displayName: string;
    originalFilename: string;
    description?: string | null;
    contentType: string;
    sizeBytes: number;
    objectGeneration?: string | null;
    checksumSha256?: string | null;
    status: SectionFileStatus;
    uploadedBy: string;
    deletedAt?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & SectionFile_Key;
}

export interface GetSectionFileByIdVariables {
  id: UUIDString;
}

export interface GetSectionMembersData {
  section?: {
    id: UUIDString;
    name: string;
    type: SectionType;
    description?: string | null;
    purposeLinks: ({
      purposes?: SectionUserGroupPurpose[] | null;
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
            serviceNumber: string;
            membershipStatus: MembershipStatus;
            rank?: string | null;
            shareContactInfo?: boolean | null;
            mobileNumber?: string | null;
            announcementOptOutAll: boolean;
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
        purposeLinks: ({
          purposes?: SectionUserGroupPurpose[] | null;
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
    purposeLinks: ({
      purposes?: SectionUserGroupPurpose[] | null;
      section: {
        id: UUIDString;
        name: string;
        type: SectionType;
        description?: string | null;
      } & Section_Key;
    })[];
  } & UserGroup_Key)[];
}

export interface GetTicketOrderForWebhookData {
  ticketOrder?: {
    id: UUIDString;
    status: TicketOrderStatus;
    quantity: number;
    unitAmountMinor: number;
    totalAmountMinor: number;
    currency: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    } & User_Key;
    event: {
      id: UUIDString;
      title: string;
      location?: string | null;
      startDateTime: TimestampString;
      endDateTime: TimestampString;
    } & Event_Key;
    ticketType: {
      id: UUIDString;
      title: string;
    } & TicketType_Key;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeRefundId?: string | null;
    refundedAmountMinor?: number | null;
    refundedAt?: TimestampString | null;
    stripeDisputeId?: string | null;
    disputeStatus?: string | null;
    disputeReason?: string | null;
    disputeAmountMinor?: number | null;
    disputeOpenedAt?: TimestampString | null;
    disputeUpdatedAt?: TimestampString | null;
    disputeClosedAt?: TimestampString | null;
    webhookEventId?: string | null;
    paymentAllocations: ({
      id: UUIDString;
      refundedAmountMinor: number;
    } & BookingPlacePaymentAllocation_Key)[];
  } & TicketOrder_Key;
}

export interface GetTicketOrderForWebhookVariables {
  id: UUIDString;
}

export interface GetTicketOrderStripeArtifactsForCallableData {
  ticketOrder?: {
    id: UUIDString;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    user: {
      id: string;
    } & User_Key;
  } & TicketOrder_Key;
}

export interface GetTicketOrderStripeArtifactsForCallableVariables {
  id: UUIDString;
}

export interface GetTicketOrdersForBookerAndEventData {
  user?: {
    id: string;
    ticketOrders: ({
      id: UUIDString;
      status: TicketOrderStatus;
      quantity: number;
      unitAmountMinor: number;
      totalAmountMinor: number;
      createdAt: TimestampString;
      ticketType: {
        id: UUIDString;
      } & TicketType_Key;
      event: {
        id: UUIDString;
      } & Event_Key;
      paymentAllocations: ({
        id: UUIDString;
        allocatedAmountMinor: number;
        bookingPlace: {
          id: UUIDString;
        } & BookingPlace_Key;
      } & BookingPlacePaymentAllocation_Key)[];
    } & TicketOrder_Key)[];
  } & User_Key;
}

export interface GetTicketOrdersForBookerAndEventVariables {
  userId: string;
  eventId: UUIDString;
}

export interface GetTicketTypeForCheckoutData {
  ticketType?: {
    id: UUIDString;
    title: string;
    price: number;
    audience: TicketAudience;
    userGroup: {
      id: UUIDString;
      membershipStatuses?: MembershipStatus[] | null;
    } & UserGroup_Key;
    event: {
      id: UUIDString;
      title: string;
      bookingStartDateTime: TimestampString;
      bookingEndDateTime: TimestampString;
      section: {
        id: UUIDString;
      } & Section_Key;
    } & Event_Key;
  } & TicketType_Key;
}

export interface GetTicketTypeForCheckoutVariables {
  ticketTypeId: UUIDString;
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

export interface GetUserByEmailData {
  users: ({
    id: string;
    membershipStatus: MembershipStatus;
    emailBounceCount: number;
    emailLastBounceAt?: TimestampString | null;
    emailDeliveryVersion: number;
    emailDeliveryStatus?: string | null;
    emailDeliveryStatusUpdatedAt?: TimestampString | null;
    emailDeliveryReceiptId?: string | null;
  } & User_Key)[];
}

export interface GetUserByEmailVariables {
  email: string;
}

export interface GetUserByIdData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    mobileNumber?: string | null;
    postNominals?: string | null;
    membershipStatus: MembershipStatus;
    requestedMembershipStatus?: MembershipStatus | null;
    isRegular?: boolean | null;
    isReserve?: boolean | null;
    isCivilServant?: boolean | null;
    isIndustry?: boolean | null;
    rank?: string | null;
    shareContactInfo?: boolean | null;
    announcementOptOutAll: boolean;
    legacyPasswordMigrated?: boolean | null;
    profileReviewedAt?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy?: string | null;
    updatedBy?: string | null;
  } & User_Key;
}

export interface GetUserByIdVariables {
  id: string;
}

export interface GetUserForCheckoutData {
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    membershipStatus: MembershipStatus;
    stripeCustomerId?: string | null;
  } & User_Key;
}

export interface GetUserForCheckoutVariables {
  userId: string;
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
    purposeLinks: ({
      purposes?: SectionUserGroupPurpose[] | null;
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
    firstName: string;
    lastName: string;
    email: string;
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

export interface GovNotifyDeliveryConfiguration_Key {
  id: string;
  __typename?: 'GovNotifyDeliveryConfiguration_Key';
}

export interface GovNotifyDeliveryModeAudit_Key {
  id: UUIDString;
  __typename?: 'GovNotifyDeliveryModeAudit_Key';
}

export interface GrantUserGroupToSectionForPurposeData {
  sectionUserGroupPurposeLink_upsert: SectionUserGroupPurposeLink_Key;
}

export interface GrantUserGroupToSectionForPurposeVariables {
  sectionId: UUIDString;
  userGroupId: UUIDString;
  purposes?: SectionUserGroupPurpose[] | null;
}

export interface LegacyUserIdentity_Key {
  sourceSystem: string;
  legacyUserId: UUIDString;
  __typename?: 'LegacyUserIdentity_Key';
}

export interface LinkLegacyIdentityToExistingUserData {
  legacyUserIdentity_insert: LegacyUserIdentity_Key;
}

export interface LinkLegacyIdentityToExistingUserVariables {
  userId: string;
  legacyUserId: UUIDString;
  oldUid?: number | null;
  sourceSystem: string;
  migrationBatchId: UUIDString;
  recordSchemaVersion: string;
  sourceChecksum: string;
  now: TimestampString;
}

export interface ListBookingPaymentAdjustmentsForAdminData {
  event?: {
    id: UUIDString;
    bookings: ({
      id: UUIDString;
      revisionNumber: number;
      status: BookingStatus;
      booker: {
        id: string;
        firstName: string;
        lastName: string;
      } & User_Key;
      adjustments: ({
        id: UUIDString;
        deltaAmountMinor: number;
        status: BookingPaymentAdjustmentStatus;
        orchestrationKey: string;
        createdAt: TimestampString;
        updatedAt: TimestampString;
        supersededBooking: {
          id: UUIDString;
          revisionNumber: number;
        } & Booking_Key;
      })[];
    } & Booking_Key)[];
  } & Event_Key;
}

export interface ListBookingPaymentAdjustmentsForAdminVariables {
  eventId: UUIDString;
}

export interface ListEventBookingsForAdminData {
  event?: {
    id: UUIDString;
    bookings: ({
      id: UUIDString;
      status: BookingStatus;
      approvalStatus: BookingApprovalStatus;
      approvalReviewedAt?: TimestampString | null;
      approvalNote?: string | null;
      approvalReviewedBy?: {
        id: string;
        firstName: string;
        lastName: string;
      } & User_Key;
      revisionGroupId: UUIDString;
      revisionNumber: number;
      supersededAt?: TimestampString | null;
      supersedesBooking?: {
        id: UUIDString;
        revisionNumber: number;
      } & Booking_Key;
      clientSubmissionKey?: string | null;
      sitNextToUserIds?: string[] | null;
      accommodationRequested: boolean;
      accommodationNote?: string | null;
      createdAt: TimestampString;
      updatedAt: TimestampString;
      createdBy?: string | null;
      updatedBy?: string | null;
      booker: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } & User_Key;
      lines: ({
        id: UUIDString;
        sortOrder: number;
        guestDisplayName?: string | null;
        dietaryNote?: string | null;
        bookingPlace: {
          id: UUIDString;
          paymentAllocations: ({
            id: UUIDString;
            allocatedAmountMinor: number;
            refundedAmountMinor: number;
            ticketOrderId: UUIDString;
          } & BookingPlacePaymentAllocation_Key)[];
        } & BookingPlace_Key;
        guestUser?: {
          id: string;
          firstName: string;
          lastName: string;
        } & User_Key;
        ticketType: {
          id: UUIDString;
          title: string;
          audience: TicketAudience;
          price: number;
        } & TicketType_Key;
      } & BookingLine_Key)[];
    } & Booking_Key)[];
  } & Event_Key;
}

export interface ListEventBookingsForAdminVariables {
  eventId: UUIDString;
}

export interface ListFailedNotificationDeliveriesForRecoveryData {
  notificationDeliveries: ({
    id: UUIDString;
    channel: NotificationChannel;
    notificationType: string;
    deliveryKey: string;
    recoveryPayload?: string | null;
    status: NotificationDeliveryStatus;
    attemptCount: number;
    lastAttemptedAt?: TimestampString | null;
    createdAt: TimestampString;
  } & NotificationDelivery_Key)[];
}

export interface ListFailedNotificationDeliveriesForRecoveryVariables {
  attemptedBefore: TimestampString;
  maxAttemptCount: number;
  limit: number;
}

export interface ListGovNotifyDeliveryModeAuditsData {
  govNotifyDeliveryModeAudits: ({
    id: UUIDString;
    previousMode: GovNotifyDeliveryMode;
    newMode: GovNotifyDeliveryMode;
    deploymentCeiling: GovNotifyDeliveryMode;
    changedBy: string;
    reason: string;
    changedAt: TimestampString;
  } & GovNotifyDeliveryModeAudit_Key)[];
}

export interface ListGovNotifyDeliveryModeAuditsVariables {
  limit: number;
}

export interface ListLegacyUserIdentitiesByBatchData {
  legacyUserIdentities: ({
    sourceSystem: string;
    legacyUserId: UUIDString;
    oldUid?: number | null;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      serviceNumber: string;
      mobileNumber?: string | null;
      postNominals?: string | null;
      rank?: string | null;
      membershipStatus: MembershipStatus;
      shareContactInfo?: boolean | null;
      announcementOptOutAll: boolean;
      legacyPasswordMigrated?: boolean | null;
      profileReviewedAt?: TimestampString | null;
    } & User_Key;
    migrationBatchId: UUIDString;
    recordSchemaVersion: string;
    sourceChecksum: string;
    importedAt: TimestampString;
  } & LegacyUserIdentity_Key)[];
}

export interface ListLegacyUserIdentitiesByBatchVariables {
  migrationBatchId: UUIDString;
  limit: number;
}

export interface ListLegacyUserIdentitiesForMigrationData {
  legacyUserIdentities: ({
    legacyUserId: UUIDString;
    user: {
      id: string;
    } & User_Key;
    migrationBatchId: UUIDString;
    recordSchemaVersion: string;
    sourceChecksum: string;
  })[];
}

export interface ListLegacyUserIdentitiesForMigrationVariables {
  sourceSystem: string;
  limit: number;
}

export interface ListMigrationUsersData {
  users: ({
    id: string;
    email: string;
  } & User_Key)[];
}

export interface ListMigrationUsersVariables {
  limit: number;
}

export interface ListNotifyReplyToAuditsData {
  notifyReplyToAudits: ({
    id: UUIDString;
    action: NotifyReplyToAuditAction;
    replyToAddressId?: UUIDString | null;
    templateKey?: string | null;
    previousValue?: string | null;
    newValue?: string | null;
    changedBy: string;
    reason?: string | null;
    changedAt: TimestampString;
  } & NotifyReplyToAudit_Key)[];
}

export interface ListNotifyReplyToAuditsVariables {
  limit: number;
}

export interface ListNotifyTemplateBindingAuditsData {
  notifyTemplateBindingAudits: ({
    id: UUIDString;
    action: NotifyTemplateBindingAuditAction;
    templateKey: string;
    previousValue?: string | null;
    newValue?: string | null;
    changedBy: string;
    reason?: string | null;
    changedAt: TimestampString;
  } & NotifyTemplateBindingAudit_Key)[];
}

export interface ListNotifyTemplateBindingAuditsVariables {
  limit: number;
}

export interface ListOpenPaymentReconciliationExceptionsData {
  paymentReconciliationExceptions: ({
    id: UUIDString;
    exceptionType: PaymentReconciliationExceptionType;
    status: PaymentReconciliationExceptionStatus;
    note?: string | null;
    ownerUserId?: string | null;
    lastAttemptedAt?: TimestampString | null;
    resolvedAt?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    ticketOrder: {
      id: UUIDString;
      status: TicketOrderStatus;
      totalAmountMinor: number;
      currency: string;
      refundedAmountMinor?: number | null;
      disputeStatus?: string | null;
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } & User_Key;
      event: {
        id: UUIDString;
        title: string;
      } & Event_Key;
    } & TicketOrder_Key;
  } & PaymentReconciliationException_Key)[];
}

export interface ListSectionFilesByStatusData {
  sectionFiles: ({
    id: UUIDString;
    sectionId: UUIDString;
    storageObjectPath?: string | null;
    pendingStorageObjectPath?: string | null;
    displayName: string;
    originalFilename: string;
    description?: string | null;
    contentType: string;
    sizeBytes: number;
    objectGeneration?: string | null;
    checksumSha256?: string | null;
    status: SectionFileStatus;
    uploadedBy: string;
    deletedAt?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & SectionFile_Key)[];
}

export interface ListSectionFilesByStatusVariables {
  sectionId: UUIDString;
  status: SectionFileStatus;
  limit: number;
}

export interface ListSectionFilesForQuotaData {
  sectionFiles: ({
    id: UUIDString;
    sizeBytes: number;
    status: SectionFileStatus;
  } & SectionFile_Key)[];
}

export interface ListSectionFilesForQuotaVariables {
  sectionId: UUIDString;
  limit: number;
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

export interface ListStaleDraftBookingsForSchedulerData {
  bookings: ({
    id: UUIDString;
    status: BookingStatus;
    updatedAt: TimestampString;
  } & Booking_Key)[];
}

export interface ListStaleDraftBookingsForSchedulerVariables {
  updatedBefore: TimestampString;
  limit: number;
}

export interface ListStalePendingNotificationDeliveriesForRecoveryData {
  notificationDeliveries: ({
    id: UUIDString;
    channel: NotificationChannel;
    notificationType: string;
    deliveryKey: string;
    recoveryPayload?: string | null;
    status: NotificationDeliveryStatus;
    attemptCount: number;
    lastAttemptedAt?: TimestampString | null;
    createdAt: TimestampString;
  } & NotificationDelivery_Key)[];
}

export interface ListStalePendingNotificationDeliveriesForRecoveryVariables {
  attemptedBefore: TimestampString;
  maxAttemptCount: number;
  limit: number;
}

export interface ListStalePendingTicketOrdersForSchedulerData {
  ticketOrders: ({
    id: UUIDString;
    status: TicketOrderStatus;
    createdAt: TimestampString;
  } & TicketOrder_Key)[];
}

export interface ListStalePendingTicketOrdersForSchedulerVariables {
  createdBefore: TimestampString;
  limit: number;
}

export interface ListStaleSectionFilesData {
  sectionFiles: ({
    id: UUIDString;
    sectionId: UUIDString;
    storageObjectPath?: string | null;
    pendingStorageObjectPath?: string | null;
    status: SectionFileStatus;
    updatedAt: TimestampString;
  } & SectionFile_Key)[];
}

export interface ListStaleSectionFilesVariables {
  updatedBefore: TimestampString;
  limit: number;
}

export interface ListTicketOrdersForAdminData {
  event?: {
    id: UUIDString;
    title: string;
    ticketOrders: ({
      id: UUIDString;
      status: TicketOrderStatus;
      quantity: number;
      totalAmountMinor: number;
      currency: string;
      stripeCheckoutSessionId?: string | null;
      stripePaymentIntentId?: string | null;
      stripeRefundId?: string | null;
      refundedAmountMinor?: number | null;
      refundedAt?: TimestampString | null;
      stripeDisputeId?: string | null;
      disputeStatus?: string | null;
      disputeReason?: string | null;
      disputeAmountMinor?: number | null;
      disputeOpenedAt?: TimestampString | null;
      disputeUpdatedAt?: TimestampString | null;
      disputeClosedAt?: TimestampString | null;
      webhookEventId?: string | null;
      createdAt: TimestampString;
      updatedAt: TimestampString;
      createdBy?: string | null;
      updatedBy?: string | null;
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } & User_Key;
      ticketType: {
        id: UUIDString;
        title: string;
      } & TicketType_Key;
    } & TicketOrder_Key)[];
  } & Event_Key;
}

export interface ListTicketOrdersForAdminVariables {
  eventId: UUIDString;
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
    mobileNumber?: string | null;
    postNominals?: string | null;
    membershipStatus: MembershipStatus;
    requestedMembershipStatus?: MembershipStatus | null;
    isRegular?: boolean | null;
    isReserve?: boolean | null;
    isCivilServant?: boolean | null;
    isIndustry?: boolean | null;
    rank?: string | null;
    shareContactInfo?: boolean | null;
    announcementOptOutAll: boolean;
    legacyPasswordMigrated?: boolean | null;
    profileReviewedAt?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy?: string | null;
    updatedBy?: string | null;
  } & User_Key)[];
}

export interface MarkNotificationDeliveryFailedByIdData {
  notificationDelivery_updateMany: number;
}

export interface MarkNotificationDeliveryFailedByIdVariables {
  id: UUIDString;
  attemptCount: number;
  lastAttemptedAt: TimestampString;
  provider?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}

export interface MarkNotificationDeliverySentByIdData {
  notificationDelivery_updateMany: number;
}

export interface MarkNotificationDeliverySentByIdVariables {
  id: UUIDString;
  attemptCount: number;
  lastAttemptedAt: TimestampString;
  sentAt: TimestampString;
  provider?: string | null;
  providerMessageId?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  deliveryMode?: GovNotifyDeliveryMode | null;
}

export interface MarkNotifyDeliveryReceiptFailedData {
  notifyDeliveryReceipt_updateMany: number;
}

export interface MarkNotifyDeliveryReceiptFailedVariables {
  id: string;
  attemptCount: number;
  lastErrorMessage?: string | null;
}

export interface MarkNotifyDeliveryReceiptProcessedData {
  notifyDeliveryReceipt_updateMany: number;
}

export interface MarkNotifyDeliveryReceiptProcessedVariables {
  id: string;
  attemptCount: number;
  outcome: NotifyDeliveryReceiptOutcome;
  processedAt: TimestampString;
}

export interface MarkSectionFileDeletedData {
  sectionFile_updateMany: number;
}

export interface MarkSectionFileDeletedVariables {
  id: UUIDString;
  deletedAt: TimestampString;
  updatedBy: string;
}

export interface MarkTicketOrderFailedFromWebhookData {
  ticketOrder_update?: TicketOrder_Key | null;
}

export interface MarkTicketOrderFailedFromWebhookVariables {
  id: UUIDString;
  webhookEventId?: string | null;
}

export interface MarkTicketOrderPaidFromWebhookData {
  ticketOrder_update?: TicketOrder_Key | null;
}

export interface MarkTicketOrderPaidFromWebhookVariables {
  id: UUIDString;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  webhookEventId?: string | null;
}

export interface MarkTicketOrderRefundedFromWebhookData {
  ticketOrder_update?: TicketOrder_Key | null;
}

export interface MarkTicketOrderRefundedFromWebhookVariables {
  id: UUIDString;
  webhookEventId?: string | null;
  stripeRefundId?: string | null;
  refundedAmountMinor?: number | null;
  refundedAt?: TimestampString | null;
}

export interface NotificationDelivery_Key {
  id: UUIDString;
  __typename?: 'NotificationDelivery_Key';
}

export interface NotifyDeliveryReceipt_Key {
  id: string;
  __typename?: 'NotifyDeliveryReceipt_Key';
}

export interface NotifyEmailConfiguration_Key {
  id: string;
  __typename?: 'NotifyEmailConfiguration_Key';
}

export interface NotifyReplyToAddress_Key {
  id: UUIDString;
  __typename?: 'NotifyReplyToAddress_Key';
}

export interface NotifyReplyToAudit_Key {
  id: UUIDString;
  __typename?: 'NotifyReplyToAudit_Key';
}

export interface NotifyTemplateBindingAudit_Key {
  id: UUIDString;
  __typename?: 'NotifyTemplateBindingAudit_Key';
}

export interface NotifyTemplateBinding_Key {
  templateKey: string;
  __typename?: 'NotifyTemplateBinding_Key';
}

export interface NotifyTemplateReplyToOverride_Key {
  templateKey: string;
  __typename?: 'NotifyTemplateReplyToOverride_Key';
}

export interface OptInSectionAnnouncementData {
  sectionAnnouncementOptOut_delete?: SectionAnnouncementOptOut_Key | null;
}

export interface OptInSectionAnnouncementVariables {
  sectionId: UUIDString;
}

export interface OptOutSectionAnnouncementData {
  sectionAnnouncementOptOut_upsert: SectionAnnouncementOptOut_Key;
}

export interface OptOutSectionAnnouncementVariables {
  sectionId: UUIDString;
}

export interface PaymentReconciliationException_Key {
  id: UUIDString;
  __typename?: 'PaymentReconciliationException_Key';
}

export interface PaymentWebhookEvent_Key {
  id: UUIDString;
  __typename?: 'PaymentWebhookEvent_Key';
}

export interface RecordNotificationRecoveryFailureByIdData {
  notificationDelivery_updateMany: number;
}

export interface RecordNotificationRecoveryFailureByIdVariables {
  id: UUIDString;
  expectedStatus: NotificationDeliveryStatus;
  expectedAttemptCount: number;
  attemptCount: number;
  lastAttemptedAt: TimestampString;
  lastErrorCode: string;
  lastErrorMessage: string;
}

export interface RecordNotifyReplyToProviderAcceptanceData {
  changed: number;
  notifyReplyToAudit_insert: NotifyReplyToAudit_Key;
}

export interface RecordNotifyReplyToProviderAcceptanceVariables {
  id: UUIDString;
  expectedVersion: number;
  providerNotificationId: string;
  verificationMode: GovNotifyDeliveryMode;
  changedBy: string;
  reason?: string | null;
}

export interface RecordSectionFileAuditData {
  sectionFileAudit_insert: SectionFileAudit_Key;
}

export interface RecordSectionFileAuditVariables {
  sectionId: UUIDString;
  fileId?: UUIDString | null;
  actorUid: string;
  action: string;
  outcome: string;
  detail?: string | null;
}

export interface RecordTicketOrderPartialRefundFromWebhookData {
  ticketOrder_update?: TicketOrder_Key | null;
}

export interface RecordTicketOrderPartialRefundFromWebhookVariables {
  id: UUIDString;
  webhookEventId: string;
  stripeRefundId?: string | null;
  refundedAmountMinor: number;
  refundedAt?: TimestampString | null;
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

export interface ResolvePaymentReconciliationExceptionData {
  paymentReconciliationException_update?: PaymentReconciliationException_Key | null;
}

export interface ResolvePaymentReconciliationExceptionVariables {
  id: UUIDString;
  note?: string | null;
}

export interface RevokeUserGroupFromSectionForPurposeData {
  sectionUserGroupPurposeLink_delete?: SectionUserGroupPurposeLink_Key | null;
}

export interface RevokeUserGroupFromSectionForPurposeVariables {
  sectionId: UUIDString;
  userGroupId: UUIDString;
}

export interface SearchSectionMemberCandidatesData {
  explicit: ({
    user: {
      id: string;
      firstName: string;
      lastName: string;
    } & User_Key;
  })[];
  inherited: ({
    id: string;
    firstName: string;
    lastName: string;
  } & User_Key)[];
  includedExplicit: ({
    user: {
      id: string;
      firstName: string;
      lastName: string;
    } & User_Key;
  })[];
  includedInherited: ({
    id: string;
    firstName: string;
    lastName: string;
  } & User_Key)[];
}

export interface SearchSectionMemberCandidatesVariables {
  userGroupIds: UUIDString[];
  membershipStatuses: MembershipStatus[];
  searchPattern: string;
  includeIds: string[];
  limit: number;
}

export interface SectionAnnouncementOptOut_Key {
  userId: string;
  sectionId: UUIDString;
  __typename?: 'SectionAnnouncementOptOut_Key';
}

export interface SectionFileAudit_Key {
  id: UUIDString;
  __typename?: 'SectionFileAudit_Key';
}

export interface SectionFile_Key {
  id: UUIDString;
  __typename?: 'SectionFile_Key';
}

export interface SectionUserGroupPurposeLink_Key {
  sectionId: UUIDString;
  userGroupId: UUIDString;
  __typename?: 'SectionUserGroupPurposeLink_Key';
}

export interface Section_Key {
  id: UUIDString;
  __typename?: 'Section_Key';
}

export interface SetNotifyTemplateReplyToOverrideData {
  notifyTemplateReplyToOverride_upsert: NotifyTemplateReplyToOverride_Key;
  notifyReplyToAudit_insert: NotifyReplyToAudit_Key;
}

export interface SetNotifyTemplateReplyToOverrideVariables {
  templateKey: string;
  replyToAddressId: UUIDString;
  changedBy: string;
  reason?: string | null;
  previousValue?: string | null;
  newValue: string;
}

export interface SettleBookingPaymentAdjustmentsFromCallableData {
  bookingPaymentAdjustment_updateMany: number;
}

export interface SettleBookingPaymentAdjustmentsFromCallableVariables {
  revisionBookingId: UUIDString;
  status: BookingPaymentAdjustmentStatus;
}

export interface SubscribeToUserGroupData {
  userUserGroup_upsert: UserUserGroup_Key;
}

export interface SubscribeToUserGroupVariables {
  userGroupId: UUIDString;
}

export interface TicketOrder_Key {
  id: UUIDString;
  __typename?: 'TicketOrder_Key';
}

export interface TicketType_Key {
  id: UUIDString;
  __typename?: 'TicketType_Key';
}

export interface TryApplyNotifyDeliveryUserStateAndMarkLostData {
  user_updateMany: number;
}

export interface TryApplyNotifyDeliveryUserStateAndMarkLostVariables {
  userId: string;
  expectedEmailDeliveryVersion: number;
  emailDeliveryVersion: number;
  emailBounceCount: number;
  emailLastBounceAt?: TimestampString | null;
  emailDeliveryStatus: string;
  emailDeliveryStatusUpdatedAt: TimestampString;
  emailDeliveryReceiptId: string;
}

export interface TryApplyNotifyDeliveryUserStateData {
  user_updateMany: number;
}

export interface TryApplyNotifyDeliveryUserStateVariables {
  userId: string;
  expectedEmailDeliveryVersion: number;
  emailDeliveryVersion: number;
  emailBounceCount: number;
  emailLastBounceAt?: TimestampString | null;
  emailDeliveryStatus: string;
  emailDeliveryStatusUpdatedAt: TimestampString;
  emailDeliveryReceiptId: string;
}

export interface TryMarkAnnouncementRecipientEnqueueFailedData {
  announcementRecipient_updateMany: number;
}

export interface TryMarkAnnouncementRecipientEnqueueFailedVariables {
  id: UUIDString;
  failureReason: string;
}

export interface TryUpdateAnnouncementRecipientDeliveryStatusData {
  announcementRecipient_updateMany: number;
}

export interface TryUpdateAnnouncementRecipientDeliveryStatusVariables {
  id: UUIDString;
  expectedDeliveryVersion: number;
  deliveryVersion: number;
  status: string;
  failureReason?: string | null;
  deliveryStatusUpdatedAt: TimestampString;
  deliveryReceiptId: string;
}

export interface TryUpdateAnnouncementRecipientProcessingStatusData {
  announcementRecipient_updateMany: number;
}

export interface TryUpdateAnnouncementRecipientProcessingStatusVariables {
  id: UUIDString;
  expectedStatus: string;
  expectedProcessingVersion: number;
  status: string;
  processingVersion: number;
  processingStartedAt?: TimestampString | null;
  sentAt?: TimestampString | null;
  failureReason?: string | null;
  providerNotificationId?: string | null;
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

export interface UpdateAnnouncementOptOutAllData {
  user_update?: User_Key | null;
}

export interface UpdateAnnouncementOptOutAllVariables {
  announcementOptOutAll: boolean;
}

export interface UpdateAvailableSectionFileMetadataData {
  sectionFile_updateMany: number;
}

export interface UpdateAvailableSectionFileMetadataVariables {
  id: UUIDString;
  displayName: string;
  description?: string | null;
  updatedBy: string;
}

export interface UpdateBookingApprovalFromCallableData {
  changed: number;
}

export interface UpdateBookingApprovalFromCallableVariables {
  id: UUIDString;
  expectedRevisionNumber: number;
  status: BookingApprovalStatus;
  reviewedById?: string | null;
  approvalNote?: string | null;
}

export interface UpdateBookingPlaceAllocationRefundFromCallableData {
  bookingPlacePaymentAllocation_update?: BookingPlacePaymentAllocation_Key | null;
}

export interface UpdateBookingPlaceAllocationRefundFromCallableVariables {
  id: UUIDString;
  refundedAmountMinor: number;
  stripeRefundId: string;
}

export interface UpdateBookingStatusFromCallableData {
  booking_update?: Booking_Key | null;
}

export interface UpdateBookingStatusFromCallableVariables {
  id: UUIDString;
  status: BookingStatus;
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
  maxGuestsWithoutModeratorApproval: number;
}

export interface UpdateNotifyReplyToAddressIdentityData {
  changed: number;
  notifyReplyToAudit_insert: NotifyReplyToAudit_Key;
}

export interface UpdateNotifyReplyToAddressIdentityVariables {
  id: UUIDString;
  expectedVersion: number;
  displayLabel: string;
  emailAddress: string;
  notifyUuid: string;
  changedBy: string;
  reason?: string | null;
  previousValue: string;
  newValue: string;
}

export interface UpdateNotifyReplyToAvailabilityData {
  changed: number;
  notifyReplyToAudit_insert: NotifyReplyToAudit_Key;
}

export interface UpdateNotifyReplyToAvailabilityVariables {
  id: UUIDString;
  expectedVersion: number;
  enabled: boolean;
  announcementSelectable: boolean;
  changedBy: string;
  reason?: string | null;
  previousValue: string;
  newValue: string;
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
  audience: TicketAudience;
  title: string;
  description?: string | null;
  price: number;
  sortOrder: number;
}

export interface UpdateUserData {
  user_upsert: User_Key;
}

export interface UpdateUserEmailFromAuthData {
  user_update?: User_Key | null;
}

export interface UpdateUserEmailFromAuthVariables {
  userId: string;
  email: string;
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

export interface UpdateUserStripeCustomerIdData {
  user_update?: User_Key | null;
}

export interface UpdateUserStripeCustomerIdVariables {
  userId: string;
  stripeCustomerId: string;
}

export interface UpdateUserVariables {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  mobileNumber?: string | null;
  postNominals?: string | null;
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
}

export interface UpsertCallableInvocationData {
  callableInvocation_upsert: CallableInvocation_Key;
}

export interface UpsertCallableInvocationVariables {
  userId: string;
  functionName: string;
  windowStart: TimestampString;
  count: number;
}

export interface UpsertNotifyTemplateBindingData {
  notifyTemplateBinding_upsert: NotifyTemplateBinding_Key;
  notifyTemplateBindingAudit_insert: NotifyTemplateBindingAudit_Key;
}

export interface UpsertNotifyTemplateBindingVariables {
  templateKey: string;
  notifyTemplateId: string;
  reviewedVersion: number;
  changedBy: string;
  reason?: string | null;
  auditAction: NotifyTemplateBindingAuditAction;
  previousValue?: string | null;
  newValue: string;
}

export interface UpsertPaymentReconciliationExceptionData {
  paymentReconciliationException_upsert: PaymentReconciliationException_Key;
}

export interface UpsertPaymentReconciliationExceptionVariables {
  id: UUIDString;
  ticketOrderId: UUIDString;
  exceptionType: PaymentReconciliationExceptionType;
  status: PaymentReconciliationExceptionStatus;
  note?: string | null;
  ownerUserId?: string | null;
  lastAttemptedAt?: TimestampString | null;
  resolvedAt?: TimestampString | null;
}

export interface UpsertTicketOrderDisputeFromWebhookData {
  ticketOrder_update?: TicketOrder_Key | null;
}

export interface UpsertTicketOrderDisputeFromWebhookVariables {
  id: UUIDString;
  webhookEventId?: string | null;
  stripeDisputeId?: string | null;
  disputeStatus?: string | null;
  disputeReason?: string | null;
  disputeAmountMinor?: number | null;
  disputeOpenedAt?: TimestampString | null;
  disputeUpdatedAt?: TimestampString | null;
  disputeClosedAt?: TimestampString | null;
}

export interface UpsertUserData {
  user_upsert: User_Key;
}

export interface UpsertUserVariables {
  firstName: string;
  lastName: string;
  serviceNumber: string;
  mobileNumber?: string | null;
  postNominals?: string | null;
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
  rank?: string | null;
  shareContactInfo?: boolean | null;
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

/** Generated Node Admin SDK operation action function for the 'GetGovNotifyDeliveryConfiguration' Query. Allow users to execute without passing in DataConnect. */
export function getGovNotifyDeliveryConfiguration(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetGovNotifyDeliveryConfigurationData>>;
/** Generated Node Admin SDK operation action function for the 'GetGovNotifyDeliveryConfiguration' Query. Allow users to pass in custom DataConnect instances. */
export function getGovNotifyDeliveryConfiguration(options?: OperationOptions): Promise<ExecuteOperationResponse<GetGovNotifyDeliveryConfigurationData>>;

/** Generated Node Admin SDK operation action function for the 'ListGovNotifyDeliveryModeAudits' Query. Allow users to execute without passing in DataConnect. */
export function listGovNotifyDeliveryModeAudits(dc: DataConnect, vars: ListGovNotifyDeliveryModeAuditsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListGovNotifyDeliveryModeAuditsData>>;
/** Generated Node Admin SDK operation action function for the 'ListGovNotifyDeliveryModeAudits' Query. Allow users to pass in custom DataConnect instances. */
export function listGovNotifyDeliveryModeAudits(vars: ListGovNotifyDeliveryModeAuditsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListGovNotifyDeliveryModeAuditsData>>;

/** Generated Node Admin SDK operation action function for the 'CreateGovNotifyDeliveryConfiguration' Mutation. Allow users to execute without passing in DataConnect. */
export function createGovNotifyDeliveryConfiguration(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateGovNotifyDeliveryConfigurationData>>;
/** Generated Node Admin SDK operation action function for the 'CreateGovNotifyDeliveryConfiguration' Mutation. Allow users to pass in custom DataConnect instances. */
export function createGovNotifyDeliveryConfiguration(options?: OperationOptions): Promise<ExecuteOperationResponse<CreateGovNotifyDeliveryConfigurationData>>;

/** Generated Node Admin SDK operation action function for the 'ChangeGovNotifyDeliveryMode' Mutation. Allow users to execute without passing in DataConnect. */
export function changeGovNotifyDeliveryMode(dc: DataConnect, vars: ChangeGovNotifyDeliveryModeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChangeGovNotifyDeliveryModeData>>;
/** Generated Node Admin SDK operation action function for the 'ChangeGovNotifyDeliveryMode' Mutation. Allow users to pass in custom DataConnect instances. */
export function changeGovNotifyDeliveryMode(vars: ChangeGovNotifyDeliveryModeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChangeGovNotifyDeliveryModeData>>;

/** Generated Node Admin SDK operation action function for the 'GetNotifyReplyToConfiguration' Query. Allow users to execute without passing in DataConnect. */
export function getNotifyReplyToConfiguration(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetNotifyReplyToConfigurationData>>;
/** Generated Node Admin SDK operation action function for the 'GetNotifyReplyToConfiguration' Query. Allow users to pass in custom DataConnect instances. */
export function getNotifyReplyToConfiguration(options?: OperationOptions): Promise<ExecuteOperationResponse<GetNotifyReplyToConfigurationData>>;

/** Generated Node Admin SDK operation action function for the 'ListNotifyReplyToAudits' Query. Allow users to execute without passing in DataConnect. */
export function listNotifyReplyToAudits(dc: DataConnect, vars: ListNotifyReplyToAuditsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListNotifyReplyToAuditsData>>;
/** Generated Node Admin SDK operation action function for the 'ListNotifyReplyToAudits' Query. Allow users to pass in custom DataConnect instances. */
export function listNotifyReplyToAudits(vars: ListNotifyReplyToAuditsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListNotifyReplyToAuditsData>>;

/** Generated Node Admin SDK operation action function for the 'CreateNotifyEmailConfiguration' Mutation. Allow users to execute without passing in DataConnect. */
export function createNotifyEmailConfiguration(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateNotifyEmailConfigurationData>>;
/** Generated Node Admin SDK operation action function for the 'CreateNotifyEmailConfiguration' Mutation. Allow users to pass in custom DataConnect instances. */
export function createNotifyEmailConfiguration(options?: OperationOptions): Promise<ExecuteOperationResponse<CreateNotifyEmailConfigurationData>>;

/** Generated Node Admin SDK operation action function for the 'CreateNotifyReplyToAddress' Mutation. Allow users to execute without passing in DataConnect. */
export function createNotifyReplyToAddress(dc: DataConnect, vars: CreateNotifyReplyToAddressVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateNotifyReplyToAddressData>>;
/** Generated Node Admin SDK operation action function for the 'CreateNotifyReplyToAddress' Mutation. Allow users to pass in custom DataConnect instances. */
export function createNotifyReplyToAddress(vars: CreateNotifyReplyToAddressVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateNotifyReplyToAddressData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateNotifyReplyToAddressIdentity' Mutation. Allow users to execute without passing in DataConnect. */
export function updateNotifyReplyToAddressIdentity(dc: DataConnect, vars: UpdateNotifyReplyToAddressIdentityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateNotifyReplyToAddressIdentityData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateNotifyReplyToAddressIdentity' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateNotifyReplyToAddressIdentity(vars: UpdateNotifyReplyToAddressIdentityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateNotifyReplyToAddressIdentityData>>;

/** Generated Node Admin SDK operation action function for the 'RecordNotifyReplyToProviderAcceptance' Mutation. Allow users to execute without passing in DataConnect. */
export function recordNotifyReplyToProviderAcceptance(dc: DataConnect, vars: RecordNotifyReplyToProviderAcceptanceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordNotifyReplyToProviderAcceptanceData>>;
/** Generated Node Admin SDK operation action function for the 'RecordNotifyReplyToProviderAcceptance' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordNotifyReplyToProviderAcceptance(vars: RecordNotifyReplyToProviderAcceptanceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordNotifyReplyToProviderAcceptanceData>>;

/** Generated Node Admin SDK operation action function for the 'ConfirmNotifyReplyToVerification' Mutation. Allow users to execute without passing in DataConnect. */
export function confirmNotifyReplyToVerification(dc: DataConnect, vars: ConfirmNotifyReplyToVerificationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ConfirmNotifyReplyToVerificationData>>;
/** Generated Node Admin SDK operation action function for the 'ConfirmNotifyReplyToVerification' Mutation. Allow users to pass in custom DataConnect instances. */
export function confirmNotifyReplyToVerification(vars: ConfirmNotifyReplyToVerificationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ConfirmNotifyReplyToVerificationData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateNotifyReplyToAvailability' Mutation. Allow users to execute without passing in DataConnect. */
export function updateNotifyReplyToAvailability(dc: DataConnect, vars: UpdateNotifyReplyToAvailabilityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateNotifyReplyToAvailabilityData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateNotifyReplyToAvailability' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateNotifyReplyToAvailability(vars: UpdateNotifyReplyToAvailabilityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateNotifyReplyToAvailabilityData>>;

/** Generated Node Admin SDK operation action function for the 'ChangeNotifyReplyToDefault' Mutation. Allow users to execute without passing in DataConnect. */
export function changeNotifyReplyToDefault(dc: DataConnect, vars: ChangeNotifyReplyToDefaultVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChangeNotifyReplyToDefaultData>>;
/** Generated Node Admin SDK operation action function for the 'ChangeNotifyReplyToDefault' Mutation. Allow users to pass in custom DataConnect instances. */
export function changeNotifyReplyToDefault(vars: ChangeNotifyReplyToDefaultVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChangeNotifyReplyToDefaultData>>;

/** Generated Node Admin SDK operation action function for the 'DisableDefaultNotifyReplyToAddress' Mutation. Allow users to execute without passing in DataConnect. */
export function disableDefaultNotifyReplyToAddress(dc: DataConnect, vars: DisableDefaultNotifyReplyToAddressVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DisableDefaultNotifyReplyToAddressData>>;
/** Generated Node Admin SDK operation action function for the 'DisableDefaultNotifyReplyToAddress' Mutation. Allow users to pass in custom DataConnect instances. */
export function disableDefaultNotifyReplyToAddress(vars: DisableDefaultNotifyReplyToAddressVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DisableDefaultNotifyReplyToAddressData>>;

/** Generated Node Admin SDK operation action function for the 'SetNotifyTemplateReplyToOverride' Mutation. Allow users to execute without passing in DataConnect. */
export function setNotifyTemplateReplyToOverride(dc: DataConnect, vars: SetNotifyTemplateReplyToOverrideVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetNotifyTemplateReplyToOverrideData>>;
/** Generated Node Admin SDK operation action function for the 'SetNotifyTemplateReplyToOverride' Mutation. Allow users to pass in custom DataConnect instances. */
export function setNotifyTemplateReplyToOverride(vars: SetNotifyTemplateReplyToOverrideVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetNotifyTemplateReplyToOverrideData>>;

/** Generated Node Admin SDK operation action function for the 'ClearNotifyTemplateReplyToOverride' Mutation. Allow users to execute without passing in DataConnect. */
export function clearNotifyTemplateReplyToOverride(dc: DataConnect, vars: ClearNotifyTemplateReplyToOverrideVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClearNotifyTemplateReplyToOverrideData>>;
/** Generated Node Admin SDK operation action function for the 'ClearNotifyTemplateReplyToOverride' Mutation. Allow users to pass in custom DataConnect instances. */
export function clearNotifyTemplateReplyToOverride(vars: ClearNotifyTemplateReplyToOverrideVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClearNotifyTemplateReplyToOverrideData>>;

/** Generated Node Admin SDK operation action function for the 'GetNotifyTemplateBindings' Query. Allow users to execute without passing in DataConnect. */
export function getNotifyTemplateBindings(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetNotifyTemplateBindingsData>>;
/** Generated Node Admin SDK operation action function for the 'GetNotifyTemplateBindings' Query. Allow users to pass in custom DataConnect instances. */
export function getNotifyTemplateBindings(options?: OperationOptions): Promise<ExecuteOperationResponse<GetNotifyTemplateBindingsData>>;

/** Generated Node Admin SDK operation action function for the 'ListNotifyTemplateBindingAudits' Query. Allow users to execute without passing in DataConnect. */
export function listNotifyTemplateBindingAudits(dc: DataConnect, vars: ListNotifyTemplateBindingAuditsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListNotifyTemplateBindingAuditsData>>;
/** Generated Node Admin SDK operation action function for the 'ListNotifyTemplateBindingAudits' Query. Allow users to pass in custom DataConnect instances. */
export function listNotifyTemplateBindingAudits(vars: ListNotifyTemplateBindingAuditsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListNotifyTemplateBindingAuditsData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertNotifyTemplateBinding' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertNotifyTemplateBinding(dc: DataConnect, vars: UpsertNotifyTemplateBindingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertNotifyTemplateBindingData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertNotifyTemplateBinding' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertNotifyTemplateBinding(vars: UpsertNotifyTemplateBindingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertNotifyTemplateBindingData>>;

/** Generated Node Admin SDK operation action function for the 'CreatePendingSectionFile' Mutation. Allow users to execute without passing in DataConnect. */
export function createPendingSectionFile(dc: DataConnect, vars: CreatePendingSectionFileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePendingSectionFileData>>;
/** Generated Node Admin SDK operation action function for the 'CreatePendingSectionFile' Mutation. Allow users to pass in custom DataConnect instances. */
export function createPendingSectionFile(vars: CreatePendingSectionFileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePendingSectionFileData>>;

/** Generated Node Admin SDK operation action function for the 'GetSectionFileById' Query. Allow users to execute without passing in DataConnect. */
export function getSectionFileById(dc: DataConnect, vars: GetSectionFileByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionFileByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetSectionFileById' Query. Allow users to pass in custom DataConnect instances. */
export function getSectionFileById(vars: GetSectionFileByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionFileByIdData>>;

/** Generated Node Admin SDK operation action function for the 'ListSectionFilesByStatus' Query. Allow users to execute without passing in DataConnect. */
export function listSectionFilesByStatus(dc: DataConnect, vars: ListSectionFilesByStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSectionFilesByStatusData>>;
/** Generated Node Admin SDK operation action function for the 'ListSectionFilesByStatus' Query. Allow users to pass in custom DataConnect instances. */
export function listSectionFilesByStatus(vars: ListSectionFilesByStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSectionFilesByStatusData>>;

/** Generated Node Admin SDK operation action function for the 'ListStaleSectionFiles' Query. Allow users to execute without passing in DataConnect. */
export function listStaleSectionFiles(dc: DataConnect, vars: ListStaleSectionFilesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListStaleSectionFilesData>>;
/** Generated Node Admin SDK operation action function for the 'ListStaleSectionFiles' Query. Allow users to pass in custom DataConnect instances. */
export function listStaleSectionFiles(vars: ListStaleSectionFilesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListStaleSectionFilesData>>;

/** Generated Node Admin SDK operation action function for the 'ListSectionFilesForQuota' Query. Allow users to execute without passing in DataConnect. */
export function listSectionFilesForQuota(dc: DataConnect, vars: ListSectionFilesForQuotaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSectionFilesForQuotaData>>;
/** Generated Node Admin SDK operation action function for the 'ListSectionFilesForQuota' Query. Allow users to pass in custom DataConnect instances. */
export function listSectionFilesForQuota(vars: ListSectionFilesForQuotaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSectionFilesForQuotaData>>;

/** Generated Node Admin SDK operation action function for the 'RecordSectionFileAudit' Mutation. Allow users to execute without passing in DataConnect. */
export function recordSectionFileAudit(dc: DataConnect, vars: RecordSectionFileAuditVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordSectionFileAuditData>>;
/** Generated Node Admin SDK operation action function for the 'RecordSectionFileAudit' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordSectionFileAudit(vars: RecordSectionFileAuditVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordSectionFileAuditData>>;

/** Generated Node Admin SDK operation action function for the 'AbandonPendingSectionFile' Mutation. Allow users to execute without passing in DataConnect. */
export function abandonPendingSectionFile(dc: DataConnect, vars: AbandonPendingSectionFileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AbandonPendingSectionFileData>>;
/** Generated Node Admin SDK operation action function for the 'AbandonPendingSectionFile' Mutation. Allow users to pass in custom DataConnect instances. */
export function abandonPendingSectionFile(vars: AbandonPendingSectionFileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AbandonPendingSectionFileData>>;

/** Generated Node Admin SDK operation action function for the 'FinalizePendingSectionFile' Mutation. Allow users to execute without passing in DataConnect. */
export function finalizePendingSectionFile(dc: DataConnect, vars: FinalizePendingSectionFileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FinalizePendingSectionFileData>>;
/** Generated Node Admin SDK operation action function for the 'FinalizePendingSectionFile' Mutation. Allow users to pass in custom DataConnect instances. */
export function finalizePendingSectionFile(vars: FinalizePendingSectionFileVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FinalizePendingSectionFileData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateAvailableSectionFileMetadata' Mutation. Allow users to execute without passing in DataConnect. */
export function updateAvailableSectionFileMetadata(dc: DataConnect, vars: UpdateAvailableSectionFileMetadataVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAvailableSectionFileMetadataData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateAvailableSectionFileMetadata' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateAvailableSectionFileMetadata(vars: UpdateAvailableSectionFileMetadataVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAvailableSectionFileMetadataData>>;

/** Generated Node Admin SDK operation action function for the 'BeginSectionFileReplacement' Mutation. Allow users to execute without passing in DataConnect. */
export function beginSectionFileReplacement(dc: DataConnect, vars: BeginSectionFileReplacementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BeginSectionFileReplacementData>>;
/** Generated Node Admin SDK operation action function for the 'BeginSectionFileReplacement' Mutation. Allow users to pass in custom DataConnect instances. */
export function beginSectionFileReplacement(vars: BeginSectionFileReplacementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BeginSectionFileReplacementData>>;

/** Generated Node Admin SDK operation action function for the 'FinalizeSectionFileReplacement' Mutation. Allow users to execute without passing in DataConnect. */
export function finalizeSectionFileReplacement(dc: DataConnect, vars: FinalizeSectionFileReplacementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FinalizeSectionFileReplacementData>>;
/** Generated Node Admin SDK operation action function for the 'FinalizeSectionFileReplacement' Mutation. Allow users to pass in custom DataConnect instances. */
export function finalizeSectionFileReplacement(vars: FinalizeSectionFileReplacementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FinalizeSectionFileReplacementData>>;

/** Generated Node Admin SDK operation action function for the 'AbortSectionFileReplacement' Mutation. Allow users to execute without passing in DataConnect. */
export function abortSectionFileReplacement(dc: DataConnect, vars: AbortSectionFileReplacementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AbortSectionFileReplacementData>>;
/** Generated Node Admin SDK operation action function for the 'AbortSectionFileReplacement' Mutation. Allow users to pass in custom DataConnect instances. */
export function abortSectionFileReplacement(vars: AbortSectionFileReplacementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AbortSectionFileReplacementData>>;

/** Generated Node Admin SDK operation action function for the 'BeginSectionFileDeletion' Mutation. Allow users to execute without passing in DataConnect. */
export function beginSectionFileDeletion(dc: DataConnect, vars: BeginSectionFileDeletionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BeginSectionFileDeletionData>>;
/** Generated Node Admin SDK operation action function for the 'BeginSectionFileDeletion' Mutation. Allow users to pass in custom DataConnect instances. */
export function beginSectionFileDeletion(vars: BeginSectionFileDeletionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BeginSectionFileDeletionData>>;

/** Generated Node Admin SDK operation action function for the 'MarkSectionFileDeleted' Mutation. Allow users to execute without passing in DataConnect. */
export function markSectionFileDeleted(dc: DataConnect, vars: MarkSectionFileDeletedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkSectionFileDeletedData>>;
/** Generated Node Admin SDK operation action function for the 'MarkSectionFileDeleted' Mutation. Allow users to pass in custom DataConnect instances. */
export function markSectionFileDeleted(vars: MarkSectionFileDeletedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkSectionFileDeletedData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateUserMembershipStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUserMembershipStatus(dc: DataConnect, vars: UpdateUserMembershipStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserMembershipStatusData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUserMembershipStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUserMembershipStatus(vars: UpdateUserMembershipStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserMembershipStatusData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateUserEmailFromAuth' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUserEmailFromAuth(dc: DataConnect, vars: UpdateUserEmailFromAuthVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserEmailFromAuthData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUserEmailFromAuth' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUserEmailFromAuth(vars: UpdateUserEmailFromAuthVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserEmailFromAuthData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteUser' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteUser(dc: DataConnect, vars: DeleteUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteUser(vars: DeleteUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserData>>;

/** Generated Node Admin SDK operation action function for the 'CreateUser' Mutation. Allow users to execute without passing in DataConnect. */
export function createUser(dc: DataConnect, vars: CreateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserData>>;
/** Generated Node Admin SDK operation action function for the 'CreateUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function createUser(vars: CreateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserData>>;

/** Generated Node Admin SDK operation action function for the 'CreateMigratedUserProfileAndIdentity' Mutation. Allow users to execute without passing in DataConnect. */
export function createMigratedUserProfileAndIdentity(dc: DataConnect, vars: CreateMigratedUserProfileAndIdentityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMigratedUserProfileAndIdentityData>>;
/** Generated Node Admin SDK operation action function for the 'CreateMigratedUserProfileAndIdentity' Mutation. Allow users to pass in custom DataConnect instances. */
export function createMigratedUserProfileAndIdentity(vars: CreateMigratedUserProfileAndIdentityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMigratedUserProfileAndIdentityData>>;

/** Generated Node Admin SDK operation action function for the 'LinkLegacyIdentityToExistingUser' Mutation. Allow users to execute without passing in DataConnect. */
export function linkLegacyIdentityToExistingUser(dc: DataConnect, vars: LinkLegacyIdentityToExistingUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<LinkLegacyIdentityToExistingUserData>>;
/** Generated Node Admin SDK operation action function for the 'LinkLegacyIdentityToExistingUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function linkLegacyIdentityToExistingUser(vars: LinkLegacyIdentityToExistingUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<LinkLegacyIdentityToExistingUserData>>;

/** Generated Node Admin SDK operation action function for the 'GetLegacyUserIdentity' Query. Allow users to execute without passing in DataConnect. */
export function getLegacyUserIdentity(dc: DataConnect, vars: GetLegacyUserIdentityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLegacyUserIdentityData>>;
/** Generated Node Admin SDK operation action function for the 'GetLegacyUserIdentity' Query. Allow users to pass in custom DataConnect instances. */
export function getLegacyUserIdentity(vars: GetLegacyUserIdentityVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLegacyUserIdentityData>>;

/** Generated Node Admin SDK operation action function for the 'ListLegacyUserIdentitiesByBatch' Query. Allow users to execute without passing in DataConnect. */
export function listLegacyUserIdentitiesByBatch(dc: DataConnect, vars: ListLegacyUserIdentitiesByBatchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLegacyUserIdentitiesByBatchData>>;
/** Generated Node Admin SDK operation action function for the 'ListLegacyUserIdentitiesByBatch' Query. Allow users to pass in custom DataConnect instances. */
export function listLegacyUserIdentitiesByBatch(vars: ListLegacyUserIdentitiesByBatchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLegacyUserIdentitiesByBatchData>>;

/** Generated Node Admin SDK operation action function for the 'ListMigrationUsers' Query. Allow users to execute without passing in DataConnect. */
export function listMigrationUsers(dc: DataConnect, vars: ListMigrationUsersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMigrationUsersData>>;
/** Generated Node Admin SDK operation action function for the 'ListMigrationUsers' Query. Allow users to pass in custom DataConnect instances. */
export function listMigrationUsers(vars: ListMigrationUsersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMigrationUsersData>>;

/** Generated Node Admin SDK operation action function for the 'SearchSectionMemberCandidates' Query. Allow users to execute without passing in DataConnect. */
export function searchSectionMemberCandidates(dc: DataConnect, vars: SearchSectionMemberCandidatesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SearchSectionMemberCandidatesData>>;
/** Generated Node Admin SDK operation action function for the 'SearchSectionMemberCandidates' Query. Allow users to pass in custom DataConnect instances. */
export function searchSectionMemberCandidates(vars: SearchSectionMemberCandidatesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SearchSectionMemberCandidatesData>>;

/** Generated Node Admin SDK operation action function for the 'ListLegacyUserIdentitiesForMigration' Query. Allow users to execute without passing in DataConnect. */
export function listLegacyUserIdentitiesForMigration(dc: DataConnect, vars: ListLegacyUserIdentitiesForMigrationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLegacyUserIdentitiesForMigrationData>>;
/** Generated Node Admin SDK operation action function for the 'ListLegacyUserIdentitiesForMigration' Query. Allow users to pass in custom DataConnect instances. */
export function listLegacyUserIdentitiesForMigration(vars: ListLegacyUserIdentitiesForMigrationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLegacyUserIdentitiesForMigrationData>>;

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

/** Generated Node Admin SDK operation action function for the 'GetUserForCheckout' Query. Allow users to execute without passing in DataConnect. */
export function getUserForCheckout(dc: DataConnect, vars: GetUserForCheckoutVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserForCheckoutData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserForCheckout' Query. Allow users to pass in custom DataConnect instances. */
export function getUserForCheckout(vars: GetUserForCheckoutVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserForCheckoutData>>;

/** Generated Node Admin SDK operation action function for the 'GetTicketTypeForCheckout' Query. Allow users to execute without passing in DataConnect. */
export function getTicketTypeForCheckout(dc: DataConnect, vars: GetTicketTypeForCheckoutVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTicketTypeForCheckoutData>>;
/** Generated Node Admin SDK operation action function for the 'GetTicketTypeForCheckout' Query. Allow users to pass in custom DataConnect instances. */
export function getTicketTypeForCheckout(vars: GetTicketTypeForCheckoutVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTicketTypeForCheckoutData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateUserStripeCustomerId' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUserStripeCustomerId(dc: DataConnect, vars: UpdateUserStripeCustomerIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserStripeCustomerIdData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUserStripeCustomerId' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUserStripeCustomerId(vars: UpdateUserStripeCustomerIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserStripeCustomerIdData>>;

/** Generated Node Admin SDK operation action function for the 'GetEventByIdForCallable' Query. Allow users to execute without passing in DataConnect. */
export function getEventByIdForCallable(dc: DataConnect, vars: GetEventByIdForCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetEventByIdForCallableData>>;
/** Generated Node Admin SDK operation action function for the 'GetEventByIdForCallable' Query. Allow users to pass in custom DataConnect instances. */
export function getEventByIdForCallable(vars: GetEventByIdForCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetEventByIdForCallableData>>;

/** Generated Node Admin SDK operation action function for the 'GetSectionByIdForCallable' Query. Allow users to execute without passing in DataConnect. */
export function getSectionByIdForCallable(dc: DataConnect, vars: GetSectionByIdForCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionByIdForCallableData>>;
/** Generated Node Admin SDK operation action function for the 'GetSectionByIdForCallable' Query. Allow users to pass in custom DataConnect instances. */
export function getSectionByIdForCallable(vars: GetSectionByIdForCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionByIdForCallableData>>;

/** Generated Node Admin SDK operation action function for the 'GetBookingsForBookerAndEvent' Query. Allow users to execute without passing in DataConnect. */
export function getBookingsForBookerAndEvent(dc: DataConnect, vars: GetBookingsForBookerAndEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetBookingsForBookerAndEventData>>;
/** Generated Node Admin SDK operation action function for the 'GetBookingsForBookerAndEvent' Query. Allow users to pass in custom DataConnect instances. */
export function getBookingsForBookerAndEvent(vars: GetBookingsForBookerAndEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetBookingsForBookerAndEventData>>;

/** Generated Node Admin SDK operation action function for the 'GetBookingRevisionForApprovalFromCallable' Query. Allow users to execute without passing in DataConnect. */
export function getBookingRevisionForApprovalFromCallable(dc: DataConnect, vars: GetBookingRevisionForApprovalFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetBookingRevisionForApprovalFromCallableData>>;
/** Generated Node Admin SDK operation action function for the 'GetBookingRevisionForApprovalFromCallable' Query. Allow users to pass in custom DataConnect instances. */
export function getBookingRevisionForApprovalFromCallable(vars: GetBookingRevisionForApprovalFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetBookingRevisionForApprovalFromCallableData>>;

/** Generated Node Admin SDK operation action function for the 'GetTicketOrdersForBookerAndEvent' Query. Allow users to execute without passing in DataConnect. */
export function getTicketOrdersForBookerAndEvent(dc: DataConnect, vars: GetTicketOrdersForBookerAndEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTicketOrdersForBookerAndEventData>>;
/** Generated Node Admin SDK operation action function for the 'GetTicketOrdersForBookerAndEvent' Query. Allow users to pass in custom DataConnect instances. */
export function getTicketOrdersForBookerAndEvent(vars: GetTicketOrdersForBookerAndEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTicketOrdersForBookerAndEventData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateBookingStatusFromCallable' Mutation. Allow users to execute without passing in DataConnect. */
export function updateBookingStatusFromCallable(dc: DataConnect, vars: UpdateBookingStatusFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateBookingStatusFromCallableData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateBookingStatusFromCallable' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateBookingStatusFromCallable(vars: UpdateBookingStatusFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateBookingStatusFromCallableData>>;

/** Generated Node Admin SDK operation action function for the 'SettleBookingPaymentAdjustmentsFromCallable' Mutation. Allow users to execute without passing in DataConnect. */
export function settleBookingPaymentAdjustmentsFromCallable(dc: DataConnect, vars: SettleBookingPaymentAdjustmentsFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SettleBookingPaymentAdjustmentsFromCallableData>>;
/** Generated Node Admin SDK operation action function for the 'SettleBookingPaymentAdjustmentsFromCallable' Mutation. Allow users to pass in custom DataConnect instances. */
export function settleBookingPaymentAdjustmentsFromCallable(vars: SettleBookingPaymentAdjustmentsFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SettleBookingPaymentAdjustmentsFromCallableData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateBookingApprovalFromCallable' Mutation. Allow users to execute without passing in DataConnect. */
export function updateBookingApprovalFromCallable(dc: DataConnect, vars: UpdateBookingApprovalFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateBookingApprovalFromCallableData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateBookingApprovalFromCallable' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateBookingApprovalFromCallable(vars: UpdateBookingApprovalFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateBookingApprovalFromCallableData>>;

/** Generated Node Admin SDK operation action function for the 'CreateTicketOrderForCheckout' Mutation. Allow users to execute without passing in DataConnect. */
export function createTicketOrderForCheckout(dc: DataConnect, vars: CreateTicketOrderForCheckoutVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTicketOrderForCheckoutData>>;
/** Generated Node Admin SDK operation action function for the 'CreateTicketOrderForCheckout' Mutation. Allow users to pass in custom DataConnect instances. */
export function createTicketOrderForCheckout(vars: CreateTicketOrderForCheckoutVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTicketOrderForCheckoutData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateBookingPlaceAllocationRefundFromCallable' Mutation. Allow users to execute without passing in DataConnect. */
export function updateBookingPlaceAllocationRefundFromCallable(dc: DataConnect, vars: UpdateBookingPlaceAllocationRefundFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateBookingPlaceAllocationRefundFromCallableData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateBookingPlaceAllocationRefundFromCallable' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateBookingPlaceAllocationRefundFromCallable(vars: UpdateBookingPlaceAllocationRefundFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateBookingPlaceAllocationRefundFromCallableData>>;

/** Generated Node Admin SDK operation action function for the 'GetTicketOrderForWebhook' Query. Allow users to execute without passing in DataConnect. */
export function getTicketOrderForWebhook(dc: DataConnect, vars: GetTicketOrderForWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTicketOrderForWebhookData>>;
/** Generated Node Admin SDK operation action function for the 'GetTicketOrderForWebhook' Query. Allow users to pass in custom DataConnect instances. */
export function getTicketOrderForWebhook(vars: GetTicketOrderForWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTicketOrderForWebhookData>>;

/** Generated Node Admin SDK operation action function for the 'GetTicketOrderStripeArtifactsForCallable' Query. Allow users to execute without passing in DataConnect. */
export function getTicketOrderStripeArtifactsForCallable(dc: DataConnect, vars: GetTicketOrderStripeArtifactsForCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTicketOrderStripeArtifactsForCallableData>>;
/** Generated Node Admin SDK operation action function for the 'GetTicketOrderStripeArtifactsForCallable' Query. Allow users to pass in custom DataConnect instances. */
export function getTicketOrderStripeArtifactsForCallable(vars: GetTicketOrderStripeArtifactsForCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTicketOrderStripeArtifactsForCallableData>>;

/** Generated Node Admin SDK operation action function for the 'GetPaymentWebhookEventByStripeEventId' Query. Allow users to execute without passing in DataConnect. */
export function getPaymentWebhookEventByStripeEventId(dc: DataConnect, vars: GetPaymentWebhookEventByStripeEventIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPaymentWebhookEventByStripeEventIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetPaymentWebhookEventByStripeEventId' Query. Allow users to pass in custom DataConnect instances. */
export function getPaymentWebhookEventByStripeEventId(vars: GetPaymentWebhookEventByStripeEventIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPaymentWebhookEventByStripeEventIdData>>;

/** Generated Node Admin SDK operation action function for the 'CreatePaymentWebhookEvent' Mutation. Allow users to execute without passing in DataConnect. */
export function createPaymentWebhookEvent(dc: DataConnect, vars: CreatePaymentWebhookEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePaymentWebhookEventData>>;
/** Generated Node Admin SDK operation action function for the 'CreatePaymentWebhookEvent' Mutation. Allow users to pass in custom DataConnect instances. */
export function createPaymentWebhookEvent(vars: CreatePaymentWebhookEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePaymentWebhookEventData>>;

/** Generated Node Admin SDK operation action function for the 'GetNotificationDeliveryByChannelAndKey' Query. Allow users to execute without passing in DataConnect. */
export function getNotificationDeliveryByChannelAndKey(dc: DataConnect, vars: GetNotificationDeliveryByChannelAndKeyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetNotificationDeliveryByChannelAndKeyData>>;
/** Generated Node Admin SDK operation action function for the 'GetNotificationDeliveryByChannelAndKey' Query. Allow users to pass in custom DataConnect instances. */
export function getNotificationDeliveryByChannelAndKey(vars: GetNotificationDeliveryByChannelAndKeyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetNotificationDeliveryByChannelAndKeyData>>;

/** Generated Node Admin SDK operation action function for the 'ListFailedNotificationDeliveriesForRecovery' Query. Allow users to execute without passing in DataConnect. */
export function listFailedNotificationDeliveriesForRecovery(dc: DataConnect, vars: ListFailedNotificationDeliveriesForRecoveryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListFailedNotificationDeliveriesForRecoveryData>>;
/** Generated Node Admin SDK operation action function for the 'ListFailedNotificationDeliveriesForRecovery' Query. Allow users to pass in custom DataConnect instances. */
export function listFailedNotificationDeliveriesForRecovery(vars: ListFailedNotificationDeliveriesForRecoveryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListFailedNotificationDeliveriesForRecoveryData>>;

/** Generated Node Admin SDK operation action function for the 'ListStalePendingNotificationDeliveriesForRecovery' Query. Allow users to execute without passing in DataConnect. */
export function listStalePendingNotificationDeliveriesForRecovery(dc: DataConnect, vars: ListStalePendingNotificationDeliveriesForRecoveryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListStalePendingNotificationDeliveriesForRecoveryData>>;
/** Generated Node Admin SDK operation action function for the 'ListStalePendingNotificationDeliveriesForRecovery' Query. Allow users to pass in custom DataConnect instances. */
export function listStalePendingNotificationDeliveriesForRecovery(vars: ListStalePendingNotificationDeliveriesForRecoveryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListStalePendingNotificationDeliveriesForRecoveryData>>;

/** Generated Node Admin SDK operation action function for the 'CreateNotificationDelivery' Mutation. Allow users to execute without passing in DataConnect. */
export function createNotificationDelivery(dc: DataConnect, vars: CreateNotificationDeliveryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateNotificationDeliveryData>>;
/** Generated Node Admin SDK operation action function for the 'CreateNotificationDelivery' Mutation. Allow users to pass in custom DataConnect instances. */
export function createNotificationDelivery(vars: CreateNotificationDeliveryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateNotificationDeliveryData>>;

/** Generated Node Admin SDK operation action function for the 'ClaimNotificationDeliveryById' Mutation. Allow users to execute without passing in DataConnect. */
export function claimNotificationDeliveryById(dc: DataConnect, vars: ClaimNotificationDeliveryByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimNotificationDeliveryByIdData>>;
/** Generated Node Admin SDK operation action function for the 'ClaimNotificationDeliveryById' Mutation. Allow users to pass in custom DataConnect instances. */
export function claimNotificationDeliveryById(vars: ClaimNotificationDeliveryByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimNotificationDeliveryByIdData>>;

/** Generated Node Admin SDK operation action function for the 'RecordNotificationRecoveryFailureById' Mutation. Allow users to execute without passing in DataConnect. */
export function recordNotificationRecoveryFailureById(dc: DataConnect, vars: RecordNotificationRecoveryFailureByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordNotificationRecoveryFailureByIdData>>;
/** Generated Node Admin SDK operation action function for the 'RecordNotificationRecoveryFailureById' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordNotificationRecoveryFailureById(vars: RecordNotificationRecoveryFailureByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordNotificationRecoveryFailureByIdData>>;

/** Generated Node Admin SDK operation action function for the 'MarkNotificationDeliverySentById' Mutation. Allow users to execute without passing in DataConnect. */
export function markNotificationDeliverySentById(dc: DataConnect, vars: MarkNotificationDeliverySentByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkNotificationDeliverySentByIdData>>;
/** Generated Node Admin SDK operation action function for the 'MarkNotificationDeliverySentById' Mutation. Allow users to pass in custom DataConnect instances. */
export function markNotificationDeliverySentById(vars: MarkNotificationDeliverySentByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkNotificationDeliverySentByIdData>>;

/** Generated Node Admin SDK operation action function for the 'MarkNotificationDeliveryFailedById' Mutation. Allow users to execute without passing in DataConnect. */
export function markNotificationDeliveryFailedById(dc: DataConnect, vars: MarkNotificationDeliveryFailedByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkNotificationDeliveryFailedByIdData>>;
/** Generated Node Admin SDK operation action function for the 'MarkNotificationDeliveryFailedById' Mutation. Allow users to pass in custom DataConnect instances. */
export function markNotificationDeliveryFailedById(vars: MarkNotificationDeliveryFailedByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkNotificationDeliveryFailedByIdData>>;

/** Generated Node Admin SDK operation action function for the 'MarkTicketOrderPaidFromWebhook' Mutation. Allow users to execute without passing in DataConnect. */
export function markTicketOrderPaidFromWebhook(dc: DataConnect, vars: MarkTicketOrderPaidFromWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkTicketOrderPaidFromWebhookData>>;
/** Generated Node Admin SDK operation action function for the 'MarkTicketOrderPaidFromWebhook' Mutation. Allow users to pass in custom DataConnect instances. */
export function markTicketOrderPaidFromWebhook(vars: MarkTicketOrderPaidFromWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkTicketOrderPaidFromWebhookData>>;

/** Generated Node Admin SDK operation action function for the 'MarkTicketOrderFailedFromWebhook' Mutation. Allow users to execute without passing in DataConnect. */
export function markTicketOrderFailedFromWebhook(dc: DataConnect, vars: MarkTicketOrderFailedFromWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkTicketOrderFailedFromWebhookData>>;
/** Generated Node Admin SDK operation action function for the 'MarkTicketOrderFailedFromWebhook' Mutation. Allow users to pass in custom DataConnect instances. */
export function markTicketOrderFailedFromWebhook(vars: MarkTicketOrderFailedFromWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkTicketOrderFailedFromWebhookData>>;

/** Generated Node Admin SDK operation action function for the 'MarkTicketOrderRefundedFromWebhook' Mutation. Allow users to execute without passing in DataConnect. */
export function markTicketOrderRefundedFromWebhook(dc: DataConnect, vars: MarkTicketOrderRefundedFromWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkTicketOrderRefundedFromWebhookData>>;
/** Generated Node Admin SDK operation action function for the 'MarkTicketOrderRefundedFromWebhook' Mutation. Allow users to pass in custom DataConnect instances. */
export function markTicketOrderRefundedFromWebhook(vars: MarkTicketOrderRefundedFromWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkTicketOrderRefundedFromWebhookData>>;

/** Generated Node Admin SDK operation action function for the 'RecordTicketOrderPartialRefundFromWebhook' Mutation. Allow users to execute without passing in DataConnect. */
export function recordTicketOrderPartialRefundFromWebhook(dc: DataConnect, vars: RecordTicketOrderPartialRefundFromWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordTicketOrderPartialRefundFromWebhookData>>;
/** Generated Node Admin SDK operation action function for the 'RecordTicketOrderPartialRefundFromWebhook' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordTicketOrderPartialRefundFromWebhook(vars: RecordTicketOrderPartialRefundFromWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordTicketOrderPartialRefundFromWebhookData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertTicketOrderDisputeFromWebhook' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertTicketOrderDisputeFromWebhook(dc: DataConnect, vars: UpsertTicketOrderDisputeFromWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertTicketOrderDisputeFromWebhookData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertTicketOrderDisputeFromWebhook' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertTicketOrderDisputeFromWebhook(vars: UpsertTicketOrderDisputeFromWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertTicketOrderDisputeFromWebhookData>>;

/** Generated Node Admin SDK operation action function for the 'GetPaymentReconciliationExceptionByOrderAndType' Query. Allow users to execute without passing in DataConnect. */
export function getPaymentReconciliationExceptionByOrderAndType(dc: DataConnect, vars: GetPaymentReconciliationExceptionByOrderAndTypeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPaymentReconciliationExceptionByOrderAndTypeData>>;
/** Generated Node Admin SDK operation action function for the 'GetPaymentReconciliationExceptionByOrderAndType' Query. Allow users to pass in custom DataConnect instances. */
export function getPaymentReconciliationExceptionByOrderAndType(vars: GetPaymentReconciliationExceptionByOrderAndTypeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPaymentReconciliationExceptionByOrderAndTypeData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertPaymentReconciliationException' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertPaymentReconciliationException(dc: DataConnect, vars: UpsertPaymentReconciliationExceptionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertPaymentReconciliationExceptionData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertPaymentReconciliationException' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertPaymentReconciliationException(vars: UpsertPaymentReconciliationExceptionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertPaymentReconciliationExceptionData>>;

/** Generated Node Admin SDK operation action function for the 'GetBookingForNotification' Query. Allow users to execute without passing in DataConnect. */
export function getBookingForNotification(dc: DataConnect, vars: GetBookingForNotificationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetBookingForNotificationData>>;
/** Generated Node Admin SDK operation action function for the 'GetBookingForNotification' Query. Allow users to pass in custom DataConnect instances. */
export function getBookingForNotification(vars: GetBookingForNotificationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetBookingForNotificationData>>;

/** Generated Node Admin SDK operation action function for the 'ListStaleDraftBookingsForScheduler' Query. Allow users to execute without passing in DataConnect. */
export function listStaleDraftBookingsForScheduler(dc: DataConnect, vars: ListStaleDraftBookingsForSchedulerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListStaleDraftBookingsForSchedulerData>>;
/** Generated Node Admin SDK operation action function for the 'ListStaleDraftBookingsForScheduler' Query. Allow users to pass in custom DataConnect instances. */
export function listStaleDraftBookingsForScheduler(vars: ListStaleDraftBookingsForSchedulerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListStaleDraftBookingsForSchedulerData>>;

/** Generated Node Admin SDK operation action function for the 'ListStalePendingTicketOrdersForScheduler' Query. Allow users to execute without passing in DataConnect. */
export function listStalePendingTicketOrdersForScheduler(dc: DataConnect, vars: ListStalePendingTicketOrdersForSchedulerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListStalePendingTicketOrdersForSchedulerData>>;
/** Generated Node Admin SDK operation action function for the 'ListStalePendingTicketOrdersForScheduler' Query. Allow users to pass in custom DataConnect instances. */
export function listStalePendingTicketOrdersForScheduler(vars: ListStalePendingTicketOrdersForSchedulerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListStalePendingTicketOrdersForSchedulerData>>;

/** Generated Node Admin SDK operation action function for the 'GetSectionAnnouncementOptOuts' Query. Allow users to execute without passing in DataConnect. */
export function getSectionAnnouncementOptOuts(dc: DataConnect, vars: GetSectionAnnouncementOptOutsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionAnnouncementOptOutsData>>;
/** Generated Node Admin SDK operation action function for the 'GetSectionAnnouncementOptOuts' Query. Allow users to pass in custom DataConnect instances. */
export function getSectionAnnouncementOptOuts(vars: GetSectionAnnouncementOptOutsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionAnnouncementOptOutsData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAnnouncementSend' Mutation. Allow users to execute without passing in DataConnect. */
export function createAnnouncementSend(dc: DataConnect, vars: CreateAnnouncementSendVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAnnouncementSendData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAnnouncementSend' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAnnouncementSend(vars: CreateAnnouncementSendVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAnnouncementSendData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAnnouncementSendWithDeliveryMode' Mutation. Allow users to execute without passing in DataConnect. */
export function createAnnouncementSendWithDeliveryMode(dc: DataConnect, vars: CreateAnnouncementSendWithDeliveryModeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAnnouncementSendWithDeliveryModeData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAnnouncementSendWithDeliveryMode' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAnnouncementSendWithDeliveryMode(vars: CreateAnnouncementSendWithDeliveryModeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAnnouncementSendWithDeliveryModeData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAnnouncementRecipient' Mutation. Allow users to execute without passing in DataConnect. */
export function createAnnouncementRecipient(dc: DataConnect, vars: CreateAnnouncementRecipientVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAnnouncementRecipientData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAnnouncementRecipient' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAnnouncementRecipient(vars: CreateAnnouncementRecipientVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAnnouncementRecipientData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAnnouncementRecipientWithDeliveryMode' Mutation. Allow users to execute without passing in DataConnect. */
export function createAnnouncementRecipientWithDeliveryMode(dc: DataConnect, vars: CreateAnnouncementRecipientWithDeliveryModeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAnnouncementRecipientWithDeliveryModeData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAnnouncementRecipientWithDeliveryMode' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAnnouncementRecipientWithDeliveryMode(vars: CreateAnnouncementRecipientWithDeliveryModeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAnnouncementRecipientWithDeliveryModeData>>;

/** Generated Node Admin SDK operation action function for the 'GetAnnouncementRecipientProgress' Query. Allow users to execute without passing in DataConnect. */
export function getAnnouncementRecipientProgress(dc: DataConnect, vars: GetAnnouncementRecipientProgressVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAnnouncementRecipientProgressData>>;
/** Generated Node Admin SDK operation action function for the 'GetAnnouncementRecipientProgress' Query. Allow users to pass in custom DataConnect instances. */
export function getAnnouncementRecipientProgress(vars: GetAnnouncementRecipientProgressVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAnnouncementRecipientProgressData>>;

/** Generated Node Admin SDK operation action function for the 'GetAnnouncementRecipientsForResume' Query. Allow users to execute without passing in DataConnect. */
export function getAnnouncementRecipientsForResume(dc: DataConnect, vars: GetAnnouncementRecipientsForResumeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAnnouncementRecipientsForResumeData>>;
/** Generated Node Admin SDK operation action function for the 'GetAnnouncementRecipientsForResume' Query. Allow users to pass in custom DataConnect instances. */
export function getAnnouncementRecipientsForResume(vars: GetAnnouncementRecipientsForResumeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAnnouncementRecipientsForResumeData>>;

/** Generated Node Admin SDK operation action function for the 'GetAnnouncementSendHistory' Query. Allow users to execute without passing in DataConnect. */
export function getAnnouncementSendHistory(dc: DataConnect, vars: GetAnnouncementSendHistoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAnnouncementSendHistoryData>>;
/** Generated Node Admin SDK operation action function for the 'GetAnnouncementSendHistory' Query. Allow users to pass in custom DataConnect instances. */
export function getAnnouncementSendHistory(vars: GetAnnouncementSendHistoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAnnouncementSendHistoryData>>;

/** Generated Node Admin SDK operation action function for the 'GetAnnouncementSendRecipients' Query. Allow users to execute without passing in DataConnect. */
export function getAnnouncementSendRecipients(dc: DataConnect, vars: GetAnnouncementSendRecipientsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAnnouncementSendRecipientsData>>;
/** Generated Node Admin SDK operation action function for the 'GetAnnouncementSendRecipients' Query. Allow users to pass in custom DataConnect instances. */
export function getAnnouncementSendRecipients(vars: GetAnnouncementSendRecipientsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAnnouncementSendRecipientsData>>;

/** Generated Node Admin SDK operation action function for the 'GetAnnouncementSendById' Query. Allow users to execute without passing in DataConnect. */
export function getAnnouncementSendById(dc: DataConnect, vars: GetAnnouncementSendByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAnnouncementSendByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetAnnouncementSendById' Query. Allow users to pass in custom DataConnect instances. */
export function getAnnouncementSendById(vars: GetAnnouncementSendByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAnnouncementSendByIdData>>;

/** Generated Node Admin SDK operation action function for the 'GetAnnouncementRecipientBySendAndUser' Query. Allow users to execute without passing in DataConnect. */
export function getAnnouncementRecipientBySendAndUser(dc: DataConnect, vars: GetAnnouncementRecipientBySendAndUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAnnouncementRecipientBySendAndUserData>>;
/** Generated Node Admin SDK operation action function for the 'GetAnnouncementRecipientBySendAndUser' Query. Allow users to pass in custom DataConnect instances. */
export function getAnnouncementRecipientBySendAndUser(vars: GetAnnouncementRecipientBySendAndUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetAnnouncementRecipientBySendAndUserData>>;

/** Generated Node Admin SDK operation action function for the 'TryUpdateAnnouncementRecipientProcessingStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function tryUpdateAnnouncementRecipientProcessingStatus(dc: DataConnect, vars: TryUpdateAnnouncementRecipientProcessingStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<TryUpdateAnnouncementRecipientProcessingStatusData>>;
/** Generated Node Admin SDK operation action function for the 'TryUpdateAnnouncementRecipientProcessingStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function tryUpdateAnnouncementRecipientProcessingStatus(vars: TryUpdateAnnouncementRecipientProcessingStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<TryUpdateAnnouncementRecipientProcessingStatusData>>;

/** Generated Node Admin SDK operation action function for the 'TryMarkAnnouncementRecipientEnqueueFailed' Mutation. Allow users to execute without passing in DataConnect. */
export function tryMarkAnnouncementRecipientEnqueueFailed(dc: DataConnect, vars: TryMarkAnnouncementRecipientEnqueueFailedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<TryMarkAnnouncementRecipientEnqueueFailedData>>;
/** Generated Node Admin SDK operation action function for the 'TryMarkAnnouncementRecipientEnqueueFailed' Mutation. Allow users to pass in custom DataConnect instances. */
export function tryMarkAnnouncementRecipientEnqueueFailed(vars: TryMarkAnnouncementRecipientEnqueueFailedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<TryMarkAnnouncementRecipientEnqueueFailedData>>;

/** Generated Node Admin SDK operation action function for the 'TryUpdateAnnouncementRecipientDeliveryStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function tryUpdateAnnouncementRecipientDeliveryStatus(dc: DataConnect, vars: TryUpdateAnnouncementRecipientDeliveryStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<TryUpdateAnnouncementRecipientDeliveryStatusData>>;
/** Generated Node Admin SDK operation action function for the 'TryUpdateAnnouncementRecipientDeliveryStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function tryUpdateAnnouncementRecipientDeliveryStatus(vars: TryUpdateAnnouncementRecipientDeliveryStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<TryUpdateAnnouncementRecipientDeliveryStatusData>>;

/** Generated Node Admin SDK operation action function for the 'GetUserByEmail' Query. Allow users to execute without passing in DataConnect. */
export function getUserByEmail(dc: DataConnect, vars: GetUserByEmailVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserByEmailData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserByEmail' Query. Allow users to pass in custom DataConnect instances. */
export function getUserByEmail(vars: GetUserByEmailVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserByEmailData>>;

/** Generated Node Admin SDK operation action function for the 'GetNotifyCallbackUserById' Query. Allow users to execute without passing in DataConnect. */
export function getNotifyCallbackUserById(dc: DataConnect, vars: GetNotifyCallbackUserByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetNotifyCallbackUserByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetNotifyCallbackUserById' Query. Allow users to pass in custom DataConnect instances. */
export function getNotifyCallbackUserById(vars: GetNotifyCallbackUserByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetNotifyCallbackUserByIdData>>;

/** Generated Node Admin SDK operation action function for the 'TryApplyNotifyDeliveryUserState' Mutation. Allow users to execute without passing in DataConnect. */
export function tryApplyNotifyDeliveryUserState(dc: DataConnect, vars: TryApplyNotifyDeliveryUserStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<TryApplyNotifyDeliveryUserStateData>>;
/** Generated Node Admin SDK operation action function for the 'TryApplyNotifyDeliveryUserState' Mutation. Allow users to pass in custom DataConnect instances. */
export function tryApplyNotifyDeliveryUserState(vars: TryApplyNotifyDeliveryUserStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<TryApplyNotifyDeliveryUserStateData>>;

/** Generated Node Admin SDK operation action function for the 'TryApplyNotifyDeliveryUserStateAndMarkLost' Mutation. Allow users to execute without passing in DataConnect. */
export function tryApplyNotifyDeliveryUserStateAndMarkLost(dc: DataConnect, vars: TryApplyNotifyDeliveryUserStateAndMarkLostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<TryApplyNotifyDeliveryUserStateAndMarkLostData>>;
/** Generated Node Admin SDK operation action function for the 'TryApplyNotifyDeliveryUserStateAndMarkLost' Mutation. Allow users to pass in custom DataConnect instances. */
export function tryApplyNotifyDeliveryUserStateAndMarkLost(vars: TryApplyNotifyDeliveryUserStateAndMarkLostVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<TryApplyNotifyDeliveryUserStateAndMarkLostData>>;

/** Generated Node Admin SDK operation action function for the 'GetNotifyDeliveryReceipt' Query. Allow users to execute without passing in DataConnect. */
export function getNotifyDeliveryReceipt(dc: DataConnect, vars: GetNotifyDeliveryReceiptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetNotifyDeliveryReceiptData>>;
/** Generated Node Admin SDK operation action function for the 'GetNotifyDeliveryReceipt' Query. Allow users to pass in custom DataConnect instances. */
export function getNotifyDeliveryReceipt(vars: GetNotifyDeliveryReceiptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetNotifyDeliveryReceiptData>>;

/** Generated Node Admin SDK operation action function for the 'CreateNotifyDeliveryReceipt' Mutation. Allow users to execute without passing in DataConnect. */
export function createNotifyDeliveryReceipt(dc: DataConnect, vars: CreateNotifyDeliveryReceiptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateNotifyDeliveryReceiptData>>;
/** Generated Node Admin SDK operation action function for the 'CreateNotifyDeliveryReceipt' Mutation. Allow users to pass in custom DataConnect instances. */
export function createNotifyDeliveryReceipt(vars: CreateNotifyDeliveryReceiptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateNotifyDeliveryReceiptData>>;

/** Generated Node Admin SDK operation action function for the 'ClaimNotifyDeliveryReceipt' Mutation. Allow users to execute without passing in DataConnect. */
export function claimNotifyDeliveryReceipt(dc: DataConnect, vars: ClaimNotifyDeliveryReceiptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimNotifyDeliveryReceiptData>>;
/** Generated Node Admin SDK operation action function for the 'ClaimNotifyDeliveryReceipt' Mutation. Allow users to pass in custom DataConnect instances. */
export function claimNotifyDeliveryReceipt(vars: ClaimNotifyDeliveryReceiptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimNotifyDeliveryReceiptData>>;

/** Generated Node Admin SDK operation action function for the 'MarkNotifyDeliveryReceiptProcessed' Mutation. Allow users to execute without passing in DataConnect. */
export function markNotifyDeliveryReceiptProcessed(dc: DataConnect, vars: MarkNotifyDeliveryReceiptProcessedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkNotifyDeliveryReceiptProcessedData>>;
/** Generated Node Admin SDK operation action function for the 'MarkNotifyDeliveryReceiptProcessed' Mutation. Allow users to pass in custom DataConnect instances. */
export function markNotifyDeliveryReceiptProcessed(vars: MarkNotifyDeliveryReceiptProcessedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkNotifyDeliveryReceiptProcessedData>>;

/** Generated Node Admin SDK operation action function for the 'MarkNotifyDeliveryReceiptFailed' Mutation. Allow users to execute without passing in DataConnect. */
export function markNotifyDeliveryReceiptFailed(dc: DataConnect, vars: MarkNotifyDeliveryReceiptFailedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkNotifyDeliveryReceiptFailedData>>;
/** Generated Node Admin SDK operation action function for the 'MarkNotifyDeliveryReceiptFailed' Mutation. Allow users to pass in custom DataConnect instances. */
export function markNotifyDeliveryReceiptFailed(vars: MarkNotifyDeliveryReceiptFailedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkNotifyDeliveryReceiptFailedData>>;

/** Generated Node Admin SDK operation action function for the 'GetRecentNotifyDeliveryReceiptsForUser' Query. Allow users to execute without passing in DataConnect. */
export function getRecentNotifyDeliveryReceiptsForUser(dc: DataConnect, vars: GetRecentNotifyDeliveryReceiptsForUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetRecentNotifyDeliveryReceiptsForUserData>>;
/** Generated Node Admin SDK operation action function for the 'GetRecentNotifyDeliveryReceiptsForUser' Query. Allow users to pass in custom DataConnect instances. */
export function getRecentNotifyDeliveryReceiptsForUser(vars: GetRecentNotifyDeliveryReceiptsForUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetRecentNotifyDeliveryReceiptsForUserData>>;

/** Generated Node Admin SDK operation action function for the 'GetLatestNotifyDeliveryReceiptForReference' Query. Allow users to execute without passing in DataConnect. */
export function getLatestNotifyDeliveryReceiptForReference(dc: DataConnect, vars: GetLatestNotifyDeliveryReceiptForReferenceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLatestNotifyDeliveryReceiptForReferenceData>>;
/** Generated Node Admin SDK operation action function for the 'GetLatestNotifyDeliveryReceiptForReference' Query. Allow users to pass in custom DataConnect instances. */
export function getLatestNotifyDeliveryReceiptForReference(vars: GetLatestNotifyDeliveryReceiptForReferenceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLatestNotifyDeliveryReceiptForReferenceData>>;

/** Generated Node Admin SDK operation action function for the 'AdminOptOutSectionAnnouncement' Mutation. Allow users to execute without passing in DataConnect. */
export function adminOptOutSectionAnnouncement(dc: DataConnect, vars: AdminOptOutSectionAnnouncementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdminOptOutSectionAnnouncementData>>;
/** Generated Node Admin SDK operation action function for the 'AdminOptOutSectionAnnouncement' Mutation. Allow users to pass in custom DataConnect instances. */
export function adminOptOutSectionAnnouncement(vars: AdminOptOutSectionAnnouncementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdminOptOutSectionAnnouncementData>>;

/** Generated Node Admin SDK operation action function for the 'AdminOptInSectionAnnouncement' Mutation. Allow users to execute without passing in DataConnect. */
export function adminOptInSectionAnnouncement(dc: DataConnect, vars: AdminOptInSectionAnnouncementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdminOptInSectionAnnouncementData>>;
/** Generated Node Admin SDK operation action function for the 'AdminOptInSectionAnnouncement' Mutation. Allow users to pass in custom DataConnect instances. */
export function adminOptInSectionAnnouncement(vars: AdminOptInSectionAnnouncementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdminOptInSectionAnnouncementData>>;

/** Generated Node Admin SDK operation action function for the 'GetCallableInvocation' Query. Allow users to execute without passing in DataConnect. */
export function getCallableInvocation(dc: DataConnect, vars: GetCallableInvocationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCallableInvocationData>>;
/** Generated Node Admin SDK operation action function for the 'GetCallableInvocation' Query. Allow users to pass in custom DataConnect instances. */
export function getCallableInvocation(vars: GetCallableInvocationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCallableInvocationData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertCallableInvocation' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertCallableInvocation(dc: DataConnect, vars: UpsertCallableInvocationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertCallableInvocationData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertCallableInvocation' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertCallableInvocation(vars: UpsertCallableInvocationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertCallableInvocationData>>;

/** Generated Node Admin SDK operation action function for the 'EnsureCallableRateLimitBucket' Mutation. Allow users to execute without passing in DataConnect. */
export function ensureCallableRateLimitBucket(dc: DataConnect, vars: EnsureCallableRateLimitBucketVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<EnsureCallableRateLimitBucketData>>;
/** Generated Node Admin SDK operation action function for the 'EnsureCallableRateLimitBucket' Mutation. Allow users to pass in custom DataConnect instances. */
export function ensureCallableRateLimitBucket(vars: EnsureCallableRateLimitBucketVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<EnsureCallableRateLimitBucketData>>;

/** Generated Node Admin SDK operation action function for the 'ConsumeCallableRateLimit' Mutation. Allow users to execute without passing in DataConnect. */
export function consumeCallableRateLimit(dc: DataConnect, vars: ConsumeCallableRateLimitVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ConsumeCallableRateLimitData>>;
/** Generated Node Admin SDK operation action function for the 'ConsumeCallableRateLimit' Mutation. Allow users to pass in custom DataConnect instances. */
export function consumeCallableRateLimit(vars: ConsumeCallableRateLimitVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ConsumeCallableRateLimitData>>;

/** Generated Node Admin SDK operation action function for the 'AdminDeleteBookingLine' Mutation. Allow users to execute without passing in DataConnect. */
export function adminDeleteBookingLine(dc: DataConnect, vars: AdminDeleteBookingLineVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdminDeleteBookingLineData>>;
/** Generated Node Admin SDK operation action function for the 'AdminDeleteBookingLine' Mutation. Allow users to pass in custom DataConnect instances. */
export function adminDeleteBookingLine(vars: AdminDeleteBookingLineVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdminDeleteBookingLineData>>;

/** Generated Node Admin SDK operation action function for the 'AdminDeleteBooking' Mutation. Allow users to execute without passing in DataConnect. */
export function adminDeleteBooking(dc: DataConnect, vars: AdminDeleteBookingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdminDeleteBookingData>>;
/** Generated Node Admin SDK operation action function for the 'AdminDeleteBooking' Mutation. Allow users to pass in custom DataConnect instances. */
export function adminDeleteBooking(vars: AdminDeleteBookingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdminDeleteBookingData>>;

/** Generated Node Admin SDK operation action function for the 'ResolvePaymentReconciliationException' Mutation. Allow users to execute without passing in DataConnect. */
export function resolvePaymentReconciliationException(dc: DataConnect, vars: ResolvePaymentReconciliationExceptionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResolvePaymentReconciliationExceptionData>>;
/** Generated Node Admin SDK operation action function for the 'ResolvePaymentReconciliationException' Mutation. Allow users to pass in custom DataConnect instances. */
export function resolvePaymentReconciliationException(vars: ResolvePaymentReconciliationExceptionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResolvePaymentReconciliationExceptionData>>;

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

/** Generated Node Admin SDK operation action function for the 'GetMyBookingsForEvent' Query. Allow users to execute without passing in DataConnect. */
export function getMyBookingsForEvent(dc: DataConnect, vars: GetMyBookingsForEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyBookingsForEventData>>;
/** Generated Node Admin SDK operation action function for the 'GetMyBookingsForEvent' Query. Allow users to pass in custom DataConnect instances. */
export function getMyBookingsForEvent(vars: GetMyBookingsForEventVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyBookingsForEventData>>;

/** Generated Node Admin SDK operation action function for the 'GetMyBookings' Query. Allow users to execute without passing in DataConnect. */
export function getMyBookings(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyBookingsData>>;
/** Generated Node Admin SDK operation action function for the 'GetMyBookings' Query. Allow users to pass in custom DataConnect instances. */
export function getMyBookings(options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyBookingsData>>;

/** Generated Node Admin SDK operation action function for the 'GetMyTicketOrderById' Query. Allow users to execute without passing in DataConnect. */
export function getMyTicketOrderById(dc: DataConnect, vars: GetMyTicketOrderByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyTicketOrderByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetMyTicketOrderById' Query. Allow users to pass in custom DataConnect instances. */
export function getMyTicketOrderById(vars: GetMyTicketOrderByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyTicketOrderByIdData>>;

/** Generated Node Admin SDK operation action function for the 'GetMyTicketOrders' Query. Allow users to execute without passing in DataConnect. */
export function getMyTicketOrders(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyTicketOrdersData>>;
/** Generated Node Admin SDK operation action function for the 'GetMyTicketOrders' Query. Allow users to pass in custom DataConnect instances. */
export function getMyTicketOrders(options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyTicketOrdersData>>;

/** Generated Node Admin SDK operation action function for the 'GetMyBookingPaymentAdjustments' Query. Allow users to execute without passing in DataConnect. */
export function getMyBookingPaymentAdjustments(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyBookingPaymentAdjustmentsData>>;
/** Generated Node Admin SDK operation action function for the 'GetMyBookingPaymentAdjustments' Query. Allow users to pass in custom DataConnect instances. */
export function getMyBookingPaymentAdjustments(options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyBookingPaymentAdjustmentsData>>;

/** Generated Node Admin SDK operation action function for the 'ListEventBookingsForAdmin' Query. Allow users to execute without passing in DataConnect. */
export function listEventBookingsForAdmin(dc: DataConnect, vars: ListEventBookingsForAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListEventBookingsForAdminData>>;
/** Generated Node Admin SDK operation action function for the 'ListEventBookingsForAdmin' Query. Allow users to pass in custom DataConnect instances. */
export function listEventBookingsForAdmin(vars: ListEventBookingsForAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListEventBookingsForAdminData>>;

/** Generated Node Admin SDK operation action function for the 'ListTicketOrdersForAdmin' Query. Allow users to execute without passing in DataConnect. */
export function listTicketOrdersForAdmin(dc: DataConnect, vars: ListTicketOrdersForAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListTicketOrdersForAdminData>>;
/** Generated Node Admin SDK operation action function for the 'ListTicketOrdersForAdmin' Query. Allow users to pass in custom DataConnect instances. */
export function listTicketOrdersForAdmin(vars: ListTicketOrdersForAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListTicketOrdersForAdminData>>;

/** Generated Node Admin SDK operation action function for the 'ListBookingPaymentAdjustmentsForAdmin' Query. Allow users to execute without passing in DataConnect. */
export function listBookingPaymentAdjustmentsForAdmin(dc: DataConnect, vars: ListBookingPaymentAdjustmentsForAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListBookingPaymentAdjustmentsForAdminData>>;
/** Generated Node Admin SDK operation action function for the 'ListBookingPaymentAdjustmentsForAdmin' Query. Allow users to pass in custom DataConnect instances. */
export function listBookingPaymentAdjustmentsForAdmin(vars: ListBookingPaymentAdjustmentsForAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListBookingPaymentAdjustmentsForAdminData>>;

/** Generated Node Admin SDK operation action function for the 'ListOpenPaymentReconciliationExceptions' Query. Allow users to execute without passing in DataConnect. */
export function listOpenPaymentReconciliationExceptions(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListOpenPaymentReconciliationExceptionsData>>;
/** Generated Node Admin SDK operation action function for the 'ListOpenPaymentReconciliationExceptions' Query. Allow users to pass in custom DataConnect instances. */
export function listOpenPaymentReconciliationExceptions(options?: OperationOptions): Promise<ExecuteOperationResponse<ListOpenPaymentReconciliationExceptionsData>>;

/** Generated Node Admin SDK operation action function for the 'GetSectionAnnouncementOptOut' Query. Allow users to execute without passing in DataConnect. */
export function getSectionAnnouncementOptOut(dc: DataConnect, vars: GetSectionAnnouncementOptOutVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionAnnouncementOptOutData>>;
/** Generated Node Admin SDK operation action function for the 'GetSectionAnnouncementOptOut' Query. Allow users to pass in custom DataConnect instances. */
export function getSectionAnnouncementOptOut(vars: GetSectionAnnouncementOptOutVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSectionAnnouncementOptOutData>>;

/** Generated Node Admin SDK operation action function for the 'GetMyAnnouncementPreferences' Query. Allow users to execute without passing in DataConnect. */
export function getMyAnnouncementPreferences(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyAnnouncementPreferencesData>>;
/** Generated Node Admin SDK operation action function for the 'GetMyAnnouncementPreferences' Query. Allow users to pass in custom DataConnect instances. */
export function getMyAnnouncementPreferences(options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyAnnouncementPreferencesData>>;

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

/** Generated Node Admin SDK operation action function for the 'GrantUserGroupToSectionForPurpose' Mutation. Allow users to execute without passing in DataConnect. */
export function grantUserGroupToSectionForPurpose(dc: DataConnect, vars: GrantUserGroupToSectionForPurposeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GrantUserGroupToSectionForPurposeData>>;
/** Generated Node Admin SDK operation action function for the 'GrantUserGroupToSectionForPurpose' Mutation. Allow users to pass in custom DataConnect instances. */
export function grantUserGroupToSectionForPurpose(vars: GrantUserGroupToSectionForPurposeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GrantUserGroupToSectionForPurposeData>>;

/** Generated Node Admin SDK operation action function for the 'RevokeUserGroupFromSectionForPurpose' Mutation. Allow users to execute without passing in DataConnect. */
export function revokeUserGroupFromSectionForPurpose(dc: DataConnect, vars: RevokeUserGroupFromSectionForPurposeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RevokeUserGroupFromSectionForPurposeData>>;
/** Generated Node Admin SDK operation action function for the 'RevokeUserGroupFromSectionForPurpose' Mutation. Allow users to pass in custom DataConnect instances. */
export function revokeUserGroupFromSectionForPurpose(vars: RevokeUserGroupFromSectionForPurposeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RevokeUserGroupFromSectionForPurposeData>>;

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

/** Generated Node Admin SDK operation action function for the 'OptOutSectionAnnouncement' Mutation. Allow users to execute without passing in DataConnect. */
export function optOutSectionAnnouncement(dc: DataConnect, vars: OptOutSectionAnnouncementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<OptOutSectionAnnouncementData>>;
/** Generated Node Admin SDK operation action function for the 'OptOutSectionAnnouncement' Mutation. Allow users to pass in custom DataConnect instances. */
export function optOutSectionAnnouncement(vars: OptOutSectionAnnouncementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<OptOutSectionAnnouncementData>>;

/** Generated Node Admin SDK operation action function for the 'OptInSectionAnnouncement' Mutation. Allow users to execute without passing in DataConnect. */
export function optInSectionAnnouncement(dc: DataConnect, vars: OptInSectionAnnouncementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<OptInSectionAnnouncementData>>;
/** Generated Node Admin SDK operation action function for the 'OptInSectionAnnouncement' Mutation. Allow users to pass in custom DataConnect instances. */
export function optInSectionAnnouncement(vars: OptInSectionAnnouncementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<OptInSectionAnnouncementData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateAnnouncementOptOutAll' Mutation. Allow users to execute without passing in DataConnect. */
export function updateAnnouncementOptOutAll(dc: DataConnect, vars: UpdateAnnouncementOptOutAllVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAnnouncementOptOutAllData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateAnnouncementOptOutAll' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateAnnouncementOptOutAll(vars: UpdateAnnouncementOptOutAllVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAnnouncementOptOutAllData>>;

/** Generated Node Admin SDK operation action function for the 'ConfirmProfileReview' Mutation. Allow users to execute without passing in DataConnect. */
export function confirmProfileReview(dc: DataConnect, vars: ConfirmProfileReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ConfirmProfileReviewData>>;
/** Generated Node Admin SDK operation action function for the 'ConfirmProfileReview' Mutation. Allow users to pass in custom DataConnect instances. */
export function confirmProfileReview(vars: ConfirmProfileReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ConfirmProfileReviewData>>;

