import * as admin from "firebase-admin";

// Export all functions
export * from "./admin";
export * from "./users";
export * from "./membershipStatus";
export * from "./sections";
export * from "./bookings";
export * from "./guestTicketRequests";
export * from "./payments";
export * from "./stagedExpiry";
export * from "./userGroups";
export * from "./emailTemplateSync";
export * from "./announcements";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}
