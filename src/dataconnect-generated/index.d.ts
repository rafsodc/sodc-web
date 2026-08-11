import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

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
};

export enum BookingPaymentAdjustmentStatus {
  NOT_REQUIRED = "NOT_REQUIRED",
  PENDING_AUTO_REFUND = "PENDING_AUTO_REFUND",
  PENDING_AUTO_CHARGE = "PENDING_AUTO_CHARGE",
  SETTLED = "SETTLED",
};

export enum BookingStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
};

export enum GovNotifyDeliveryMode {
  SIMULATION = "SIMULATION",
  TEAM_TEST = "TEAM_TEST",
  LIVE = "LIVE",
};

export enum GuestTicketRequestStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
};

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
};

export enum NotificationChannel {
  EMAIL = "EMAIL",
  SMS = "SMS",
  PUSH = "PUSH",
};

export enum NotificationDeliveryStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
};

export enum NotifyDeliveryReceiptOutcome {
  APPLIED = "APPLIED",
  IGNORED_STATUS = "IGNORED_STATUS",
  IGNORED_NO_USER = "IGNORED_NO_USER",
  IGNORED_NO_RECIPIENT = "IGNORED_NO_RECIPIENT",
  NO_STATE_CHANGE = "NO_STATE_CHANGE",
};

export enum NotifyDeliveryReceiptProcessingStatus {
  PENDING = "PENDING",
  PROCESSED = "PROCESSED",
  FAILED = "FAILED",
};

export enum NotifyReplyToAuditAction {
  CREATED = "CREATED",
  UPDATED = "UPDATED",
  DISABLED = "DISABLED",
  PROVIDER_TEST_ACCEPTED = "PROVIDER_TEST_ACCEPTED",
  VERIFIED = "VERIFIED",
  DEFAULT_CHANGED = "DEFAULT_CHANGED",
  TEMPLATE_OVERRIDE_CHANGED = "TEMPLATE_OVERRIDE_CHANGED",
};

export enum NotifyReplyToVerificationStatus {
  UNVERIFIED = "UNVERIFIED",
  PROVIDER_ACCEPTED = "PROVIDER_ACCEPTED",
  VERIFIED = "VERIFIED",
};

export enum NotifyTemplateBindingAuditAction {
  CREATED = "CREATED",
  TEMPLATE_CHANGED = "TEMPLATE_CHANGED",
  VERSION_REVIEWED = "VERSION_REVIEWED",
};

export enum PaymentReconciliationExceptionStatus {
  OPEN = "OPEN",
  RESOLVED = "RESOLVED",
};

export enum PaymentReconciliationExceptionType {
  MISSING_PAYMENT_INTENT = "MISSING_PAYMENT_INTENT",
  REFUND_AMOUNT_MISMATCH = "REFUND_AMOUNT_MISMATCH",
  ACTIVE_DISPUTE = "ACTIVE_DISPUTE",
};

export enum PaymentWebhookEventOutcome {
  PROCESSED = "PROCESSED",
  IGNORED = "IGNORED",
  DUPLICATE = "DUPLICATE",
  FAILED = "FAILED",
};

export enum SectionFileStatus {
  PENDING = "PENDING",
  AVAILABLE = "AVAILABLE",
  REPLACING = "REPLACING",
  DELETING = "DELETING",
  DELETED = "DELETED",
};

export enum SectionType {
  MEMBERS = "MEMBERS",
  EVENTS = "EVENTS",
};

export enum SectionUserGroupPurpose {
  ACCESS = "ACCESS",
  MEMBER = "MEMBER",
  BOOKER = "BOOKER",
  MESSAGE = "MESSAGE",
  MODERATOR = "MODERATOR",
};

export enum TicketAudience {
  MEMBER = "MEMBER",
  GUEST = "GUEST",
};

export enum TicketOrderStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
};



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

export interface AddBookingLineData {
  bookingLine_insert: BookingLine_Key;
}

export interface AddBookingLineFromCallableData {
  bookingLine_insert: BookingLine_Key;
}

export interface AddBookingLineFromCallableVariables {
  bookingId: UUIDString;
  ticketTypeId: UUIDString;
  guestUserId?: string | null;
  guestDisplayName?: string | null;
  dietaryNote?: string | null;
  sortOrder: number;
}

export interface AddBookingLineVariables {
  bookingId: UUIDString;
  ticketTypeId: UUIDString;
  guestUserId?: string | null;
  guestDisplayName?: string | null;
  dietaryNote?: string | null;
  sortOrder: number;
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

export interface AdminDeleteGuestTicketRequestData {
  guestTicketRequest_delete?: GuestTicketRequest_Key | null;
}

export interface AdminDeleteGuestTicketRequestVariables {
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

export interface AdminReviewGuestTicketRequestData {
  guestTicketRequest_update?: GuestTicketRequest_Key | null;
}

export interface AdminReviewGuestTicketRequestFromCallableData {
  guestTicketRequest_update?: GuestTicketRequest_Key | null;
}

export interface AdminReviewGuestTicketRequestFromCallableVariables {
  id: UUIDString;
  status: GuestTicketRequestStatus;
  moderatorNote?: string | null;
  reviewedById: string;
}

export interface AdminReviewGuestTicketRequestVariables {
  id: UUIDString;
  status: GuestTicketRequestStatus;
  moderatorNote?: string | null;
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

export interface CreateBookingDraftData {
  booking_insert: Booking_Key;
}

export interface CreateBookingDraftForUserData {
  booking_insert: Booking_Key;
}

export interface CreateBookingDraftForUserVariables {
  eventId: UUIDString;
  bookerId: string;
  clientSubmissionKey: string;
}

export interface CreateBookingDraftRevisionForUserData {
  booking_insert: Booking_Key;
}

export interface CreateBookingDraftRevisionForUserVariables {
  eventId: UUIDString;
  bookerId: string;
  clientSubmissionKey: string;
  revisionGroupId: UUIDString;
  revisionNumber: number;
  supersedesBookingId: UUIDString;
}

export interface CreateBookingDraftVariables {
  eventId: UUIDString;
}

export interface CreateBookingPaymentAdjustmentFromCallableData {
  bookingPaymentAdjustment_upsert: BookingPaymentAdjustment_Key;
}

export interface CreateBookingPaymentAdjustmentFromCallableVariables {
  revisionBookingId: UUIDString;
  supersededBookingId: UUIDString;
  deltaAmountMinor: number;
  status: BookingPaymentAdjustmentStatus;
  orchestrationKey: string;
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

export interface CreateGuestTicketRequestData {
  guestTicketRequest_insert: GuestTicketRequest_Key;
}

export interface CreateGuestTicketRequestFromCallableData {
  guestTicketRequest_insert: GuestTicketRequest_Key;
}

export interface CreateGuestTicketRequestFromCallableVariables {
  id: UUIDString;
  bookingId: UUIDString;
  requestedGuestCount: number;
  guestTicketTypeId: UUIDString;
  guestDisplayName: string;
  dietaryNote?: string | null;
  status: GuestTicketRequestStatus;
  reviewedById?: string | null;
  reviewedAt?: TimestampString | null;
  moderatorNote?: string | null;
}

export interface CreateGuestTicketRequestVariables {
  bookingId: UUIDString;
  requestedGuestCount: number;
  guestTicketTypeId: UUIDString;
  guestDisplayName: string;
  dietaryNote?: string | null;
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

export interface DeleteBookingLineFromCallableData {
  bookingLine_delete?: BookingLine_Key | null;
}

export interface DeleteBookingLineFromCallableVariables {
  id: UUIDString;
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

export interface GetBookingForGuestTicketCallableData {
  booking?: {
    id: UUIDString;
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
      guestTicketRequests: ({
        status: GuestTicketRequestStatus;
        requestedGuestCount: number;
        guestDisplayName?: string | null;
        guestTicketType?: {
          id: UUIDString;
        } & TicketType_Key;
        reviewedBy?: {
          id: string;
        } & User_Key;
        reviewedAt?: TimestampString | null;
        moderatorNote?: string | null;
      })[];
    };
    guestTicketRequests: ({
      status: GuestTicketRequestStatus;
      requestedGuestCount: number;
      guestDisplayName?: string | null;
      guestTicketType?: {
        id: UUIDString;
      } & TicketType_Key;
    })[];
  } & Booking_Key;
}

export interface GetBookingForGuestTicketCallableVariables {
  bookingId: UUIDString;
}

export interface GetBookingForNotificationData {
  booking?: {
    id: UUIDString;
    revisionNumber: number;
    bookerDietaryNote?: string | null;
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

export interface GetBookingsForBookerAndEventData {
  user?: {
    id: string;
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
      bookerDietaryNote?: string | null;
      sitNextToUserIds?: string[] | null;
      accommodationRequested: boolean;
      accommodationNote?: string | null;
      createdAt: TimestampString;
      updatedAt: TimestampString;
      lines: ({
        id: UUIDString;
        bookingPlace?: {
          id: UUIDString;
          paymentAllocations: ({
            id: UUIDString;
            allocatedAmountMinor: number;
            refundedAmountMinor: number;
            stripeRefundId?: string | null;
            createdAt: TimestampString;
            ticketOrder: {
              id: UUIDString;
              status: TicketOrderStatus;
              stripePaymentIntentId?: string | null;
            } & TicketOrder_Key;
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
      guestTicketRequests: ({
        id: UUIDString;
        status: GuestTicketRequestStatus;
        requestedGuestCount: number;
        guestTicketType?: {
          id: UUIDString;
          title: string;
          price: number;
        } & TicketType_Key;
      } & GuestTicketRequest_Key)[];
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

export interface GetGuestTicketRequestByIdForCallableData {
  guestTicketRequest?: {
    id: UUIDString;
    status: GuestTicketRequestStatus;
    requestedGuestCount: number;
    guestDisplayName?: string | null;
    dietaryNote?: string | null;
    booking: {
      id: UUIDString;
    } & Booking_Key;
    guestTicketType?: {
      id: UUIDString;
    } & TicketType_Key;
  } & GuestTicketRequest_Key;
}

export interface GetGuestTicketRequestByIdForCallableVariables {
  id: UUIDString;
}

export interface GetGuestTicketRequestForNotificationData {
  guestTicketRequest?: {
    id: UUIDString;
    status: GuestTicketRequestStatus;
    requestedGuestCount: number;
    dietaryNote?: string | null;
    moderatorNote?: string | null;
    guestTicketType?: {
      id: UUIDString;
      title: string;
      price: number;
    } & TicketType_Key;
    booking: {
      id: UUIDString;
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
      guestTicketRequests: ({
        id: UUIDString;
        status: GuestTicketRequestStatus;
        requestedGuestCount: number;
        guestTicketType?: {
          price: number;
        };
      } & GuestTicketRequest_Key)[];
    } & Booking_Key;
  } & GuestTicketRequest_Key;
}

export interface GetGuestTicketRequestForNotificationVariables {
  id: UUIDString;
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
        bookingPlace?: {
          id: UUIDString;
        } & BookingPlace_Key;
        ticketType: {
          id: UUIDString;
          title: string;
          audience: TicketAudience;
          price: number;
        } & TicketType_Key;
      } & BookingLine_Key)[];
      guestTicketRequests: ({
        id: UUIDString;
        status: GuestTicketRequestStatus;
        requestedGuestCount: number;
        guestDisplayName?: string | null;
        guestTicketType?: {
          id: UUIDString;
          title: string;
          price: number;
        } & TicketType_Key;
      } & GuestTicketRequest_Key)[];
    } & Booking_Key)[];
  } & User_Key;
}

export interface GetMyBookingsForEventData {
  user?: {
    id: string;
    bookings: ({
      id: UUIDString;
      status: BookingStatus;
      approvalStatus: BookingApprovalStatus;
      approvalReviewedAt?: TimestampString | null;
      approvalNote?: string | null;
      revisionNumber: number;
      supersededAt?: TimestampString | null;
      clientSubmissionKey?: string | null;
      bookerDietaryNote?: string | null;
      sitNextToUserIds?: string[] | null;
      accommodationRequested: boolean;
      accommodationNote?: string | null;
      createdAt: TimestampString;
      updatedAt: TimestampString;
      lines: ({
        id: UUIDString;
        bookingPlace?: {
          id: UUIDString;
          paymentAllocations: ({
            id: UUIDString;
            refundedAmountMinor: number;
            ticketOrder: {
              id: UUIDString;
              status: TicketOrderStatus;
            } & TicketOrder_Key;
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
      guestTicketRequests: ({
        id: UUIDString;
        status: GuestTicketRequestStatus;
        requestedGuestCount: number;
        guestDisplayName?: string | null;
        dietaryNote?: string | null;
        guestTicketType?: {
          id: UUIDString;
          title: string;
          audience: TicketAudience;
          price: number;
        } & TicketType_Key;
        reviewedAt?: TimestampString | null;
        moderatorNote?: string | null;
      } & GuestTicketRequest_Key)[];
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

export interface GuestTicketRequest_Key {
  id: UUIDString;
  __typename?: 'GuestTicketRequest_Key';
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
      revisionNumber: number;
      supersedesBooking?: {
        id: UUIDString;
        revisionNumber: number;
      } & Booking_Key;
      clientSubmissionKey?: string | null;
      bookerDietaryNote?: string | null;
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
      guestTicketRequests: ({
        id: UUIDString;
        status: GuestTicketRequestStatus;
        requestedGuestCount: number;
        reviewedAt?: TimestampString | null;
        moderatorNote?: string | null;
        createdAt: TimestampString;
        updatedAt: TimestampString;
        createdBy?: string | null;
        updatedBy?: string | null;
        reviewedBy?: {
          id: string;
          firstName: string;
          lastName: string;
        } & User_Key;
      } & GuestTicketRequest_Key)[];
      lines: ({
        id: UUIDString;
        sortOrder: number;
        guestDisplayName?: string | null;
        dietaryNote?: string | null;
        guestUser?: {
          id: string;
          firstName: string;
          lastName: string;
        } & User_Key;
        ticketType: {
          id: UUIDString;
          title: string;
          audience: TicketAudience;
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

export interface ListGuestTicketRequestsForAdminData {
  event?: {
    id: UUIDString;
    title: string;
    bookings: ({
      id: UUIDString;
      status: BookingStatus;
      revisionNumber: number;
      revisionGroupId: UUIDString;
      supersededAt?: TimestampString | null;
      supersedesBooking?: {
        id: UUIDString;
        revisionNumber: number;
      } & Booking_Key;
      booker: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } & User_Key;
      guestTicketRequests: ({
        id: UUIDString;
        status: GuestTicketRequestStatus;
        requestedGuestCount: number;
        guestDisplayName?: string | null;
        dietaryNote?: string | null;
        moderatorNote?: string | null;
        createdAt: TimestampString;
        reviewedAt?: TimestampString | null;
        createdBy?: string | null;
        updatedAt: TimestampString;
        updatedBy?: string | null;
        reviewedBy?: {
          id: string;
          firstName: string;
          lastName: string;
          email: string;
        } & User_Key;
        guestTicketType?: {
          id: UUIDString;
          title: string;
          audience: TicketAudience;
          price: number;
        } & TicketType_Key;
      } & GuestTicketRequest_Key)[];
    } & Booking_Key)[];
  } & Event_Key;
}

export interface ListGuestTicketRequestsForAdminVariables {
  eventId: UUIDString;
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

export interface MarkBookingSupersededFromCallableData {
  booking_update?: Booking_Key | null;
}

export interface MarkBookingSupersededFromCallableVariables {
  id: UUIDString;
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
  booking_update?: Booking_Key | null;
}

export interface UpdateBookingApprovalFromCallableVariables {
  id: UUIDString;
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

export interface UpdateBookingPreferencesFromCallableData {
  booking_update?: Booking_Key | null;
}

export interface UpdateBookingPreferencesFromCallableVariables {
  id: UUIDString;
  sitNextToUserIds?: string[] | null;
  accommodationRequested: boolean;
  accommodationNote?: string | null;
}

export interface UpdateBookingStatusData {
  booking_update?: Booking_Key | null;
}

export interface UpdateBookingStatusFromCallableData {
  booking_update?: Booking_Key | null;
}

export interface UpdateBookingStatusFromCallableVariables {
  id: UUIDString;
  status: BookingStatus;
}

export interface UpdateBookingStatusVariables {
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

interface GetGovNotifyDeliveryConfigurationRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetGovNotifyDeliveryConfigurationData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetGovNotifyDeliveryConfigurationData, undefined>;
  operationName: string;
}
export const getGovNotifyDeliveryConfigurationRef: GetGovNotifyDeliveryConfigurationRef;

export function getGovNotifyDeliveryConfiguration(options?: ExecuteQueryOptions): QueryPromise<GetGovNotifyDeliveryConfigurationData, undefined>;
export function getGovNotifyDeliveryConfiguration(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetGovNotifyDeliveryConfigurationData, undefined>;

interface ListGovNotifyDeliveryModeAuditsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListGovNotifyDeliveryModeAuditsVariables): QueryRef<ListGovNotifyDeliveryModeAuditsData, ListGovNotifyDeliveryModeAuditsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListGovNotifyDeliveryModeAuditsVariables): QueryRef<ListGovNotifyDeliveryModeAuditsData, ListGovNotifyDeliveryModeAuditsVariables>;
  operationName: string;
}
export const listGovNotifyDeliveryModeAuditsRef: ListGovNotifyDeliveryModeAuditsRef;

export function listGovNotifyDeliveryModeAudits(vars: ListGovNotifyDeliveryModeAuditsVariables, options?: ExecuteQueryOptions): QueryPromise<ListGovNotifyDeliveryModeAuditsData, ListGovNotifyDeliveryModeAuditsVariables>;
export function listGovNotifyDeliveryModeAudits(dc: DataConnect, vars: ListGovNotifyDeliveryModeAuditsVariables, options?: ExecuteQueryOptions): QueryPromise<ListGovNotifyDeliveryModeAuditsData, ListGovNotifyDeliveryModeAuditsVariables>;

interface CreateGovNotifyDeliveryConfigurationRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<CreateGovNotifyDeliveryConfigurationData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<CreateGovNotifyDeliveryConfigurationData, undefined>;
  operationName: string;
}
export const createGovNotifyDeliveryConfigurationRef: CreateGovNotifyDeliveryConfigurationRef;

export function createGovNotifyDeliveryConfiguration(): MutationPromise<CreateGovNotifyDeliveryConfigurationData, undefined>;
export function createGovNotifyDeliveryConfiguration(dc: DataConnect): MutationPromise<CreateGovNotifyDeliveryConfigurationData, undefined>;

interface ChangeGovNotifyDeliveryModeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ChangeGovNotifyDeliveryModeVariables): MutationRef<ChangeGovNotifyDeliveryModeData, ChangeGovNotifyDeliveryModeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ChangeGovNotifyDeliveryModeVariables): MutationRef<ChangeGovNotifyDeliveryModeData, ChangeGovNotifyDeliveryModeVariables>;
  operationName: string;
}
export const changeGovNotifyDeliveryModeRef: ChangeGovNotifyDeliveryModeRef;

export function changeGovNotifyDeliveryMode(vars: ChangeGovNotifyDeliveryModeVariables): MutationPromise<ChangeGovNotifyDeliveryModeData, ChangeGovNotifyDeliveryModeVariables>;
export function changeGovNotifyDeliveryMode(dc: DataConnect, vars: ChangeGovNotifyDeliveryModeVariables): MutationPromise<ChangeGovNotifyDeliveryModeData, ChangeGovNotifyDeliveryModeVariables>;

interface GetNotifyReplyToConfigurationRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetNotifyReplyToConfigurationData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetNotifyReplyToConfigurationData, undefined>;
  operationName: string;
}
export const getNotifyReplyToConfigurationRef: GetNotifyReplyToConfigurationRef;

export function getNotifyReplyToConfiguration(options?: ExecuteQueryOptions): QueryPromise<GetNotifyReplyToConfigurationData, undefined>;
export function getNotifyReplyToConfiguration(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetNotifyReplyToConfigurationData, undefined>;

interface ListNotifyReplyToAuditsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListNotifyReplyToAuditsVariables): QueryRef<ListNotifyReplyToAuditsData, ListNotifyReplyToAuditsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListNotifyReplyToAuditsVariables): QueryRef<ListNotifyReplyToAuditsData, ListNotifyReplyToAuditsVariables>;
  operationName: string;
}
export const listNotifyReplyToAuditsRef: ListNotifyReplyToAuditsRef;

export function listNotifyReplyToAudits(vars: ListNotifyReplyToAuditsVariables, options?: ExecuteQueryOptions): QueryPromise<ListNotifyReplyToAuditsData, ListNotifyReplyToAuditsVariables>;
export function listNotifyReplyToAudits(dc: DataConnect, vars: ListNotifyReplyToAuditsVariables, options?: ExecuteQueryOptions): QueryPromise<ListNotifyReplyToAuditsData, ListNotifyReplyToAuditsVariables>;

interface CreateNotifyEmailConfigurationRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<CreateNotifyEmailConfigurationData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<CreateNotifyEmailConfigurationData, undefined>;
  operationName: string;
}
export const createNotifyEmailConfigurationRef: CreateNotifyEmailConfigurationRef;

export function createNotifyEmailConfiguration(): MutationPromise<CreateNotifyEmailConfigurationData, undefined>;
export function createNotifyEmailConfiguration(dc: DataConnect): MutationPromise<CreateNotifyEmailConfigurationData, undefined>;

interface CreateNotifyReplyToAddressRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNotifyReplyToAddressVariables): MutationRef<CreateNotifyReplyToAddressData, CreateNotifyReplyToAddressVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateNotifyReplyToAddressVariables): MutationRef<CreateNotifyReplyToAddressData, CreateNotifyReplyToAddressVariables>;
  operationName: string;
}
export const createNotifyReplyToAddressRef: CreateNotifyReplyToAddressRef;

export function createNotifyReplyToAddress(vars: CreateNotifyReplyToAddressVariables): MutationPromise<CreateNotifyReplyToAddressData, CreateNotifyReplyToAddressVariables>;
export function createNotifyReplyToAddress(dc: DataConnect, vars: CreateNotifyReplyToAddressVariables): MutationPromise<CreateNotifyReplyToAddressData, CreateNotifyReplyToAddressVariables>;

interface UpdateNotifyReplyToAddressIdentityRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateNotifyReplyToAddressIdentityVariables): MutationRef<UpdateNotifyReplyToAddressIdentityData, UpdateNotifyReplyToAddressIdentityVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateNotifyReplyToAddressIdentityVariables): MutationRef<UpdateNotifyReplyToAddressIdentityData, UpdateNotifyReplyToAddressIdentityVariables>;
  operationName: string;
}
export const updateNotifyReplyToAddressIdentityRef: UpdateNotifyReplyToAddressIdentityRef;

export function updateNotifyReplyToAddressIdentity(vars: UpdateNotifyReplyToAddressIdentityVariables): MutationPromise<UpdateNotifyReplyToAddressIdentityData, UpdateNotifyReplyToAddressIdentityVariables>;
export function updateNotifyReplyToAddressIdentity(dc: DataConnect, vars: UpdateNotifyReplyToAddressIdentityVariables): MutationPromise<UpdateNotifyReplyToAddressIdentityData, UpdateNotifyReplyToAddressIdentityVariables>;

interface RecordNotifyReplyToProviderAcceptanceRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RecordNotifyReplyToProviderAcceptanceVariables): MutationRef<RecordNotifyReplyToProviderAcceptanceData, RecordNotifyReplyToProviderAcceptanceVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RecordNotifyReplyToProviderAcceptanceVariables): MutationRef<RecordNotifyReplyToProviderAcceptanceData, RecordNotifyReplyToProviderAcceptanceVariables>;
  operationName: string;
}
export const recordNotifyReplyToProviderAcceptanceRef: RecordNotifyReplyToProviderAcceptanceRef;

export function recordNotifyReplyToProviderAcceptance(vars: RecordNotifyReplyToProviderAcceptanceVariables): MutationPromise<RecordNotifyReplyToProviderAcceptanceData, RecordNotifyReplyToProviderAcceptanceVariables>;
export function recordNotifyReplyToProviderAcceptance(dc: DataConnect, vars: RecordNotifyReplyToProviderAcceptanceVariables): MutationPromise<RecordNotifyReplyToProviderAcceptanceData, RecordNotifyReplyToProviderAcceptanceVariables>;

interface ConfirmNotifyReplyToVerificationRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ConfirmNotifyReplyToVerificationVariables): MutationRef<ConfirmNotifyReplyToVerificationData, ConfirmNotifyReplyToVerificationVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ConfirmNotifyReplyToVerificationVariables): MutationRef<ConfirmNotifyReplyToVerificationData, ConfirmNotifyReplyToVerificationVariables>;
  operationName: string;
}
export const confirmNotifyReplyToVerificationRef: ConfirmNotifyReplyToVerificationRef;

export function confirmNotifyReplyToVerification(vars: ConfirmNotifyReplyToVerificationVariables): MutationPromise<ConfirmNotifyReplyToVerificationData, ConfirmNotifyReplyToVerificationVariables>;
export function confirmNotifyReplyToVerification(dc: DataConnect, vars: ConfirmNotifyReplyToVerificationVariables): MutationPromise<ConfirmNotifyReplyToVerificationData, ConfirmNotifyReplyToVerificationVariables>;

interface UpdateNotifyReplyToAvailabilityRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateNotifyReplyToAvailabilityVariables): MutationRef<UpdateNotifyReplyToAvailabilityData, UpdateNotifyReplyToAvailabilityVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateNotifyReplyToAvailabilityVariables): MutationRef<UpdateNotifyReplyToAvailabilityData, UpdateNotifyReplyToAvailabilityVariables>;
  operationName: string;
}
export const updateNotifyReplyToAvailabilityRef: UpdateNotifyReplyToAvailabilityRef;

export function updateNotifyReplyToAvailability(vars: UpdateNotifyReplyToAvailabilityVariables): MutationPromise<UpdateNotifyReplyToAvailabilityData, UpdateNotifyReplyToAvailabilityVariables>;
export function updateNotifyReplyToAvailability(dc: DataConnect, vars: UpdateNotifyReplyToAvailabilityVariables): MutationPromise<UpdateNotifyReplyToAvailabilityData, UpdateNotifyReplyToAvailabilityVariables>;

interface ChangeNotifyReplyToDefaultRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ChangeNotifyReplyToDefaultVariables): MutationRef<ChangeNotifyReplyToDefaultData, ChangeNotifyReplyToDefaultVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ChangeNotifyReplyToDefaultVariables): MutationRef<ChangeNotifyReplyToDefaultData, ChangeNotifyReplyToDefaultVariables>;
  operationName: string;
}
export const changeNotifyReplyToDefaultRef: ChangeNotifyReplyToDefaultRef;

export function changeNotifyReplyToDefault(vars: ChangeNotifyReplyToDefaultVariables): MutationPromise<ChangeNotifyReplyToDefaultData, ChangeNotifyReplyToDefaultVariables>;
export function changeNotifyReplyToDefault(dc: DataConnect, vars: ChangeNotifyReplyToDefaultVariables): MutationPromise<ChangeNotifyReplyToDefaultData, ChangeNotifyReplyToDefaultVariables>;

interface DisableDefaultNotifyReplyToAddressRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DisableDefaultNotifyReplyToAddressVariables): MutationRef<DisableDefaultNotifyReplyToAddressData, DisableDefaultNotifyReplyToAddressVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DisableDefaultNotifyReplyToAddressVariables): MutationRef<DisableDefaultNotifyReplyToAddressData, DisableDefaultNotifyReplyToAddressVariables>;
  operationName: string;
}
export const disableDefaultNotifyReplyToAddressRef: DisableDefaultNotifyReplyToAddressRef;

export function disableDefaultNotifyReplyToAddress(vars: DisableDefaultNotifyReplyToAddressVariables): MutationPromise<DisableDefaultNotifyReplyToAddressData, DisableDefaultNotifyReplyToAddressVariables>;
export function disableDefaultNotifyReplyToAddress(dc: DataConnect, vars: DisableDefaultNotifyReplyToAddressVariables): MutationPromise<DisableDefaultNotifyReplyToAddressData, DisableDefaultNotifyReplyToAddressVariables>;

interface SetNotifyTemplateReplyToOverrideRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SetNotifyTemplateReplyToOverrideVariables): MutationRef<SetNotifyTemplateReplyToOverrideData, SetNotifyTemplateReplyToOverrideVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SetNotifyTemplateReplyToOverrideVariables): MutationRef<SetNotifyTemplateReplyToOverrideData, SetNotifyTemplateReplyToOverrideVariables>;
  operationName: string;
}
export const setNotifyTemplateReplyToOverrideRef: SetNotifyTemplateReplyToOverrideRef;

export function setNotifyTemplateReplyToOverride(vars: SetNotifyTemplateReplyToOverrideVariables): MutationPromise<SetNotifyTemplateReplyToOverrideData, SetNotifyTemplateReplyToOverrideVariables>;
export function setNotifyTemplateReplyToOverride(dc: DataConnect, vars: SetNotifyTemplateReplyToOverrideVariables): MutationPromise<SetNotifyTemplateReplyToOverrideData, SetNotifyTemplateReplyToOverrideVariables>;

interface ClearNotifyTemplateReplyToOverrideRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ClearNotifyTemplateReplyToOverrideVariables): MutationRef<ClearNotifyTemplateReplyToOverrideData, ClearNotifyTemplateReplyToOverrideVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ClearNotifyTemplateReplyToOverrideVariables): MutationRef<ClearNotifyTemplateReplyToOverrideData, ClearNotifyTemplateReplyToOverrideVariables>;
  operationName: string;
}
export const clearNotifyTemplateReplyToOverrideRef: ClearNotifyTemplateReplyToOverrideRef;

export function clearNotifyTemplateReplyToOverride(vars: ClearNotifyTemplateReplyToOverrideVariables): MutationPromise<ClearNotifyTemplateReplyToOverrideData, ClearNotifyTemplateReplyToOverrideVariables>;
export function clearNotifyTemplateReplyToOverride(dc: DataConnect, vars: ClearNotifyTemplateReplyToOverrideVariables): MutationPromise<ClearNotifyTemplateReplyToOverrideData, ClearNotifyTemplateReplyToOverrideVariables>;

interface GetNotifyTemplateBindingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetNotifyTemplateBindingsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetNotifyTemplateBindingsData, undefined>;
  operationName: string;
}
export const getNotifyTemplateBindingsRef: GetNotifyTemplateBindingsRef;

export function getNotifyTemplateBindings(options?: ExecuteQueryOptions): QueryPromise<GetNotifyTemplateBindingsData, undefined>;
export function getNotifyTemplateBindings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetNotifyTemplateBindingsData, undefined>;

interface ListNotifyTemplateBindingAuditsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListNotifyTemplateBindingAuditsVariables): QueryRef<ListNotifyTemplateBindingAuditsData, ListNotifyTemplateBindingAuditsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListNotifyTemplateBindingAuditsVariables): QueryRef<ListNotifyTemplateBindingAuditsData, ListNotifyTemplateBindingAuditsVariables>;
  operationName: string;
}
export const listNotifyTemplateBindingAuditsRef: ListNotifyTemplateBindingAuditsRef;

export function listNotifyTemplateBindingAudits(vars: ListNotifyTemplateBindingAuditsVariables, options?: ExecuteQueryOptions): QueryPromise<ListNotifyTemplateBindingAuditsData, ListNotifyTemplateBindingAuditsVariables>;
export function listNotifyTemplateBindingAudits(dc: DataConnect, vars: ListNotifyTemplateBindingAuditsVariables, options?: ExecuteQueryOptions): QueryPromise<ListNotifyTemplateBindingAuditsData, ListNotifyTemplateBindingAuditsVariables>;

interface UpsertNotifyTemplateBindingRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertNotifyTemplateBindingVariables): MutationRef<UpsertNotifyTemplateBindingData, UpsertNotifyTemplateBindingVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertNotifyTemplateBindingVariables): MutationRef<UpsertNotifyTemplateBindingData, UpsertNotifyTemplateBindingVariables>;
  operationName: string;
}
export const upsertNotifyTemplateBindingRef: UpsertNotifyTemplateBindingRef;

export function upsertNotifyTemplateBinding(vars: UpsertNotifyTemplateBindingVariables): MutationPromise<UpsertNotifyTemplateBindingData, UpsertNotifyTemplateBindingVariables>;
export function upsertNotifyTemplateBinding(dc: DataConnect, vars: UpsertNotifyTemplateBindingVariables): MutationPromise<UpsertNotifyTemplateBindingData, UpsertNotifyTemplateBindingVariables>;

interface CreatePendingSectionFileRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePendingSectionFileVariables): MutationRef<CreatePendingSectionFileData, CreatePendingSectionFileVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreatePendingSectionFileVariables): MutationRef<CreatePendingSectionFileData, CreatePendingSectionFileVariables>;
  operationName: string;
}
export const createPendingSectionFileRef: CreatePendingSectionFileRef;

export function createPendingSectionFile(vars: CreatePendingSectionFileVariables): MutationPromise<CreatePendingSectionFileData, CreatePendingSectionFileVariables>;
export function createPendingSectionFile(dc: DataConnect, vars: CreatePendingSectionFileVariables): MutationPromise<CreatePendingSectionFileData, CreatePendingSectionFileVariables>;

interface GetSectionFileByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionFileByIdVariables): QueryRef<GetSectionFileByIdData, GetSectionFileByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSectionFileByIdVariables): QueryRef<GetSectionFileByIdData, GetSectionFileByIdVariables>;
  operationName: string;
}
export const getSectionFileByIdRef: GetSectionFileByIdRef;

export function getSectionFileById(vars: GetSectionFileByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionFileByIdData, GetSectionFileByIdVariables>;
export function getSectionFileById(dc: DataConnect, vars: GetSectionFileByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionFileByIdData, GetSectionFileByIdVariables>;

interface ListSectionFilesByStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListSectionFilesByStatusVariables): QueryRef<ListSectionFilesByStatusData, ListSectionFilesByStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListSectionFilesByStatusVariables): QueryRef<ListSectionFilesByStatusData, ListSectionFilesByStatusVariables>;
  operationName: string;
}
export const listSectionFilesByStatusRef: ListSectionFilesByStatusRef;

export function listSectionFilesByStatus(vars: ListSectionFilesByStatusVariables, options?: ExecuteQueryOptions): QueryPromise<ListSectionFilesByStatusData, ListSectionFilesByStatusVariables>;
export function listSectionFilesByStatus(dc: DataConnect, vars: ListSectionFilesByStatusVariables, options?: ExecuteQueryOptions): QueryPromise<ListSectionFilesByStatusData, ListSectionFilesByStatusVariables>;

interface ListStaleSectionFilesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStaleSectionFilesVariables): QueryRef<ListStaleSectionFilesData, ListStaleSectionFilesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListStaleSectionFilesVariables): QueryRef<ListStaleSectionFilesData, ListStaleSectionFilesVariables>;
  operationName: string;
}
export const listStaleSectionFilesRef: ListStaleSectionFilesRef;

export function listStaleSectionFiles(vars: ListStaleSectionFilesVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaleSectionFilesData, ListStaleSectionFilesVariables>;
export function listStaleSectionFiles(dc: DataConnect, vars: ListStaleSectionFilesVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaleSectionFilesData, ListStaleSectionFilesVariables>;

interface ListSectionFilesForQuotaRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListSectionFilesForQuotaVariables): QueryRef<ListSectionFilesForQuotaData, ListSectionFilesForQuotaVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListSectionFilesForQuotaVariables): QueryRef<ListSectionFilesForQuotaData, ListSectionFilesForQuotaVariables>;
  operationName: string;
}
export const listSectionFilesForQuotaRef: ListSectionFilesForQuotaRef;

export function listSectionFilesForQuota(vars: ListSectionFilesForQuotaVariables, options?: ExecuteQueryOptions): QueryPromise<ListSectionFilesForQuotaData, ListSectionFilesForQuotaVariables>;
export function listSectionFilesForQuota(dc: DataConnect, vars: ListSectionFilesForQuotaVariables, options?: ExecuteQueryOptions): QueryPromise<ListSectionFilesForQuotaData, ListSectionFilesForQuotaVariables>;

interface RecordSectionFileAuditRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RecordSectionFileAuditVariables): MutationRef<RecordSectionFileAuditData, RecordSectionFileAuditVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RecordSectionFileAuditVariables): MutationRef<RecordSectionFileAuditData, RecordSectionFileAuditVariables>;
  operationName: string;
}
export const recordSectionFileAuditRef: RecordSectionFileAuditRef;

export function recordSectionFileAudit(vars: RecordSectionFileAuditVariables): MutationPromise<RecordSectionFileAuditData, RecordSectionFileAuditVariables>;
export function recordSectionFileAudit(dc: DataConnect, vars: RecordSectionFileAuditVariables): MutationPromise<RecordSectionFileAuditData, RecordSectionFileAuditVariables>;

interface AbandonPendingSectionFileRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AbandonPendingSectionFileVariables): MutationRef<AbandonPendingSectionFileData, AbandonPendingSectionFileVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AbandonPendingSectionFileVariables): MutationRef<AbandonPendingSectionFileData, AbandonPendingSectionFileVariables>;
  operationName: string;
}
export const abandonPendingSectionFileRef: AbandonPendingSectionFileRef;

export function abandonPendingSectionFile(vars: AbandonPendingSectionFileVariables): MutationPromise<AbandonPendingSectionFileData, AbandonPendingSectionFileVariables>;
export function abandonPendingSectionFile(dc: DataConnect, vars: AbandonPendingSectionFileVariables): MutationPromise<AbandonPendingSectionFileData, AbandonPendingSectionFileVariables>;

interface FinalizePendingSectionFileRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: FinalizePendingSectionFileVariables): MutationRef<FinalizePendingSectionFileData, FinalizePendingSectionFileVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: FinalizePendingSectionFileVariables): MutationRef<FinalizePendingSectionFileData, FinalizePendingSectionFileVariables>;
  operationName: string;
}
export const finalizePendingSectionFileRef: FinalizePendingSectionFileRef;

export function finalizePendingSectionFile(vars: FinalizePendingSectionFileVariables): MutationPromise<FinalizePendingSectionFileData, FinalizePendingSectionFileVariables>;
export function finalizePendingSectionFile(dc: DataConnect, vars: FinalizePendingSectionFileVariables): MutationPromise<FinalizePendingSectionFileData, FinalizePendingSectionFileVariables>;

interface UpdateAvailableSectionFileMetadataRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAvailableSectionFileMetadataVariables): MutationRef<UpdateAvailableSectionFileMetadataData, UpdateAvailableSectionFileMetadataVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateAvailableSectionFileMetadataVariables): MutationRef<UpdateAvailableSectionFileMetadataData, UpdateAvailableSectionFileMetadataVariables>;
  operationName: string;
}
export const updateAvailableSectionFileMetadataRef: UpdateAvailableSectionFileMetadataRef;

export function updateAvailableSectionFileMetadata(vars: UpdateAvailableSectionFileMetadataVariables): MutationPromise<UpdateAvailableSectionFileMetadataData, UpdateAvailableSectionFileMetadataVariables>;
export function updateAvailableSectionFileMetadata(dc: DataConnect, vars: UpdateAvailableSectionFileMetadataVariables): MutationPromise<UpdateAvailableSectionFileMetadataData, UpdateAvailableSectionFileMetadataVariables>;

interface BeginSectionFileReplacementRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: BeginSectionFileReplacementVariables): MutationRef<BeginSectionFileReplacementData, BeginSectionFileReplacementVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: BeginSectionFileReplacementVariables): MutationRef<BeginSectionFileReplacementData, BeginSectionFileReplacementVariables>;
  operationName: string;
}
export const beginSectionFileReplacementRef: BeginSectionFileReplacementRef;

export function beginSectionFileReplacement(vars: BeginSectionFileReplacementVariables): MutationPromise<BeginSectionFileReplacementData, BeginSectionFileReplacementVariables>;
export function beginSectionFileReplacement(dc: DataConnect, vars: BeginSectionFileReplacementVariables): MutationPromise<BeginSectionFileReplacementData, BeginSectionFileReplacementVariables>;

interface FinalizeSectionFileReplacementRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: FinalizeSectionFileReplacementVariables): MutationRef<FinalizeSectionFileReplacementData, FinalizeSectionFileReplacementVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: FinalizeSectionFileReplacementVariables): MutationRef<FinalizeSectionFileReplacementData, FinalizeSectionFileReplacementVariables>;
  operationName: string;
}
export const finalizeSectionFileReplacementRef: FinalizeSectionFileReplacementRef;

export function finalizeSectionFileReplacement(vars: FinalizeSectionFileReplacementVariables): MutationPromise<FinalizeSectionFileReplacementData, FinalizeSectionFileReplacementVariables>;
export function finalizeSectionFileReplacement(dc: DataConnect, vars: FinalizeSectionFileReplacementVariables): MutationPromise<FinalizeSectionFileReplacementData, FinalizeSectionFileReplacementVariables>;

interface AbortSectionFileReplacementRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AbortSectionFileReplacementVariables): MutationRef<AbortSectionFileReplacementData, AbortSectionFileReplacementVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AbortSectionFileReplacementVariables): MutationRef<AbortSectionFileReplacementData, AbortSectionFileReplacementVariables>;
  operationName: string;
}
export const abortSectionFileReplacementRef: AbortSectionFileReplacementRef;

export function abortSectionFileReplacement(vars: AbortSectionFileReplacementVariables): MutationPromise<AbortSectionFileReplacementData, AbortSectionFileReplacementVariables>;
export function abortSectionFileReplacement(dc: DataConnect, vars: AbortSectionFileReplacementVariables): MutationPromise<AbortSectionFileReplacementData, AbortSectionFileReplacementVariables>;

interface BeginSectionFileDeletionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: BeginSectionFileDeletionVariables): MutationRef<BeginSectionFileDeletionData, BeginSectionFileDeletionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: BeginSectionFileDeletionVariables): MutationRef<BeginSectionFileDeletionData, BeginSectionFileDeletionVariables>;
  operationName: string;
}
export const beginSectionFileDeletionRef: BeginSectionFileDeletionRef;

export function beginSectionFileDeletion(vars: BeginSectionFileDeletionVariables): MutationPromise<BeginSectionFileDeletionData, BeginSectionFileDeletionVariables>;
export function beginSectionFileDeletion(dc: DataConnect, vars: BeginSectionFileDeletionVariables): MutationPromise<BeginSectionFileDeletionData, BeginSectionFileDeletionVariables>;

interface MarkSectionFileDeletedRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkSectionFileDeletedVariables): MutationRef<MarkSectionFileDeletedData, MarkSectionFileDeletedVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MarkSectionFileDeletedVariables): MutationRef<MarkSectionFileDeletedData, MarkSectionFileDeletedVariables>;
  operationName: string;
}
export const markSectionFileDeletedRef: MarkSectionFileDeletedRef;

export function markSectionFileDeleted(vars: MarkSectionFileDeletedVariables): MutationPromise<MarkSectionFileDeletedData, MarkSectionFileDeletedVariables>;
export function markSectionFileDeleted(dc: DataConnect, vars: MarkSectionFileDeletedVariables): MutationPromise<MarkSectionFileDeletedData, MarkSectionFileDeletedVariables>;

interface UpdateUserMembershipStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserMembershipStatusVariables): MutationRef<UpdateUserMembershipStatusData, UpdateUserMembershipStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateUserMembershipStatusVariables): MutationRef<UpdateUserMembershipStatusData, UpdateUserMembershipStatusVariables>;
  operationName: string;
}
export const updateUserMembershipStatusRef: UpdateUserMembershipStatusRef;

export function updateUserMembershipStatus(vars: UpdateUserMembershipStatusVariables): MutationPromise<UpdateUserMembershipStatusData, UpdateUserMembershipStatusVariables>;
export function updateUserMembershipStatus(dc: DataConnect, vars: UpdateUserMembershipStatusVariables): MutationPromise<UpdateUserMembershipStatusData, UpdateUserMembershipStatusVariables>;

interface UpdateUserEmailFromAuthRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserEmailFromAuthVariables): MutationRef<UpdateUserEmailFromAuthData, UpdateUserEmailFromAuthVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateUserEmailFromAuthVariables): MutationRef<UpdateUserEmailFromAuthData, UpdateUserEmailFromAuthVariables>;
  operationName: string;
}
export const updateUserEmailFromAuthRef: UpdateUserEmailFromAuthRef;

export function updateUserEmailFromAuth(vars: UpdateUserEmailFromAuthVariables): MutationPromise<UpdateUserEmailFromAuthData, UpdateUserEmailFromAuthVariables>;
export function updateUserEmailFromAuth(dc: DataConnect, vars: UpdateUserEmailFromAuthVariables): MutationPromise<UpdateUserEmailFromAuthData, UpdateUserEmailFromAuthVariables>;

interface DeleteUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteUserVariables): MutationRef<DeleteUserData, DeleteUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteUserVariables): MutationRef<DeleteUserData, DeleteUserVariables>;
  operationName: string;
}
export const deleteUserRef: DeleteUserRef;

export function deleteUser(vars: DeleteUserVariables): MutationPromise<DeleteUserData, DeleteUserVariables>;
export function deleteUser(dc: DataConnect, vars: DeleteUserVariables): MutationPromise<DeleteUserData, DeleteUserVariables>;

interface CreateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  operationName: string;
}
export const createUserRef: CreateUserRef;

export function createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;
export function createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateMigratedUserProfileAndIdentityRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateMigratedUserProfileAndIdentityVariables): MutationRef<CreateMigratedUserProfileAndIdentityData, CreateMigratedUserProfileAndIdentityVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateMigratedUserProfileAndIdentityVariables): MutationRef<CreateMigratedUserProfileAndIdentityData, CreateMigratedUserProfileAndIdentityVariables>;
  operationName: string;
}
export const createMigratedUserProfileAndIdentityRef: CreateMigratedUserProfileAndIdentityRef;

export function createMigratedUserProfileAndIdentity(vars: CreateMigratedUserProfileAndIdentityVariables): MutationPromise<CreateMigratedUserProfileAndIdentityData, CreateMigratedUserProfileAndIdentityVariables>;
export function createMigratedUserProfileAndIdentity(dc: DataConnect, vars: CreateMigratedUserProfileAndIdentityVariables): MutationPromise<CreateMigratedUserProfileAndIdentityData, CreateMigratedUserProfileAndIdentityVariables>;

interface LinkLegacyIdentityToExistingUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: LinkLegacyIdentityToExistingUserVariables): MutationRef<LinkLegacyIdentityToExistingUserData, LinkLegacyIdentityToExistingUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: LinkLegacyIdentityToExistingUserVariables): MutationRef<LinkLegacyIdentityToExistingUserData, LinkLegacyIdentityToExistingUserVariables>;
  operationName: string;
}
export const linkLegacyIdentityToExistingUserRef: LinkLegacyIdentityToExistingUserRef;

export function linkLegacyIdentityToExistingUser(vars: LinkLegacyIdentityToExistingUserVariables): MutationPromise<LinkLegacyIdentityToExistingUserData, LinkLegacyIdentityToExistingUserVariables>;
export function linkLegacyIdentityToExistingUser(dc: DataConnect, vars: LinkLegacyIdentityToExistingUserVariables): MutationPromise<LinkLegacyIdentityToExistingUserData, LinkLegacyIdentityToExistingUserVariables>;

interface GetLegacyUserIdentityRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetLegacyUserIdentityVariables): QueryRef<GetLegacyUserIdentityData, GetLegacyUserIdentityVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetLegacyUserIdentityVariables): QueryRef<GetLegacyUserIdentityData, GetLegacyUserIdentityVariables>;
  operationName: string;
}
export const getLegacyUserIdentityRef: GetLegacyUserIdentityRef;

export function getLegacyUserIdentity(vars: GetLegacyUserIdentityVariables, options?: ExecuteQueryOptions): QueryPromise<GetLegacyUserIdentityData, GetLegacyUserIdentityVariables>;
export function getLegacyUserIdentity(dc: DataConnect, vars: GetLegacyUserIdentityVariables, options?: ExecuteQueryOptions): QueryPromise<GetLegacyUserIdentityData, GetLegacyUserIdentityVariables>;

interface ListLegacyUserIdentitiesByBatchRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListLegacyUserIdentitiesByBatchVariables): QueryRef<ListLegacyUserIdentitiesByBatchData, ListLegacyUserIdentitiesByBatchVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListLegacyUserIdentitiesByBatchVariables): QueryRef<ListLegacyUserIdentitiesByBatchData, ListLegacyUserIdentitiesByBatchVariables>;
  operationName: string;
}
export const listLegacyUserIdentitiesByBatchRef: ListLegacyUserIdentitiesByBatchRef;

export function listLegacyUserIdentitiesByBatch(vars: ListLegacyUserIdentitiesByBatchVariables, options?: ExecuteQueryOptions): QueryPromise<ListLegacyUserIdentitiesByBatchData, ListLegacyUserIdentitiesByBatchVariables>;
export function listLegacyUserIdentitiesByBatch(dc: DataConnect, vars: ListLegacyUserIdentitiesByBatchVariables, options?: ExecuteQueryOptions): QueryPromise<ListLegacyUserIdentitiesByBatchData, ListLegacyUserIdentitiesByBatchVariables>;

interface ListMigrationUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListMigrationUsersVariables): QueryRef<ListMigrationUsersData, ListMigrationUsersVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListMigrationUsersVariables): QueryRef<ListMigrationUsersData, ListMigrationUsersVariables>;
  operationName: string;
}
export const listMigrationUsersRef: ListMigrationUsersRef;

export function listMigrationUsers(vars: ListMigrationUsersVariables, options?: ExecuteQueryOptions): QueryPromise<ListMigrationUsersData, ListMigrationUsersVariables>;
export function listMigrationUsers(dc: DataConnect, vars: ListMigrationUsersVariables, options?: ExecuteQueryOptions): QueryPromise<ListMigrationUsersData, ListMigrationUsersVariables>;

interface SearchSectionMemberCandidatesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SearchSectionMemberCandidatesVariables): QueryRef<SearchSectionMemberCandidatesData, SearchSectionMemberCandidatesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SearchSectionMemberCandidatesVariables): QueryRef<SearchSectionMemberCandidatesData, SearchSectionMemberCandidatesVariables>;
  operationName: string;
}
export const searchSectionMemberCandidatesRef: SearchSectionMemberCandidatesRef;

export function searchSectionMemberCandidates(vars: SearchSectionMemberCandidatesVariables, options?: ExecuteQueryOptions): QueryPromise<SearchSectionMemberCandidatesData, SearchSectionMemberCandidatesVariables>;
export function searchSectionMemberCandidates(dc: DataConnect, vars: SearchSectionMemberCandidatesVariables, options?: ExecuteQueryOptions): QueryPromise<SearchSectionMemberCandidatesData, SearchSectionMemberCandidatesVariables>;

interface ListLegacyUserIdentitiesForMigrationRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListLegacyUserIdentitiesForMigrationVariables): QueryRef<ListLegacyUserIdentitiesForMigrationData, ListLegacyUserIdentitiesForMigrationVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListLegacyUserIdentitiesForMigrationVariables): QueryRef<ListLegacyUserIdentitiesForMigrationData, ListLegacyUserIdentitiesForMigrationVariables>;
  operationName: string;
}
export const listLegacyUserIdentitiesForMigrationRef: ListLegacyUserIdentitiesForMigrationRef;

export function listLegacyUserIdentitiesForMigration(vars: ListLegacyUserIdentitiesForMigrationVariables, options?: ExecuteQueryOptions): QueryPromise<ListLegacyUserIdentitiesForMigrationData, ListLegacyUserIdentitiesForMigrationVariables>;
export function listLegacyUserIdentitiesForMigration(dc: DataConnect, vars: ListLegacyUserIdentitiesForMigrationVariables, options?: ExecuteQueryOptions): QueryPromise<ListLegacyUserIdentitiesForMigrationData, ListLegacyUserIdentitiesForMigrationVariables>;

interface CreateUserGroupAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserGroupAdminVariables): MutationRef<CreateUserGroupAdminData, CreateUserGroupAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserGroupAdminVariables): MutationRef<CreateUserGroupAdminData, CreateUserGroupAdminVariables>;
  operationName: string;
}
export const createUserGroupAdminRef: CreateUserGroupAdminRef;

export function createUserGroupAdmin(vars: CreateUserGroupAdminVariables): MutationPromise<CreateUserGroupAdminData, CreateUserGroupAdminVariables>;
export function createUserGroupAdmin(dc: DataConnect, vars: CreateUserGroupAdminVariables): MutationPromise<CreateUserGroupAdminData, CreateUserGroupAdminVariables>;

interface AddUserToUserGroupAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddUserToUserGroupAdminVariables): MutationRef<AddUserToUserGroupAdminData, AddUserToUserGroupAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddUserToUserGroupAdminVariables): MutationRef<AddUserToUserGroupAdminData, AddUserToUserGroupAdminVariables>;
  operationName: string;
}
export const addUserToUserGroupAdminRef: AddUserToUserGroupAdminRef;

export function addUserToUserGroupAdmin(vars: AddUserToUserGroupAdminVariables): MutationPromise<AddUserToUserGroupAdminData, AddUserToUserGroupAdminVariables>;
export function addUserToUserGroupAdmin(dc: DataConnect, vars: AddUserToUserGroupAdminVariables): MutationPromise<AddUserToUserGroupAdminData, AddUserToUserGroupAdminVariables>;

interface RemoveUserFromUserGroupAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveUserFromUserGroupAdminVariables): MutationRef<RemoveUserFromUserGroupAdminData, RemoveUserFromUserGroupAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RemoveUserFromUserGroupAdminVariables): MutationRef<RemoveUserFromUserGroupAdminData, RemoveUserFromUserGroupAdminVariables>;
  operationName: string;
}
export const removeUserFromUserGroupAdminRef: RemoveUserFromUserGroupAdminRef;

export function removeUserFromUserGroupAdmin(vars: RemoveUserFromUserGroupAdminVariables): MutationPromise<RemoveUserFromUserGroupAdminData, RemoveUserFromUserGroupAdminVariables>;
export function removeUserFromUserGroupAdmin(dc: DataConnect, vars: RemoveUserFromUserGroupAdminVariables): MutationPromise<RemoveUserFromUserGroupAdminData, RemoveUserFromUserGroupAdminVariables>;

interface GetUserGroupByNameRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserGroupByNameVariables): QueryRef<GetUserGroupByNameData, GetUserGroupByNameVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserGroupByNameVariables): QueryRef<GetUserGroupByNameData, GetUserGroupByNameVariables>;
  operationName: string;
}
export const getUserGroupByNameRef: GetUserGroupByNameRef;

export function getUserGroupByName(vars: GetUserGroupByNameVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserGroupByNameData, GetUserGroupByNameVariables>;
export function getUserGroupByName(dc: DataConnect, vars: GetUserGroupByNameVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserGroupByNameData, GetUserGroupByNameVariables>;

interface GetUserUserGroupsForAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserUserGroupsForAdminVariables): QueryRef<GetUserUserGroupsForAdminData, GetUserUserGroupsForAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserUserGroupsForAdminVariables): QueryRef<GetUserUserGroupsForAdminData, GetUserUserGroupsForAdminVariables>;
  operationName: string;
}
export const getUserUserGroupsForAdminRef: GetUserUserGroupsForAdminRef;

export function getUserUserGroupsForAdmin(vars: GetUserUserGroupsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserUserGroupsForAdminData, GetUserUserGroupsForAdminVariables>;
export function getUserUserGroupsForAdmin(dc: DataConnect, vars: GetUserUserGroupsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserUserGroupsForAdminData, GetUserUserGroupsForAdminVariables>;

interface GetUserForCheckoutRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserForCheckoutVariables): QueryRef<GetUserForCheckoutData, GetUserForCheckoutVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserForCheckoutVariables): QueryRef<GetUserForCheckoutData, GetUserForCheckoutVariables>;
  operationName: string;
}
export const getUserForCheckoutRef: GetUserForCheckoutRef;

export function getUserForCheckout(vars: GetUserForCheckoutVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserForCheckoutData, GetUserForCheckoutVariables>;
export function getUserForCheckout(dc: DataConnect, vars: GetUserForCheckoutVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserForCheckoutData, GetUserForCheckoutVariables>;

interface GetTicketTypeForCheckoutRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTicketTypeForCheckoutVariables): QueryRef<GetTicketTypeForCheckoutData, GetTicketTypeForCheckoutVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetTicketTypeForCheckoutVariables): QueryRef<GetTicketTypeForCheckoutData, GetTicketTypeForCheckoutVariables>;
  operationName: string;
}
export const getTicketTypeForCheckoutRef: GetTicketTypeForCheckoutRef;

export function getTicketTypeForCheckout(vars: GetTicketTypeForCheckoutVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketTypeForCheckoutData, GetTicketTypeForCheckoutVariables>;
export function getTicketTypeForCheckout(dc: DataConnect, vars: GetTicketTypeForCheckoutVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketTypeForCheckoutData, GetTicketTypeForCheckoutVariables>;

interface UpdateUserStripeCustomerIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserStripeCustomerIdVariables): MutationRef<UpdateUserStripeCustomerIdData, UpdateUserStripeCustomerIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateUserStripeCustomerIdVariables): MutationRef<UpdateUserStripeCustomerIdData, UpdateUserStripeCustomerIdVariables>;
  operationName: string;
}
export const updateUserStripeCustomerIdRef: UpdateUserStripeCustomerIdRef;

export function updateUserStripeCustomerId(vars: UpdateUserStripeCustomerIdVariables): MutationPromise<UpdateUserStripeCustomerIdData, UpdateUserStripeCustomerIdVariables>;
export function updateUserStripeCustomerId(dc: DataConnect, vars: UpdateUserStripeCustomerIdVariables): MutationPromise<UpdateUserStripeCustomerIdData, UpdateUserStripeCustomerIdVariables>;

interface GetEventByIdForCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEventByIdForCallableVariables): QueryRef<GetEventByIdForCallableData, GetEventByIdForCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetEventByIdForCallableVariables): QueryRef<GetEventByIdForCallableData, GetEventByIdForCallableVariables>;
  operationName: string;
}
export const getEventByIdForCallableRef: GetEventByIdForCallableRef;

export function getEventByIdForCallable(vars: GetEventByIdForCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetEventByIdForCallableData, GetEventByIdForCallableVariables>;
export function getEventByIdForCallable(dc: DataConnect, vars: GetEventByIdForCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetEventByIdForCallableData, GetEventByIdForCallableVariables>;

interface GetSectionByIdForCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionByIdForCallableVariables): QueryRef<GetSectionByIdForCallableData, GetSectionByIdForCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSectionByIdForCallableVariables): QueryRef<GetSectionByIdForCallableData, GetSectionByIdForCallableVariables>;
  operationName: string;
}
export const getSectionByIdForCallableRef: GetSectionByIdForCallableRef;

export function getSectionByIdForCallable(vars: GetSectionByIdForCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionByIdForCallableData, GetSectionByIdForCallableVariables>;
export function getSectionByIdForCallable(dc: DataConnect, vars: GetSectionByIdForCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionByIdForCallableData, GetSectionByIdForCallableVariables>;

interface GetBookingsForBookerAndEventRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetBookingsForBookerAndEventVariables): QueryRef<GetBookingsForBookerAndEventData, GetBookingsForBookerAndEventVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetBookingsForBookerAndEventVariables): QueryRef<GetBookingsForBookerAndEventData, GetBookingsForBookerAndEventVariables>;
  operationName: string;
}
export const getBookingsForBookerAndEventRef: GetBookingsForBookerAndEventRef;

export function getBookingsForBookerAndEvent(vars: GetBookingsForBookerAndEventVariables, options?: ExecuteQueryOptions): QueryPromise<GetBookingsForBookerAndEventData, GetBookingsForBookerAndEventVariables>;
export function getBookingsForBookerAndEvent(dc: DataConnect, vars: GetBookingsForBookerAndEventVariables, options?: ExecuteQueryOptions): QueryPromise<GetBookingsForBookerAndEventData, GetBookingsForBookerAndEventVariables>;

interface GetTicketOrdersForBookerAndEventRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTicketOrdersForBookerAndEventVariables): QueryRef<GetTicketOrdersForBookerAndEventData, GetTicketOrdersForBookerAndEventVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetTicketOrdersForBookerAndEventVariables): QueryRef<GetTicketOrdersForBookerAndEventData, GetTicketOrdersForBookerAndEventVariables>;
  operationName: string;
}
export const getTicketOrdersForBookerAndEventRef: GetTicketOrdersForBookerAndEventRef;

export function getTicketOrdersForBookerAndEvent(vars: GetTicketOrdersForBookerAndEventVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketOrdersForBookerAndEventData, GetTicketOrdersForBookerAndEventVariables>;
export function getTicketOrdersForBookerAndEvent(dc: DataConnect, vars: GetTicketOrdersForBookerAndEventVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketOrdersForBookerAndEventData, GetTicketOrdersForBookerAndEventVariables>;

interface CreateBookingDraftForUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateBookingDraftForUserVariables): MutationRef<CreateBookingDraftForUserData, CreateBookingDraftForUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateBookingDraftForUserVariables): MutationRef<CreateBookingDraftForUserData, CreateBookingDraftForUserVariables>;
  operationName: string;
}
export const createBookingDraftForUserRef: CreateBookingDraftForUserRef;

export function createBookingDraftForUser(vars: CreateBookingDraftForUserVariables): MutationPromise<CreateBookingDraftForUserData, CreateBookingDraftForUserVariables>;
export function createBookingDraftForUser(dc: DataConnect, vars: CreateBookingDraftForUserVariables): MutationPromise<CreateBookingDraftForUserData, CreateBookingDraftForUserVariables>;

interface CreateBookingDraftRevisionForUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateBookingDraftRevisionForUserVariables): MutationRef<CreateBookingDraftRevisionForUserData, CreateBookingDraftRevisionForUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateBookingDraftRevisionForUserVariables): MutationRef<CreateBookingDraftRevisionForUserData, CreateBookingDraftRevisionForUserVariables>;
  operationName: string;
}
export const createBookingDraftRevisionForUserRef: CreateBookingDraftRevisionForUserRef;

export function createBookingDraftRevisionForUser(vars: CreateBookingDraftRevisionForUserVariables): MutationPromise<CreateBookingDraftRevisionForUserData, CreateBookingDraftRevisionForUserVariables>;
export function createBookingDraftRevisionForUser(dc: DataConnect, vars: CreateBookingDraftRevisionForUserVariables): MutationPromise<CreateBookingDraftRevisionForUserData, CreateBookingDraftRevisionForUserVariables>;

interface MarkBookingSupersededFromCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkBookingSupersededFromCallableVariables): MutationRef<MarkBookingSupersededFromCallableData, MarkBookingSupersededFromCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MarkBookingSupersededFromCallableVariables): MutationRef<MarkBookingSupersededFromCallableData, MarkBookingSupersededFromCallableVariables>;
  operationName: string;
}
export const markBookingSupersededFromCallableRef: MarkBookingSupersededFromCallableRef;

export function markBookingSupersededFromCallable(vars: MarkBookingSupersededFromCallableVariables): MutationPromise<MarkBookingSupersededFromCallableData, MarkBookingSupersededFromCallableVariables>;
export function markBookingSupersededFromCallable(dc: DataConnect, vars: MarkBookingSupersededFromCallableVariables): MutationPromise<MarkBookingSupersededFromCallableData, MarkBookingSupersededFromCallableVariables>;

interface CreateBookingPaymentAdjustmentFromCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateBookingPaymentAdjustmentFromCallableVariables): MutationRef<CreateBookingPaymentAdjustmentFromCallableData, CreateBookingPaymentAdjustmentFromCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateBookingPaymentAdjustmentFromCallableVariables): MutationRef<CreateBookingPaymentAdjustmentFromCallableData, CreateBookingPaymentAdjustmentFromCallableVariables>;
  operationName: string;
}
export const createBookingPaymentAdjustmentFromCallableRef: CreateBookingPaymentAdjustmentFromCallableRef;

export function createBookingPaymentAdjustmentFromCallable(vars: CreateBookingPaymentAdjustmentFromCallableVariables): MutationPromise<CreateBookingPaymentAdjustmentFromCallableData, CreateBookingPaymentAdjustmentFromCallableVariables>;
export function createBookingPaymentAdjustmentFromCallable(dc: DataConnect, vars: CreateBookingPaymentAdjustmentFromCallableVariables): MutationPromise<CreateBookingPaymentAdjustmentFromCallableData, CreateBookingPaymentAdjustmentFromCallableVariables>;

interface AddBookingLineFromCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddBookingLineFromCallableVariables): MutationRef<AddBookingLineFromCallableData, AddBookingLineFromCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddBookingLineFromCallableVariables): MutationRef<AddBookingLineFromCallableData, AddBookingLineFromCallableVariables>;
  operationName: string;
}
export const addBookingLineFromCallableRef: AddBookingLineFromCallableRef;

export function addBookingLineFromCallable(vars: AddBookingLineFromCallableVariables): MutationPromise<AddBookingLineFromCallableData, AddBookingLineFromCallableVariables>;
export function addBookingLineFromCallable(dc: DataConnect, vars: AddBookingLineFromCallableVariables): MutationPromise<AddBookingLineFromCallableData, AddBookingLineFromCallableVariables>;

interface UpdateBookingStatusFromCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateBookingStatusFromCallableVariables): MutationRef<UpdateBookingStatusFromCallableData, UpdateBookingStatusFromCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateBookingStatusFromCallableVariables): MutationRef<UpdateBookingStatusFromCallableData, UpdateBookingStatusFromCallableVariables>;
  operationName: string;
}
export const updateBookingStatusFromCallableRef: UpdateBookingStatusFromCallableRef;

export function updateBookingStatusFromCallable(vars: UpdateBookingStatusFromCallableVariables): MutationPromise<UpdateBookingStatusFromCallableData, UpdateBookingStatusFromCallableVariables>;
export function updateBookingStatusFromCallable(dc: DataConnect, vars: UpdateBookingStatusFromCallableVariables): MutationPromise<UpdateBookingStatusFromCallableData, UpdateBookingStatusFromCallableVariables>;

interface SettleBookingPaymentAdjustmentsFromCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SettleBookingPaymentAdjustmentsFromCallableVariables): MutationRef<SettleBookingPaymentAdjustmentsFromCallableData, SettleBookingPaymentAdjustmentsFromCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SettleBookingPaymentAdjustmentsFromCallableVariables): MutationRef<SettleBookingPaymentAdjustmentsFromCallableData, SettleBookingPaymentAdjustmentsFromCallableVariables>;
  operationName: string;
}
export const settleBookingPaymentAdjustmentsFromCallableRef: SettleBookingPaymentAdjustmentsFromCallableRef;

export function settleBookingPaymentAdjustmentsFromCallable(vars: SettleBookingPaymentAdjustmentsFromCallableVariables): MutationPromise<SettleBookingPaymentAdjustmentsFromCallableData, SettleBookingPaymentAdjustmentsFromCallableVariables>;
export function settleBookingPaymentAdjustmentsFromCallable(dc: DataConnect, vars: SettleBookingPaymentAdjustmentsFromCallableVariables): MutationPromise<SettleBookingPaymentAdjustmentsFromCallableData, SettleBookingPaymentAdjustmentsFromCallableVariables>;

interface UpdateBookingApprovalFromCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateBookingApprovalFromCallableVariables): MutationRef<UpdateBookingApprovalFromCallableData, UpdateBookingApprovalFromCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateBookingApprovalFromCallableVariables): MutationRef<UpdateBookingApprovalFromCallableData, UpdateBookingApprovalFromCallableVariables>;
  operationName: string;
}
export const updateBookingApprovalFromCallableRef: UpdateBookingApprovalFromCallableRef;

export function updateBookingApprovalFromCallable(vars: UpdateBookingApprovalFromCallableVariables): MutationPromise<UpdateBookingApprovalFromCallableData, UpdateBookingApprovalFromCallableVariables>;
export function updateBookingApprovalFromCallable(dc: DataConnect, vars: UpdateBookingApprovalFromCallableVariables): MutationPromise<UpdateBookingApprovalFromCallableData, UpdateBookingApprovalFromCallableVariables>;

interface CreateTicketOrderForCheckoutRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateTicketOrderForCheckoutVariables): MutationRef<CreateTicketOrderForCheckoutData, CreateTicketOrderForCheckoutVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateTicketOrderForCheckoutVariables): MutationRef<CreateTicketOrderForCheckoutData, CreateTicketOrderForCheckoutVariables>;
  operationName: string;
}
export const createTicketOrderForCheckoutRef: CreateTicketOrderForCheckoutRef;

export function createTicketOrderForCheckout(vars: CreateTicketOrderForCheckoutVariables): MutationPromise<CreateTicketOrderForCheckoutData, CreateTicketOrderForCheckoutVariables>;
export function createTicketOrderForCheckout(dc: DataConnect, vars: CreateTicketOrderForCheckoutVariables): MutationPromise<CreateTicketOrderForCheckoutData, CreateTicketOrderForCheckoutVariables>;

interface UpdateBookingPlaceAllocationRefundFromCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateBookingPlaceAllocationRefundFromCallableVariables): MutationRef<UpdateBookingPlaceAllocationRefundFromCallableData, UpdateBookingPlaceAllocationRefundFromCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateBookingPlaceAllocationRefundFromCallableVariables): MutationRef<UpdateBookingPlaceAllocationRefundFromCallableData, UpdateBookingPlaceAllocationRefundFromCallableVariables>;
  operationName: string;
}
export const updateBookingPlaceAllocationRefundFromCallableRef: UpdateBookingPlaceAllocationRefundFromCallableRef;

export function updateBookingPlaceAllocationRefundFromCallable(vars: UpdateBookingPlaceAllocationRefundFromCallableVariables): MutationPromise<UpdateBookingPlaceAllocationRefundFromCallableData, UpdateBookingPlaceAllocationRefundFromCallableVariables>;
export function updateBookingPlaceAllocationRefundFromCallable(dc: DataConnect, vars: UpdateBookingPlaceAllocationRefundFromCallableVariables): MutationPromise<UpdateBookingPlaceAllocationRefundFromCallableData, UpdateBookingPlaceAllocationRefundFromCallableVariables>;

interface GetTicketOrderForWebhookRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTicketOrderForWebhookVariables): QueryRef<GetTicketOrderForWebhookData, GetTicketOrderForWebhookVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetTicketOrderForWebhookVariables): QueryRef<GetTicketOrderForWebhookData, GetTicketOrderForWebhookVariables>;
  operationName: string;
}
export const getTicketOrderForWebhookRef: GetTicketOrderForWebhookRef;

export function getTicketOrderForWebhook(vars: GetTicketOrderForWebhookVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketOrderForWebhookData, GetTicketOrderForWebhookVariables>;
export function getTicketOrderForWebhook(dc: DataConnect, vars: GetTicketOrderForWebhookVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketOrderForWebhookData, GetTicketOrderForWebhookVariables>;

interface GetTicketOrderStripeArtifactsForCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTicketOrderStripeArtifactsForCallableVariables): QueryRef<GetTicketOrderStripeArtifactsForCallableData, GetTicketOrderStripeArtifactsForCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetTicketOrderStripeArtifactsForCallableVariables): QueryRef<GetTicketOrderStripeArtifactsForCallableData, GetTicketOrderStripeArtifactsForCallableVariables>;
  operationName: string;
}
export const getTicketOrderStripeArtifactsForCallableRef: GetTicketOrderStripeArtifactsForCallableRef;

export function getTicketOrderStripeArtifactsForCallable(vars: GetTicketOrderStripeArtifactsForCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketOrderStripeArtifactsForCallableData, GetTicketOrderStripeArtifactsForCallableVariables>;
export function getTicketOrderStripeArtifactsForCallable(dc: DataConnect, vars: GetTicketOrderStripeArtifactsForCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketOrderStripeArtifactsForCallableData, GetTicketOrderStripeArtifactsForCallableVariables>;

interface GetPaymentWebhookEventByStripeEventIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetPaymentWebhookEventByStripeEventIdVariables): QueryRef<GetPaymentWebhookEventByStripeEventIdData, GetPaymentWebhookEventByStripeEventIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetPaymentWebhookEventByStripeEventIdVariables): QueryRef<GetPaymentWebhookEventByStripeEventIdData, GetPaymentWebhookEventByStripeEventIdVariables>;
  operationName: string;
}
export const getPaymentWebhookEventByStripeEventIdRef: GetPaymentWebhookEventByStripeEventIdRef;

export function getPaymentWebhookEventByStripeEventId(vars: GetPaymentWebhookEventByStripeEventIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetPaymentWebhookEventByStripeEventIdData, GetPaymentWebhookEventByStripeEventIdVariables>;
export function getPaymentWebhookEventByStripeEventId(dc: DataConnect, vars: GetPaymentWebhookEventByStripeEventIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetPaymentWebhookEventByStripeEventIdData, GetPaymentWebhookEventByStripeEventIdVariables>;

interface CreatePaymentWebhookEventRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePaymentWebhookEventVariables): MutationRef<CreatePaymentWebhookEventData, CreatePaymentWebhookEventVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreatePaymentWebhookEventVariables): MutationRef<CreatePaymentWebhookEventData, CreatePaymentWebhookEventVariables>;
  operationName: string;
}
export const createPaymentWebhookEventRef: CreatePaymentWebhookEventRef;

export function createPaymentWebhookEvent(vars: CreatePaymentWebhookEventVariables): MutationPromise<CreatePaymentWebhookEventData, CreatePaymentWebhookEventVariables>;
export function createPaymentWebhookEvent(dc: DataConnect, vars: CreatePaymentWebhookEventVariables): MutationPromise<CreatePaymentWebhookEventData, CreatePaymentWebhookEventVariables>;

interface GetNotificationDeliveryByChannelAndKeyRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetNotificationDeliveryByChannelAndKeyVariables): QueryRef<GetNotificationDeliveryByChannelAndKeyData, GetNotificationDeliveryByChannelAndKeyVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetNotificationDeliveryByChannelAndKeyVariables): QueryRef<GetNotificationDeliveryByChannelAndKeyData, GetNotificationDeliveryByChannelAndKeyVariables>;
  operationName: string;
}
export const getNotificationDeliveryByChannelAndKeyRef: GetNotificationDeliveryByChannelAndKeyRef;

export function getNotificationDeliveryByChannelAndKey(vars: GetNotificationDeliveryByChannelAndKeyVariables, options?: ExecuteQueryOptions): QueryPromise<GetNotificationDeliveryByChannelAndKeyData, GetNotificationDeliveryByChannelAndKeyVariables>;
export function getNotificationDeliveryByChannelAndKey(dc: DataConnect, vars: GetNotificationDeliveryByChannelAndKeyVariables, options?: ExecuteQueryOptions): QueryPromise<GetNotificationDeliveryByChannelAndKeyData, GetNotificationDeliveryByChannelAndKeyVariables>;

interface ListFailedNotificationDeliveriesForRecoveryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListFailedNotificationDeliveriesForRecoveryVariables): QueryRef<ListFailedNotificationDeliveriesForRecoveryData, ListFailedNotificationDeliveriesForRecoveryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListFailedNotificationDeliveriesForRecoveryVariables): QueryRef<ListFailedNotificationDeliveriesForRecoveryData, ListFailedNotificationDeliveriesForRecoveryVariables>;
  operationName: string;
}
export const listFailedNotificationDeliveriesForRecoveryRef: ListFailedNotificationDeliveriesForRecoveryRef;

export function listFailedNotificationDeliveriesForRecovery(vars: ListFailedNotificationDeliveriesForRecoveryVariables, options?: ExecuteQueryOptions): QueryPromise<ListFailedNotificationDeliveriesForRecoveryData, ListFailedNotificationDeliveriesForRecoveryVariables>;
export function listFailedNotificationDeliveriesForRecovery(dc: DataConnect, vars: ListFailedNotificationDeliveriesForRecoveryVariables, options?: ExecuteQueryOptions): QueryPromise<ListFailedNotificationDeliveriesForRecoveryData, ListFailedNotificationDeliveriesForRecoveryVariables>;

interface ListStalePendingNotificationDeliveriesForRecoveryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStalePendingNotificationDeliveriesForRecoveryVariables): QueryRef<ListStalePendingNotificationDeliveriesForRecoveryData, ListStalePendingNotificationDeliveriesForRecoveryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListStalePendingNotificationDeliveriesForRecoveryVariables): QueryRef<ListStalePendingNotificationDeliveriesForRecoveryData, ListStalePendingNotificationDeliveriesForRecoveryVariables>;
  operationName: string;
}
export const listStalePendingNotificationDeliveriesForRecoveryRef: ListStalePendingNotificationDeliveriesForRecoveryRef;

export function listStalePendingNotificationDeliveriesForRecovery(vars: ListStalePendingNotificationDeliveriesForRecoveryVariables, options?: ExecuteQueryOptions): QueryPromise<ListStalePendingNotificationDeliveriesForRecoveryData, ListStalePendingNotificationDeliveriesForRecoveryVariables>;
export function listStalePendingNotificationDeliveriesForRecovery(dc: DataConnect, vars: ListStalePendingNotificationDeliveriesForRecoveryVariables, options?: ExecuteQueryOptions): QueryPromise<ListStalePendingNotificationDeliveriesForRecoveryData, ListStalePendingNotificationDeliveriesForRecoveryVariables>;

interface CreateNotificationDeliveryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNotificationDeliveryVariables): MutationRef<CreateNotificationDeliveryData, CreateNotificationDeliveryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateNotificationDeliveryVariables): MutationRef<CreateNotificationDeliveryData, CreateNotificationDeliveryVariables>;
  operationName: string;
}
export const createNotificationDeliveryRef: CreateNotificationDeliveryRef;

export function createNotificationDelivery(vars: CreateNotificationDeliveryVariables): MutationPromise<CreateNotificationDeliveryData, CreateNotificationDeliveryVariables>;
export function createNotificationDelivery(dc: DataConnect, vars: CreateNotificationDeliveryVariables): MutationPromise<CreateNotificationDeliveryData, CreateNotificationDeliveryVariables>;

interface ClaimNotificationDeliveryByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ClaimNotificationDeliveryByIdVariables): MutationRef<ClaimNotificationDeliveryByIdData, ClaimNotificationDeliveryByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ClaimNotificationDeliveryByIdVariables): MutationRef<ClaimNotificationDeliveryByIdData, ClaimNotificationDeliveryByIdVariables>;
  operationName: string;
}
export const claimNotificationDeliveryByIdRef: ClaimNotificationDeliveryByIdRef;

export function claimNotificationDeliveryById(vars: ClaimNotificationDeliveryByIdVariables): MutationPromise<ClaimNotificationDeliveryByIdData, ClaimNotificationDeliveryByIdVariables>;
export function claimNotificationDeliveryById(dc: DataConnect, vars: ClaimNotificationDeliveryByIdVariables): MutationPromise<ClaimNotificationDeliveryByIdData, ClaimNotificationDeliveryByIdVariables>;

interface RecordNotificationRecoveryFailureByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RecordNotificationRecoveryFailureByIdVariables): MutationRef<RecordNotificationRecoveryFailureByIdData, RecordNotificationRecoveryFailureByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RecordNotificationRecoveryFailureByIdVariables): MutationRef<RecordNotificationRecoveryFailureByIdData, RecordNotificationRecoveryFailureByIdVariables>;
  operationName: string;
}
export const recordNotificationRecoveryFailureByIdRef: RecordNotificationRecoveryFailureByIdRef;

export function recordNotificationRecoveryFailureById(vars: RecordNotificationRecoveryFailureByIdVariables): MutationPromise<RecordNotificationRecoveryFailureByIdData, RecordNotificationRecoveryFailureByIdVariables>;
export function recordNotificationRecoveryFailureById(dc: DataConnect, vars: RecordNotificationRecoveryFailureByIdVariables): MutationPromise<RecordNotificationRecoveryFailureByIdData, RecordNotificationRecoveryFailureByIdVariables>;

interface MarkNotificationDeliverySentByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkNotificationDeliverySentByIdVariables): MutationRef<MarkNotificationDeliverySentByIdData, MarkNotificationDeliverySentByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MarkNotificationDeliverySentByIdVariables): MutationRef<MarkNotificationDeliverySentByIdData, MarkNotificationDeliverySentByIdVariables>;
  operationName: string;
}
export const markNotificationDeliverySentByIdRef: MarkNotificationDeliverySentByIdRef;

export function markNotificationDeliverySentById(vars: MarkNotificationDeliverySentByIdVariables): MutationPromise<MarkNotificationDeliverySentByIdData, MarkNotificationDeliverySentByIdVariables>;
export function markNotificationDeliverySentById(dc: DataConnect, vars: MarkNotificationDeliverySentByIdVariables): MutationPromise<MarkNotificationDeliverySentByIdData, MarkNotificationDeliverySentByIdVariables>;

interface MarkNotificationDeliveryFailedByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkNotificationDeliveryFailedByIdVariables): MutationRef<MarkNotificationDeliveryFailedByIdData, MarkNotificationDeliveryFailedByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MarkNotificationDeliveryFailedByIdVariables): MutationRef<MarkNotificationDeliveryFailedByIdData, MarkNotificationDeliveryFailedByIdVariables>;
  operationName: string;
}
export const markNotificationDeliveryFailedByIdRef: MarkNotificationDeliveryFailedByIdRef;

export function markNotificationDeliveryFailedById(vars: MarkNotificationDeliveryFailedByIdVariables): MutationPromise<MarkNotificationDeliveryFailedByIdData, MarkNotificationDeliveryFailedByIdVariables>;
export function markNotificationDeliveryFailedById(dc: DataConnect, vars: MarkNotificationDeliveryFailedByIdVariables): MutationPromise<MarkNotificationDeliveryFailedByIdData, MarkNotificationDeliveryFailedByIdVariables>;

interface MarkTicketOrderPaidFromWebhookRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkTicketOrderPaidFromWebhookVariables): MutationRef<MarkTicketOrderPaidFromWebhookData, MarkTicketOrderPaidFromWebhookVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MarkTicketOrderPaidFromWebhookVariables): MutationRef<MarkTicketOrderPaidFromWebhookData, MarkTicketOrderPaidFromWebhookVariables>;
  operationName: string;
}
export const markTicketOrderPaidFromWebhookRef: MarkTicketOrderPaidFromWebhookRef;

export function markTicketOrderPaidFromWebhook(vars: MarkTicketOrderPaidFromWebhookVariables): MutationPromise<MarkTicketOrderPaidFromWebhookData, MarkTicketOrderPaidFromWebhookVariables>;
export function markTicketOrderPaidFromWebhook(dc: DataConnect, vars: MarkTicketOrderPaidFromWebhookVariables): MutationPromise<MarkTicketOrderPaidFromWebhookData, MarkTicketOrderPaidFromWebhookVariables>;

interface MarkTicketOrderFailedFromWebhookRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkTicketOrderFailedFromWebhookVariables): MutationRef<MarkTicketOrderFailedFromWebhookData, MarkTicketOrderFailedFromWebhookVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MarkTicketOrderFailedFromWebhookVariables): MutationRef<MarkTicketOrderFailedFromWebhookData, MarkTicketOrderFailedFromWebhookVariables>;
  operationName: string;
}
export const markTicketOrderFailedFromWebhookRef: MarkTicketOrderFailedFromWebhookRef;

export function markTicketOrderFailedFromWebhook(vars: MarkTicketOrderFailedFromWebhookVariables): MutationPromise<MarkTicketOrderFailedFromWebhookData, MarkTicketOrderFailedFromWebhookVariables>;
export function markTicketOrderFailedFromWebhook(dc: DataConnect, vars: MarkTicketOrderFailedFromWebhookVariables): MutationPromise<MarkTicketOrderFailedFromWebhookData, MarkTicketOrderFailedFromWebhookVariables>;

interface MarkTicketOrderRefundedFromWebhookRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkTicketOrderRefundedFromWebhookVariables): MutationRef<MarkTicketOrderRefundedFromWebhookData, MarkTicketOrderRefundedFromWebhookVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MarkTicketOrderRefundedFromWebhookVariables): MutationRef<MarkTicketOrderRefundedFromWebhookData, MarkTicketOrderRefundedFromWebhookVariables>;
  operationName: string;
}
export const markTicketOrderRefundedFromWebhookRef: MarkTicketOrderRefundedFromWebhookRef;

export function markTicketOrderRefundedFromWebhook(vars: MarkTicketOrderRefundedFromWebhookVariables): MutationPromise<MarkTicketOrderRefundedFromWebhookData, MarkTicketOrderRefundedFromWebhookVariables>;
export function markTicketOrderRefundedFromWebhook(dc: DataConnect, vars: MarkTicketOrderRefundedFromWebhookVariables): MutationPromise<MarkTicketOrderRefundedFromWebhookData, MarkTicketOrderRefundedFromWebhookVariables>;

interface RecordTicketOrderPartialRefundFromWebhookRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RecordTicketOrderPartialRefundFromWebhookVariables): MutationRef<RecordTicketOrderPartialRefundFromWebhookData, RecordTicketOrderPartialRefundFromWebhookVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RecordTicketOrderPartialRefundFromWebhookVariables): MutationRef<RecordTicketOrderPartialRefundFromWebhookData, RecordTicketOrderPartialRefundFromWebhookVariables>;
  operationName: string;
}
export const recordTicketOrderPartialRefundFromWebhookRef: RecordTicketOrderPartialRefundFromWebhookRef;

export function recordTicketOrderPartialRefundFromWebhook(vars: RecordTicketOrderPartialRefundFromWebhookVariables): MutationPromise<RecordTicketOrderPartialRefundFromWebhookData, RecordTicketOrderPartialRefundFromWebhookVariables>;
export function recordTicketOrderPartialRefundFromWebhook(dc: DataConnect, vars: RecordTicketOrderPartialRefundFromWebhookVariables): MutationPromise<RecordTicketOrderPartialRefundFromWebhookData, RecordTicketOrderPartialRefundFromWebhookVariables>;

interface UpsertTicketOrderDisputeFromWebhookRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertTicketOrderDisputeFromWebhookVariables): MutationRef<UpsertTicketOrderDisputeFromWebhookData, UpsertTicketOrderDisputeFromWebhookVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertTicketOrderDisputeFromWebhookVariables): MutationRef<UpsertTicketOrderDisputeFromWebhookData, UpsertTicketOrderDisputeFromWebhookVariables>;
  operationName: string;
}
export const upsertTicketOrderDisputeFromWebhookRef: UpsertTicketOrderDisputeFromWebhookRef;

export function upsertTicketOrderDisputeFromWebhook(vars: UpsertTicketOrderDisputeFromWebhookVariables): MutationPromise<UpsertTicketOrderDisputeFromWebhookData, UpsertTicketOrderDisputeFromWebhookVariables>;
export function upsertTicketOrderDisputeFromWebhook(dc: DataConnect, vars: UpsertTicketOrderDisputeFromWebhookVariables): MutationPromise<UpsertTicketOrderDisputeFromWebhookData, UpsertTicketOrderDisputeFromWebhookVariables>;

interface GetPaymentReconciliationExceptionByOrderAndTypeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetPaymentReconciliationExceptionByOrderAndTypeVariables): QueryRef<GetPaymentReconciliationExceptionByOrderAndTypeData, GetPaymentReconciliationExceptionByOrderAndTypeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetPaymentReconciliationExceptionByOrderAndTypeVariables): QueryRef<GetPaymentReconciliationExceptionByOrderAndTypeData, GetPaymentReconciliationExceptionByOrderAndTypeVariables>;
  operationName: string;
}
export const getPaymentReconciliationExceptionByOrderAndTypeRef: GetPaymentReconciliationExceptionByOrderAndTypeRef;

export function getPaymentReconciliationExceptionByOrderAndType(vars: GetPaymentReconciliationExceptionByOrderAndTypeVariables, options?: ExecuteQueryOptions): QueryPromise<GetPaymentReconciliationExceptionByOrderAndTypeData, GetPaymentReconciliationExceptionByOrderAndTypeVariables>;
export function getPaymentReconciliationExceptionByOrderAndType(dc: DataConnect, vars: GetPaymentReconciliationExceptionByOrderAndTypeVariables, options?: ExecuteQueryOptions): QueryPromise<GetPaymentReconciliationExceptionByOrderAndTypeData, GetPaymentReconciliationExceptionByOrderAndTypeVariables>;

interface UpsertPaymentReconciliationExceptionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertPaymentReconciliationExceptionVariables): MutationRef<UpsertPaymentReconciliationExceptionData, UpsertPaymentReconciliationExceptionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertPaymentReconciliationExceptionVariables): MutationRef<UpsertPaymentReconciliationExceptionData, UpsertPaymentReconciliationExceptionVariables>;
  operationName: string;
}
export const upsertPaymentReconciliationExceptionRef: UpsertPaymentReconciliationExceptionRef;

export function upsertPaymentReconciliationException(vars: UpsertPaymentReconciliationExceptionVariables): MutationPromise<UpsertPaymentReconciliationExceptionData, UpsertPaymentReconciliationExceptionVariables>;
export function upsertPaymentReconciliationException(dc: DataConnect, vars: UpsertPaymentReconciliationExceptionVariables): MutationPromise<UpsertPaymentReconciliationExceptionData, UpsertPaymentReconciliationExceptionVariables>;

interface UpdateBookingPreferencesFromCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateBookingPreferencesFromCallableVariables): MutationRef<UpdateBookingPreferencesFromCallableData, UpdateBookingPreferencesFromCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateBookingPreferencesFromCallableVariables): MutationRef<UpdateBookingPreferencesFromCallableData, UpdateBookingPreferencesFromCallableVariables>;
  operationName: string;
}
export const updateBookingPreferencesFromCallableRef: UpdateBookingPreferencesFromCallableRef;

export function updateBookingPreferencesFromCallable(vars: UpdateBookingPreferencesFromCallableVariables): MutationPromise<UpdateBookingPreferencesFromCallableData, UpdateBookingPreferencesFromCallableVariables>;
export function updateBookingPreferencesFromCallable(dc: DataConnect, vars: UpdateBookingPreferencesFromCallableVariables): MutationPromise<UpdateBookingPreferencesFromCallableData, UpdateBookingPreferencesFromCallableVariables>;

interface DeleteBookingLineFromCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteBookingLineFromCallableVariables): MutationRef<DeleteBookingLineFromCallableData, DeleteBookingLineFromCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteBookingLineFromCallableVariables): MutationRef<DeleteBookingLineFromCallableData, DeleteBookingLineFromCallableVariables>;
  operationName: string;
}
export const deleteBookingLineFromCallableRef: DeleteBookingLineFromCallableRef;

export function deleteBookingLineFromCallable(vars: DeleteBookingLineFromCallableVariables): MutationPromise<DeleteBookingLineFromCallableData, DeleteBookingLineFromCallableVariables>;
export function deleteBookingLineFromCallable(dc: DataConnect, vars: DeleteBookingLineFromCallableVariables): MutationPromise<DeleteBookingLineFromCallableData, DeleteBookingLineFromCallableVariables>;

interface CreateGuestTicketRequestFromCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateGuestTicketRequestFromCallableVariables): MutationRef<CreateGuestTicketRequestFromCallableData, CreateGuestTicketRequestFromCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateGuestTicketRequestFromCallableVariables): MutationRef<CreateGuestTicketRequestFromCallableData, CreateGuestTicketRequestFromCallableVariables>;
  operationName: string;
}
export const createGuestTicketRequestFromCallableRef: CreateGuestTicketRequestFromCallableRef;

export function createGuestTicketRequestFromCallable(vars: CreateGuestTicketRequestFromCallableVariables): MutationPromise<CreateGuestTicketRequestFromCallableData, CreateGuestTicketRequestFromCallableVariables>;
export function createGuestTicketRequestFromCallable(dc: DataConnect, vars: CreateGuestTicketRequestFromCallableVariables): MutationPromise<CreateGuestTicketRequestFromCallableData, CreateGuestTicketRequestFromCallableVariables>;

interface GetGuestTicketRequestByIdForCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetGuestTicketRequestByIdForCallableVariables): QueryRef<GetGuestTicketRequestByIdForCallableData, GetGuestTicketRequestByIdForCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetGuestTicketRequestByIdForCallableVariables): QueryRef<GetGuestTicketRequestByIdForCallableData, GetGuestTicketRequestByIdForCallableVariables>;
  operationName: string;
}
export const getGuestTicketRequestByIdForCallableRef: GetGuestTicketRequestByIdForCallableRef;

export function getGuestTicketRequestByIdForCallable(vars: GetGuestTicketRequestByIdForCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetGuestTicketRequestByIdForCallableData, GetGuestTicketRequestByIdForCallableVariables>;
export function getGuestTicketRequestByIdForCallable(dc: DataConnect, vars: GetGuestTicketRequestByIdForCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetGuestTicketRequestByIdForCallableData, GetGuestTicketRequestByIdForCallableVariables>;

interface AdminReviewGuestTicketRequestFromCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminReviewGuestTicketRequestFromCallableVariables): MutationRef<AdminReviewGuestTicketRequestFromCallableData, AdminReviewGuestTicketRequestFromCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminReviewGuestTicketRequestFromCallableVariables): MutationRef<AdminReviewGuestTicketRequestFromCallableData, AdminReviewGuestTicketRequestFromCallableVariables>;
  operationName: string;
}
export const adminReviewGuestTicketRequestFromCallableRef: AdminReviewGuestTicketRequestFromCallableRef;

export function adminReviewGuestTicketRequestFromCallable(vars: AdminReviewGuestTicketRequestFromCallableVariables): MutationPromise<AdminReviewGuestTicketRequestFromCallableData, AdminReviewGuestTicketRequestFromCallableVariables>;
export function adminReviewGuestTicketRequestFromCallable(dc: DataConnect, vars: AdminReviewGuestTicketRequestFromCallableVariables): MutationPromise<AdminReviewGuestTicketRequestFromCallableData, AdminReviewGuestTicketRequestFromCallableVariables>;

interface GetBookingForGuestTicketCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetBookingForGuestTicketCallableVariables): QueryRef<GetBookingForGuestTicketCallableData, GetBookingForGuestTicketCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetBookingForGuestTicketCallableVariables): QueryRef<GetBookingForGuestTicketCallableData, GetBookingForGuestTicketCallableVariables>;
  operationName: string;
}
export const getBookingForGuestTicketCallableRef: GetBookingForGuestTicketCallableRef;

export function getBookingForGuestTicketCallable(vars: GetBookingForGuestTicketCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetBookingForGuestTicketCallableData, GetBookingForGuestTicketCallableVariables>;
export function getBookingForGuestTicketCallable(dc: DataConnect, vars: GetBookingForGuestTicketCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetBookingForGuestTicketCallableData, GetBookingForGuestTicketCallableVariables>;

interface GetBookingForNotificationRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetBookingForNotificationVariables): QueryRef<GetBookingForNotificationData, GetBookingForNotificationVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetBookingForNotificationVariables): QueryRef<GetBookingForNotificationData, GetBookingForNotificationVariables>;
  operationName: string;
}
export const getBookingForNotificationRef: GetBookingForNotificationRef;

export function getBookingForNotification(vars: GetBookingForNotificationVariables, options?: ExecuteQueryOptions): QueryPromise<GetBookingForNotificationData, GetBookingForNotificationVariables>;
export function getBookingForNotification(dc: DataConnect, vars: GetBookingForNotificationVariables, options?: ExecuteQueryOptions): QueryPromise<GetBookingForNotificationData, GetBookingForNotificationVariables>;

interface ListStaleDraftBookingsForSchedulerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStaleDraftBookingsForSchedulerVariables): QueryRef<ListStaleDraftBookingsForSchedulerData, ListStaleDraftBookingsForSchedulerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListStaleDraftBookingsForSchedulerVariables): QueryRef<ListStaleDraftBookingsForSchedulerData, ListStaleDraftBookingsForSchedulerVariables>;
  operationName: string;
}
export const listStaleDraftBookingsForSchedulerRef: ListStaleDraftBookingsForSchedulerRef;

export function listStaleDraftBookingsForScheduler(vars: ListStaleDraftBookingsForSchedulerVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaleDraftBookingsForSchedulerData, ListStaleDraftBookingsForSchedulerVariables>;
export function listStaleDraftBookingsForScheduler(dc: DataConnect, vars: ListStaleDraftBookingsForSchedulerVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaleDraftBookingsForSchedulerData, ListStaleDraftBookingsForSchedulerVariables>;

interface ListStalePendingTicketOrdersForSchedulerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStalePendingTicketOrdersForSchedulerVariables): QueryRef<ListStalePendingTicketOrdersForSchedulerData, ListStalePendingTicketOrdersForSchedulerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListStalePendingTicketOrdersForSchedulerVariables): QueryRef<ListStalePendingTicketOrdersForSchedulerData, ListStalePendingTicketOrdersForSchedulerVariables>;
  operationName: string;
}
export const listStalePendingTicketOrdersForSchedulerRef: ListStalePendingTicketOrdersForSchedulerRef;

export function listStalePendingTicketOrdersForScheduler(vars: ListStalePendingTicketOrdersForSchedulerVariables, options?: ExecuteQueryOptions): QueryPromise<ListStalePendingTicketOrdersForSchedulerData, ListStalePendingTicketOrdersForSchedulerVariables>;
export function listStalePendingTicketOrdersForScheduler(dc: DataConnect, vars: ListStalePendingTicketOrdersForSchedulerVariables, options?: ExecuteQueryOptions): QueryPromise<ListStalePendingTicketOrdersForSchedulerData, ListStalePendingTicketOrdersForSchedulerVariables>;

interface GetGuestTicketRequestForNotificationRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetGuestTicketRequestForNotificationVariables): QueryRef<GetGuestTicketRequestForNotificationData, GetGuestTicketRequestForNotificationVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetGuestTicketRequestForNotificationVariables): QueryRef<GetGuestTicketRequestForNotificationData, GetGuestTicketRequestForNotificationVariables>;
  operationName: string;
}
export const getGuestTicketRequestForNotificationRef: GetGuestTicketRequestForNotificationRef;

export function getGuestTicketRequestForNotification(vars: GetGuestTicketRequestForNotificationVariables, options?: ExecuteQueryOptions): QueryPromise<GetGuestTicketRequestForNotificationData, GetGuestTicketRequestForNotificationVariables>;
export function getGuestTicketRequestForNotification(dc: DataConnect, vars: GetGuestTicketRequestForNotificationVariables, options?: ExecuteQueryOptions): QueryPromise<GetGuestTicketRequestForNotificationData, GetGuestTicketRequestForNotificationVariables>;

interface GetSectionAnnouncementOptOutsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionAnnouncementOptOutsVariables): QueryRef<GetSectionAnnouncementOptOutsData, GetSectionAnnouncementOptOutsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSectionAnnouncementOptOutsVariables): QueryRef<GetSectionAnnouncementOptOutsData, GetSectionAnnouncementOptOutsVariables>;
  operationName: string;
}
export const getSectionAnnouncementOptOutsRef: GetSectionAnnouncementOptOutsRef;

export function getSectionAnnouncementOptOuts(vars: GetSectionAnnouncementOptOutsVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionAnnouncementOptOutsData, GetSectionAnnouncementOptOutsVariables>;
export function getSectionAnnouncementOptOuts(dc: DataConnect, vars: GetSectionAnnouncementOptOutsVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionAnnouncementOptOutsData, GetSectionAnnouncementOptOutsVariables>;

interface CreateAnnouncementSendRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAnnouncementSendVariables): MutationRef<CreateAnnouncementSendData, CreateAnnouncementSendVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAnnouncementSendVariables): MutationRef<CreateAnnouncementSendData, CreateAnnouncementSendVariables>;
  operationName: string;
}
export const createAnnouncementSendRef: CreateAnnouncementSendRef;

export function createAnnouncementSend(vars: CreateAnnouncementSendVariables): MutationPromise<CreateAnnouncementSendData, CreateAnnouncementSendVariables>;
export function createAnnouncementSend(dc: DataConnect, vars: CreateAnnouncementSendVariables): MutationPromise<CreateAnnouncementSendData, CreateAnnouncementSendVariables>;

interface CreateAnnouncementSendWithDeliveryModeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAnnouncementSendWithDeliveryModeVariables): MutationRef<CreateAnnouncementSendWithDeliveryModeData, CreateAnnouncementSendWithDeliveryModeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAnnouncementSendWithDeliveryModeVariables): MutationRef<CreateAnnouncementSendWithDeliveryModeData, CreateAnnouncementSendWithDeliveryModeVariables>;
  operationName: string;
}
export const createAnnouncementSendWithDeliveryModeRef: CreateAnnouncementSendWithDeliveryModeRef;

export function createAnnouncementSendWithDeliveryMode(vars: CreateAnnouncementSendWithDeliveryModeVariables): MutationPromise<CreateAnnouncementSendWithDeliveryModeData, CreateAnnouncementSendWithDeliveryModeVariables>;
export function createAnnouncementSendWithDeliveryMode(dc: DataConnect, vars: CreateAnnouncementSendWithDeliveryModeVariables): MutationPromise<CreateAnnouncementSendWithDeliveryModeData, CreateAnnouncementSendWithDeliveryModeVariables>;

interface CreateAnnouncementRecipientRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAnnouncementRecipientVariables): MutationRef<CreateAnnouncementRecipientData, CreateAnnouncementRecipientVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAnnouncementRecipientVariables): MutationRef<CreateAnnouncementRecipientData, CreateAnnouncementRecipientVariables>;
  operationName: string;
}
export const createAnnouncementRecipientRef: CreateAnnouncementRecipientRef;

export function createAnnouncementRecipient(vars: CreateAnnouncementRecipientVariables): MutationPromise<CreateAnnouncementRecipientData, CreateAnnouncementRecipientVariables>;
export function createAnnouncementRecipient(dc: DataConnect, vars: CreateAnnouncementRecipientVariables): MutationPromise<CreateAnnouncementRecipientData, CreateAnnouncementRecipientVariables>;

interface CreateAnnouncementRecipientWithDeliveryModeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAnnouncementRecipientWithDeliveryModeVariables): MutationRef<CreateAnnouncementRecipientWithDeliveryModeData, CreateAnnouncementRecipientWithDeliveryModeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAnnouncementRecipientWithDeliveryModeVariables): MutationRef<CreateAnnouncementRecipientWithDeliveryModeData, CreateAnnouncementRecipientWithDeliveryModeVariables>;
  operationName: string;
}
export const createAnnouncementRecipientWithDeliveryModeRef: CreateAnnouncementRecipientWithDeliveryModeRef;

export function createAnnouncementRecipientWithDeliveryMode(vars: CreateAnnouncementRecipientWithDeliveryModeVariables): MutationPromise<CreateAnnouncementRecipientWithDeliveryModeData, CreateAnnouncementRecipientWithDeliveryModeVariables>;
export function createAnnouncementRecipientWithDeliveryMode(dc: DataConnect, vars: CreateAnnouncementRecipientWithDeliveryModeVariables): MutationPromise<CreateAnnouncementRecipientWithDeliveryModeData, CreateAnnouncementRecipientWithDeliveryModeVariables>;

interface GetAnnouncementRecipientProgressRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAnnouncementRecipientProgressVariables): QueryRef<GetAnnouncementRecipientProgressData, GetAnnouncementRecipientProgressVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetAnnouncementRecipientProgressVariables): QueryRef<GetAnnouncementRecipientProgressData, GetAnnouncementRecipientProgressVariables>;
  operationName: string;
}
export const getAnnouncementRecipientProgressRef: GetAnnouncementRecipientProgressRef;

export function getAnnouncementRecipientProgress(vars: GetAnnouncementRecipientProgressVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementRecipientProgressData, GetAnnouncementRecipientProgressVariables>;
export function getAnnouncementRecipientProgress(dc: DataConnect, vars: GetAnnouncementRecipientProgressVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementRecipientProgressData, GetAnnouncementRecipientProgressVariables>;

interface GetAnnouncementRecipientsForResumeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAnnouncementRecipientsForResumeVariables): QueryRef<GetAnnouncementRecipientsForResumeData, GetAnnouncementRecipientsForResumeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetAnnouncementRecipientsForResumeVariables): QueryRef<GetAnnouncementRecipientsForResumeData, GetAnnouncementRecipientsForResumeVariables>;
  operationName: string;
}
export const getAnnouncementRecipientsForResumeRef: GetAnnouncementRecipientsForResumeRef;

export function getAnnouncementRecipientsForResume(vars: GetAnnouncementRecipientsForResumeVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementRecipientsForResumeData, GetAnnouncementRecipientsForResumeVariables>;
export function getAnnouncementRecipientsForResume(dc: DataConnect, vars: GetAnnouncementRecipientsForResumeVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementRecipientsForResumeData, GetAnnouncementRecipientsForResumeVariables>;

interface GetAnnouncementSendHistoryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAnnouncementSendHistoryVariables): QueryRef<GetAnnouncementSendHistoryData, GetAnnouncementSendHistoryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetAnnouncementSendHistoryVariables): QueryRef<GetAnnouncementSendHistoryData, GetAnnouncementSendHistoryVariables>;
  operationName: string;
}
export const getAnnouncementSendHistoryRef: GetAnnouncementSendHistoryRef;

export function getAnnouncementSendHistory(vars: GetAnnouncementSendHistoryVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementSendHistoryData, GetAnnouncementSendHistoryVariables>;
export function getAnnouncementSendHistory(dc: DataConnect, vars: GetAnnouncementSendHistoryVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementSendHistoryData, GetAnnouncementSendHistoryVariables>;

interface GetAnnouncementSendRecipientsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAnnouncementSendRecipientsVariables): QueryRef<GetAnnouncementSendRecipientsData, GetAnnouncementSendRecipientsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetAnnouncementSendRecipientsVariables): QueryRef<GetAnnouncementSendRecipientsData, GetAnnouncementSendRecipientsVariables>;
  operationName: string;
}
export const getAnnouncementSendRecipientsRef: GetAnnouncementSendRecipientsRef;

export function getAnnouncementSendRecipients(vars: GetAnnouncementSendRecipientsVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementSendRecipientsData, GetAnnouncementSendRecipientsVariables>;
export function getAnnouncementSendRecipients(dc: DataConnect, vars: GetAnnouncementSendRecipientsVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementSendRecipientsData, GetAnnouncementSendRecipientsVariables>;

interface GetAnnouncementSendByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAnnouncementSendByIdVariables): QueryRef<GetAnnouncementSendByIdData, GetAnnouncementSendByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetAnnouncementSendByIdVariables): QueryRef<GetAnnouncementSendByIdData, GetAnnouncementSendByIdVariables>;
  operationName: string;
}
export const getAnnouncementSendByIdRef: GetAnnouncementSendByIdRef;

export function getAnnouncementSendById(vars: GetAnnouncementSendByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementSendByIdData, GetAnnouncementSendByIdVariables>;
export function getAnnouncementSendById(dc: DataConnect, vars: GetAnnouncementSendByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementSendByIdData, GetAnnouncementSendByIdVariables>;

interface GetAnnouncementRecipientBySendAndUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAnnouncementRecipientBySendAndUserVariables): QueryRef<GetAnnouncementRecipientBySendAndUserData, GetAnnouncementRecipientBySendAndUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetAnnouncementRecipientBySendAndUserVariables): QueryRef<GetAnnouncementRecipientBySendAndUserData, GetAnnouncementRecipientBySendAndUserVariables>;
  operationName: string;
}
export const getAnnouncementRecipientBySendAndUserRef: GetAnnouncementRecipientBySendAndUserRef;

export function getAnnouncementRecipientBySendAndUser(vars: GetAnnouncementRecipientBySendAndUserVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementRecipientBySendAndUserData, GetAnnouncementRecipientBySendAndUserVariables>;
export function getAnnouncementRecipientBySendAndUser(dc: DataConnect, vars: GetAnnouncementRecipientBySendAndUserVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementRecipientBySendAndUserData, GetAnnouncementRecipientBySendAndUserVariables>;

interface TryUpdateAnnouncementRecipientProcessingStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: TryUpdateAnnouncementRecipientProcessingStatusVariables): MutationRef<TryUpdateAnnouncementRecipientProcessingStatusData, TryUpdateAnnouncementRecipientProcessingStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: TryUpdateAnnouncementRecipientProcessingStatusVariables): MutationRef<TryUpdateAnnouncementRecipientProcessingStatusData, TryUpdateAnnouncementRecipientProcessingStatusVariables>;
  operationName: string;
}
export const tryUpdateAnnouncementRecipientProcessingStatusRef: TryUpdateAnnouncementRecipientProcessingStatusRef;

export function tryUpdateAnnouncementRecipientProcessingStatus(vars: TryUpdateAnnouncementRecipientProcessingStatusVariables): MutationPromise<TryUpdateAnnouncementRecipientProcessingStatusData, TryUpdateAnnouncementRecipientProcessingStatusVariables>;
export function tryUpdateAnnouncementRecipientProcessingStatus(dc: DataConnect, vars: TryUpdateAnnouncementRecipientProcessingStatusVariables): MutationPromise<TryUpdateAnnouncementRecipientProcessingStatusData, TryUpdateAnnouncementRecipientProcessingStatusVariables>;

interface TryMarkAnnouncementRecipientEnqueueFailedRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: TryMarkAnnouncementRecipientEnqueueFailedVariables): MutationRef<TryMarkAnnouncementRecipientEnqueueFailedData, TryMarkAnnouncementRecipientEnqueueFailedVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: TryMarkAnnouncementRecipientEnqueueFailedVariables): MutationRef<TryMarkAnnouncementRecipientEnqueueFailedData, TryMarkAnnouncementRecipientEnqueueFailedVariables>;
  operationName: string;
}
export const tryMarkAnnouncementRecipientEnqueueFailedRef: TryMarkAnnouncementRecipientEnqueueFailedRef;

export function tryMarkAnnouncementRecipientEnqueueFailed(vars: TryMarkAnnouncementRecipientEnqueueFailedVariables): MutationPromise<TryMarkAnnouncementRecipientEnqueueFailedData, TryMarkAnnouncementRecipientEnqueueFailedVariables>;
export function tryMarkAnnouncementRecipientEnqueueFailed(dc: DataConnect, vars: TryMarkAnnouncementRecipientEnqueueFailedVariables): MutationPromise<TryMarkAnnouncementRecipientEnqueueFailedData, TryMarkAnnouncementRecipientEnqueueFailedVariables>;

interface TryUpdateAnnouncementRecipientDeliveryStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: TryUpdateAnnouncementRecipientDeliveryStatusVariables): MutationRef<TryUpdateAnnouncementRecipientDeliveryStatusData, TryUpdateAnnouncementRecipientDeliveryStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: TryUpdateAnnouncementRecipientDeliveryStatusVariables): MutationRef<TryUpdateAnnouncementRecipientDeliveryStatusData, TryUpdateAnnouncementRecipientDeliveryStatusVariables>;
  operationName: string;
}
export const tryUpdateAnnouncementRecipientDeliveryStatusRef: TryUpdateAnnouncementRecipientDeliveryStatusRef;

export function tryUpdateAnnouncementRecipientDeliveryStatus(vars: TryUpdateAnnouncementRecipientDeliveryStatusVariables): MutationPromise<TryUpdateAnnouncementRecipientDeliveryStatusData, TryUpdateAnnouncementRecipientDeliveryStatusVariables>;
export function tryUpdateAnnouncementRecipientDeliveryStatus(dc: DataConnect, vars: TryUpdateAnnouncementRecipientDeliveryStatusVariables): MutationPromise<TryUpdateAnnouncementRecipientDeliveryStatusData, TryUpdateAnnouncementRecipientDeliveryStatusVariables>;

interface GetUserByEmailRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByEmailVariables): QueryRef<GetUserByEmailData, GetUserByEmailVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserByEmailVariables): QueryRef<GetUserByEmailData, GetUserByEmailVariables>;
  operationName: string;
}
export const getUserByEmailRef: GetUserByEmailRef;

export function getUserByEmail(vars: GetUserByEmailVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByEmailData, GetUserByEmailVariables>;
export function getUserByEmail(dc: DataConnect, vars: GetUserByEmailVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByEmailData, GetUserByEmailVariables>;

interface GetNotifyCallbackUserByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetNotifyCallbackUserByIdVariables): QueryRef<GetNotifyCallbackUserByIdData, GetNotifyCallbackUserByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetNotifyCallbackUserByIdVariables): QueryRef<GetNotifyCallbackUserByIdData, GetNotifyCallbackUserByIdVariables>;
  operationName: string;
}
export const getNotifyCallbackUserByIdRef: GetNotifyCallbackUserByIdRef;

export function getNotifyCallbackUserById(vars: GetNotifyCallbackUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetNotifyCallbackUserByIdData, GetNotifyCallbackUserByIdVariables>;
export function getNotifyCallbackUserById(dc: DataConnect, vars: GetNotifyCallbackUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetNotifyCallbackUserByIdData, GetNotifyCallbackUserByIdVariables>;

interface TryApplyNotifyDeliveryUserStateRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: TryApplyNotifyDeliveryUserStateVariables): MutationRef<TryApplyNotifyDeliveryUserStateData, TryApplyNotifyDeliveryUserStateVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: TryApplyNotifyDeliveryUserStateVariables): MutationRef<TryApplyNotifyDeliveryUserStateData, TryApplyNotifyDeliveryUserStateVariables>;
  operationName: string;
}
export const tryApplyNotifyDeliveryUserStateRef: TryApplyNotifyDeliveryUserStateRef;

export function tryApplyNotifyDeliveryUserState(vars: TryApplyNotifyDeliveryUserStateVariables): MutationPromise<TryApplyNotifyDeliveryUserStateData, TryApplyNotifyDeliveryUserStateVariables>;
export function tryApplyNotifyDeliveryUserState(dc: DataConnect, vars: TryApplyNotifyDeliveryUserStateVariables): MutationPromise<TryApplyNotifyDeliveryUserStateData, TryApplyNotifyDeliveryUserStateVariables>;

interface TryApplyNotifyDeliveryUserStateAndMarkLostRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: TryApplyNotifyDeliveryUserStateAndMarkLostVariables): MutationRef<TryApplyNotifyDeliveryUserStateAndMarkLostData, TryApplyNotifyDeliveryUserStateAndMarkLostVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: TryApplyNotifyDeliveryUserStateAndMarkLostVariables): MutationRef<TryApplyNotifyDeliveryUserStateAndMarkLostData, TryApplyNotifyDeliveryUserStateAndMarkLostVariables>;
  operationName: string;
}
export const tryApplyNotifyDeliveryUserStateAndMarkLostRef: TryApplyNotifyDeliveryUserStateAndMarkLostRef;

export function tryApplyNotifyDeliveryUserStateAndMarkLost(vars: TryApplyNotifyDeliveryUserStateAndMarkLostVariables): MutationPromise<TryApplyNotifyDeliveryUserStateAndMarkLostData, TryApplyNotifyDeliveryUserStateAndMarkLostVariables>;
export function tryApplyNotifyDeliveryUserStateAndMarkLost(dc: DataConnect, vars: TryApplyNotifyDeliveryUserStateAndMarkLostVariables): MutationPromise<TryApplyNotifyDeliveryUserStateAndMarkLostData, TryApplyNotifyDeliveryUserStateAndMarkLostVariables>;

interface GetNotifyDeliveryReceiptRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetNotifyDeliveryReceiptVariables): QueryRef<GetNotifyDeliveryReceiptData, GetNotifyDeliveryReceiptVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetNotifyDeliveryReceiptVariables): QueryRef<GetNotifyDeliveryReceiptData, GetNotifyDeliveryReceiptVariables>;
  operationName: string;
}
export const getNotifyDeliveryReceiptRef: GetNotifyDeliveryReceiptRef;

export function getNotifyDeliveryReceipt(vars: GetNotifyDeliveryReceiptVariables, options?: ExecuteQueryOptions): QueryPromise<GetNotifyDeliveryReceiptData, GetNotifyDeliveryReceiptVariables>;
export function getNotifyDeliveryReceipt(dc: DataConnect, vars: GetNotifyDeliveryReceiptVariables, options?: ExecuteQueryOptions): QueryPromise<GetNotifyDeliveryReceiptData, GetNotifyDeliveryReceiptVariables>;

interface CreateNotifyDeliveryReceiptRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNotifyDeliveryReceiptVariables): MutationRef<CreateNotifyDeliveryReceiptData, CreateNotifyDeliveryReceiptVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateNotifyDeliveryReceiptVariables): MutationRef<CreateNotifyDeliveryReceiptData, CreateNotifyDeliveryReceiptVariables>;
  operationName: string;
}
export const createNotifyDeliveryReceiptRef: CreateNotifyDeliveryReceiptRef;

export function createNotifyDeliveryReceipt(vars: CreateNotifyDeliveryReceiptVariables): MutationPromise<CreateNotifyDeliveryReceiptData, CreateNotifyDeliveryReceiptVariables>;
export function createNotifyDeliveryReceipt(dc: DataConnect, vars: CreateNotifyDeliveryReceiptVariables): MutationPromise<CreateNotifyDeliveryReceiptData, CreateNotifyDeliveryReceiptVariables>;

interface ClaimNotifyDeliveryReceiptRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ClaimNotifyDeliveryReceiptVariables): MutationRef<ClaimNotifyDeliveryReceiptData, ClaimNotifyDeliveryReceiptVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ClaimNotifyDeliveryReceiptVariables): MutationRef<ClaimNotifyDeliveryReceiptData, ClaimNotifyDeliveryReceiptVariables>;
  operationName: string;
}
export const claimNotifyDeliveryReceiptRef: ClaimNotifyDeliveryReceiptRef;

export function claimNotifyDeliveryReceipt(vars: ClaimNotifyDeliveryReceiptVariables): MutationPromise<ClaimNotifyDeliveryReceiptData, ClaimNotifyDeliveryReceiptVariables>;
export function claimNotifyDeliveryReceipt(dc: DataConnect, vars: ClaimNotifyDeliveryReceiptVariables): MutationPromise<ClaimNotifyDeliveryReceiptData, ClaimNotifyDeliveryReceiptVariables>;

interface MarkNotifyDeliveryReceiptProcessedRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkNotifyDeliveryReceiptProcessedVariables): MutationRef<MarkNotifyDeliveryReceiptProcessedData, MarkNotifyDeliveryReceiptProcessedVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MarkNotifyDeliveryReceiptProcessedVariables): MutationRef<MarkNotifyDeliveryReceiptProcessedData, MarkNotifyDeliveryReceiptProcessedVariables>;
  operationName: string;
}
export const markNotifyDeliveryReceiptProcessedRef: MarkNotifyDeliveryReceiptProcessedRef;

export function markNotifyDeliveryReceiptProcessed(vars: MarkNotifyDeliveryReceiptProcessedVariables): MutationPromise<MarkNotifyDeliveryReceiptProcessedData, MarkNotifyDeliveryReceiptProcessedVariables>;
export function markNotifyDeliveryReceiptProcessed(dc: DataConnect, vars: MarkNotifyDeliveryReceiptProcessedVariables): MutationPromise<MarkNotifyDeliveryReceiptProcessedData, MarkNotifyDeliveryReceiptProcessedVariables>;

interface MarkNotifyDeliveryReceiptFailedRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkNotifyDeliveryReceiptFailedVariables): MutationRef<MarkNotifyDeliveryReceiptFailedData, MarkNotifyDeliveryReceiptFailedVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MarkNotifyDeliveryReceiptFailedVariables): MutationRef<MarkNotifyDeliveryReceiptFailedData, MarkNotifyDeliveryReceiptFailedVariables>;
  operationName: string;
}
export const markNotifyDeliveryReceiptFailedRef: MarkNotifyDeliveryReceiptFailedRef;

export function markNotifyDeliveryReceiptFailed(vars: MarkNotifyDeliveryReceiptFailedVariables): MutationPromise<MarkNotifyDeliveryReceiptFailedData, MarkNotifyDeliveryReceiptFailedVariables>;
export function markNotifyDeliveryReceiptFailed(dc: DataConnect, vars: MarkNotifyDeliveryReceiptFailedVariables): MutationPromise<MarkNotifyDeliveryReceiptFailedData, MarkNotifyDeliveryReceiptFailedVariables>;

interface GetRecentNotifyDeliveryReceiptsForUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetRecentNotifyDeliveryReceiptsForUserVariables): QueryRef<GetRecentNotifyDeliveryReceiptsForUserData, GetRecentNotifyDeliveryReceiptsForUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetRecentNotifyDeliveryReceiptsForUserVariables): QueryRef<GetRecentNotifyDeliveryReceiptsForUserData, GetRecentNotifyDeliveryReceiptsForUserVariables>;
  operationName: string;
}
export const getRecentNotifyDeliveryReceiptsForUserRef: GetRecentNotifyDeliveryReceiptsForUserRef;

export function getRecentNotifyDeliveryReceiptsForUser(vars: GetRecentNotifyDeliveryReceiptsForUserVariables, options?: ExecuteQueryOptions): QueryPromise<GetRecentNotifyDeliveryReceiptsForUserData, GetRecentNotifyDeliveryReceiptsForUserVariables>;
export function getRecentNotifyDeliveryReceiptsForUser(dc: DataConnect, vars: GetRecentNotifyDeliveryReceiptsForUserVariables, options?: ExecuteQueryOptions): QueryPromise<GetRecentNotifyDeliveryReceiptsForUserData, GetRecentNotifyDeliveryReceiptsForUserVariables>;

interface GetLatestNotifyDeliveryReceiptForReferenceRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetLatestNotifyDeliveryReceiptForReferenceVariables): QueryRef<GetLatestNotifyDeliveryReceiptForReferenceData, GetLatestNotifyDeliveryReceiptForReferenceVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetLatestNotifyDeliveryReceiptForReferenceVariables): QueryRef<GetLatestNotifyDeliveryReceiptForReferenceData, GetLatestNotifyDeliveryReceiptForReferenceVariables>;
  operationName: string;
}
export const getLatestNotifyDeliveryReceiptForReferenceRef: GetLatestNotifyDeliveryReceiptForReferenceRef;

export function getLatestNotifyDeliveryReceiptForReference(vars: GetLatestNotifyDeliveryReceiptForReferenceVariables, options?: ExecuteQueryOptions): QueryPromise<GetLatestNotifyDeliveryReceiptForReferenceData, GetLatestNotifyDeliveryReceiptForReferenceVariables>;
export function getLatestNotifyDeliveryReceiptForReference(dc: DataConnect, vars: GetLatestNotifyDeliveryReceiptForReferenceVariables, options?: ExecuteQueryOptions): QueryPromise<GetLatestNotifyDeliveryReceiptForReferenceData, GetLatestNotifyDeliveryReceiptForReferenceVariables>;

interface AdminOptOutSectionAnnouncementRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminOptOutSectionAnnouncementVariables): MutationRef<AdminOptOutSectionAnnouncementData, AdminOptOutSectionAnnouncementVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminOptOutSectionAnnouncementVariables): MutationRef<AdminOptOutSectionAnnouncementData, AdminOptOutSectionAnnouncementVariables>;
  operationName: string;
}
export const adminOptOutSectionAnnouncementRef: AdminOptOutSectionAnnouncementRef;

export function adminOptOutSectionAnnouncement(vars: AdminOptOutSectionAnnouncementVariables): MutationPromise<AdminOptOutSectionAnnouncementData, AdminOptOutSectionAnnouncementVariables>;
export function adminOptOutSectionAnnouncement(dc: DataConnect, vars: AdminOptOutSectionAnnouncementVariables): MutationPromise<AdminOptOutSectionAnnouncementData, AdminOptOutSectionAnnouncementVariables>;

interface AdminOptInSectionAnnouncementRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminOptInSectionAnnouncementVariables): MutationRef<AdminOptInSectionAnnouncementData, AdminOptInSectionAnnouncementVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminOptInSectionAnnouncementVariables): MutationRef<AdminOptInSectionAnnouncementData, AdminOptInSectionAnnouncementVariables>;
  operationName: string;
}
export const adminOptInSectionAnnouncementRef: AdminOptInSectionAnnouncementRef;

export function adminOptInSectionAnnouncement(vars: AdminOptInSectionAnnouncementVariables): MutationPromise<AdminOptInSectionAnnouncementData, AdminOptInSectionAnnouncementVariables>;
export function adminOptInSectionAnnouncement(dc: DataConnect, vars: AdminOptInSectionAnnouncementVariables): MutationPromise<AdminOptInSectionAnnouncementData, AdminOptInSectionAnnouncementVariables>;

interface GetCallableInvocationRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetCallableInvocationVariables): QueryRef<GetCallableInvocationData, GetCallableInvocationVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetCallableInvocationVariables): QueryRef<GetCallableInvocationData, GetCallableInvocationVariables>;
  operationName: string;
}
export const getCallableInvocationRef: GetCallableInvocationRef;

export function getCallableInvocation(vars: GetCallableInvocationVariables, options?: ExecuteQueryOptions): QueryPromise<GetCallableInvocationData, GetCallableInvocationVariables>;
export function getCallableInvocation(dc: DataConnect, vars: GetCallableInvocationVariables, options?: ExecuteQueryOptions): QueryPromise<GetCallableInvocationData, GetCallableInvocationVariables>;

interface UpsertCallableInvocationRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertCallableInvocationVariables): MutationRef<UpsertCallableInvocationData, UpsertCallableInvocationVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertCallableInvocationVariables): MutationRef<UpsertCallableInvocationData, UpsertCallableInvocationVariables>;
  operationName: string;
}
export const upsertCallableInvocationRef: UpsertCallableInvocationRef;

export function upsertCallableInvocation(vars: UpsertCallableInvocationVariables): MutationPromise<UpsertCallableInvocationData, UpsertCallableInvocationVariables>;
export function upsertCallableInvocation(dc: DataConnect, vars: UpsertCallableInvocationVariables): MutationPromise<UpsertCallableInvocationData, UpsertCallableInvocationVariables>;

interface EnsureCallableRateLimitBucketRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: EnsureCallableRateLimitBucketVariables): MutationRef<EnsureCallableRateLimitBucketData, EnsureCallableRateLimitBucketVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: EnsureCallableRateLimitBucketVariables): MutationRef<EnsureCallableRateLimitBucketData, EnsureCallableRateLimitBucketVariables>;
  operationName: string;
}
export const ensureCallableRateLimitBucketRef: EnsureCallableRateLimitBucketRef;

export function ensureCallableRateLimitBucket(vars: EnsureCallableRateLimitBucketVariables): MutationPromise<EnsureCallableRateLimitBucketData, EnsureCallableRateLimitBucketVariables>;
export function ensureCallableRateLimitBucket(dc: DataConnect, vars: EnsureCallableRateLimitBucketVariables): MutationPromise<EnsureCallableRateLimitBucketData, EnsureCallableRateLimitBucketVariables>;

interface ConsumeCallableRateLimitRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ConsumeCallableRateLimitVariables): MutationRef<ConsumeCallableRateLimitData, ConsumeCallableRateLimitVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ConsumeCallableRateLimitVariables): MutationRef<ConsumeCallableRateLimitData, ConsumeCallableRateLimitVariables>;
  operationName: string;
}
export const consumeCallableRateLimitRef: ConsumeCallableRateLimitRef;

export function consumeCallableRateLimit(vars: ConsumeCallableRateLimitVariables): MutationPromise<ConsumeCallableRateLimitData, ConsumeCallableRateLimitVariables>;
export function consumeCallableRateLimit(dc: DataConnect, vars: ConsumeCallableRateLimitVariables): MutationPromise<ConsumeCallableRateLimitData, ConsumeCallableRateLimitVariables>;

interface CreateBookingDraftRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateBookingDraftVariables): MutationRef<CreateBookingDraftData, CreateBookingDraftVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateBookingDraftVariables): MutationRef<CreateBookingDraftData, CreateBookingDraftVariables>;
  operationName: string;
}
export const createBookingDraftRef: CreateBookingDraftRef;

export function createBookingDraft(vars: CreateBookingDraftVariables): MutationPromise<CreateBookingDraftData, CreateBookingDraftVariables>;
export function createBookingDraft(dc: DataConnect, vars: CreateBookingDraftVariables): MutationPromise<CreateBookingDraftData, CreateBookingDraftVariables>;

interface AddBookingLineRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddBookingLineVariables): MutationRef<AddBookingLineData, AddBookingLineVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddBookingLineVariables): MutationRef<AddBookingLineData, AddBookingLineVariables>;
  operationName: string;
}
export const addBookingLineRef: AddBookingLineRef;

export function addBookingLine(vars: AddBookingLineVariables): MutationPromise<AddBookingLineData, AddBookingLineVariables>;
export function addBookingLine(dc: DataConnect, vars: AddBookingLineVariables): MutationPromise<AddBookingLineData, AddBookingLineVariables>;

interface UpdateBookingStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateBookingStatusVariables): MutationRef<UpdateBookingStatusData, UpdateBookingStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateBookingStatusVariables): MutationRef<UpdateBookingStatusData, UpdateBookingStatusVariables>;
  operationName: string;
}
export const updateBookingStatusRef: UpdateBookingStatusRef;

export function updateBookingStatus(vars: UpdateBookingStatusVariables): MutationPromise<UpdateBookingStatusData, UpdateBookingStatusVariables>;
export function updateBookingStatus(dc: DataConnect, vars: UpdateBookingStatusVariables): MutationPromise<UpdateBookingStatusData, UpdateBookingStatusVariables>;

interface CreateGuestTicketRequestRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateGuestTicketRequestVariables): MutationRef<CreateGuestTicketRequestData, CreateGuestTicketRequestVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateGuestTicketRequestVariables): MutationRef<CreateGuestTicketRequestData, CreateGuestTicketRequestVariables>;
  operationName: string;
}
export const createGuestTicketRequestRef: CreateGuestTicketRequestRef;

export function createGuestTicketRequest(vars: CreateGuestTicketRequestVariables): MutationPromise<CreateGuestTicketRequestData, CreateGuestTicketRequestVariables>;
export function createGuestTicketRequest(dc: DataConnect, vars: CreateGuestTicketRequestVariables): MutationPromise<CreateGuestTicketRequestData, CreateGuestTicketRequestVariables>;

interface AdminDeleteGuestTicketRequestRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminDeleteGuestTicketRequestVariables): MutationRef<AdminDeleteGuestTicketRequestData, AdminDeleteGuestTicketRequestVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminDeleteGuestTicketRequestVariables): MutationRef<AdminDeleteGuestTicketRequestData, AdminDeleteGuestTicketRequestVariables>;
  operationName: string;
}
export const adminDeleteGuestTicketRequestRef: AdminDeleteGuestTicketRequestRef;

export function adminDeleteGuestTicketRequest(vars: AdminDeleteGuestTicketRequestVariables): MutationPromise<AdminDeleteGuestTicketRequestData, AdminDeleteGuestTicketRequestVariables>;
export function adminDeleteGuestTicketRequest(dc: DataConnect, vars: AdminDeleteGuestTicketRequestVariables): MutationPromise<AdminDeleteGuestTicketRequestData, AdminDeleteGuestTicketRequestVariables>;

interface AdminReviewGuestTicketRequestRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminReviewGuestTicketRequestVariables): MutationRef<AdminReviewGuestTicketRequestData, AdminReviewGuestTicketRequestVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminReviewGuestTicketRequestVariables): MutationRef<AdminReviewGuestTicketRequestData, AdminReviewGuestTicketRequestVariables>;
  operationName: string;
}
export const adminReviewGuestTicketRequestRef: AdminReviewGuestTicketRequestRef;

export function adminReviewGuestTicketRequest(vars: AdminReviewGuestTicketRequestVariables): MutationPromise<AdminReviewGuestTicketRequestData, AdminReviewGuestTicketRequestVariables>;
export function adminReviewGuestTicketRequest(dc: DataConnect, vars: AdminReviewGuestTicketRequestVariables): MutationPromise<AdminReviewGuestTicketRequestData, AdminReviewGuestTicketRequestVariables>;

interface AdminDeleteBookingLineRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminDeleteBookingLineVariables): MutationRef<AdminDeleteBookingLineData, AdminDeleteBookingLineVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminDeleteBookingLineVariables): MutationRef<AdminDeleteBookingLineData, AdminDeleteBookingLineVariables>;
  operationName: string;
}
export const adminDeleteBookingLineRef: AdminDeleteBookingLineRef;

export function adminDeleteBookingLine(vars: AdminDeleteBookingLineVariables): MutationPromise<AdminDeleteBookingLineData, AdminDeleteBookingLineVariables>;
export function adminDeleteBookingLine(dc: DataConnect, vars: AdminDeleteBookingLineVariables): MutationPromise<AdminDeleteBookingLineData, AdminDeleteBookingLineVariables>;

interface AdminDeleteBookingRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminDeleteBookingVariables): MutationRef<AdminDeleteBookingData, AdminDeleteBookingVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminDeleteBookingVariables): MutationRef<AdminDeleteBookingData, AdminDeleteBookingVariables>;
  operationName: string;
}
export const adminDeleteBookingRef: AdminDeleteBookingRef;

export function adminDeleteBooking(vars: AdminDeleteBookingVariables): MutationPromise<AdminDeleteBookingData, AdminDeleteBookingVariables>;
export function adminDeleteBooking(dc: DataConnect, vars: AdminDeleteBookingVariables): MutationPromise<AdminDeleteBookingData, AdminDeleteBookingVariables>;

interface ResolvePaymentReconciliationExceptionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ResolvePaymentReconciliationExceptionVariables): MutationRef<ResolvePaymentReconciliationExceptionData, ResolvePaymentReconciliationExceptionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ResolvePaymentReconciliationExceptionVariables): MutationRef<ResolvePaymentReconciliationExceptionData, ResolvePaymentReconciliationExceptionVariables>;
  operationName: string;
}
export const resolvePaymentReconciliationExceptionRef: ResolvePaymentReconciliationExceptionRef;

export function resolvePaymentReconciliationException(vars: ResolvePaymentReconciliationExceptionVariables): MutationPromise<ResolvePaymentReconciliationExceptionData, ResolvePaymentReconciliationExceptionVariables>;
export function resolvePaymentReconciliationException(dc: DataConnect, vars: ResolvePaymentReconciliationExceptionVariables): MutationPromise<ResolvePaymentReconciliationExceptionData, ResolvePaymentReconciliationExceptionVariables>;

interface GetCurrentUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetCurrentUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetCurrentUserData, undefined>;
  operationName: string;
}
export const getCurrentUserRef: GetCurrentUserRef;

export function getCurrentUser(options?: ExecuteQueryOptions): QueryPromise<GetCurrentUserData, undefined>;
export function getCurrentUser(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetCurrentUserData, undefined>;

interface GetUserByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
  operationName: string;
}
export const getUserByIdRef: GetUserByIdRef;

export function getUserById(vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;
export function getUserById(dc: DataConnect, vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

interface ListUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
  operationName: string;
}
export const listUsersRef: ListUsersRef;

export function listUsers(options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;
export function listUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface ListSectionsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSectionsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListSectionsData, undefined>;
  operationName: string;
}
export const listSectionsRef: ListSectionsRef;

export function listSections(options?: ExecuteQueryOptions): QueryPromise<ListSectionsData, undefined>;
export function listSections(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListSectionsData, undefined>;

interface GetSectionsForUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetSectionsForUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetSectionsForUserData, undefined>;
  operationName: string;
}
export const getSectionsForUserRef: GetSectionsForUserRef;

export function getSectionsForUser(options?: ExecuteQueryOptions): QueryPromise<GetSectionsForUserData, undefined>;
export function getSectionsForUser(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetSectionsForUserData, undefined>;

interface ListUserGroupsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUserGroupsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListUserGroupsData, undefined>;
  operationName: string;
}
export const listUserGroupsRef: ListUserGroupsRef;

export function listUserGroups(options?: ExecuteQueryOptions): QueryPromise<ListUserGroupsData, undefined>;
export function listUserGroups(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUserGroupsData, undefined>;

interface GetUserAccessGroupsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetUserAccessGroupsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetUserAccessGroupsData, undefined>;
  operationName: string;
}
export const getUserAccessGroupsRef: GetUserAccessGroupsRef;

export function getUserAccessGroups(options?: ExecuteQueryOptions): QueryPromise<GetUserAccessGroupsData, undefined>;
export function getUserAccessGroups(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetUserAccessGroupsData, undefined>;

interface CheckUserProfileExistsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<CheckUserProfileExistsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<CheckUserProfileExistsData, undefined>;
  operationName: string;
}
export const checkUserProfileExistsRef: CheckUserProfileExistsRef;

export function checkUserProfileExists(options?: ExecuteQueryOptions): QueryPromise<CheckUserProfileExistsData, undefined>;
export function checkUserProfileExists(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<CheckUserProfileExistsData, undefined>;

interface GetUserMembershipStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserMembershipStatusVariables): QueryRef<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserMembershipStatusVariables): QueryRef<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;
  operationName: string;
}
export const getUserMembershipStatusRef: GetUserMembershipStatusRef;

export function getUserMembershipStatus(vars: GetUserMembershipStatusVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;
export function getUserMembershipStatus(dc: DataConnect, vars: GetUserMembershipStatusVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;

interface GetUserWithAccessGroupsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserWithAccessGroupsVariables): QueryRef<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserWithAccessGroupsVariables): QueryRef<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;
  operationName: string;
}
export const getUserWithAccessGroupsRef: GetUserWithAccessGroupsRef;

export function getUserWithAccessGroups(vars: GetUserWithAccessGroupsVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;
export function getUserWithAccessGroups(dc: DataConnect, vars: GetUserWithAccessGroupsVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;

interface GetUserAccessGroupsByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserAccessGroupsByIdVariables): QueryRef<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserAccessGroupsByIdVariables): QueryRef<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;
  operationName: string;
}
export const getUserAccessGroupsByIdRef: GetUserAccessGroupsByIdRef;

export function getUserAccessGroupsById(vars: GetUserAccessGroupsByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;
export function getUserAccessGroupsById(dc: DataConnect, vars: GetUserAccessGroupsByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;

interface GetEventsForSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEventsForSectionVariables): QueryRef<GetEventsForSectionData, GetEventsForSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetEventsForSectionVariables): QueryRef<GetEventsForSectionData, GetEventsForSectionVariables>;
  operationName: string;
}
export const getEventsForSectionRef: GetEventsForSectionRef;

export function getEventsForSection(vars: GetEventsForSectionVariables, options?: ExecuteQueryOptions): QueryPromise<GetEventsForSectionData, GetEventsForSectionVariables>;
export function getEventsForSection(dc: DataConnect, vars: GetEventsForSectionVariables, options?: ExecuteQueryOptions): QueryPromise<GetEventsForSectionData, GetEventsForSectionVariables>;

interface GetEventByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEventByIdVariables): QueryRef<GetEventByIdData, GetEventByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetEventByIdVariables): QueryRef<GetEventByIdData, GetEventByIdVariables>;
  operationName: string;
}
export const getEventByIdRef: GetEventByIdRef;

export function getEventById(vars: GetEventByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetEventByIdData, GetEventByIdVariables>;
export function getEventById(dc: DataConnect, vars: GetEventByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetEventByIdData, GetEventByIdVariables>;

interface GetSectionByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionByIdVariables): QueryRef<GetSectionByIdData, GetSectionByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSectionByIdVariables): QueryRef<GetSectionByIdData, GetSectionByIdVariables>;
  operationName: string;
}
export const getSectionByIdRef: GetSectionByIdRef;

export function getSectionById(vars: GetSectionByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionByIdData, GetSectionByIdVariables>;
export function getSectionById(dc: DataConnect, vars: GetSectionByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionByIdData, GetSectionByIdVariables>;

interface GetUserGroupByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserGroupByIdVariables): QueryRef<GetUserGroupByIdData, GetUserGroupByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserGroupByIdVariables): QueryRef<GetUserGroupByIdData, GetUserGroupByIdVariables>;
  operationName: string;
}
export const getUserGroupByIdRef: GetUserGroupByIdRef;

export function getUserGroupById(vars: GetUserGroupByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserGroupByIdData, GetUserGroupByIdVariables>;
export function getUserGroupById(dc: DataConnect, vars: GetUserGroupByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserGroupByIdData, GetUserGroupByIdVariables>;

interface GetAllUserGroupsWithStatusesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetAllUserGroupsWithStatusesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetAllUserGroupsWithStatusesData, undefined>;
  operationName: string;
}
export const getAllUserGroupsWithStatusesRef: GetAllUserGroupsWithStatusesRef;

export function getAllUserGroupsWithStatuses(options?: ExecuteQueryOptions): QueryPromise<GetAllUserGroupsWithStatusesData, undefined>;
export function getAllUserGroupsWithStatuses(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetAllUserGroupsWithStatusesData, undefined>;

interface GetSectionMembersRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionMembersVariables): QueryRef<GetSectionMembersData, GetSectionMembersVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSectionMembersVariables): QueryRef<GetSectionMembersData, GetSectionMembersVariables>;
  operationName: string;
}
export const getSectionMembersRef: GetSectionMembersRef;

export function getSectionMembers(vars: GetSectionMembersVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionMembersData, GetSectionMembersVariables>;
export function getSectionMembers(dc: DataConnect, vars: GetSectionMembersVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionMembersData, GetSectionMembersVariables>;

interface GetMyBookingsForEventRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyBookingsForEventVariables): QueryRef<GetMyBookingsForEventData, GetMyBookingsForEventVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMyBookingsForEventVariables): QueryRef<GetMyBookingsForEventData, GetMyBookingsForEventVariables>;
  operationName: string;
}
export const getMyBookingsForEventRef: GetMyBookingsForEventRef;

export function getMyBookingsForEvent(vars: GetMyBookingsForEventVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyBookingsForEventData, GetMyBookingsForEventVariables>;
export function getMyBookingsForEvent(dc: DataConnect, vars: GetMyBookingsForEventVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyBookingsForEventData, GetMyBookingsForEventVariables>;

interface GetMyBookingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyBookingsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyBookingsData, undefined>;
  operationName: string;
}
export const getMyBookingsRef: GetMyBookingsRef;

export function getMyBookings(options?: ExecuteQueryOptions): QueryPromise<GetMyBookingsData, undefined>;
export function getMyBookings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyBookingsData, undefined>;

interface GetMyTicketOrderByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyTicketOrderByIdVariables): QueryRef<GetMyTicketOrderByIdData, GetMyTicketOrderByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMyTicketOrderByIdVariables): QueryRef<GetMyTicketOrderByIdData, GetMyTicketOrderByIdVariables>;
  operationName: string;
}
export const getMyTicketOrderByIdRef: GetMyTicketOrderByIdRef;

export function getMyTicketOrderById(vars: GetMyTicketOrderByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyTicketOrderByIdData, GetMyTicketOrderByIdVariables>;
export function getMyTicketOrderById(dc: DataConnect, vars: GetMyTicketOrderByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyTicketOrderByIdData, GetMyTicketOrderByIdVariables>;

interface GetMyTicketOrdersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyTicketOrdersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyTicketOrdersData, undefined>;
  operationName: string;
}
export const getMyTicketOrdersRef: GetMyTicketOrdersRef;

export function getMyTicketOrders(options?: ExecuteQueryOptions): QueryPromise<GetMyTicketOrdersData, undefined>;
export function getMyTicketOrders(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyTicketOrdersData, undefined>;

interface GetMyBookingPaymentAdjustmentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyBookingPaymentAdjustmentsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyBookingPaymentAdjustmentsData, undefined>;
  operationName: string;
}
export const getMyBookingPaymentAdjustmentsRef: GetMyBookingPaymentAdjustmentsRef;

export function getMyBookingPaymentAdjustments(options?: ExecuteQueryOptions): QueryPromise<GetMyBookingPaymentAdjustmentsData, undefined>;
export function getMyBookingPaymentAdjustments(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyBookingPaymentAdjustmentsData, undefined>;

interface ListEventBookingsForAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListEventBookingsForAdminVariables): QueryRef<ListEventBookingsForAdminData, ListEventBookingsForAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListEventBookingsForAdminVariables): QueryRef<ListEventBookingsForAdminData, ListEventBookingsForAdminVariables>;
  operationName: string;
}
export const listEventBookingsForAdminRef: ListEventBookingsForAdminRef;

export function listEventBookingsForAdmin(vars: ListEventBookingsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListEventBookingsForAdminData, ListEventBookingsForAdminVariables>;
export function listEventBookingsForAdmin(dc: DataConnect, vars: ListEventBookingsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListEventBookingsForAdminData, ListEventBookingsForAdminVariables>;

interface ListGuestTicketRequestsForAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListGuestTicketRequestsForAdminVariables): QueryRef<ListGuestTicketRequestsForAdminData, ListGuestTicketRequestsForAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListGuestTicketRequestsForAdminVariables): QueryRef<ListGuestTicketRequestsForAdminData, ListGuestTicketRequestsForAdminVariables>;
  operationName: string;
}
export const listGuestTicketRequestsForAdminRef: ListGuestTicketRequestsForAdminRef;

export function listGuestTicketRequestsForAdmin(vars: ListGuestTicketRequestsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListGuestTicketRequestsForAdminData, ListGuestTicketRequestsForAdminVariables>;
export function listGuestTicketRequestsForAdmin(dc: DataConnect, vars: ListGuestTicketRequestsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListGuestTicketRequestsForAdminData, ListGuestTicketRequestsForAdminVariables>;

interface ListTicketOrdersForAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListTicketOrdersForAdminVariables): QueryRef<ListTicketOrdersForAdminData, ListTicketOrdersForAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListTicketOrdersForAdminVariables): QueryRef<ListTicketOrdersForAdminData, ListTicketOrdersForAdminVariables>;
  operationName: string;
}
export const listTicketOrdersForAdminRef: ListTicketOrdersForAdminRef;

export function listTicketOrdersForAdmin(vars: ListTicketOrdersForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListTicketOrdersForAdminData, ListTicketOrdersForAdminVariables>;
export function listTicketOrdersForAdmin(dc: DataConnect, vars: ListTicketOrdersForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListTicketOrdersForAdminData, ListTicketOrdersForAdminVariables>;

interface ListBookingPaymentAdjustmentsForAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListBookingPaymentAdjustmentsForAdminVariables): QueryRef<ListBookingPaymentAdjustmentsForAdminData, ListBookingPaymentAdjustmentsForAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListBookingPaymentAdjustmentsForAdminVariables): QueryRef<ListBookingPaymentAdjustmentsForAdminData, ListBookingPaymentAdjustmentsForAdminVariables>;
  operationName: string;
}
export const listBookingPaymentAdjustmentsForAdminRef: ListBookingPaymentAdjustmentsForAdminRef;

export function listBookingPaymentAdjustmentsForAdmin(vars: ListBookingPaymentAdjustmentsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListBookingPaymentAdjustmentsForAdminData, ListBookingPaymentAdjustmentsForAdminVariables>;
export function listBookingPaymentAdjustmentsForAdmin(dc: DataConnect, vars: ListBookingPaymentAdjustmentsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListBookingPaymentAdjustmentsForAdminData, ListBookingPaymentAdjustmentsForAdminVariables>;

interface ListOpenPaymentReconciliationExceptionsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListOpenPaymentReconciliationExceptionsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListOpenPaymentReconciliationExceptionsData, undefined>;
  operationName: string;
}
export const listOpenPaymentReconciliationExceptionsRef: ListOpenPaymentReconciliationExceptionsRef;

export function listOpenPaymentReconciliationExceptions(options?: ExecuteQueryOptions): QueryPromise<ListOpenPaymentReconciliationExceptionsData, undefined>;
export function listOpenPaymentReconciliationExceptions(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListOpenPaymentReconciliationExceptionsData, undefined>;

interface GetSectionAnnouncementOptOutRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionAnnouncementOptOutVariables): QueryRef<GetSectionAnnouncementOptOutData, GetSectionAnnouncementOptOutVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSectionAnnouncementOptOutVariables): QueryRef<GetSectionAnnouncementOptOutData, GetSectionAnnouncementOptOutVariables>;
  operationName: string;
}
export const getSectionAnnouncementOptOutRef: GetSectionAnnouncementOptOutRef;

export function getSectionAnnouncementOptOut(vars: GetSectionAnnouncementOptOutVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionAnnouncementOptOutData, GetSectionAnnouncementOptOutVariables>;
export function getSectionAnnouncementOptOut(dc: DataConnect, vars: GetSectionAnnouncementOptOutVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionAnnouncementOptOutData, GetSectionAnnouncementOptOutVariables>;

interface GetMyAnnouncementPreferencesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyAnnouncementPreferencesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyAnnouncementPreferencesData, undefined>;
  operationName: string;
}
export const getMyAnnouncementPreferencesRef: GetMyAnnouncementPreferencesRef;

export function getMyAnnouncementPreferences(options?: ExecuteQueryOptions): QueryPromise<GetMyAnnouncementPreferencesData, undefined>;
export function getMyAnnouncementPreferences(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyAnnouncementPreferencesData, undefined>;

interface CreateSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSectionVariables): MutationRef<CreateSectionData, CreateSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateSectionVariables): MutationRef<CreateSectionData, CreateSectionVariables>;
  operationName: string;
}
export const createSectionRef: CreateSectionRef;

export function createSection(vars: CreateSectionVariables): MutationPromise<CreateSectionData, CreateSectionVariables>;
export function createSection(dc: DataConnect, vars: CreateSectionVariables): MutationPromise<CreateSectionData, CreateSectionVariables>;

interface CreateUserGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserGroupVariables): MutationRef<CreateUserGroupData, CreateUserGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserGroupVariables): MutationRef<CreateUserGroupData, CreateUserGroupVariables>;
  operationName: string;
}
export const createUserGroupRef: CreateUserGroupRef;

export function createUserGroup(vars: CreateUserGroupVariables): MutationPromise<CreateUserGroupData, CreateUserGroupVariables>;
export function createUserGroup(dc: DataConnect, vars: CreateUserGroupVariables): MutationPromise<CreateUserGroupData, CreateUserGroupVariables>;

interface AddUserToUserGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddUserToUserGroupVariables): MutationRef<AddUserToUserGroupData, AddUserToUserGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddUserToUserGroupVariables): MutationRef<AddUserToUserGroupData, AddUserToUserGroupVariables>;
  operationName: string;
}
export const addUserToUserGroupRef: AddUserToUserGroupRef;

export function addUserToUserGroup(vars: AddUserToUserGroupVariables): MutationPromise<AddUserToUserGroupData, AddUserToUserGroupVariables>;
export function addUserToUserGroup(dc: DataConnect, vars: AddUserToUserGroupVariables): MutationPromise<AddUserToUserGroupData, AddUserToUserGroupVariables>;

interface RemoveUserFromUserGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveUserFromUserGroupVariables): MutationRef<RemoveUserFromUserGroupData, RemoveUserFromUserGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RemoveUserFromUserGroupVariables): MutationRef<RemoveUserFromUserGroupData, RemoveUserFromUserGroupVariables>;
  operationName: string;
}
export const removeUserFromUserGroupRef: RemoveUserFromUserGroupRef;

export function removeUserFromUserGroup(vars: RemoveUserFromUserGroupVariables): MutationPromise<RemoveUserFromUserGroupData, RemoveUserFromUserGroupVariables>;
export function removeUserFromUserGroup(dc: DataConnect, vars: RemoveUserFromUserGroupVariables): MutationPromise<RemoveUserFromUserGroupData, RemoveUserFromUserGroupVariables>;

interface GrantUserGroupToSectionForPurposeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GrantUserGroupToSectionForPurposeVariables): MutationRef<GrantUserGroupToSectionForPurposeData, GrantUserGroupToSectionForPurposeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GrantUserGroupToSectionForPurposeVariables): MutationRef<GrantUserGroupToSectionForPurposeData, GrantUserGroupToSectionForPurposeVariables>;
  operationName: string;
}
export const grantUserGroupToSectionForPurposeRef: GrantUserGroupToSectionForPurposeRef;

export function grantUserGroupToSectionForPurpose(vars: GrantUserGroupToSectionForPurposeVariables): MutationPromise<GrantUserGroupToSectionForPurposeData, GrantUserGroupToSectionForPurposeVariables>;
export function grantUserGroupToSectionForPurpose(dc: DataConnect, vars: GrantUserGroupToSectionForPurposeVariables): MutationPromise<GrantUserGroupToSectionForPurposeData, GrantUserGroupToSectionForPurposeVariables>;

interface RevokeUserGroupFromSectionForPurposeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RevokeUserGroupFromSectionForPurposeVariables): MutationRef<RevokeUserGroupFromSectionForPurposeData, RevokeUserGroupFromSectionForPurposeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RevokeUserGroupFromSectionForPurposeVariables): MutationRef<RevokeUserGroupFromSectionForPurposeData, RevokeUserGroupFromSectionForPurposeVariables>;
  operationName: string;
}
export const revokeUserGroupFromSectionForPurposeRef: RevokeUserGroupFromSectionForPurposeRef;

export function revokeUserGroupFromSectionForPurpose(vars: RevokeUserGroupFromSectionForPurposeVariables): MutationPromise<RevokeUserGroupFromSectionForPurposeData, RevokeUserGroupFromSectionForPurposeVariables>;
export function revokeUserGroupFromSectionForPurpose(dc: DataConnect, vars: RevokeUserGroupFromSectionForPurposeVariables): MutationPromise<RevokeUserGroupFromSectionForPurposeData, RevokeUserGroupFromSectionForPurposeVariables>;

interface UpdateUserGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserGroupVariables): MutationRef<UpdateUserGroupData, UpdateUserGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateUserGroupVariables): MutationRef<UpdateUserGroupData, UpdateUserGroupVariables>;
  operationName: string;
}
export const updateUserGroupRef: UpdateUserGroupRef;

export function updateUserGroup(vars: UpdateUserGroupVariables): MutationPromise<UpdateUserGroupData, UpdateUserGroupVariables>;
export function updateUserGroup(dc: DataConnect, vars: UpdateUserGroupVariables): MutationPromise<UpdateUserGroupData, UpdateUserGroupVariables>;

interface DeleteUserGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteUserGroupVariables): MutationRef<DeleteUserGroupData, DeleteUserGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteUserGroupVariables): MutationRef<DeleteUserGroupData, DeleteUserGroupVariables>;
  operationName: string;
}
export const deleteUserGroupRef: DeleteUserGroupRef;

export function deleteUserGroup(vars: DeleteUserGroupVariables): MutationPromise<DeleteUserGroupData, DeleteUserGroupVariables>;
export function deleteUserGroup(dc: DataConnect, vars: DeleteUserGroupVariables): MutationPromise<DeleteUserGroupData, DeleteUserGroupVariables>;

interface UpdateSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateSectionVariables): MutationRef<UpdateSectionData, UpdateSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateSectionVariables): MutationRef<UpdateSectionData, UpdateSectionVariables>;
  operationName: string;
}
export const updateSectionRef: UpdateSectionRef;

export function updateSection(vars: UpdateSectionVariables): MutationPromise<UpdateSectionData, UpdateSectionVariables>;
export function updateSection(dc: DataConnect, vars: UpdateSectionVariables): MutationPromise<UpdateSectionData, UpdateSectionVariables>;

interface DeleteSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteSectionVariables): MutationRef<DeleteSectionData, DeleteSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteSectionVariables): MutationRef<DeleteSectionData, DeleteSectionVariables>;
  operationName: string;
}
export const deleteSectionRef: DeleteSectionRef;

export function deleteSection(vars: DeleteSectionVariables): MutationPromise<DeleteSectionData, DeleteSectionVariables>;
export function deleteSection(dc: DataConnect, vars: DeleteSectionVariables): MutationPromise<DeleteSectionData, DeleteSectionVariables>;

interface CreateEventRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateEventVariables): MutationRef<CreateEventData, CreateEventVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateEventVariables): MutationRef<CreateEventData, CreateEventVariables>;
  operationName: string;
}
export const createEventRef: CreateEventRef;

export function createEvent(vars: CreateEventVariables): MutationPromise<CreateEventData, CreateEventVariables>;
export function createEvent(dc: DataConnect, vars: CreateEventVariables): MutationPromise<CreateEventData, CreateEventVariables>;

interface UpdateEventRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateEventVariables): MutationRef<UpdateEventData, UpdateEventVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateEventVariables): MutationRef<UpdateEventData, UpdateEventVariables>;
  operationName: string;
}
export const updateEventRef: UpdateEventRef;

export function updateEvent(vars: UpdateEventVariables): MutationPromise<UpdateEventData, UpdateEventVariables>;
export function updateEvent(dc: DataConnect, vars: UpdateEventVariables): MutationPromise<UpdateEventData, UpdateEventVariables>;

interface DeleteEventRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteEventVariables): MutationRef<DeleteEventData, DeleteEventVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteEventVariables): MutationRef<DeleteEventData, DeleteEventVariables>;
  operationName: string;
}
export const deleteEventRef: DeleteEventRef;

export function deleteEvent(vars: DeleteEventVariables): MutationPromise<DeleteEventData, DeleteEventVariables>;
export function deleteEvent(dc: DataConnect, vars: DeleteEventVariables): MutationPromise<DeleteEventData, DeleteEventVariables>;

interface CreateTicketTypeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateTicketTypeVariables): MutationRef<CreateTicketTypeData, CreateTicketTypeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateTicketTypeVariables): MutationRef<CreateTicketTypeData, CreateTicketTypeVariables>;
  operationName: string;
}
export const createTicketTypeRef: CreateTicketTypeRef;

export function createTicketType(vars: CreateTicketTypeVariables): MutationPromise<CreateTicketTypeData, CreateTicketTypeVariables>;
export function createTicketType(dc: DataConnect, vars: CreateTicketTypeVariables): MutationPromise<CreateTicketTypeData, CreateTicketTypeVariables>;

interface UpdateTicketTypeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateTicketTypeVariables): MutationRef<UpdateTicketTypeData, UpdateTicketTypeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateTicketTypeVariables): MutationRef<UpdateTicketTypeData, UpdateTicketTypeVariables>;
  operationName: string;
}
export const updateTicketTypeRef: UpdateTicketTypeRef;

export function updateTicketType(vars: UpdateTicketTypeVariables): MutationPromise<UpdateTicketTypeData, UpdateTicketTypeVariables>;
export function updateTicketType(dc: DataConnect, vars: UpdateTicketTypeVariables): MutationPromise<UpdateTicketTypeData, UpdateTicketTypeVariables>;

interface DeleteTicketTypeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteTicketTypeVariables): MutationRef<DeleteTicketTypeData, DeleteTicketTypeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteTicketTypeVariables): MutationRef<DeleteTicketTypeData, DeleteTicketTypeVariables>;
  operationName: string;
}
export const deleteTicketTypeRef: DeleteTicketTypeRef;

export function deleteTicketType(vars: DeleteTicketTypeVariables): MutationPromise<DeleteTicketTypeData, DeleteTicketTypeVariables>;
export function deleteTicketType(dc: DataConnect, vars: DeleteTicketTypeVariables): MutationPromise<DeleteTicketTypeData, DeleteTicketTypeVariables>;

interface CreateUserProfileRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserProfileVariables): MutationRef<CreateUserProfileData, CreateUserProfileVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserProfileVariables): MutationRef<CreateUserProfileData, CreateUserProfileVariables>;
  operationName: string;
}
export const createUserProfileRef: CreateUserProfileRef;

export function createUserProfile(vars: CreateUserProfileVariables): MutationPromise<CreateUserProfileData, CreateUserProfileVariables>;
export function createUserProfile(dc: DataConnect, vars: CreateUserProfileVariables): MutationPromise<CreateUserProfileData, CreateUserProfileVariables>;

interface UpsertUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
  operationName: string;
}
export const upsertUserRef: UpsertUserRef;

export function upsertUser(vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;
export function upsertUser(dc: DataConnect, vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;

interface UpdateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
  operationName: string;
}
export const updateUserRef: UpdateUserRef;

export function updateUser(vars: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;
export function updateUser(dc: DataConnect, vars: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;

interface RegisterForSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RegisterForSectionVariables): MutationRef<RegisterForSectionData, RegisterForSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RegisterForSectionVariables): MutationRef<RegisterForSectionData, RegisterForSectionVariables>;
  operationName: string;
}
export const registerForSectionRef: RegisterForSectionRef;

export function registerForSection(vars: RegisterForSectionVariables): MutationPromise<RegisterForSectionData, RegisterForSectionVariables>;
export function registerForSection(dc: DataConnect, vars: RegisterForSectionVariables): MutationPromise<RegisterForSectionData, RegisterForSectionVariables>;

interface UnregisterFromSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UnregisterFromSectionVariables): MutationRef<UnregisterFromSectionData, UnregisterFromSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UnregisterFromSectionVariables): MutationRef<UnregisterFromSectionData, UnregisterFromSectionVariables>;
  operationName: string;
}
export const unregisterFromSectionRef: UnregisterFromSectionRef;

export function unregisterFromSection(vars: UnregisterFromSectionVariables): MutationPromise<UnregisterFromSectionData, UnregisterFromSectionVariables>;
export function unregisterFromSection(dc: DataConnect, vars: UnregisterFromSectionVariables): MutationPromise<UnregisterFromSectionData, UnregisterFromSectionVariables>;

interface SubscribeToUserGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SubscribeToUserGroupVariables): MutationRef<SubscribeToUserGroupData, SubscribeToUserGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SubscribeToUserGroupVariables): MutationRef<SubscribeToUserGroupData, SubscribeToUserGroupVariables>;
  operationName: string;
}
export const subscribeToUserGroupRef: SubscribeToUserGroupRef;

export function subscribeToUserGroup(vars: SubscribeToUserGroupVariables): MutationPromise<SubscribeToUserGroupData, SubscribeToUserGroupVariables>;
export function subscribeToUserGroup(dc: DataConnect, vars: SubscribeToUserGroupVariables): MutationPromise<SubscribeToUserGroupData, SubscribeToUserGroupVariables>;

interface UnsubscribeFromUserGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UnsubscribeFromUserGroupVariables): MutationRef<UnsubscribeFromUserGroupData, UnsubscribeFromUserGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UnsubscribeFromUserGroupVariables): MutationRef<UnsubscribeFromUserGroupData, UnsubscribeFromUserGroupVariables>;
  operationName: string;
}
export const unsubscribeFromUserGroupRef: UnsubscribeFromUserGroupRef;

export function unsubscribeFromUserGroup(vars: UnsubscribeFromUserGroupVariables): MutationPromise<UnsubscribeFromUserGroupData, UnsubscribeFromUserGroupVariables>;
export function unsubscribeFromUserGroup(dc: DataConnect, vars: UnsubscribeFromUserGroupVariables): MutationPromise<UnsubscribeFromUserGroupData, UnsubscribeFromUserGroupVariables>;

interface OptOutSectionAnnouncementRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: OptOutSectionAnnouncementVariables): MutationRef<OptOutSectionAnnouncementData, OptOutSectionAnnouncementVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: OptOutSectionAnnouncementVariables): MutationRef<OptOutSectionAnnouncementData, OptOutSectionAnnouncementVariables>;
  operationName: string;
}
export const optOutSectionAnnouncementRef: OptOutSectionAnnouncementRef;

export function optOutSectionAnnouncement(vars: OptOutSectionAnnouncementVariables): MutationPromise<OptOutSectionAnnouncementData, OptOutSectionAnnouncementVariables>;
export function optOutSectionAnnouncement(dc: DataConnect, vars: OptOutSectionAnnouncementVariables): MutationPromise<OptOutSectionAnnouncementData, OptOutSectionAnnouncementVariables>;

interface OptInSectionAnnouncementRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: OptInSectionAnnouncementVariables): MutationRef<OptInSectionAnnouncementData, OptInSectionAnnouncementVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: OptInSectionAnnouncementVariables): MutationRef<OptInSectionAnnouncementData, OptInSectionAnnouncementVariables>;
  operationName: string;
}
export const optInSectionAnnouncementRef: OptInSectionAnnouncementRef;

export function optInSectionAnnouncement(vars: OptInSectionAnnouncementVariables): MutationPromise<OptInSectionAnnouncementData, OptInSectionAnnouncementVariables>;
export function optInSectionAnnouncement(dc: DataConnect, vars: OptInSectionAnnouncementVariables): MutationPromise<OptInSectionAnnouncementData, OptInSectionAnnouncementVariables>;

interface UpdateAnnouncementOptOutAllRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAnnouncementOptOutAllVariables): MutationRef<UpdateAnnouncementOptOutAllData, UpdateAnnouncementOptOutAllVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateAnnouncementOptOutAllVariables): MutationRef<UpdateAnnouncementOptOutAllData, UpdateAnnouncementOptOutAllVariables>;
  operationName: string;
}
export const updateAnnouncementOptOutAllRef: UpdateAnnouncementOptOutAllRef;

export function updateAnnouncementOptOutAll(vars: UpdateAnnouncementOptOutAllVariables): MutationPromise<UpdateAnnouncementOptOutAllData, UpdateAnnouncementOptOutAllVariables>;
export function updateAnnouncementOptOutAll(dc: DataConnect, vars: UpdateAnnouncementOptOutAllVariables): MutationPromise<UpdateAnnouncementOptOutAllData, UpdateAnnouncementOptOutAllVariables>;

interface ConfirmProfileReviewRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ConfirmProfileReviewVariables): MutationRef<ConfirmProfileReviewData, ConfirmProfileReviewVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ConfirmProfileReviewVariables): MutationRef<ConfirmProfileReviewData, ConfirmProfileReviewVariables>;
  operationName: string;
}
export const confirmProfileReviewRef: ConfirmProfileReviewRef;

export function confirmProfileReview(vars: ConfirmProfileReviewVariables): MutationPromise<ConfirmProfileReviewData, ConfirmProfileReviewVariables>;
export function confirmProfileReview(dc: DataConnect, vars: ConfirmProfileReviewVariables): MutationPromise<ConfirmProfileReviewData, ConfirmProfileReviewVariables>;

