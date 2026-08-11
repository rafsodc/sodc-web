// AUTO-GENERATED — do not edit directly.
// Source: functions/email-templates/*.md
// Regenerate by running: npm run build (or npm run generate:templates)

export interface EmailTemplateDefinition {
  subject: string;
  variables: string[];
  body: string;
}

export const EMAIL_TEMPLATE_MANIFEST: Record<string, EmailTemplateDefinition> = {
  bookingApproved: {
    subject: "Your booking for ((eventTitle)) has been approved",
    variables: [
    "firstName",
    "eventTitle",
    "eventDateTime",
    "eventLocation",
    "ticketLinesSummary",
    "bookingTotalFormatted",
    "sectionBookingsUrl",
    "myPaymentsUrl"
    ],
    body: "Hello ((firstName)),\n\nThe organiser has approved your booking for ((eventTitle)). You can now continue to payment.\n\nDate and time: ((eventDateTime))\n\nWhere: ((eventLocation))\n\nYour approved booking:\n\n((ticketLinesSummary))\n\nTotal: ((bookingTotalFormatted))\n\nView your booking:\n\n((sectionBookingsUrl))\n\nContinue to payment:\n\n((myPaymentsUrl))\n\nKind regards,\n\nSODC Admin",
  },
  bookingChangesRequested: {
    subject: "Changes requested for your booking — ((eventTitle))",
    variables: [
    "firstName",
    "eventTitle",
    "eventDateTime",
    "eventLocation",
    "ticketLinesSummary",
    "moderatorNote",
    "sectionBookingsUrl"
    ],
    body: "Hello ((firstName)),\n\nThe organiser has reviewed your booking for ((eventTitle)) and has requested changes.\n\nDate and time: ((eventDateTime))\n\nWhere: ((eventLocation))\n\nBooking reviewed:\n\n((ticketLinesSummary))\n\nOrganiser note: ((moderatorNote))\n\nYour previous approved booking remains active. View and amend the newer revision here:\n\n((sectionBookingsUrl))\n\nKind regards,\n\nSODC Admin",
  },
  bookingConfirmation: {
    subject: "Your booking for ((eventTitle)) is confirmed",
    variables: [
    "firstName",
    "eventTitle",
    "eventDateTime",
    "eventLocation",
    "ticketLinesSummary",
    "accommodationRequested",
    "bookingTotalFormatted",
    "sectionBookingsUrl",
    "myPaymentsUrl"
    ],
    body: "Hello ((firstName)),\n\nThank you for booking your place at ((eventTitle)). Your booking is confirmed.\n\n---\n\n# Event details\n\nDate and time: ((eventDateTime))\n\nWhere: ((eventLocation))\n\n---\n\n# Your booking\n\n((ticketLinesSummary))\n\n((accommodationRequested??Accommodation requested — see your booking for details.))\n\nTotal: ((bookingTotalFormatted))\n\n---\n\nView your booking:\n\n((sectionBookingsUrl))\n\nIf you still need to make a payment, visit My Payments:\n\n((myPaymentsUrl))\n\nKind regards,\n\nSODC Admin",
  },
  bookingPendingApproval: {
    subject: "Your booking for ((eventTitle)) is awaiting approval",
    variables: [
    "firstName",
    "eventTitle",
    "eventDateTime",
    "eventLocation",
    "ticketLinesSummary",
    "sectionBookingsUrl"
    ],
    body: "Hello ((firstName)),\n\nWe have received your complete booking for ((eventTitle)). It is now with the organiser for approval.\n\nDate and time: ((eventDateTime))\n\nWhere: ((eventLocation))\n\nYour booking:\n\n((ticketLinesSummary))\n\nYou cannot pay for this revision until it is approved. We will email you when the organiser has reviewed it.\n\nView your booking:\n\n((sectionBookingsUrl))\n\nKind regards,\n\nSODC Admin",
  },
  bookingPendingApprovalModerator: {
    subject: "[SODC] Booking awaiting approval — ((eventTitle))",
    variables: [
    "eventTitle",
    "sectionName",
    "bookerDisplay",
    "guestCount",
    "ticketLinesSummary",
    "moderationUrl"
    ],
    body: "A complete booking is ready for review.\n\nEvent: ((eventTitle))\n\nSection: ((sectionName))\n\nMember: ((bookerDisplay))\n\nGuests: ((guestCount))\n\nBooking:\n\n((ticketLinesSummary))\n\nReview the exact booking revision in SODC:\n\n((moderationUrl))\n\nKind regards,\n\nSODC Admin",
  },
  bookingRevision: {
    subject: "Your booking for ((eventTitle)) has been updated",
    variables: [
    "firstName",
    "eventTitle",
    "eventDateTime",
    "eventLocation",
    "ticketLinesSummary",
    "accommodationRequested",
    "bookingTotalFormatted",
    "sectionBookingsUrl",
    "myPaymentsUrl",
    "paymentAdjustmentStatus",
    "previousTotalFormatted",
    "revisedTotalFormatted",
    "deltaAmountFormatted"
    ],
    body: "Hello ((firstName)),\n\nYour booking for ((eventTitle)) has been updated.\n\n---\n\n# Event details\n\nDate and time: ((eventDateTime))\n\nWhere: ((eventLocation))\n\n---\n\n# Your updated booking\n\n((ticketLinesSummary))\n\n((accommodationRequested??Accommodation requested — see your booking for details.))\n\nPrevious total: ((previousTotalFormatted))\n\nRevised total: ((revisedTotalFormatted))\n\nPayment difference: ((deltaAmountFormatted))\n\nPayment status: ((paymentAdjustmentStatus))\n\n---\n\nView your booking:\n\n((sectionBookingsUrl))\n\nView your payments:\n\n((myPaymentsUrl))\n\nKind regards,\n\nSODC Admin",
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
    subject: "[SODC] New member awaiting approval",
    variables: [
    "firstName",
    "lastName",
    "email",
    "serviceNumber",
    "serviceBackgroundSummary",
    "requestedMembershipStatus",
    "approveUsersUrl"
    ],
    body: "A new member has completed their profile and is ready for review.\n\nName: ((firstName)) ((lastName))\n\nEmail: ((email))\n\nService number: ((serviceNumber))\n\nService background: ((serviceBackgroundSummary))\n\nRequested status: ((requestedMembershipStatus))\n\n---\n\nReview the member in Approve Users:\n\n((approveUsersUrl))\n\nKind regards,\n\nSODC Admin",
  },
  passwordReset: {
    subject: "Reset your SODC password",
    variables: [
    "resetLink"
    ],
    body: "Hello,\n\nWe received a request to reset the password for your SODC account.\n\nUse this secure link to choose a new password:\n\n((resetLink))\n\nIf you did not request this, you can ignore this email. Your password will not change.\n\nKind regards,\n\nSODC Admin",
  },
  paymentDisputeOpsAlert: {
    subject: "[SODC] Payment dispute — ((orderId))",
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
    body: "A Stripe payment dispute needs review.\n\nTicket order ID: ((orderId))\n\nEvent: ((eventTitle))\n\nMember: ((customerDisplay))\n\nStripe dispute ID: ((stripeDisputeId))\n\nStripe dispute status: ((disputeStripeStatus))\n\nStripe dispute reason: ((disputeReason))\n\nSODC dispute state: ((disputeLocalState))\n\nStripe event type: ((stripeEventType))\n\nStripe event ID: ((stripeEventId))\n\n---\n\nReview the dispute in the reconciliation dashboard:\n\n((reconciliationDashboardUrl))\n\nKind regards,\n\nSODC Admin",
  },
  paymentReconciliationExceptionAlert: {
    subject: "[SODC] Payment reconciliation exception — ((orderId))",
    variables: [
    "orderId",
    "eventTitle",
    "customerDisplay",
    "exceptionType",
    "exceptionNote",
    "reconciliationDashboardUrl",
    "stripeEventId"
    ],
    body: "A payment reconciliation exception needs review.\n\nTicket order ID: ((orderId))\n\nEvent: ((eventTitle))\n\nMember: ((customerDisplay))\n\nException type: ((exceptionType))\n\nRecorded note: ((exceptionNote))\n\nStripe event ID: ((stripeEventId))\n\n---\n\nReview the exception in the reconciliation dashboard:\n\n((reconciliationDashboardUrl))\n\nKind regards,\n\nSODC Admin",
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
