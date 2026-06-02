import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;

export enum BookingPaymentAdjustmentStatus {
  NOT_REQUIRED = "NOT_REQUIRED",
  PENDING_AUTO_REFUND = "PENDING_AUTO_REFUND",
  PENDING_AUTO_CHARGE = "PENDING_AUTO_CHARGE",
}
export enum BookingStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
}
export enum GuestTicketRequestStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
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

export interface BookingLine_Key {
  id: UUIDString;
  __typename?: 'BookingLine_Key';
}

export interface BookingPaymentAdjustment_Key {
  revisionBookingId: UUIDString;
  supersededBookingId: UUIDString;
  __typename?: 'BookingPaymentAdjustment_Key';
}

export interface Booking_Key {
  id: UUIDString;
  __typename?: 'Booking_Key';
}

export interface CheckUserProfileExistsData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    membershipStatus: MembershipStatus;
  } & User_Key;
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
  maxGuestsWithoutModeratorApproval?: number | null;
}

export interface CreateGuestTicketRequestData {
  guestTicketRequest_insert: GuestTicketRequest_Key;
}

export interface CreateGuestTicketRequestFromCallableData {
  guestTicketRequest_insert: GuestTicketRequest_Key;
}

export interface CreateGuestTicketRequestFromCallableVariables {
  bookingId: UUIDString;
  requestedGuestCount: number;
  guestTicketTypeId: UUIDString;
  guestDisplayName: string;
  dietaryNote?: string | null;
}

export interface CreateGuestTicketRequestVariables {
  bookingId: UUIDString;
  requestedGuestCount: number;
  guestTicketTypeId: UUIDString;
  guestDisplayName: string;
  dietaryNote?: string | null;
}

export interface CreateNotificationDeliveryData {
  notificationDelivery_insert: NotificationDelivery_Key;
}

export interface CreateNotificationDeliveryVariables {
  channel: NotificationChannel;
  notificationType: string;
  deliveryKey: string;
  status: NotificationDeliveryStatus;
  ticketOrderId?: UUIDString | null;
  bookingId?: UUIDString | null;
  userId?: string | null;
  provider?: string | null;
  attemptCount: number;
  lastAttemptedAt?: TimestampString | null;
}

export interface CreatePaymentReconciliationExceptionData {
  paymentReconciliationException_insert: PaymentReconciliationException_Key;
}

export interface CreatePaymentReconciliationExceptionVariables {
  ticketOrderId: UUIDString;
  exceptionType: PaymentReconciliationExceptionType;
  status: PaymentReconciliationExceptionStatus;
  note?: string | null;
  ownerUserId?: string | null;
  lastAttemptedAt?: TimestampString | null;
  resolvedAt?: TimestampString | null;
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
  email: string;
  serviceNumber: string;
  requestedMembershipStatus: MembershipStatus;
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
}

export interface CreateUserVariables {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
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

export interface Event_Key {
  id: UUIDString;
  __typename?: 'Event_Key';
}

export interface GetAllUserGroupsWithStatusesData {
  userGroups: ({
    id: UUIDString;
    name: string;
    membershipStatuses?: MembershipStatus[] | null;
  } & UserGroup_Key)[];
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
            } & TicketType_Key;
        } & BookingLine_Key)[];
          guestTicketRequests: ({
            id: UUIDString;
            status: GuestTicketRequestStatus;
            requestedGuestCount: number;
          } & GuestTicketRequest_Key)[];
    } & Booking_Key)[];
  } & User_Key;
}

export interface GetBookingsForBookerAndEventVariables {
  bookerId: string;
  eventId: UUIDString;
}

export interface GetCurrentUserData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    membershipStatus: MembershipStatus;
    requestedMembershipStatus?: MembershipStatus | null;
    isRegular?: boolean | null;
    isReserve?: boolean | null;
    isCivilServant?: boolean | null;
    isIndustry?: boolean | null;
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
      maxGuestsWithoutModeratorApproval?: number | null;
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
      maxGuestsWithoutModeratorApproval?: number | null;
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
      maxGuestsWithoutModeratorApproval?: number | null;
    } & Event_Key)[];
  } & Section_Key;
}

export interface GetEventsForSectionVariables {
  sectionId: UUIDString;
}

export interface GetGuestTicketRequestForNotificationData {
  guestTicketRequest?: {
    id: UUIDString;
    status: GuestTicketRequestStatus;
    requestedGuestCount: number;
    guestDisplayName?: string | null;
    dietaryNote?: string | null;
    moderatorNote?: string | null;
    guestTicketType?: {
      id: UUIDString;
      title: string;
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
            section: {
              id: UUIDString;
              name: string;
            } & Section_Key;
          } & Event_Key;
      } & Booking_Key;
  } & GuestTicketRequest_Key;
}

export interface GetGuestTicketRequestForNotificationVariables {
  id: UUIDString;
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

export interface GetMyBookingsForEventData {
  user?: {
    id: string;
    bookings: ({
      id: UUIDString;
      status: BookingStatus;
      revisionNumber: number;
      clientSubmissionKey?: string | null;
      bookerDietaryNote?: string | null;
      sitNextToUserIds?: string[] | null;
      accommodationRequested: boolean;
      accommodationNote?: string | null;
      createdAt: TimestampString;
      updatedAt: TimestampString;
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
            membershipStatus: MembershipStatus;
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

export interface GetUserByIdData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    membershipStatus: MembershipStatus;
    requestedMembershipStatus?: MembershipStatus | null;
    isRegular?: boolean | null;
    isReserve?: boolean | null;
    isCivilServant?: boolean | null;
    isIndustry?: boolean | null;
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

export interface ListGuestTicketRequestsForAdminData {
  event?: {
    id: UUIDString;
    title: string;
    bookings: ({
      id: UUIDString;
      status: BookingStatus;
      revisionNumber: number;
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
    membershipStatus: MembershipStatus;
    requestedMembershipStatus?: MembershipStatus | null;
    isRegular?: boolean | null;
    isReserve?: boolean | null;
    isCivilServant?: boolean | null;
    isIndustry?: boolean | null;
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
  notificationDelivery_update?: NotificationDelivery_Key | null;
}

export interface MarkNotificationDeliveryFailedByIdVariables {
  id: UUIDString;
  attemptCount: number;
  lastAttemptedAt: TimestampString;
  provider?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}

export interface MarkNotificationDeliveryPendingByIdData {
  notificationDelivery_update?: NotificationDelivery_Key | null;
}

export interface MarkNotificationDeliveryPendingByIdVariables {
  id: UUIDString;
  attemptCount: number;
  lastAttemptedAt: TimestampString;
  provider?: string | null;
}

export interface MarkNotificationDeliverySentByIdData {
  notificationDelivery_update?: NotificationDelivery_Key | null;
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

export interface PaymentReconciliationException_Key {
  id: UUIDString;
  __typename?: 'PaymentReconciliationException_Key';
}

export interface PaymentWebhookEvent_Key {
  id: UUIDString;
  __typename?: 'PaymentWebhookEvent_Key';
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

export interface SectionUserGroupPurposeLink_Key {
  sectionId: UUIDString;
  userGroupId: UUIDString;
  __typename?: 'SectionUserGroupPurposeLink_Key';
}

export interface Section_Key {
  id: UUIDString;
  __typename?: 'Section_Key';
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

export interface UpdateBookingPreferencesFromCallableData {
  booking_update?: Booking_Key | null;
}

export interface UpdateBookingPreferencesFromCallableVariables {
  id: UUIDString;
  bookerDietaryNote?: string | null;
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
  maxGuestsWithoutModeratorApproval?: number | null;
}

export interface UpdatePaymentReconciliationExceptionByIdData {
  paymentReconciliationException_update?: PaymentReconciliationException_Key | null;
}

export interface UpdatePaymentReconciliationExceptionByIdVariables {
  id: UUIDString;
  status: PaymentReconciliationExceptionStatus;
  note?: string | null;
  ownerUserId?: string | null;
  lastAttemptedAt?: TimestampString | null;
  resolvedAt?: TimestampString | null;
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
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
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
  email: string;
  serviceNumber: string;
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
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

/** Generated Node Admin SDK operation action function for the 'ListGuestTicketRequestsForAdmin' Query. Allow users to execute without passing in DataConnect. */
export function listGuestTicketRequestsForAdmin(dc: DataConnect, vars: ListGuestTicketRequestsForAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListGuestTicketRequestsForAdminData>>;
/** Generated Node Admin SDK operation action function for the 'ListGuestTicketRequestsForAdmin' Query. Allow users to pass in custom DataConnect instances. */
export function listGuestTicketRequestsForAdmin(vars: ListGuestTicketRequestsForAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListGuestTicketRequestsForAdminData>>;

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

/** Generated Node Admin SDK operation action function for the 'UpdateUserMembershipStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUserMembershipStatus(dc: DataConnect, vars: UpdateUserMembershipStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserMembershipStatusData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUserMembershipStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUserMembershipStatus(vars: UpdateUserMembershipStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserMembershipStatusData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteUser' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteUser(dc: DataConnect, vars: DeleteUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteUser(vars: DeleteUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserData>>;

/** Generated Node Admin SDK operation action function for the 'CreateUser' Mutation. Allow users to execute without passing in DataConnect. */
export function createUser(dc: DataConnect, vars: CreateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserData>>;
/** Generated Node Admin SDK operation action function for the 'CreateUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function createUser(vars: CreateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserData>>;

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

/** Generated Node Admin SDK operation action function for the 'CreateBookingDraftForUser' Mutation. Allow users to execute without passing in DataConnect. */
export function createBookingDraftForUser(dc: DataConnect, vars: CreateBookingDraftForUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateBookingDraftForUserData>>;
/** Generated Node Admin SDK operation action function for the 'CreateBookingDraftForUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function createBookingDraftForUser(vars: CreateBookingDraftForUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateBookingDraftForUserData>>;

/** Generated Node Admin SDK operation action function for the 'CreateBookingDraftRevisionForUser' Mutation. Allow users to execute without passing in DataConnect. */
export function createBookingDraftRevisionForUser(dc: DataConnect, vars: CreateBookingDraftRevisionForUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateBookingDraftRevisionForUserData>>;
/** Generated Node Admin SDK operation action function for the 'CreateBookingDraftRevisionForUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function createBookingDraftRevisionForUser(vars: CreateBookingDraftRevisionForUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateBookingDraftRevisionForUserData>>;

/** Generated Node Admin SDK operation action function for the 'MarkBookingSupersededFromCallable' Mutation. Allow users to execute without passing in DataConnect. */
export function markBookingSupersededFromCallable(dc: DataConnect, vars: MarkBookingSupersededFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkBookingSupersededFromCallableData>>;
/** Generated Node Admin SDK operation action function for the 'MarkBookingSupersededFromCallable' Mutation. Allow users to pass in custom DataConnect instances. */
export function markBookingSupersededFromCallable(vars: MarkBookingSupersededFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkBookingSupersededFromCallableData>>;

/** Generated Node Admin SDK operation action function for the 'CreateBookingPaymentAdjustmentFromCallable' Mutation. Allow users to execute without passing in DataConnect. */
export function createBookingPaymentAdjustmentFromCallable(dc: DataConnect, vars: CreateBookingPaymentAdjustmentFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateBookingPaymentAdjustmentFromCallableData>>;
/** Generated Node Admin SDK operation action function for the 'CreateBookingPaymentAdjustmentFromCallable' Mutation. Allow users to pass in custom DataConnect instances. */
export function createBookingPaymentAdjustmentFromCallable(vars: CreateBookingPaymentAdjustmentFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateBookingPaymentAdjustmentFromCallableData>>;

/** Generated Node Admin SDK operation action function for the 'AddBookingLineFromCallable' Mutation. Allow users to execute without passing in DataConnect. */
export function addBookingLineFromCallable(dc: DataConnect, vars: AddBookingLineFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddBookingLineFromCallableData>>;
/** Generated Node Admin SDK operation action function for the 'AddBookingLineFromCallable' Mutation. Allow users to pass in custom DataConnect instances. */
export function addBookingLineFromCallable(vars: AddBookingLineFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddBookingLineFromCallableData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateBookingStatusFromCallable' Mutation. Allow users to execute without passing in DataConnect. */
export function updateBookingStatusFromCallable(dc: DataConnect, vars: UpdateBookingStatusFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateBookingStatusFromCallableData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateBookingStatusFromCallable' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateBookingStatusFromCallable(vars: UpdateBookingStatusFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateBookingStatusFromCallableData>>;

/** Generated Node Admin SDK operation action function for the 'CreateTicketOrderForCheckout' Mutation. Allow users to execute without passing in DataConnect. */
export function createTicketOrderForCheckout(dc: DataConnect, vars: CreateTicketOrderForCheckoutVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTicketOrderForCheckoutData>>;
/** Generated Node Admin SDK operation action function for the 'CreateTicketOrderForCheckout' Mutation. Allow users to pass in custom DataConnect instances. */
export function createTicketOrderForCheckout(vars: CreateTicketOrderForCheckoutVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTicketOrderForCheckoutData>>;

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

/** Generated Node Admin SDK operation action function for the 'CreateNotificationDelivery' Mutation. Allow users to execute without passing in DataConnect. */
export function createNotificationDelivery(dc: DataConnect, vars: CreateNotificationDeliveryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateNotificationDeliveryData>>;
/** Generated Node Admin SDK operation action function for the 'CreateNotificationDelivery' Mutation. Allow users to pass in custom DataConnect instances. */
export function createNotificationDelivery(vars: CreateNotificationDeliveryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateNotificationDeliveryData>>;

/** Generated Node Admin SDK operation action function for the 'MarkNotificationDeliveryPendingById' Mutation. Allow users to execute without passing in DataConnect. */
export function markNotificationDeliveryPendingById(dc: DataConnect, vars: MarkNotificationDeliveryPendingByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkNotificationDeliveryPendingByIdData>>;
/** Generated Node Admin SDK operation action function for the 'MarkNotificationDeliveryPendingById' Mutation. Allow users to pass in custom DataConnect instances. */
export function markNotificationDeliveryPendingById(vars: MarkNotificationDeliveryPendingByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkNotificationDeliveryPendingByIdData>>;

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

/** Generated Node Admin SDK operation action function for the 'UpsertTicketOrderDisputeFromWebhook' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertTicketOrderDisputeFromWebhook(dc: DataConnect, vars: UpsertTicketOrderDisputeFromWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertTicketOrderDisputeFromWebhookData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertTicketOrderDisputeFromWebhook' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertTicketOrderDisputeFromWebhook(vars: UpsertTicketOrderDisputeFromWebhookVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertTicketOrderDisputeFromWebhookData>>;

/** Generated Node Admin SDK operation action function for the 'GetPaymentReconciliationExceptionByOrderAndType' Query. Allow users to execute without passing in DataConnect. */
export function getPaymentReconciliationExceptionByOrderAndType(dc: DataConnect, vars: GetPaymentReconciliationExceptionByOrderAndTypeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPaymentReconciliationExceptionByOrderAndTypeData>>;
/** Generated Node Admin SDK operation action function for the 'GetPaymentReconciliationExceptionByOrderAndType' Query. Allow users to pass in custom DataConnect instances. */
export function getPaymentReconciliationExceptionByOrderAndType(vars: GetPaymentReconciliationExceptionByOrderAndTypeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPaymentReconciliationExceptionByOrderAndTypeData>>;

/** Generated Node Admin SDK operation action function for the 'CreatePaymentReconciliationException' Mutation. Allow users to execute without passing in DataConnect. */
export function createPaymentReconciliationException(dc: DataConnect, vars: CreatePaymentReconciliationExceptionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePaymentReconciliationExceptionData>>;
/** Generated Node Admin SDK operation action function for the 'CreatePaymentReconciliationException' Mutation. Allow users to pass in custom DataConnect instances. */
export function createPaymentReconciliationException(vars: CreatePaymentReconciliationExceptionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePaymentReconciliationExceptionData>>;

/** Generated Node Admin SDK operation action function for the 'UpdatePaymentReconciliationExceptionById' Mutation. Allow users to execute without passing in DataConnect. */
export function updatePaymentReconciliationExceptionById(dc: DataConnect, vars: UpdatePaymentReconciliationExceptionByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdatePaymentReconciliationExceptionByIdData>>;
/** Generated Node Admin SDK operation action function for the 'UpdatePaymentReconciliationExceptionById' Mutation. Allow users to pass in custom DataConnect instances. */
export function updatePaymentReconciliationExceptionById(vars: UpdatePaymentReconciliationExceptionByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdatePaymentReconciliationExceptionByIdData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateBookingPreferencesFromCallable' Mutation. Allow users to execute without passing in DataConnect. */
export function updateBookingPreferencesFromCallable(dc: DataConnect, vars: UpdateBookingPreferencesFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateBookingPreferencesFromCallableData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateBookingPreferencesFromCallable' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateBookingPreferencesFromCallable(vars: UpdateBookingPreferencesFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateBookingPreferencesFromCallableData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteBookingLineFromCallable' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteBookingLineFromCallable(dc: DataConnect, vars: DeleteBookingLineFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteBookingLineFromCallableData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteBookingLineFromCallable' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteBookingLineFromCallable(vars: DeleteBookingLineFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteBookingLineFromCallableData>>;

/** Generated Node Admin SDK operation action function for the 'CreateGuestTicketRequestFromCallable' Mutation. Allow users to execute without passing in DataConnect. */
export function createGuestTicketRequestFromCallable(dc: DataConnect, vars: CreateGuestTicketRequestFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateGuestTicketRequestFromCallableData>>;
/** Generated Node Admin SDK operation action function for the 'CreateGuestTicketRequestFromCallable' Mutation. Allow users to pass in custom DataConnect instances. */
export function createGuestTicketRequestFromCallable(vars: CreateGuestTicketRequestFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateGuestTicketRequestFromCallableData>>;

/** Generated Node Admin SDK operation action function for the 'AdminReviewGuestTicketRequestFromCallable' Mutation. Allow users to execute without passing in DataConnect. */
export function adminReviewGuestTicketRequestFromCallable(dc: DataConnect, vars: AdminReviewGuestTicketRequestFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdminReviewGuestTicketRequestFromCallableData>>;
/** Generated Node Admin SDK operation action function for the 'AdminReviewGuestTicketRequestFromCallable' Mutation. Allow users to pass in custom DataConnect instances. */
export function adminReviewGuestTicketRequestFromCallable(vars: AdminReviewGuestTicketRequestFromCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdminReviewGuestTicketRequestFromCallableData>>;

/** Generated Node Admin SDK operation action function for the 'GetBookingForGuestTicketCallable' Query. Allow users to execute without passing in DataConnect. */
export function getBookingForGuestTicketCallable(dc: DataConnect, vars: GetBookingForGuestTicketCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetBookingForGuestTicketCallableData>>;
/** Generated Node Admin SDK operation action function for the 'GetBookingForGuestTicketCallable' Query. Allow users to pass in custom DataConnect instances. */
export function getBookingForGuestTicketCallable(vars: GetBookingForGuestTicketCallableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetBookingForGuestTicketCallableData>>;

/** Generated Node Admin SDK operation action function for the 'GetBookingForNotification' Query. Allow users to execute without passing in DataConnect. */
export function getBookingForNotification(dc: DataConnect, vars: GetBookingForNotificationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetBookingForNotificationData>>;
/** Generated Node Admin SDK operation action function for the 'GetBookingForNotification' Query. Allow users to pass in custom DataConnect instances. */
export function getBookingForNotification(vars: GetBookingForNotificationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetBookingForNotificationData>>;

/** Generated Node Admin SDK operation action function for the 'GetGuestTicketRequestForNotification' Query. Allow users to execute without passing in DataConnect. */
export function getGuestTicketRequestForNotification(dc: DataConnect, vars: GetGuestTicketRequestForNotificationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetGuestTicketRequestForNotificationData>>;
/** Generated Node Admin SDK operation action function for the 'GetGuestTicketRequestForNotification' Query. Allow users to pass in custom DataConnect instances. */
export function getGuestTicketRequestForNotification(vars: GetGuestTicketRequestForNotificationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetGuestTicketRequestForNotificationData>>;

/** Generated Node Admin SDK operation action function for the 'CreateBookingDraft' Mutation. Allow users to execute without passing in DataConnect. */
export function createBookingDraft(dc: DataConnect, vars: CreateBookingDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateBookingDraftData>>;
/** Generated Node Admin SDK operation action function for the 'CreateBookingDraft' Mutation. Allow users to pass in custom DataConnect instances. */
export function createBookingDraft(vars: CreateBookingDraftVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateBookingDraftData>>;

/** Generated Node Admin SDK operation action function for the 'AddBookingLine' Mutation. Allow users to execute without passing in DataConnect. */
export function addBookingLine(dc: DataConnect, vars: AddBookingLineVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddBookingLineData>>;
/** Generated Node Admin SDK operation action function for the 'AddBookingLine' Mutation. Allow users to pass in custom DataConnect instances. */
export function addBookingLine(vars: AddBookingLineVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddBookingLineData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateBookingStatus' Mutation. Allow users to execute without passing in DataConnect. */
export function updateBookingStatus(dc: DataConnect, vars: UpdateBookingStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateBookingStatusData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateBookingStatus' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateBookingStatus(vars: UpdateBookingStatusVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateBookingStatusData>>;

/** Generated Node Admin SDK operation action function for the 'CreateGuestTicketRequest' Mutation. Allow users to execute without passing in DataConnect. */
export function createGuestTicketRequest(dc: DataConnect, vars: CreateGuestTicketRequestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateGuestTicketRequestData>>;
/** Generated Node Admin SDK operation action function for the 'CreateGuestTicketRequest' Mutation. Allow users to pass in custom DataConnect instances. */
export function createGuestTicketRequest(vars: CreateGuestTicketRequestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateGuestTicketRequestData>>;

/** Generated Node Admin SDK operation action function for the 'AdminDeleteGuestTicketRequest' Mutation. Allow users to execute without passing in DataConnect. */
export function adminDeleteGuestTicketRequest(dc: DataConnect, vars: AdminDeleteGuestTicketRequestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdminDeleteGuestTicketRequestData>>;
/** Generated Node Admin SDK operation action function for the 'AdminDeleteGuestTicketRequest' Mutation. Allow users to pass in custom DataConnect instances. */
export function adminDeleteGuestTicketRequest(vars: AdminDeleteGuestTicketRequestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdminDeleteGuestTicketRequestData>>;

/** Generated Node Admin SDK operation action function for the 'AdminReviewGuestTicketRequest' Mutation. Allow users to execute without passing in DataConnect. */
export function adminReviewGuestTicketRequest(dc: DataConnect, vars: AdminReviewGuestTicketRequestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdminReviewGuestTicketRequestData>>;
/** Generated Node Admin SDK operation action function for the 'AdminReviewGuestTicketRequest' Mutation. Allow users to pass in custom DataConnect instances. */
export function adminReviewGuestTicketRequest(vars: AdminReviewGuestTicketRequestVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdminReviewGuestTicketRequestData>>;

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

