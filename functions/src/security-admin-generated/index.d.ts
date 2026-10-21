import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;

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
export enum SecuritySyncStatus {
  PENDING = "PENDING",
  READY = "READY",
  SUPERSEDED = "SUPERSEDED",
}

export interface AnnouncementRecipient_Key {
  id: UUIDString;
  __typename?: 'AnnouncementRecipient_Key';
}

export interface AnnouncementSend_Key {
  id: UUIDString;
  __typename?: 'AnnouncementSend_Key';
}

export interface BeginSecurityTransitionData {
  userSecurityState_updateMany: number;
  user_updateMany: number;
  securityTransition_insert: SecurityTransition_Key;
}

export interface BeginSecurityTransitionVariables {
  userId: string;
  expectedVersion: number;
  nextVersion: number;
  expectedMembershipStatus: MembershipStatus;
  membershipStatus: MembershipStatus;
  desiredEnabled: boolean;
  desiredAdmin: boolean;
  authDisabled?: boolean | null;
  verificationEmail?: string | null;
  operationId: string;
  actorId: string;
  reason: string;
  intentHash: string;
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

export interface CompleteSecurityTransitionData {
  userSecurityState_updateMany: number;
  securityTransition_update?: SecurityTransition_Key | null;
}

export interface CompleteSecurityTransitionVariables {
  userId: string;
  securityVersion: number;
  operationId: string;
  membershipStatus: MembershipStatus;
  accessReady: boolean;
  adminReady: boolean;
}

export interface Event_Key {
  id: UUIDString;
  __typename?: 'Event_Key';
}

export interface GetSecurityTransitionData {
  securityTransition?: {
    operationId: string;
    userId: string;
    securityVersion: number;
    membershipStatus: MembershipStatus;
    desiredEnabled: boolean;
    desiredAdmin: boolean;
    authDisabled?: boolean | null;
    verificationEmail?: string | null;
    intentHash: string;
    actorId: string;
    reason: string;
    syncStatus: SecuritySyncStatus;
    attempts: number;
  } & SecurityTransition_Key;
}

export interface GetSecurityTransitionVariables {
  operationId: string;
}

export interface GetUserSecurityStateData {
  userSecurityState?: {
    userId: string;
    securityVersion: number;
    membershipStatus: MembershipStatus;
    desiredEnabled: boolean;
    desiredAdmin: boolean;
    verificationEmail?: string | null;
    accessReady: boolean;
    adminReady: boolean;
    operationId: string;
    syncStatus: SecuritySyncStatus;
    user: {
      membershipStatus: MembershipStatus;
    };
  } & UserSecurityState_Key;
}

export interface GetUserSecurityStateVariables {
  userId: string;
}

export interface GovNotifyDeliveryConfiguration_Key {
  id: string;
  __typename?: 'GovNotifyDeliveryConfiguration_Key';
}

export interface GovNotifyDeliveryModeAudit_Key {
  id: UUIDString;
  __typename?: 'GovNotifyDeliveryModeAudit_Key';
}

export interface InitializeUserSecurityStateData {
  userSecurityState_insert: UserSecurityState_Key;
  securityTransition_insert: SecurityTransition_Key;
}

export interface InitializeUserSecurityStateVariables {
  userId: string;
  membershipStatus: MembershipStatus;
  desiredEnabled: boolean;
  desiredAdmin: boolean;
  verificationEmail?: string | null;
  operationId: string;
  actorId: string;
  reason: string;
  intentHash: string;
}

export interface LegacyUserIdentity_Key {
  sourceSystem: string;
  legacyUserId: UUIDString;
  __typename?: 'LegacyUserIdentity_Key';
}

export interface ListPendingSecurityTransitionsData {
  securityTransitions: ({
    operationId: string;
  } & SecurityTransition_Key)[];
}

export interface ListPendingSecurityTransitionsVariables {
  limit: number;
}

export interface ListSecurityStatesForReconciliationData {
  userSecurityStates: ({
    userId: string;
    operationId: string;
  } & UserSecurityState_Key)[];
}

export interface ListSecurityStatesForReconciliationVariables {
  limit: number;
  offset: number;
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

export interface OrganiserGuestAudit_Key {
  id: UUIDString;
  __typename?: 'OrganiserGuestAudit_Key';
}

export interface OrganiserGuestTicketType_Key {
  id: UUIDString;
  __typename?: 'OrganiserGuestTicketType_Key';
}

export interface OrganiserGuest_Key {
  id: UUIDString;
  __typename?: 'OrganiserGuest_Key';
}

export interface PaymentReconciliationException_Key {
  id: UUIDString;
  __typename?: 'PaymentReconciliationException_Key';
}

export interface PaymentWebhookEvent_Key {
  id: UUIDString;
  __typename?: 'PaymentWebhookEvent_Key';
}

export interface PotentialLostReview_Key {
  id: UUIDString;
  __typename?: 'PotentialLostReview_Key';
}

export interface RecordSecuritySynchronizationFailureData {
  securityTransition_updateMany: number;
}

export interface RecordSecuritySynchronizationFailureVariables {
  operationId: string;
  errorCode: string;
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

export interface SecurityTransition_Key {
  operationId: string;
  __typename?: 'SecurityTransition_Key';
}

export interface SupersedeSecurityTransitionData {
  securityTransition_updateMany: number;
}

export interface SupersedeSecurityTransitionVariables {
  operationId: string;
}

export interface TicketOrder_Key {
  id: UUIDString;
  __typename?: 'TicketOrder_Key';
}

export interface TicketType_Key {
  id: UUIDString;
  __typename?: 'TicketType_Key';
}

export interface UserGroup_Key {
  id: UUIDString;
  __typename?: 'UserGroup_Key';
}

export interface UserSecurityState_Key {
  userId: string;
  __typename?: 'UserSecurityState_Key';
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

/** Generated Node Admin SDK operation action function for the 'GetUserSecurityState' Query. Allow users to execute without passing in DataConnect. */
export function getUserSecurityState(dc: DataConnect, vars: GetUserSecurityStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserSecurityStateData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserSecurityState' Query. Allow users to pass in custom DataConnect instances. */
export function getUserSecurityState(vars: GetUserSecurityStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserSecurityStateData>>;

/** Generated Node Admin SDK operation action function for the 'GetSecurityTransition' Query. Allow users to execute without passing in DataConnect. */
export function getSecurityTransition(dc: DataConnect, vars: GetSecurityTransitionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSecurityTransitionData>>;
/** Generated Node Admin SDK operation action function for the 'GetSecurityTransition' Query. Allow users to pass in custom DataConnect instances. */
export function getSecurityTransition(vars: GetSecurityTransitionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSecurityTransitionData>>;

/** Generated Node Admin SDK operation action function for the 'ListPendingSecurityTransitions' Query. Allow users to execute without passing in DataConnect. */
export function listPendingSecurityTransitions(dc: DataConnect, vars: ListPendingSecurityTransitionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPendingSecurityTransitionsData>>;
/** Generated Node Admin SDK operation action function for the 'ListPendingSecurityTransitions' Query. Allow users to pass in custom DataConnect instances. */
export function listPendingSecurityTransitions(vars: ListPendingSecurityTransitionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPendingSecurityTransitionsData>>;

/** Generated Node Admin SDK operation action function for the 'InitializeUserSecurityState' Mutation. Allow users to execute without passing in DataConnect. */
export function initializeUserSecurityState(dc: DataConnect, vars: InitializeUserSecurityStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InitializeUserSecurityStateData>>;
/** Generated Node Admin SDK operation action function for the 'InitializeUserSecurityState' Mutation. Allow users to pass in custom DataConnect instances. */
export function initializeUserSecurityState(vars: InitializeUserSecurityStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InitializeUserSecurityStateData>>;

/** Generated Node Admin SDK operation action function for the 'BeginSecurityTransition' Mutation. Allow users to execute without passing in DataConnect. */
export function beginSecurityTransition(dc: DataConnect, vars: BeginSecurityTransitionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BeginSecurityTransitionData>>;
/** Generated Node Admin SDK operation action function for the 'BeginSecurityTransition' Mutation. Allow users to pass in custom DataConnect instances. */
export function beginSecurityTransition(vars: BeginSecurityTransitionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BeginSecurityTransitionData>>;

/** Generated Node Admin SDK operation action function for the 'CompleteSecurityTransition' Mutation. Allow users to execute without passing in DataConnect. */
export function completeSecurityTransition(dc: DataConnect, vars: CompleteSecurityTransitionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CompleteSecurityTransitionData>>;
/** Generated Node Admin SDK operation action function for the 'CompleteSecurityTransition' Mutation. Allow users to pass in custom DataConnect instances. */
export function completeSecurityTransition(vars: CompleteSecurityTransitionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CompleteSecurityTransitionData>>;

/** Generated Node Admin SDK operation action function for the 'RecordSecuritySynchronizationFailure' Mutation. Allow users to execute without passing in DataConnect. */
export function recordSecuritySynchronizationFailure(dc: DataConnect, vars: RecordSecuritySynchronizationFailureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordSecuritySynchronizationFailureData>>;
/** Generated Node Admin SDK operation action function for the 'RecordSecuritySynchronizationFailure' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordSecuritySynchronizationFailure(vars: RecordSecuritySynchronizationFailureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordSecuritySynchronizationFailureData>>;

/** Generated Node Admin SDK operation action function for the 'SupersedeSecurityTransition' Mutation. Allow users to execute without passing in DataConnect. */
export function supersedeSecurityTransition(dc: DataConnect, vars: SupersedeSecurityTransitionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SupersedeSecurityTransitionData>>;
/** Generated Node Admin SDK operation action function for the 'SupersedeSecurityTransition' Mutation. Allow users to pass in custom DataConnect instances. */
export function supersedeSecurityTransition(vars: SupersedeSecurityTransitionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SupersedeSecurityTransitionData>>;

/** Generated Node Admin SDK operation action function for the 'ListSecurityStatesForReconciliation' Query. Allow users to execute without passing in DataConnect. */
export function listSecurityStatesForReconciliation(dc: DataConnect, vars: ListSecurityStatesForReconciliationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSecurityStatesForReconciliationData>>;
/** Generated Node Admin SDK operation action function for the 'ListSecurityStatesForReconciliation' Query. Allow users to pass in custom DataConnect instances. */
export function listSecurityStatesForReconciliation(vars: ListSecurityStatesForReconciliationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSecurityStatesForReconciliationData>>;

