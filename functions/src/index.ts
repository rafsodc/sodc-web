import * as admin from "firebase-admin";

// Export all functions
export * from "./admin";
export * from "./users";
export * from "./membershipStatus";
export * from "./sections";
export * from "./bookings";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}
