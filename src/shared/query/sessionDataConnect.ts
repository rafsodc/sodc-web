import * as sdk from "@dataconnect/generated";
import { runSessionOperation } from "../appShell/sessionLifecycle";
export * from "@dataconnect/generated";

function guarded<Args extends unknown[], Result>(operation: () => (...args: Args) => Promise<Result>) {
  return (...args: Args) => runSessionOperation(() => operation()(...args));
}
export const upsertUser = guarded(() => sdk.upsertUser) as typeof sdk.upsertUser;
export const updateUser = guarded(() => sdk.updateUser) as typeof sdk.updateUser;
export const getUserById = guarded(() => sdk.getUserById) as typeof sdk.getUserById;
export const checkUserProfileExists = guarded(() => sdk.checkUserProfileExists) as typeof sdk.checkUserProfileExists;
export const confirmProfileReview = guarded(() => sdk.confirmProfileReview) as typeof sdk.confirmProfileReview;
export const getMyBookingsForEvent = guarded(() => sdk.getMyBookingsForEvent) as typeof sdk.getMyBookingsForEvent;
export const getMyBookings = guarded(() => sdk.getMyBookings) as typeof sdk.getMyBookings;
export const getMyTicketOrders = guarded(() => sdk.getMyTicketOrders) as typeof sdk.getMyTicketOrders;
export const getMyBookingPaymentAdjustments = guarded(() => sdk.getMyBookingPaymentAdjustments) as typeof sdk.getMyBookingPaymentAdjustments;
