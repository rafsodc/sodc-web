import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export enum BookingPaymentAdjustmentStatus {
  NOT_REQUIRED = "NOT_REQUIRED",
  PENDING_AUTO_REFUND = "PENDING_AUTO_REFUND",
  PENDING_AUTO_CHARGE = "PENDING_AUTO_CHARGE",
};

export enum BookingStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
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
  id: UUIDString;
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
  revisionGroupId: UUIDString;
  revisionNumber: number;
  supersedesBookingId?: UUIDString | null;
}

export interface CreateBookingDraftVariables {
  eventId: UUIDString;
}

export interface CreateBookingPaymentAdjustmentFromCallableData {
  bookingPaymentAdjustment_upsert: BookingPaymentAdjustment_Key;
}

export interface CreateBookingPaymentAdjustmentFromCallableVariables {
  revisionBookingId: UUIDString;
  supersededBookingId?: UUIDString | null;
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

export interface CreateGuestTicketRequestVariables {
  bookingId: UUIDString;
  requestedGuestCount: number;
  guestTicketTypeId: UUIDString;
  guestDisplayName: string;
  dietaryNote?: string | null;
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

export interface GetMyBookingsForEventData {
  user?: {
    id: string;
    bookings: ({
      id: UUIDString;
      status: BookingStatus;
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
    totalAmountMinor: number;
    event: {
      id: UUIDString;
    } & Event_Key;
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

export interface ListEventBookingsForAdminData {
  event?: {
    id: UUIDString;
    bookings: ({
      id: UUIDString;
      status: BookingStatus;
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

export interface UpsertPaymentReconciliationExceptionData {
  paymentReconciliationException_upsert: PaymentReconciliationException_Key;
}

export interface UpsertPaymentReconciliationExceptionVariables {
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

interface GetCurrentUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetCurrentUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetCurrentUserData, undefined>;
  operationName: string;
}
export const getCurrentUserRef: GetCurrentUserRef;

export function getCurrentUser(): QueryPromise<GetCurrentUserData, undefined>;
export function getCurrentUser(dc: DataConnect): QueryPromise<GetCurrentUserData, undefined>;

interface GetUserByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
  operationName: string;
}
export const getUserByIdRef: GetUserByIdRef;

export function getUserById(vars: GetUserByIdVariables): QueryPromise<GetUserByIdData, GetUserByIdVariables>;
export function getUserById(dc: DataConnect, vars: GetUserByIdVariables): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

interface ListUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
  operationName: string;
}
export const listUsersRef: ListUsersRef;

export function listUsers(): QueryPromise<ListUsersData, undefined>;
export function listUsers(dc: DataConnect): QueryPromise<ListUsersData, undefined>;

interface ListSectionsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSectionsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListSectionsData, undefined>;
  operationName: string;
}
export const listSectionsRef: ListSectionsRef;

export function listSections(): QueryPromise<ListSectionsData, undefined>;
export function listSections(dc: DataConnect): QueryPromise<ListSectionsData, undefined>;

interface GetSectionsForUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetSectionsForUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetSectionsForUserData, undefined>;
  operationName: string;
}
export const getSectionsForUserRef: GetSectionsForUserRef;

export function getSectionsForUser(): QueryPromise<GetSectionsForUserData, undefined>;
export function getSectionsForUser(dc: DataConnect): QueryPromise<GetSectionsForUserData, undefined>;

interface ListUserGroupsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUserGroupsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListUserGroupsData, undefined>;
  operationName: string;
}
export const listUserGroupsRef: ListUserGroupsRef;

export function listUserGroups(): QueryPromise<ListUserGroupsData, undefined>;
export function listUserGroups(dc: DataConnect): QueryPromise<ListUserGroupsData, undefined>;

interface GetUserAccessGroupsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetUserAccessGroupsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetUserAccessGroupsData, undefined>;
  operationName: string;
}
export const getUserAccessGroupsRef: GetUserAccessGroupsRef;

export function getUserAccessGroups(): QueryPromise<GetUserAccessGroupsData, undefined>;
export function getUserAccessGroups(dc: DataConnect): QueryPromise<GetUserAccessGroupsData, undefined>;

interface CheckUserProfileExistsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<CheckUserProfileExistsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<CheckUserProfileExistsData, undefined>;
  operationName: string;
}
export const checkUserProfileExistsRef: CheckUserProfileExistsRef;

export function checkUserProfileExists(): QueryPromise<CheckUserProfileExistsData, undefined>;
export function checkUserProfileExists(dc: DataConnect): QueryPromise<CheckUserProfileExistsData, undefined>;

interface GetUserMembershipStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserMembershipStatusVariables): QueryRef<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserMembershipStatusVariables): QueryRef<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;
  operationName: string;
}
export const getUserMembershipStatusRef: GetUserMembershipStatusRef;

export function getUserMembershipStatus(vars: GetUserMembershipStatusVariables): QueryPromise<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;
export function getUserMembershipStatus(dc: DataConnect, vars: GetUserMembershipStatusVariables): QueryPromise<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;

interface GetUserWithAccessGroupsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserWithAccessGroupsVariables): QueryRef<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserWithAccessGroupsVariables): QueryRef<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;
  operationName: string;
}
export const getUserWithAccessGroupsRef: GetUserWithAccessGroupsRef;

export function getUserWithAccessGroups(vars: GetUserWithAccessGroupsVariables): QueryPromise<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;
export function getUserWithAccessGroups(dc: DataConnect, vars: GetUserWithAccessGroupsVariables): QueryPromise<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;

interface GetUserAccessGroupsByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserAccessGroupsByIdVariables): QueryRef<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserAccessGroupsByIdVariables): QueryRef<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;
  operationName: string;
}
export const getUserAccessGroupsByIdRef: GetUserAccessGroupsByIdRef;

export function getUserAccessGroupsById(vars: GetUserAccessGroupsByIdVariables): QueryPromise<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;
export function getUserAccessGroupsById(dc: DataConnect, vars: GetUserAccessGroupsByIdVariables): QueryPromise<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;

interface GetEventsForSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEventsForSectionVariables): QueryRef<GetEventsForSectionData, GetEventsForSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetEventsForSectionVariables): QueryRef<GetEventsForSectionData, GetEventsForSectionVariables>;
  operationName: string;
}
export const getEventsForSectionRef: GetEventsForSectionRef;

export function getEventsForSection(vars: GetEventsForSectionVariables): QueryPromise<GetEventsForSectionData, GetEventsForSectionVariables>;
export function getEventsForSection(dc: DataConnect, vars: GetEventsForSectionVariables): QueryPromise<GetEventsForSectionData, GetEventsForSectionVariables>;

interface GetEventByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEventByIdVariables): QueryRef<GetEventByIdData, GetEventByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetEventByIdVariables): QueryRef<GetEventByIdData, GetEventByIdVariables>;
  operationName: string;
}
export const getEventByIdRef: GetEventByIdRef;

export function getEventById(vars: GetEventByIdVariables): QueryPromise<GetEventByIdData, GetEventByIdVariables>;
export function getEventById(dc: DataConnect, vars: GetEventByIdVariables): QueryPromise<GetEventByIdData, GetEventByIdVariables>;

interface GetSectionByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionByIdVariables): QueryRef<GetSectionByIdData, GetSectionByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSectionByIdVariables): QueryRef<GetSectionByIdData, GetSectionByIdVariables>;
  operationName: string;
}
export const getSectionByIdRef: GetSectionByIdRef;

export function getSectionById(vars: GetSectionByIdVariables): QueryPromise<GetSectionByIdData, GetSectionByIdVariables>;
export function getSectionById(dc: DataConnect, vars: GetSectionByIdVariables): QueryPromise<GetSectionByIdData, GetSectionByIdVariables>;

interface GetUserGroupByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserGroupByIdVariables): QueryRef<GetUserGroupByIdData, GetUserGroupByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserGroupByIdVariables): QueryRef<GetUserGroupByIdData, GetUserGroupByIdVariables>;
  operationName: string;
}
export const getUserGroupByIdRef: GetUserGroupByIdRef;

export function getUserGroupById(vars: GetUserGroupByIdVariables): QueryPromise<GetUserGroupByIdData, GetUserGroupByIdVariables>;
export function getUserGroupById(dc: DataConnect, vars: GetUserGroupByIdVariables): QueryPromise<GetUserGroupByIdData, GetUserGroupByIdVariables>;

interface GetAllUserGroupsWithStatusesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetAllUserGroupsWithStatusesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetAllUserGroupsWithStatusesData, undefined>;
  operationName: string;
}
export const getAllUserGroupsWithStatusesRef: GetAllUserGroupsWithStatusesRef;

export function getAllUserGroupsWithStatuses(): QueryPromise<GetAllUserGroupsWithStatusesData, undefined>;
export function getAllUserGroupsWithStatuses(dc: DataConnect): QueryPromise<GetAllUserGroupsWithStatusesData, undefined>;

interface GetSectionMembersRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionMembersVariables): QueryRef<GetSectionMembersData, GetSectionMembersVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSectionMembersVariables): QueryRef<GetSectionMembersData, GetSectionMembersVariables>;
  operationName: string;
}
export const getSectionMembersRef: GetSectionMembersRef;

export function getSectionMembers(vars: GetSectionMembersVariables): QueryPromise<GetSectionMembersData, GetSectionMembersVariables>;
export function getSectionMembers(dc: DataConnect, vars: GetSectionMembersVariables): QueryPromise<GetSectionMembersData, GetSectionMembersVariables>;

interface GetMyBookingsForEventRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyBookingsForEventVariables): QueryRef<GetMyBookingsForEventData, GetMyBookingsForEventVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMyBookingsForEventVariables): QueryRef<GetMyBookingsForEventData, GetMyBookingsForEventVariables>;
  operationName: string;
}
export const getMyBookingsForEventRef: GetMyBookingsForEventRef;

export function getMyBookingsForEvent(vars: GetMyBookingsForEventVariables): QueryPromise<GetMyBookingsForEventData, GetMyBookingsForEventVariables>;
export function getMyBookingsForEvent(dc: DataConnect, vars: GetMyBookingsForEventVariables): QueryPromise<GetMyBookingsForEventData, GetMyBookingsForEventVariables>;

interface GetMyTicketOrderByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyTicketOrderByIdVariables): QueryRef<GetMyTicketOrderByIdData, GetMyTicketOrderByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMyTicketOrderByIdVariables): QueryRef<GetMyTicketOrderByIdData, GetMyTicketOrderByIdVariables>;
  operationName: string;
}
export const getMyTicketOrderByIdRef: GetMyTicketOrderByIdRef;

export function getMyTicketOrderById(vars: GetMyTicketOrderByIdVariables): QueryPromise<GetMyTicketOrderByIdData, GetMyTicketOrderByIdVariables>;
export function getMyTicketOrderById(dc: DataConnect, vars: GetMyTicketOrderByIdVariables): QueryPromise<GetMyTicketOrderByIdData, GetMyTicketOrderByIdVariables>;

interface GetMyTicketOrdersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyTicketOrdersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyTicketOrdersData, undefined>;
  operationName: string;
}
export const getMyTicketOrdersRef: GetMyTicketOrdersRef;

export function getMyTicketOrders(): QueryPromise<GetMyTicketOrdersData, undefined>;
export function getMyTicketOrders(dc: DataConnect): QueryPromise<GetMyTicketOrdersData, undefined>;

interface ListEventBookingsForAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListEventBookingsForAdminVariables): QueryRef<ListEventBookingsForAdminData, ListEventBookingsForAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListEventBookingsForAdminVariables): QueryRef<ListEventBookingsForAdminData, ListEventBookingsForAdminVariables>;
  operationName: string;
}
export const listEventBookingsForAdminRef: ListEventBookingsForAdminRef;

export function listEventBookingsForAdmin(vars: ListEventBookingsForAdminVariables): QueryPromise<ListEventBookingsForAdminData, ListEventBookingsForAdminVariables>;
export function listEventBookingsForAdmin(dc: DataConnect, vars: ListEventBookingsForAdminVariables): QueryPromise<ListEventBookingsForAdminData, ListEventBookingsForAdminVariables>;

interface ListGuestTicketRequestsForAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListGuestTicketRequestsForAdminVariables): QueryRef<ListGuestTicketRequestsForAdminData, ListGuestTicketRequestsForAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListGuestTicketRequestsForAdminVariables): QueryRef<ListGuestTicketRequestsForAdminData, ListGuestTicketRequestsForAdminVariables>;
  operationName: string;
}
export const listGuestTicketRequestsForAdminRef: ListGuestTicketRequestsForAdminRef;

export function listGuestTicketRequestsForAdmin(vars: ListGuestTicketRequestsForAdminVariables): QueryPromise<ListGuestTicketRequestsForAdminData, ListGuestTicketRequestsForAdminVariables>;
export function listGuestTicketRequestsForAdmin(dc: DataConnect, vars: ListGuestTicketRequestsForAdminVariables): QueryPromise<ListGuestTicketRequestsForAdminData, ListGuestTicketRequestsForAdminVariables>;

interface ListTicketOrdersForAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListTicketOrdersForAdminVariables): QueryRef<ListTicketOrdersForAdminData, ListTicketOrdersForAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListTicketOrdersForAdminVariables): QueryRef<ListTicketOrdersForAdminData, ListTicketOrdersForAdminVariables>;
  operationName: string;
}
export const listTicketOrdersForAdminRef: ListTicketOrdersForAdminRef;

export function listTicketOrdersForAdmin(vars: ListTicketOrdersForAdminVariables): QueryPromise<ListTicketOrdersForAdminData, ListTicketOrdersForAdminVariables>;
export function listTicketOrdersForAdmin(dc: DataConnect, vars: ListTicketOrdersForAdminVariables): QueryPromise<ListTicketOrdersForAdminData, ListTicketOrdersForAdminVariables>;

interface ListOpenPaymentReconciliationExceptionsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListOpenPaymentReconciliationExceptionsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListOpenPaymentReconciliationExceptionsData, undefined>;
  operationName: string;
}
export const listOpenPaymentReconciliationExceptionsRef: ListOpenPaymentReconciliationExceptionsRef;

export function listOpenPaymentReconciliationExceptions(): QueryPromise<ListOpenPaymentReconciliationExceptionsData, undefined>;
export function listOpenPaymentReconciliationExceptions(dc: DataConnect): QueryPromise<ListOpenPaymentReconciliationExceptionsData, undefined>;

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

export function getUserGroupByName(vars: GetUserGroupByNameVariables): QueryPromise<GetUserGroupByNameData, GetUserGroupByNameVariables>;
export function getUserGroupByName(dc: DataConnect, vars: GetUserGroupByNameVariables): QueryPromise<GetUserGroupByNameData, GetUserGroupByNameVariables>;

interface GetUserUserGroupsForAdminRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserUserGroupsForAdminVariables): QueryRef<GetUserUserGroupsForAdminData, GetUserUserGroupsForAdminVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserUserGroupsForAdminVariables): QueryRef<GetUserUserGroupsForAdminData, GetUserUserGroupsForAdminVariables>;
  operationName: string;
}
export const getUserUserGroupsForAdminRef: GetUserUserGroupsForAdminRef;

export function getUserUserGroupsForAdmin(vars: GetUserUserGroupsForAdminVariables): QueryPromise<GetUserUserGroupsForAdminData, GetUserUserGroupsForAdminVariables>;
export function getUserUserGroupsForAdmin(dc: DataConnect, vars: GetUserUserGroupsForAdminVariables): QueryPromise<GetUserUserGroupsForAdminData, GetUserUserGroupsForAdminVariables>;

interface GetUserForCheckoutRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserForCheckoutVariables): QueryRef<GetUserForCheckoutData, GetUserForCheckoutVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserForCheckoutVariables): QueryRef<GetUserForCheckoutData, GetUserForCheckoutVariables>;
  operationName: string;
}
export const getUserForCheckoutRef: GetUserForCheckoutRef;

export function getUserForCheckout(vars: GetUserForCheckoutVariables): QueryPromise<GetUserForCheckoutData, GetUserForCheckoutVariables>;
export function getUserForCheckout(dc: DataConnect, vars: GetUserForCheckoutVariables): QueryPromise<GetUserForCheckoutData, GetUserForCheckoutVariables>;

interface GetTicketTypeForCheckoutRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTicketTypeForCheckoutVariables): QueryRef<GetTicketTypeForCheckoutData, GetTicketTypeForCheckoutVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetTicketTypeForCheckoutVariables): QueryRef<GetTicketTypeForCheckoutData, GetTicketTypeForCheckoutVariables>;
  operationName: string;
}
export const getTicketTypeForCheckoutRef: GetTicketTypeForCheckoutRef;

export function getTicketTypeForCheckout(vars: GetTicketTypeForCheckoutVariables): QueryPromise<GetTicketTypeForCheckoutData, GetTicketTypeForCheckoutVariables>;
export function getTicketTypeForCheckout(dc: DataConnect, vars: GetTicketTypeForCheckoutVariables): QueryPromise<GetTicketTypeForCheckoutData, GetTicketTypeForCheckoutVariables>;

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

export function getEventByIdForCallable(vars: GetEventByIdForCallableVariables): QueryPromise<GetEventByIdForCallableData, GetEventByIdForCallableVariables>;
export function getEventByIdForCallable(dc: DataConnect, vars: GetEventByIdForCallableVariables): QueryPromise<GetEventByIdForCallableData, GetEventByIdForCallableVariables>;

interface GetSectionByIdForCallableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionByIdForCallableVariables): QueryRef<GetSectionByIdForCallableData, GetSectionByIdForCallableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSectionByIdForCallableVariables): QueryRef<GetSectionByIdForCallableData, GetSectionByIdForCallableVariables>;
  operationName: string;
}
export const getSectionByIdForCallableRef: GetSectionByIdForCallableRef;

export function getSectionByIdForCallable(vars: GetSectionByIdForCallableVariables): QueryPromise<GetSectionByIdForCallableData, GetSectionByIdForCallableVariables>;
export function getSectionByIdForCallable(dc: DataConnect, vars: GetSectionByIdForCallableVariables): QueryPromise<GetSectionByIdForCallableData, GetSectionByIdForCallableVariables>;

interface GetBookingsForBookerAndEventRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetBookingsForBookerAndEventVariables): QueryRef<GetBookingsForBookerAndEventData, GetBookingsForBookerAndEventVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetBookingsForBookerAndEventVariables): QueryRef<GetBookingsForBookerAndEventData, GetBookingsForBookerAndEventVariables>;
  operationName: string;
}
export const getBookingsForBookerAndEventRef: GetBookingsForBookerAndEventRef;

export function getBookingsForBookerAndEvent(vars: GetBookingsForBookerAndEventVariables): QueryPromise<GetBookingsForBookerAndEventData, GetBookingsForBookerAndEventVariables>;
export function getBookingsForBookerAndEvent(dc: DataConnect, vars: GetBookingsForBookerAndEventVariables): QueryPromise<GetBookingsForBookerAndEventData, GetBookingsForBookerAndEventVariables>;

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

interface GetTicketOrderForWebhookRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTicketOrderForWebhookVariables): QueryRef<GetTicketOrderForWebhookData, GetTicketOrderForWebhookVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetTicketOrderForWebhookVariables): QueryRef<GetTicketOrderForWebhookData, GetTicketOrderForWebhookVariables>;
  operationName: string;
}
export const getTicketOrderForWebhookRef: GetTicketOrderForWebhookRef;

export function getTicketOrderForWebhook(vars: GetTicketOrderForWebhookVariables): QueryPromise<GetTicketOrderForWebhookData, GetTicketOrderForWebhookVariables>;
export function getTicketOrderForWebhook(dc: DataConnect, vars: GetTicketOrderForWebhookVariables): QueryPromise<GetTicketOrderForWebhookData, GetTicketOrderForWebhookVariables>;

interface GetPaymentWebhookEventByStripeEventIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetPaymentWebhookEventByStripeEventIdVariables): QueryRef<GetPaymentWebhookEventByStripeEventIdData, GetPaymentWebhookEventByStripeEventIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetPaymentWebhookEventByStripeEventIdVariables): QueryRef<GetPaymentWebhookEventByStripeEventIdData, GetPaymentWebhookEventByStripeEventIdVariables>;
  operationName: string;
}
export const getPaymentWebhookEventByStripeEventIdRef: GetPaymentWebhookEventByStripeEventIdRef;

export function getPaymentWebhookEventByStripeEventId(vars: GetPaymentWebhookEventByStripeEventIdVariables): QueryPromise<GetPaymentWebhookEventByStripeEventIdData, GetPaymentWebhookEventByStripeEventIdVariables>;
export function getPaymentWebhookEventByStripeEventId(dc: DataConnect, vars: GetPaymentWebhookEventByStripeEventIdVariables): QueryPromise<GetPaymentWebhookEventByStripeEventIdData, GetPaymentWebhookEventByStripeEventIdVariables>;

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

