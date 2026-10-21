import * as sdk from "@dataconnect/generated";
import { runSessionOperation, runSessionRead } from "../appShell/sessionLifecycle";
export * from "@dataconnect/generated";

function guarded<Args extends unknown[], Result>(operation: () => (...args: Args) => Promise<Result>, read = false) {
  return (...args: Args) => (read ? runSessionRead : runSessionOperation)(() => operation()(...args));
}
export const upsertUser = guarded(() => sdk.upsertUser) as typeof sdk.upsertUser;
export const updateUser = guarded(() => sdk.updateUser) as typeof sdk.updateUser;
export const getUserById = guarded(() => sdk.getUserById, true) as typeof sdk.getUserById;
export const checkUserProfileExists = guarded(() => sdk.checkUserProfileExists, true) as typeof sdk.checkUserProfileExists;
export const confirmProfileReview = guarded(() => sdk.confirmProfileReview) as typeof sdk.confirmProfileReview;
export const getMyBookingsForEvent = guarded(() => sdk.getMyBookingsForEvent, true) as typeof sdk.getMyBookingsForEvent;
export const getMyBookings = guarded(() => sdk.getMyBookings, true) as typeof sdk.getMyBookings;
export const getMyTicketOrders = guarded(() => sdk.getMyTicketOrders, true) as typeof sdk.getMyTicketOrders;
export const getMyBookingPaymentAdjustments = guarded(() => sdk.getMyBookingPaymentAdjustments, true) as typeof sdk.getMyBookingPaymentAdjustments;
