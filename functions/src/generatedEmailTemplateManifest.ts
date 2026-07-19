// AUTO-GENERATED — do not edit directly.
// Source: functions/email-templates/*.md
// Regenerate by running: npm run build (or npm run generate:templates)

export interface EmailTemplateDefinition {
  subject: string;
  variables: string[];
  body: string;
}

export const EMAIL_TEMPLATE_MANIFEST: Record<string, EmailTemplateDefinition> = {
  bookingConfirmation: {
    subject: "Your SODC booking — ((eventTitle))",
    variables: [
    "customerFirstName",
    "eventTitle",
    "eventDateTime",
    "eventLocation",
    "revisionNumber",
    "ticketLinesSummary",
    "bookerDietaryNote",
    "accommodationSummary",
    "bookingTotalFormatted",
    "sectionBookingsUrl",
    "myPaymentsUrl"
    ],
    body: "Dear ((customerFirstName)),\n\nYour booking for ((eventTitle)) has been confirmed.\n\n---\n\n# Event details\n\nWhen: ((eventDateTime))\n\nWhere: ((eventLocation))\n\n---\n\n# Your booking (revision ((revisionNumber)))\n\n((ticketLinesSummary))\n\nYour dietary note: ((bookerDietaryNote))\n\nAccommodation: ((accommodationSummary))\n\nTotal: ((bookingTotalFormatted))\n\n---\n\nYou can view your booking and payment status at any time:\n\n((sectionBookingsUrl))\n\nIf payment is outstanding, visit My Payments:\n\n((myPaymentsUrl))\n\nSODC",
  },
  bookingRevision: {
    subject: "Your SODC booking has been updated — ((eventTitle))",
    variables: [
    "customerFirstName",
    "eventTitle",
    "eventDateTime",
    "eventLocation",
    "revisionNumber",
    "ticketLinesSummary",
    "bookerDietaryNote",
    "accommodationSummary",
    "bookingTotalFormatted",
    "sectionBookingsUrl",
    "myPaymentsUrl",
    "previousRevisionNumber",
    "revisedRevisionNumber",
    "paymentAdjustmentStatus",
    "previousTotalFormatted",
    "revisedTotalFormatted",
    "deltaAmountFormatted"
    ],
    body: "Dear ((customerFirstName)),\n\nYour booking for ((eventTitle)) has been updated (revision ((previousRevisionNumber)) to ((revisedRevisionNumber))).\n\n---\n\n# Event details\n\nWhen: ((eventDateTime))\n\nWhere: ((eventLocation))\n\n---\n\n# Updated booking (revision ((revisedRevisionNumber)))\n\n((ticketLinesSummary))\n\nYour dietary note: ((bookerDietaryNote))\n\nAccommodation: ((accommodationSummary))\n\nPrevious total: ((previousTotalFormatted))\n\nRevised total: ((revisedTotalFormatted))\n\nDifference: ((deltaAmountFormatted))\n\nPayment status: ((paymentAdjustmentStatus))\n\n---\n\nView your booking:\n\n((sectionBookingsUrl))\n\nManage payments:\n\n((myPaymentsUrl))\n\nSODC",
  },
  guestTicketRequestApproved: {
    subject: "Guest ticket request approved — ((eventTitle))",
    variables: [
    "customerFirstName",
    "eventTitle",
    "guestDisplayName",
    "requestedGuestCount",
    "decisionLabel",
    "moderatorNote",
    "myBookingsUrl"
    ],
    body: "Dear ((customerFirstName)),\n\nYour guest ticket request for ((eventTitle)) has been ((decisionLabel)).\n\nGuest: ((guestDisplayName))\n\nGuest tickets: ((requestedGuestCount))\n\nNote from organiser: ((moderatorNote))\n\nYou can now complete payment for your guest tickets. Visit your booking to continue:\n\n((myBookingsUrl))\n\nSODC",
  },
  guestTicketRequestRejected: {
    subject: "Guest ticket request update — ((eventTitle))",
    variables: [
    "customerFirstName",
    "eventTitle",
    "guestDisplayName",
    "requestedGuestCount",
    "decisionLabel",
    "moderatorNote",
    "myBookingsUrl"
    ],
    body: "Dear ((customerFirstName)),\n\nYour guest ticket request for ((eventTitle)) has been ((decisionLabel)).\n\nGuest: ((guestDisplayName))\n\nGuest tickets requested: ((requestedGuestCount))\n\nNote from organiser: ((moderatorNote))\n\nIf you have any questions, please contact your section organiser. You can view your booking at:\n\n((myBookingsUrl))\n\nSODC",
  },
  guestTicketRequestSubmittedModerator: {
    subject: "Guest ticket request — ((eventTitle))",
    variables: [
    "eventTitle",
    "sectionName",
    "bookerDisplay",
    "guestDisplayName",
    "requestedGuestCount",
    "guestTicketTypeTitle",
    "dietaryNote",
    "moderationUrl"
    ],
    body: "A guest ticket request has been submitted for your review.\n\nEvent: ((eventTitle))\n\nSection: ((sectionName))\n\nRequested by: ((bookerDisplay))\n\nGuest name: ((guestDisplayName))\n\nGuest count: ((requestedGuestCount))\n\nTicket type: ((guestTicketTypeTitle))\n\nDietary note: ((dietaryNote))\n\n---\n\nReview and approve or decline this request in the admin panel:\n\n((moderationUrl))\n\nSODC",
  },
  membershipAccessRestricted: {
    subject: "Your SODC membership status has changed",
    variables: [
    "customerFirstName",
    "membershipStatusLabel",
    "previousStatusLabel",
    "appUrl"
    ],
    body: "Dear ((customerFirstName)),\n\nYour SODC membership status has changed from ((previousStatusLabel)) to ((membershipStatusLabel)).\n\nYour access to the member area has been restricted. If you think this is an error, or would like to discuss your membership, please reply to this email.\n\n((appUrl))\n\nSODC",
  },
  membershipActivated: {
    subject: "Welcome to SODC — your membership is active",
    variables: [
    "customerFirstName",
    "membershipStatusLabel",
    "appUrl",
    "profileUrl"
    ],
    body: "Dear ((customerFirstName)),\n\nYour SODC membership is now active. Your membership status is ((membershipStatusLabel)).\n\nYou can now access sections, view upcoming events, and make bookings.\n\nSign in to get started:\n\n((appUrl))\n\nWe recommend completing your profile before making your first booking:\n\n((profileUrl))\n\nWelcome aboard.\n\nSODC",
  },
  newUserPendingApprovalAlert: {
    subject: "[SODC] New member awaiting approval — ((firstName)) ((lastName))",
    variables: [
    "firstName",
    "lastName",
    "email",
    "serviceNumber",
    "serviceBackgroundSummary",
    "requestedMembershipStatus",
    "approveUsersUrl"
    ],
    body: "A new member has completed their profile and is awaiting approval.\n\nName: ((firstName)) ((lastName))\nEmail: ((email))\nService number: ((serviceNumber))\nService background: ((serviceBackgroundSummary))\nRequested status: ((requestedMembershipStatus))\n\nReview in Approve Users:\n((approveUsersUrl))",
  },
  paymentDisputeOpsAlert: {
    subject: "[SODC OPS] Payment dispute — ((orderId))",
    variables: [
    "orderId",
    "eventTitle",
    "customerDisplay",
    "disputeStripeStatus",
    "disputeReason",
    "disputeLocalState",
    "stripeDisputeId",
    "stripeEventType",
    "reconciliationDashboardUrl",
    "stripeEventId"
    ],
    body: "A payment dispute event has been received.\n\nOrder ID: ((orderId))\n\nEvent: ((eventTitle))\n\nCustomer: ((customerDisplay))\n\nDispute ID: ((stripeDisputeId))\n\nStripe status: ((disputeStripeStatus))\n\nReason: ((disputeReason))\n\nLocal state: ((disputeLocalState))\n\nStripe event type: ((stripeEventType))\n\nStripe event ID: ((stripeEventId))\n\n---\n\nReview in the reconciliation dashboard:\n\n((reconciliationDashboardUrl))\n\nSODC Ops",
  },
  paymentReconciliationExceptionAlert: {
    subject: "[SODC OPS] Reconciliation exception — ((orderId))",
    variables: [
    "orderId",
    "eventTitle",
    "customerDisplay",
    "exceptionType",
    "exceptionNote",
    "reconciliationDashboardUrl",
    "stripeEventId"
    ],
    body: "A payment reconciliation exception requires your attention.\n\nOrder ID: ((orderId))\n\nEvent: ((eventTitle))\n\nCustomer: ((customerDisplay))\n\nException type: ((exceptionType))\n\nNote: ((exceptionNote))\n\nStripe event ID: ((stripeEventId))\n\n---\n\nReview in the reconciliation dashboard:\n\n((reconciliationDashboardUrl))\n\nSODC Ops",
  },
  ticketOrderFailed: {
    subject: "Payment unsuccessful — ((eventTitle))",
    variables: [
    "customerFirstName",
    "firstName",
    "eventTitle",
    "ticketTypeTitle",
    "quantity",
    "totalFormatted",
    "currencyDisplay",
    "orderStatusLabel",
    "orderId",
    "myPaymentsUrl"
    ],
    body: "Dear ((customerFirstName)),\n\nUnfortunately your payment for ((eventTitle)) was unsuccessful.\n\nTicket: ((ticketTypeTitle))\n\nQuantity: ((quantity))\n\nAmount: ((totalFormatted)) ((currencyDisplay))\n\nStatus: ((orderStatusLabel))\n\nOrder reference: ((orderId))\n\nYour booking is still in place. You can return to My Payments to try again:\n\n((myPaymentsUrl))\n\nIf you continue to have problems, please reply to this email.\n\nSODC",
  },
  ticketOrderPaid: {
    subject: "Payment confirmed — ((eventTitle))",
    variables: [
    "customerFirstName",
    "firstName",
    "eventTitle",
    "ticketTypeTitle",
    "quantity",
    "totalFormatted",
    "currencyDisplay",
    "orderStatusLabel",
    "orderId",
    "myPaymentsUrl"
    ],
    body: "Dear ((customerFirstName)),\n\nYour payment for ((eventTitle)) has been confirmed.\n\nTicket: ((ticketTypeTitle))\n\nQuantity: ((quantity))\n\nTotal paid: ((totalFormatted)) ((currencyDisplay))\n\nStatus: ((orderStatusLabel))\n\nOrder reference: ((orderId))\n\nYou can view your payment history at any time:\n\n((myPaymentsUrl))\n\nSODC",
  },
  ticketOrderRefunded: {
    subject: "Refund processed — ((eventTitle))",
    variables: [
    "customerFirstName",
    "firstName",
    "eventTitle",
    "ticketTypeTitle",
    "quantity",
    "totalFormatted",
    "currencyDisplay",
    "orderStatusLabel",
    "orderId",
    "myPaymentsUrl",
    "refundFormatted"
    ],
    body: "Dear ((customerFirstName)),\n\nA refund of ((refundFormatted)) has been processed for your payment on ((eventTitle)).\n\nTicket: ((ticketTypeTitle))\n\nQuantity: ((quantity))\n\nOriginal total: ((totalFormatted)) ((currencyDisplay))\n\nStatus: ((orderStatusLabel))\n\nOrder reference: ((orderId))\n\nRefunds typically appear in your account within 5 to 10 working days depending on your bank.\n\nYou can view your payment history at:\n\n((myPaymentsUrl))\n\nSODC",
  },
};
