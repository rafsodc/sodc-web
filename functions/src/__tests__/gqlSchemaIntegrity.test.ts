import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readApiFile(fileName: string): string {
  const p = path.resolve(process.cwd(), "..", "dataconnect", "api", fileName);
  return fs.readFileSync(p, "utf8");
}

function readSchemaFile(): string {
  const p = path.resolve(process.cwd(), "..", "dataconnect", "schema", "schema.gql");
  return fs.readFileSync(p, "utf8");
}

function readMigrationFile(fileName: string): string {
  const p = path.resolve(process.cwd(), "..", "dataconnect", "migrations", fileName);
  return fs.readFileSync(p, "utf8");
}

function extractAllOperationHeaders(source: string): Array<{ name: string; header: string }> {
  const opHeader = /(query|mutation)\s+([A-Za-z0-9_]+)/g;
  const results: Array<{ name: string; header: string }> = [];
  for (const m of source.matchAll(opHeader)) {
    const start = m.index ?? 0;
    const end = source.indexOf("{", start);
    const header = source.slice(start, end >= 0 ? end : start + 500);
    results.push({ name: m[2], header });
  }
  return results;
}

describe("GQL schema integrity", () => {
  it("user-facing mutation files only use NO_ACCESS for explicitly server-migrated operations", () => {
    // Operations listed here have been deliberately moved to server-only callable
    // paths and must NOT appear as client-callable in future.
    const serverOnlyOps = new Set([
      // booking-mutations.gql: all now routed through submitEventBooking callable
      "CreateBookingDraft",
      "AddBookingLine",
      "UpdateBookingStatus",
      "CreateGuestTicketRequest",
      // user-mutations.gql: routed through subscribeToUserGroup / registerForSectionCallable
      "RegisterForSection",
      "SubscribeToUserGroup",
    ]);

    const userFacingFiles = [
      "user-mutations.gql",
      "user-group-mutations.gql",
      "booking-mutations.gql",
    ];

    for (const fileName of userFacingFiles) {
      const source = readApiFile(fileName);
      const ops = extractAllOperationHeaders(source);
      for (const { name, header } of ops) {
        if (serverOnlyOps.has(name)) {
          expect(
            header,
            `${fileName}: ${name} was migrated to server-only and must use NO_ACCESS`,
          ).toContain("NO_ACCESS");
        } else {
          expect(
            header,
            `${fileName}: ${name} must not use NO_ACCESS — it is client-callable`,
          ).not.toContain("NO_ACCESS");
        }
      }
    }
  });

  it("admin-mutations.gql must not contain user-level or email-verified auth expressions", () => {
    // This file is the server-SDK-only boundary. Any user-level auth expression
    // here would mean a frontend user could call it directly.
    const adminSdk = readApiFile("admin-mutations.gql");
    const ops = extractAllOperationHeaders(adminSdk);

    for (const { name, header } of ops) {
      expect(
        header,
        `admin-mutations.gql: ${name} must not use enabled-user auth expression`,
      ).not.toContain("\"auth.token.enabled == true\"");

      expect(
        header,
        `admin-mutations.gql: ${name} must not use email_verified auth expression`,
      ).not.toContain("\"auth.token.email_verified == true\"");
    }
  });

  it("self-ownership mutations use server-side auth.uid expressions, not client-supplied user IDs", () => {
    // These mutations act on the calling user's own data. If a client-supplied
    // userId were substituted for auth.uid, a user could manipulate another
    // user's memberships or profile.
    const userMutations = readApiFile("user-mutations.gql");

    // Section and group self-service mutations must bind userId to auth.uid server-side
    expect(userMutations).toContain(
      "userId_expr: \"auth.uid\"",
    );

    // CreateUserProfile must bind the profile id to auth.uid so users can't
    // create profiles for arbitrary auth UIDs
    expect(userMutations).toContain("id_expr: \"auth.uid\"");

    // Verify each self-service mutation explicitly uses the server expression
    const selfServiceMutations = [
      "RegisterForSection",
      "UnregisterFromSection",
      "SubscribeToUserGroup",
      "UnsubscribeFromUserGroup",
    ];

    for (const mutName of selfServiceMutations) {
      const idx = userMutations.indexOf(`mutation ${mutName}`);
      expect(idx, `mutation ${mutName} not found`).toBeGreaterThanOrEqual(0);
      const end = userMutations.indexOf("\n}", idx);
      const block = userMutations.slice(idx, end + 2);
      expect(
        block,
        `${mutName} must use userId_expr: "auth.uid" to prevent acting on behalf of other users`,
      ).toContain("userId_expr: \"auth.uid\"");
    }
  });

  it("CreateBookingDraft binds bookerId to auth.uid server-side", () => {
    // If bookerId were client-supplied a user could create bookings attributed
    // to another user's account.
    const bookingMutations = readApiFile("booking-mutations.gql");

    const idx = bookingMutations.indexOf("mutation CreateBookingDraft");
    expect(idx).toBeGreaterThanOrEqual(0);
    const end = bookingMutations.indexOf("\n}", idx);
    const block = bookingMutations.slice(idx, end + 2);

    expect(
      block,
      "CreateBookingDraft must use bookerId_expr: \"auth.uid\" — not a client-supplied bookerId",
    ).toContain("bookerId_expr: \"auth.uid\"");
  });

  it("admin-only operations in user-group-mutations.gql require both admin and enabled claims", () => {
    // Requiring only admin without enabled would let a disabled admin retain write access.
    const groupMutations = readApiFile("user-group-mutations.gql");
    const ops = extractAllOperationHeaders(groupMutations);

    for (const { name, header } of ops) {
      // Every operation in this file is admin-only; none should be user-level or onboarding
      expect(
        header,
        `user-group-mutations.gql: ${name} must not use user-level auth (enabled only)`,
      ).not.toMatch(/@auth\(expr: "auth\.token\.enabled == true"\)/);

      expect(
        header,
        `user-group-mutations.gql: ${name} must not use email_verified auth`,
      ).not.toContain("email_verified");

      // Verify the admin expression includes both claims
      expect(
        header,
        `user-group-mutations.gql: ${name} must require admin claim`,
      ).toContain("auth.token.admin == true");

      expect(
        header,
        `user-group-mutations.gql: ${name} must require enabled claim alongside admin`,
      ).toContain("auth.token.enabled == true");
    }
  });

  it("deprecated mutations.gql contains no active query or mutation operations", () => {
    // This file is deprecated and should only contain comments.
    // Active operations here would be callable from the client SDK.
    const legacy = readApiFile("mutations.gql");
    const opHeader = /^\s*(query|mutation)\s+[A-Za-z0-9_]+/m;
    expect(
      legacy,
      "mutations.gql is deprecated and must not define any active operations",
    ).not.toMatch(opHeader);
  });

  it("schema.gql defines the expected core tables", () => {
    // Guards against accidental table deletions that could break auth or data integrity
    const schema = readSchemaFile();

    const requiredTypes = [
      "type User",
      "type Section",
      "type UserGroup",
      "type UserUserGroup",
      "type Event",
      "type TicketType",
      "type Booking",
      "type BookingLine",
      "type BookingLinePaymentAllocation",
      "type TicketOrder",
      "type GuestTicketRequest",
      "type PaymentWebhookEvent",
      "type NotificationDelivery",
    ];

    for (const typeName of requiredTypes) {
      expect(schema, `schema.gql must define ${typeName}`).toContain(typeName);
    }
  });

  it("schema.gql User type has auth-critical fields", () => {
    // These fields drive the auth claim model. Removing them would silently
    // break all auth expressions without a compile error.
    const schema = readSchemaFile();

    const userTypeStart = schema.indexOf("type User");
    expect(userTypeStart).toBeGreaterThanOrEqual(0);
    const userTypeEnd = schema.indexOf("\n}", userTypeStart);
    const userBlock = schema.slice(userTypeStart, userTypeEnd + 2);

    expect(userBlock, "User must have membershipStatus field").toContain("membershipStatus");
    expect(userBlock, "User must have email field for notifications").toContain("email:");
    expect(userBlock, "User must have firstName for identification").toContain("firstName");
    expect(userBlock, "User must have lastName for identification").toContain("lastName");
  });

  it("defines booking-level approval independently from lifecycle and payment", () => {
    const schema = readSchemaFile();
    expect(schema).toMatch(
      /enum BookingApprovalStatus\s*{\s*NOT_REQUIRED\s+PENDING\s+APPROVED\s+REJECTED\s*}/,
    );

    const bookingStart = schema.indexOf("type Booking @table");
    const bookingEnd = schema.indexOf("\n}", bookingStart);
    const bookingBlock = schema.slice(bookingStart, bookingEnd + 2);
    expect(bookingBlock).toContain(
      "approvalStatus: BookingApprovalStatus! @default(value: NOT_REQUIRED)",
    );
    expect(bookingBlock).toContain("approvalReviewedBy: User");
    expect(bookingBlock).toContain("approvalReviewedAt: Timestamp");
    expect(bookingBlock).toContain("approvalNote: String");
  });

  it("requires an explicit non-null guest approval limit on events", () => {
    const schema = readSchemaFile();
    const eventStart = schema.indexOf("type Event @table");
    const eventEnd = schema.indexOf("\n}", eventStart);
    const eventBlock = schema.slice(eventStart, eventEnd + 2);
    expect(eventBlock).toContain("maxGuestsWithoutModeratorApproval: Int!");

    const eventMutations = readApiFile("user-group-mutations.gql");
    expect(eventMutations.match(/\$maxGuestsWithoutModeratorApproval: Int!/g)).toHaveLength(2);
  });

  it("backfills legacy null guest limits before applying the non-null constraint", () => {
    const migration = readMigrationFile(
      "2026-08-11-issue-543-required-guest-approval-limit.sql",
    );
    const backfill = migration.indexOf(
      "SET max_guests_without_moderator_approval = 0",
    );
    const constraint = migration.indexOf(
      "ALTER COLUMN max_guests_without_moderator_approval SET NOT NULL",
    );
    expect(backfill).toBeGreaterThanOrEqual(0);
    expect(constraint).toBeGreaterThan(backfill);
  });

  it("keeps booking approval writes behind the server-only callable boundary", () => {
    const adminSdk = readApiFile("admin-mutations.gql");
    const start = adminSdk.indexOf("mutation UpdateBookingApprovalFromCallable");
    expect(start).toBeGreaterThanOrEqual(0);
    const end = adminSdk.indexOf("\n}", start);
    const operation = adminSdk.slice(start, end + 2);
    expect(operation).toContain("$status: BookingApprovalStatus!");
    expect(operation).toContain("@auth(level: NO_ACCESS)");
    expect(operation).toContain("approvalReviewedAt_expr: \"request.time\"");
  });

  it("can attribute payment to a stable booking place across revisions", () => {
    const schema = readSchemaFile();
    const lineStart = schema.indexOf("type BookingLine @table");
    const lineEnd = schema.indexOf("\n}", lineStart);
    expect(schema.slice(lineStart, lineEnd + 2)).toContain(
      "bookingPlaceKey: UUID! @default(expr: \"uuidV4()\")",
    );

    const allocationStart = schema.indexOf("type BookingLinePaymentAllocation @table");
    const allocationEnd = schema.indexOf("\n}", allocationStart);
    const allocationBlock = schema.slice(allocationStart, allocationEnd + 2);
    expect(allocationBlock).toContain("ticketOrder: TicketOrder!");
    expect(allocationBlock).toContain("bookingLine: BookingLine!");
    expect(allocationBlock).toContain("bookingPlaceKey: UUID!");
    expect(allocationBlock).toContain("allocatedAmountMinor: Int!");
  });
});
