import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

type AuthExpectation = {
  op: string;
  mustInclude: string;
};

function readApiFile(fileName: string): string {
  const p = path.resolve(process.cwd(), "..", "dataconnect", "api", fileName);
  return fs.readFileSync(p, "utf8");
}

function extractOperationBlock(source: string, operationName: string): string {
  const idx = source.indexOf(operationName);
  if (idx < 0) throw new Error(`Operation not found: ${operationName}`);
  const start = source.lastIndexOf("\n", idx);
  const end = source.indexOf("\n}", idx);
  return source.slice(start >= 0 ? start : 0, end >= 0 ? end + 2 : source.length);
}

function assertAuth(source: string, checks: AuthExpectation[]): void {
  for (const check of checks) {
    const block = extractOperationBlock(source, check.op);
    expect(block, `${check.op} must include: ${check.mustInclude}`).toContain(check.mustInclude);
  }
}

const ADMIN_EXPR = '@auth(expr: "auth.token.admin == true && auth.token.enabled == true")';
const USER_EXPR = '@auth(expr: "auth.token.enabled == true")';
const EMAIL_VERIFIED_EXPR = '@auth(expr: "auth.token.email_verified == true")';
const NO_ACCESS = "@auth(level: NO_ACCESS)";

describe("Data Connect auth contracts", () => {
  it("Phase A: critical booking/payment/admin operations keep strict auth", () => {
    const queries = readApiFile("queries.gql");
    const bookingMutations = readApiFile("booking-mutations.gql");
    const adminSdk = readApiFile("admin-mutations.gql");
    const userMutations = readApiFile("user-mutations.gql");
    const groupMutations = readApiFile("user-group-mutations.gql");

    assertAuth(queries, [
      { op: "query CheckUserProfileExists", mustInclude: EMAIL_VERIFIED_EXPR },
      { op: "query ListEventBookingsForAdmin", mustInclude: ADMIN_EXPR },
      { op: "query ListGuestTicketRequestsForAdmin", mustInclude: ADMIN_EXPR },
      { op: "query ListTicketOrdersForAdmin", mustInclude: ADMIN_EXPR },
      { op: "query GetMyTicketOrderById", mustInclude: USER_EXPR },
      { op: "query GetMyBookings", mustInclude: USER_EXPR },
    ]);

    assertAuth(bookingMutations, [
      { op: "mutation CreateGuestTicketRequest", mustInclude: NO_ACCESS },
      { op: "mutation AdminReviewGuestTicketRequest", mustInclude: ADMIN_EXPR },
    ]);

    assertAuth(adminSdk, [
      { op: "query GetUserForCheckout", mustInclude: NO_ACCESS },
      { op: "query GetTicketTypeForCheckout", mustInclude: NO_ACCESS },
      { op: "mutation CreateTicketOrderForCheckout", mustInclude: NO_ACCESS },
      { op: "query GetTicketOrderForWebhook", mustInclude: NO_ACCESS },
      { op: "mutation MarkTicketOrderPaidFromWebhook", mustInclude: NO_ACCESS },
      { op: "query GetBookingsForBookerAndEvent", mustInclude: NO_ACCESS },
      { op: "mutation UpdateBookingStatusFromCallable", mustInclude: NO_ACCESS },
      { op: "mutation UpdateBookingPreferencesFromCallable", mustInclude: NO_ACCESS },
      { op: "query ListStaleDraftBookingsForScheduler", mustInclude: NO_ACCESS },
      { op: "query ListStalePendingTicketOrdersForScheduler", mustInclude: NO_ACCESS },
    ]);

    assertAuth(userMutations, [
      { op: "mutation CreateUserProfile", mustInclude: EMAIL_VERIFIED_EXPR },
      { op: "mutation UpsertUser", mustInclude: USER_EXPR },
      { op: "mutation UpdateUser", mustInclude: ADMIN_EXPR },
    ]);

    assertAuth(groupMutations, [
      { op: "mutation CreateSection", mustInclude: ADMIN_EXPR },
      { op: "mutation CreateUserGroup", mustInclude: ADMIN_EXPR },
      { op: "mutation GrantUserGroupToSectionForPurpose", mustInclude: ADMIN_EXPR },
      { op: "mutation CreateEvent", mustInclude: ADMIN_EXPR },
      { op: "mutation CreateTicketType", mustInclude: ADMIN_EXPR },
    ]);
  });

  it("Phase B: all operations declare an @auth directive", () => {
    const apiDir = path.resolve(process.cwd(), "..", "dataconnect", "api");
    const files = fs.readdirSync(apiDir).filter((f) => f.endsWith(".gql"));

    const opHeader = /(query|mutation)\s+([A-Za-z0-9_]+)/g;
    for (const file of files) {
      const source = fs.readFileSync(path.join(apiDir, file), "utf8");
      const matches = [...source.matchAll(opHeader)];
      if (matches.length === 0) continue;
      for (const m of matches) {
        const start = m.index ?? 0;
        const end = source.indexOf("{", start);
        const header = source.slice(start, end >= 0 ? end : start + 400);
        expect(header, `${file}: operation at offset ${start} missing @auth`).toContain("@auth(");
      }
    }
  });

  it("Phase C: every operation in admin-mutations.gql is NO_ACCESS", () => {
    const adminSdk = readApiFile("admin-mutations.gql");

    // User management
    assertAuth(adminSdk, [
      { op: "mutation UpdateUserMembershipStatus", mustInclude: NO_ACCESS },
      { op: "mutation DeleteUser", mustInclude: NO_ACCESS },
      { op: "mutation CreateUser", mustInclude: NO_ACCESS },
      { op: "mutation UpdateUserStripeCustomerId", mustInclude: NO_ACCESS },
    ]);

    // User group management
    assertAuth(adminSdk, [
      { op: "mutation CreateUserGroupAdmin", mustInclude: NO_ACCESS },
      { op: "mutation AddUserToUserGroupAdmin", mustInclude: NO_ACCESS },
      { op: "mutation RemoveUserFromUserGroupAdmin", mustInclude: NO_ACCESS },
      { op: "query GetUserGroupByName", mustInclude: NO_ACCESS },
      { op: "query GetUserUserGroupsForAdmin", mustInclude: NO_ACCESS },
    ]);

    // Checkout and ticket orders
    assertAuth(adminSdk, [
      { op: "query GetEventByIdForCallable", mustInclude: NO_ACCESS },
      { op: "query GetSectionByIdForCallable", mustInclude: NO_ACCESS },
      { op: "query GetTicketOrderStripeArtifactsForCallable", mustInclude: NO_ACCESS },
    ]);

    // Booking callables
    assertAuth(adminSdk, [
      { op: "mutation CreateBookingDraftForUser", mustInclude: NO_ACCESS },
      { op: "mutation CreateBookingDraftRevisionForUser", mustInclude: NO_ACCESS },
      { op: "mutation MarkBookingSupersededFromCallable", mustInclude: NO_ACCESS },
      { op: "mutation CreateBookingPaymentAdjustmentFromCallable", mustInclude: NO_ACCESS },
      { op: "mutation AddBookingLineFromCallable", mustInclude: NO_ACCESS },
      { op: "mutation DeleteBookingLineFromCallable", mustInclude: NO_ACCESS },
      { op: "query GetTicketOrdersForBookerAndEvent", mustInclude: NO_ACCESS },
    ]);

    // Guest ticket request callables
    assertAuth(adminSdk, [
      { op: "mutation CreateGuestTicketRequestFromCallable", mustInclude: NO_ACCESS },
      { op: "mutation AdminReviewGuestTicketRequestFromCallable", mustInclude: NO_ACCESS },
      { op: "query GetBookingForGuestTicketCallable", mustInclude: NO_ACCESS },
    ]);

    // Notification callables
    assertAuth(adminSdk, [
      { op: "query GetBookingForNotification", mustInclude: NO_ACCESS },
      { op: "query GetGuestTicketRequestForNotification", mustInclude: NO_ACCESS },
      { op: "query GetNotificationDeliveryByChannelAndKey", mustInclude: NO_ACCESS },
      { op: "mutation CreateNotificationDelivery", mustInclude: NO_ACCESS },
      { op: "mutation MarkNotificationDeliveryPendingById", mustInclude: NO_ACCESS },
      { op: "mutation MarkNotificationDeliverySentById", mustInclude: NO_ACCESS },
      { op: "mutation MarkNotificationDeliveryFailedById", mustInclude: NO_ACCESS },
    ]);

    // Stripe webhook mutations
    assertAuth(adminSdk, [
      { op: "mutation MarkTicketOrderFailedFromWebhook", mustInclude: NO_ACCESS },
      { op: "mutation MarkTicketOrderRefundedFromWebhook", mustInclude: NO_ACCESS },
      { op: "mutation UpsertTicketOrderDisputeFromWebhook", mustInclude: NO_ACCESS },
      { op: "query GetPaymentWebhookEventByStripeEventId", mustInclude: NO_ACCESS },
      { op: "mutation CreatePaymentWebhookEvent", mustInclude: NO_ACCESS },
    ]);

    // Payment reconciliation
    assertAuth(adminSdk, [
      { op: "query GetPaymentReconciliationExceptionByOrderAndType", mustInclude: NO_ACCESS },
      { op: "mutation CreatePaymentReconciliationException", mustInclude: NO_ACCESS },
      { op: "mutation UpdatePaymentReconciliationExceptionById", mustInclude: NO_ACCESS },
    ]);
  });

  it("Phase D: all queries.gql operations have correct auth level", () => {
    const queries = readApiFile("queries.gql");

    // User-level (enabled) queries
    assertAuth(queries, [
      { op: "query GetCurrentUser", mustInclude: USER_EXPR },
      { op: "query GetSectionsForUser", mustInclude: USER_EXPR },
      { op: "query GetUserAccessGroups", mustInclude: USER_EXPR },
      { op: "query GetEventsForSection", mustInclude: USER_EXPR },
      { op: "query GetEventById", mustInclude: USER_EXPR },
      { op: "query GetSectionById", mustInclude: USER_EXPR },
      { op: "query GetMyBookingsForEvent", mustInclude: USER_EXPR },
      { op: "query GetMyTicketOrders", mustInclude: USER_EXPR },
      { op: "query GetMyBookingPaymentAdjustments", mustInclude: USER_EXPR },
    ]);

    // Admin-only queries (require both admin and enabled claims)
    assertAuth(queries, [
      { op: "query GetUserById", mustInclude: ADMIN_EXPR },
      { op: "query ListUsers", mustInclude: ADMIN_EXPR },
      { op: "query ListSections", mustInclude: ADMIN_EXPR },
      { op: "query ListUserGroups", mustInclude: ADMIN_EXPR },
      { op: "query GetUserWithAccessGroups", mustInclude: ADMIN_EXPR },
      { op: "query GetUserAccessGroupsById", mustInclude: ADMIN_EXPR },
      { op: "query GetUserGroupById", mustInclude: ADMIN_EXPR },
      { op: "query ListBookingPaymentAdjustmentsForAdmin", mustInclude: ADMIN_EXPR },
      { op: "query ListOpenPaymentReconciliationExceptions", mustInclude: ADMIN_EXPR },
    ]);

    // System-only queries (NO_ACCESS — callable from Firebase Functions only)
    assertAuth(queries, [
      { op: "query GetUserMembershipStatus", mustInclude: NO_ACCESS },
      { op: "query GetAllUserGroupsWithStatuses", mustInclude: NO_ACCESS },
      // GetSectionMembers exposes member PII (email, serviceNumber) for an arbitrary sectionId with
      // no relationship check — must stay SDK-only. Clients go through the getSectionMembersMerged
      // callable (functions/src/sections.ts), which verifies the caller's own section access first.
      { op: "query GetSectionMembers", mustInclude: NO_ACCESS },
    ]);
  });

  it("Phase E: all user-group-mutations.gql operations require admin", () => {
    const groupMutations = readApiFile("user-group-mutations.gql");

    // Section operations
    assertAuth(groupMutations, [
      { op: "mutation UpdateSection", mustInclude: ADMIN_EXPR },
      { op: "mutation DeleteSection", mustInclude: ADMIN_EXPR },
    ]);

    // User group CRUD
    assertAuth(groupMutations, [
      { op: "mutation AddUserToUserGroup", mustInclude: ADMIN_EXPR },
      { op: "mutation RemoveUserFromUserGroup", mustInclude: ADMIN_EXPR },
      { op: "mutation RevokeUserGroupFromSectionForPurpose", mustInclude: ADMIN_EXPR },
      { op: "mutation UpdateUserGroup", mustInclude: ADMIN_EXPR },
      { op: "mutation DeleteUserGroup", mustInclude: ADMIN_EXPR },
    ]);

    // Event CRUD
    assertAuth(groupMutations, [
      { op: "mutation UpdateEvent", mustInclude: ADMIN_EXPR },
      { op: "mutation DeleteEvent", mustInclude: ADMIN_EXPR },
    ]);

    // Ticket type CRUD
    assertAuth(groupMutations, [
      { op: "mutation UpdateTicketType", mustInclude: ADMIN_EXPR },
      { op: "mutation DeleteTicketType", mustInclude: ADMIN_EXPR },
    ]);
  });

  it("Phase F: all booking-mutations.gql operations have correct auth level", () => {
    const bookingMutations = readApiFile("booking-mutations.gql");

    // Legacy booking operations now server-only — all client paths go through
    // submitEventBooking callable which enforces ownership and rules.
    assertAuth(bookingMutations, [
      { op: "mutation CreateBookingDraft", mustInclude: NO_ACCESS },
      { op: "mutation AddBookingLine", mustInclude: NO_ACCESS },
      { op: "mutation UpdateBookingStatus", mustInclude: NO_ACCESS },
    ]);

    // Admin-only booking operations
    assertAuth(bookingMutations, [
      { op: "mutation AdminDeleteGuestTicketRequest", mustInclude: ADMIN_EXPR },
      { op: "mutation AdminDeleteBookingLine", mustInclude: ADMIN_EXPR },
      { op: "mutation AdminDeleteBooking", mustInclude: ADMIN_EXPR },
      { op: "mutation ResolvePaymentReconciliationException", mustInclude: ADMIN_EXPR },
    ]);
  });

  it("Phase G: all user-mutations.gql operations have correct auth level", () => {
    const userMutations = readApiFile("user-mutations.gql");

    // Self-removal operations remain client-callable (no privilege escalation risk)
    assertAuth(userMutations, [
      { op: "mutation UnregisterFromSection", mustInclude: USER_EXPR },
      { op: "mutation UnsubscribeFromUserGroup", mustInclude: USER_EXPR },
    ]);

    // Server-only: RegisterForSection and SubscribeToUserGroup now go through
    // Firebase callables that verify UserGroup.subscribable == true.
    assertAuth(userMutations, [
      { op: "mutation RegisterForSection", mustInclude: NO_ACCESS },
      { op: "mutation SubscribeToUserGroup", mustInclude: NO_ACCESS },
    ]);
  });
});
