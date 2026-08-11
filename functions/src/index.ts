import * as admin from "firebase-admin";

// Export all functions
export * from "./admin";
export * from "./users";
export * from "./membershipStatus";
export * from "./sections";
export * from "./bookings";
export * from "./bookingApprovals";
export * from "./guestTicketRequests";
export * from "./payments";
export * from "./stagedExpiry";
export * from "./userGroups";
export * from "./emailTemplateSync";
export * from "./announcements";
export * from "./unsubscribe";
export * from "./notifyCallback";
export * from "./notificationRecovery";
export * from "./sectionFiles";
export * from "./sectionFileReconciliation";
export * from "./govNotifyDeliveryAdmin";
export * from "./notifyReplyToAdmin";
export * from "./authEmailActions";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}
