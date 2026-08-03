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
    subject: "Your booking for ((eventTitle)) is confirmed",
    variables: [
    "firstName",
    "eventTitle",
    "eventDateTime",
    "eventLocation",
    "ticketLinesSummary",
    "bookerDietaryNote",
    "accommodationSummary",
    "bookingTotalFormatted",
    "sectionBookingsUrl",
    "myPaymentsUrl"
    ],
    body: "Hello ((firstName)),\n\nThank you for booking your place at ((eventTitle)). Your booking is confirmed.\n\n---\n\n# Event details\n\nDate and time: ((eventDateTime))\n\nWhere: ((eventLocation))\n\n---\n\n# Your booking\n\n((ticketLinesSummary))\n\nDietary requirements: ((bookerDietaryNote))\n\nAccommodation: ((accommodationSummary))\n\nTotal: ((bookingTotalFormatted))\n\n---\n\nView your booking:\n\n((sectionBookingsUrl))\n\nIf you still need to make a payment, visit My Payments:\n\n((myPaymentsUrl))\n\nKind regards,\n\nSODC Admin",
  },
  bookingRevision: {
    subject: "Your booking for ((eventTitle)) has been updated",
    variables: [
    "firstName",
    "eventTitle",
    "eventDateTime",
    "eventLocation",
    "ticketLinesSummary",
    "bookerDietaryNote",
    "accommodationSummary",
    "bookingTotalFormatted",
    "sectionBookingsUrl",
    "myPaymentsUrl",
    "paymentAdjustmentStatus",
    "previousTotalFormatted",
    "revisedTotalFormatted",
    "deltaAmountFormatted"
    ],
    body: "Hello ((firstName)),\n\nYour booking for ((eventTitle)) has been updated.\n\n---\n\n# Event details\n\nDate and time: ((eventDateTime))\n\nWhere: ((eventLocation))\n\n---\n\n# Your updated booking\n\n((ticketLinesSummary))\n\nDietary requirements: ((bookerDietaryNote))\n\nAccommodation: ((accommodationSummary))\n\nPrevious total: ((previousTotalFormatted))\n\nRevised total: ((revisedTotalFormatted))\n\nPayment difference: ((deltaAmountFormatted))\n\nPayment status: ((paymentAdjustmentStatus))\n\n---\n\nView your booking:\n\n((sectionBookingsUrl))\n\nView your payments:\n\n((myPaymentsUrl))\n\nKind regards,\n\nSODC Admin",
  },
  emailChangeVerification: {
    subject: "Confirm your new SODC email address",
    variables: [
    "verificationLink"
    ],
    body: "Hello,\n\nWe received a request to change the email address used for your SODC account.\n\nUse this secure link to confirm the new address:\n\n((verificationLink))\n\nIf you did not request this change, you can ignore this email. Your current address will remain unchanged.\n\nKind regards,\n\nSODC Admin",
  },
  emailVerification: {
    subject: "Verify your SODC email address",
    variables: [
    "verificationLink"
    ],
    body: "Hello,\n\nThank you for registering with SODC.\n\nUse this secure link to verify your email address:\n\n((verificationLink))\n\nIf you did not create an SODC account, you can ignore this email.\n\nKind regards,\n\nSODC Admin",
  },
  guestTicketRequestApproved: {
    subject: "Guest ticket request approved — ((eventTitle))",
    variables: [
    "firstName",
    "eventTitle",
    "eventDateTime",
    "eventLocation",
    "guestDisplayName",
    "requestedGuestCount",
    "moderatorNote",
    "myBookingsUrl"
    ],
    body: "Hello ((firstName)),\n\nYour request for guest places at ((eventTitle)) has been approved.\n\nDate and time: ((eventDateTime))\n\nLocation: ((eventLocation))\n\nGuest: ((guestDisplayName))\n\nGuest places: ((requestedGuestCount))\n\nNote from organiser: ((moderatorNote))\n\nYou can now arrange payment for the guest places. View your booking to continue:\n\n((myBookingsUrl))\n\nKind regards,\n\nSODC Admin",
  },
  guestTicketRequestRejected: {
    subject: "Update on your guest request for ((eventTitle))",
    variables: [
    "firstName",
    "eventTitle",
    "eventDateTime",
    "eventLocation",
    "guestDisplayName",
    "requestedGuestCount",
    "moderatorNote",
    "myBookingsUrl"
    ],
    body: "Hello ((firstName)),\n\nUnfortunately, your request for guest places at ((eventTitle)) was not approved.\n\nDate and time: ((eventDateTime))\n\nLocation: ((eventLocation))\n\nGuest: ((guestDisplayName))\n\nGuest places requested: ((requestedGuestCount))\n\nNote from organiser: ((moderatorNote))\n\nView your booking:\n\n((myBookingsUrl))\n\nKind regards,\n\nSODC Admin",
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
    "firstName",
    "membershipStatusLabel",
    "previousStatusLabel",
    "appUrl"
    ],
    body: "Hello ((firstName)),\n\nYour SODC membership status has changed from ((previousStatusLabel)) to ((membershipStatusLabel)).\n\nYour access to the member area has therefore changed.\n\nView SODC online:\n\n((appUrl))\n\nKind regards,\n\nSODC Admin",
  },
  membershipActivated: {
    subject: "Welcome to SODC — your membership is active",
    variables: [
    "firstName",
    "membershipStatusLabel",
    "appUrl",
    "profileUrl"
    ],
    body: "Hello ((firstName)),\n\nWe are pleased to confirm that your SODC membership is now active. Your membership status is ((membershipStatusLabel)).\n\nYou can now access sections, view upcoming events, and make bookings.\n\nSign in to get started:\n\n((appUrl))\n\nYou can review your profile and communication preferences here:\n\n((profileUrl))\n\nWelcome to SODC.\n\nKind regards,\n\nSODC Admin",
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
  passwordReset: {
    subject: "Reset your SODC password",
    variables: [
    "resetLink"
    ],
    body: "Hello,\n\nWe received a request to reset the password for your SODC account.\n\nUse this secure link to choose a new password:\n\n((resetLink))\n\nIf you did not request this, you can ignore this email. Your password will not change.\n\nKind regards,\n\nSODC Admin",
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
    "firstName",
    "eventTitle",
    "eventDateTime",
    "eventLocation",
    "ticketTypeTitle",
    "quantity",
    "totalFormatted",
    "myPaymentsUrl"
    ],
    body: "Hello ((firstName)),\n\nWe could not complete your payment for ((eventTitle)).\n\nDate and time: ((eventDateTime))\n\nLocation: ((eventLocation))\n\nTicket: ((ticketTypeTitle))\n\nQuantity: ((quantity))\n\nAmount: ((totalFormatted))\n\nYour booking is still in place. You can return to My Payments to try again:\n\n((myPaymentsUrl))\n\nKind regards,\n\nSODC Admin",
  },
  ticketOrderPaid: {
    subject: "Payment confirmed — ((eventTitle))",
    variables: [
    "firstName",
    "eventTitle",
    "eventDateTime",
    "eventLocation",
    "ticketTypeTitle",
    "quantity",
    "totalFormatted",
    "myPaymentsUrl"
    ],
    body: "Hello ((firstName)),\n\nThank you. We have received your payment for ((eventTitle)).\n\nDate and time: ((eventDateTime))\n\nLocation: ((eventLocation))\n\nTicket: ((ticketTypeTitle))\n\nQuantity: ((quantity))\n\nTotal paid: ((totalFormatted))\n\nYou can view your payment history at any time:\n\n((myPaymentsUrl))\n\nKind regards,\n\nSODC Admin",
  },
  ticketOrderRefunded: {
    subject: "Refund processed — ((eventTitle))",
    variables: [
    "firstName",
    "eventTitle",
    "eventDateTime",
    "eventLocation",
    "ticketTypeTitle",
    "quantity",
    "totalFormatted",
    "myPaymentsUrl",
    "refundFormatted"
    ],
    body: "Hello ((firstName)),\n\nWe have processed a refund of ((refundFormatted)) for your payment for ((eventTitle)).\n\nDate and time: ((eventDateTime))\n\nLocation: ((eventLocation))\n\nTicket: ((ticketTypeTitle))\n\nQuantity: ((quantity))\n\nOriginal payment: ((totalFormatted))\n\nRefunds typically appear in your account within 5 to 10 working days depending on your bank.\n\nYou can view your payment history at:\n\n((myPaymentsUrl))\n\nKind regards,\n\nSODC Admin",
  },
};
