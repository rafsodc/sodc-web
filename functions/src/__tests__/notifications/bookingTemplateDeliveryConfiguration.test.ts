import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  type UUIDString,
} from "@dataconnect/admin-generated";
import { createConfiguredGovNotifyMailer } from "../../mailer";
import { buildTemplateSyncResults } from "../../emailTemplateSync";
import { EMAIL_TEMPLATE_MANIFEST } from "../../generatedEmailTemplateManifest";
import { sendNotificationOnce, type NotificationDeliveryRepository } from "../../notificationDelivery";
import { sendPrivilegedNotification } from "../../privilegedNotificationDelivery";
import type { BookingEmailTemplates } from "../../bookingEmailDispatcher";
import type { NotificationRecoveryPayload } from "../../notificationRecoveryPayload";
import {
  bookingApprovedDeliveryKey,
  bookingChangesRequestedDeliveryKey,
  bookingPendingMemberDeliveryKey,
  bookingPendingModeratorUidDeliveryKey,
} from "../../notificationDeliveryKeys";

const boundaries = vi.hoisted(() => ({
  bindings: vi.fn(),
  deliveryConfiguration: vi.fn(),
  replyToConfiguration: vi.fn(),
  createDeliveryConfiguration: vi.fn(),
  createReplyToConfiguration: vi.fn(),
  notifyClient: vi.fn(),
  getNotifications: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@dataconnect/admin-generated", async (importOriginal) => ({
  ...await importOriginal<typeof import("@dataconnect/admin-generated")>(),
  getNotifyTemplateBindings: boundaries.bindings,
  getGovNotifyDeliveryConfiguration: boundaries.deliveryConfiguration,
  getNotifyReplyToConfiguration: boundaries.replyToConfiguration,
  createGovNotifyDeliveryConfiguration: boundaries.createDeliveryConfiguration,
  createNotifyEmailConfiguration: boundaries.createReplyToConfiguration,
}));

vi.mock("firebase-functions/params", () => ({
  defineSecret: vi.fn((name: string) => ({ name, value: () => `${name}-fixture` })),
}));

vi.mock("notifications-node-client", () => ({
  NotifyClient: class {
    constructor(apiKey: string) { boundaries.notifyClient(apiKey); }
    getNotifications(...args: unknown[]) { return boundaries.getNotifications(...args); }
    sendEmail(...args: unknown[]) { return boundaries.sendEmail(...args); }
  },
}));

const BOOKING_ID = "00000000-0000-4000-8000-000000000741";
const DELIVERY_ID = "00000000-0000-4000-8000-000000000742";
const DATABASE_TEMPLATE = "10000000-0000-4000-8000-000000000741";
const FALLBACK_TEMPLATE = "20000000-0000-4000-8000-000000000741";
const MODERATOR_UID = "fixture-moderator";
const RECIPIENT = "booking-template-fixture@example.invalid";
const NOW = "2026-11-17T12:00:00.000Z";

// Keep the actual four logical keys and their environment spellings explicit:
// changing the mailer's camel-case conversion must not silently break fallback.
const cases = [
  { key: "bookingApproved", env: "GOV_NOTIFY_TEMPLATE_BOOKING_APPROVED", type: "BOOKING_APPROVED", deliveryKey: bookingApprovedDeliveryKey(BOOKING_ID), payload: { version: 1, kind: "BOOKING_APPROVED", bookingId: BOOKING_ID } },
  { key: "bookingChangesRequested", env: "GOV_NOTIFY_TEMPLATE_BOOKING_CHANGES_REQUESTED", type: "BOOKING_CHANGES_REQUESTED", deliveryKey: bookingChangesRequestedDeliveryKey(BOOKING_ID), payload: { version: 1, kind: "BOOKING_CHANGES_REQUESTED", bookingId: BOOKING_ID } },
  { key: "bookingPendingApproval", env: "GOV_NOTIFY_TEMPLATE_BOOKING_PENDING_APPROVAL", type: "BOOKING_PENDING_APPROVAL_MEMBER", deliveryKey: bookingPendingMemberDeliveryKey(BOOKING_ID, "fixture-request"), payload: { version: 1, kind: "BOOKING_PENDING_MEMBER", bookingId: BOOKING_ID, idempotencyKey: "fixture-request" } },
  { key: "bookingPendingApprovalModerator", env: "GOV_NOTIFY_TEMPLATE_BOOKING_PENDING_APPROVAL_MODERATOR", type: "BOOKING_PENDING_APPROVAL_MODERATOR", deliveryKey: bookingPendingModeratorUidDeliveryKey(BOOKING_ID, MODERATOR_UID), payload: { version: 2, kind: "BOOKING_PENDING_MODERATOR", bookingId: BOOKING_ID, recipientUserId: MODERATOR_UID } },
] as const;

type BookingCase = typeof cases[number];
interface StoredDelivery {
  id: UUIDString;
  status: NotificationDeliveryStatus;
  channel: NotificationChannel;
  deliveryKey: string;
  attemptCount: number;
  lastAttemptedAt: string;
  recoveryPayload: string | null;
  recipientUserId?: string;
  providerMessageId?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}

/** Storage fake only: template selection, failure handling and retry policy are real. */
function ledger(initial?: StoredDelivery) {
  let row = initial;
  const getRow = () => {
    if (!row) throw new Error("The fixture delivery does not exist");
    return row;
  };
  const repository: NotificationDeliveryRepository = {
    getByChannelAndKey: vi.fn<NotificationDeliveryRepository["getByChannelAndKey"]>(async ({ channel, deliveryKey }) => {
      if (!row || row.channel !== channel || row.deliveryKey !== deliveryKey) return null;
      return { ...row };
    }),
    createPending: vi.fn<NotificationDeliveryRepository["createPending"]>(async (args) => {
      expect(row).toBeUndefined();
      row = { ...args, id: DELIVERY_ID, status: NotificationDeliveryStatus.PENDING, recoveryPayload: args.recoveryPayload ?? null };
      return { ...getRow() };
    }),
    tryMarkPending: vi.fn<NotificationDeliveryRepository["tryMarkPending"]>(async (args) => {
      expect(getRow()).toMatchObject({ id: args.id, status: args.expectedStatus, attemptCount: args.expectedAttemptCount });
      Object.assign(getRow(), { status: NotificationDeliveryStatus.PENDING, attemptCount: args.attemptCount, lastAttemptedAt: args.lastAttemptedAt, recoveryPayload: args.recoveryPayload });
      return true;
    }),
    tryMarkPendingForRecovery: vi.fn<NotificationDeliveryRepository["tryMarkPendingForRecovery"]>(async () => { throw new Error("Unexpected scheduler claim"); }),
    markSent: vi.fn<NotificationDeliveryRepository["markSent"]>(async (args) => {
      Object.assign(getRow(), { status: NotificationDeliveryStatus.SENT, providerMessageId: args.providerMessageId, lastErrorCode: null, lastErrorMessage: null });
      return true;
    }),
    markFailed: vi.fn<NotificationDeliveryRepository["markFailed"]>(async (args) => {
      Object.assign(getRow(), { status: NotificationDeliveryStatus.FAILED, lastErrorCode: args.lastErrorCode, lastErrorMessage: args.lastErrorMessage });
      return true;
    }),
    markSkipped: vi.fn<NotificationDeliveryRepository["markSkipped"]>(async () => { throw new Error("Unexpected new skip write"); }),
  };
  return { repository, getRow };
}

const personalisation = {
  firstName: "Fixture", eventTitle: "Fixture event", eventDateTime: "17 November 2026", eventLocation: "Fixture hall",
  ticketLinesSummary: "One member ticket", accommodationRequested: "no" as const,
  bookingTotalFormatted: "GBP 10.00", sectionBookingsUrl: "https://example.invalid/bookings", myPaymentsUrl: "https://example.invalid/payments",
  moderatorNote: "Please review the fixture", sectionName: "Fixture section", bookerDisplay: "Fixture booker", guestCount: 0, moderationUrl: "https://example.invalid/approvals",
};

function fixture(c: BookingCase, env: NodeJS.ProcessEnv = {}, skipped = false) {
  const physicalKey = `${c.deliveryKey}:notify-live`;
  const initial = skipped ? { id: DELIVERY_ID, channel: NotificationChannel.EMAIL, deliveryKey: physicalKey, status: NotificationDeliveryStatus.SKIPPED, attemptCount: 6, lastAttemptedAt: NOW, recoveryPayload: JSON.stringify(c.payload), recipientUserId: c.key === "bookingPendingApprovalModerator" ? MODERATOR_UID : undefined } : undefined;
  const storage = ledger(initial);
  const mailer = createConfiguredGovNotifyMailer<BookingEmailTemplates>(cases.map(row => row.key), env);
  const sendEmail = async (email: string, mode?: "LIVE" | "SIMULATION" | "TEAM_TEST") => {
    const result = await mailer.sendEmail({ templateName: c.key, to: email, personalisation, reference: c.deliveryKey, requestedDeliveryMode: mode });
    return { providerMessageId: result.providerNotificationId, deliveryMode: result.deliveryMode.effectiveMode };
  };
  const common = { channel: NotificationChannel.EMAIL, notificationType: c.type, deliveryKey: c.deliveryKey, bookingId: BOOKING_ID, provider: "govuk_notify", recoveryPayload: c.payload as NotificationRecoveryPayload };
  const dependencies = { repository: storage.repository, now: () => NOW };
  return {
    ...storage,
    physicalKey,
    send: () => c.key === "bookingPendingApprovalModerator"
      ? sendPrivilegedNotification({ ...common, recipientUserId: MODERATOR_UID, scope: { kind: "BOOKING", sectionId: "fixture-section" }, event: { kind: "BOOKING", bookingId: BOOKING_ID }, sendAuthorized: sendEmail }, { delivery: dependencies, hasLegacyEvent: async () => false, authorize: async () => ({ eligible: true, recipientUserId: MODERATOR_UID, email: RECIPIENT }) })
      : sendNotificationOnce({ ...common, send: mode => sendEmail(RECIPIENT, mode) }, dependencies),
  };
}

describe.each(cases)("booking template delivery configuration: $key", (c) => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GOV_NOTIFY_DELIVERY_MODE", "LIVE");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Live transport is forbidden"); }));
    boundaries.bindings.mockReset().mockResolvedValue({ data: { notifyTemplateBindings: [] } });
    boundaries.deliveryConfiguration.mockResolvedValue({ data: { govNotifyDeliveryConfiguration: { mode: "LIVE", version: 1 } } });
    boundaries.replyToConfiguration.mockResolvedValue({ data: { notifyEmailConfiguration: { id: "site-wide", defaultReplyToAddress: null }, notifyReplyToAddresses: [], notifyTemplateReplyToOverrides: [] } });
    boundaries.getNotifications.mockReset().mockResolvedValue({ data: { notifications: [] } });
    boundaries.sendEmail.mockReset().mockResolvedValue({ data: { id: "fixture-provider-acceptance" } });
  });

  afterEach(() => {
    try {
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(boundaries.createDeliveryConfiguration).not.toHaveBeenCalled();
      expect(boundaries.createReplyToConfiguration).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it("uses the saved binding ahead of fallback while matching live content has an unreviewed version", async () => {
    const binding = { templateKey: c.key, notifyTemplateId: DATABASE_TEMPLATE, reviewedVersion: 1, updatedAt: NOW, updatedBy: "fixture" };
    const expectedContent = EMAIL_TEMPLATE_MANIFEST[c.key];
    const status = buildTemplateSyncResults(
      [{ id: DATABASE_TEMPLATE, name: c.key, version: 7, subject: expectedContent.subject, body: expectedContent.body }],
      [binding],
      undefined,
    ).find(row => row.templateKey === c.key);
    expect(status).toMatchObject({ status: "in_sync", reviewedVersion: 1, currentLiveVersion: 7, versionDrift: true });
    boundaries.bindings.mockResolvedValue({ data: { notifyTemplateBindings: [{ templateKey: "unrelated-key", notifyTemplateId: FALLBACK_TEMPLATE, reviewedVersion: 999 }, binding] } });
    const f = fixture(c, { [c.env]: FALLBACK_TEMPLATE });

    await expect(f.send()).resolves.toMatchObject({ outcome: "sent", attemptCount: 1 });

    expect(boundaries.sendEmail).toHaveBeenCalledExactlyOnceWith(DATABASE_TEMPLATE, RECIPIENT, expect.objectContaining({ personalisation }));
    expect(f.getRow()).toMatchObject({ status: NotificationDeliveryStatus.SENT, deliveryKey: f.physicalKey, providerMessageId: "fixture-provider-acceptance" });
  });

  it("uses the exact sender-environment fallback when the saved binding is absent", async () => {
    const f = fixture(c, { [c.env]: FALLBACK_TEMPLATE });

    await expect(f.send()).resolves.toMatchObject({ outcome: "sent" });

    expect(boundaries.sendEmail).toHaveBeenCalledExactlyOnceWith(FALLBACK_TEMPLATE, RECIPIENT, expect.any(Object));
    expect(f.getRow().status).toBe(NotificationDeliveryStatus.SENT);
  });

  it("uses the configured fallback when the saved-binding read is unavailable", async () => {
    boundaries.bindings.mockRejectedValue(new Error("Fixture binding lookup unavailable"));
    const f = fixture(c, { [c.env]: FALLBACK_TEMPLATE });

    await expect(f.send()).resolves.toMatchObject({ outcome: "sent" });

    expect(boundaries.sendEmail).toHaveBeenCalledExactlyOnceWith(FALLBACK_TEMPLATE, RECIPIENT, expect.any(Object));
    expect(f.getRow().status).toBe(NotificationDeliveryStatus.SENT);
  });

  it("records a failed delivery without contacting Notify when binding and fallback are both absent", async () => {
    const f = fixture(c);

    await expect(f.send()).resolves.toMatchObject({ outcome: "failed", reason: "send_failed", attemptCount: 1 });

    expect(boundaries.notifyClient).not.toHaveBeenCalled();
    expect(boundaries.getNotifications).not.toHaveBeenCalled();
    expect(boundaries.sendEmail).not.toHaveBeenCalled();
    expect(f.repository.markSent).not.toHaveBeenCalled();
    expect(f.getRow()).toMatchObject({ status: NotificationDeliveryStatus.FAILED, attemptCount: 1, lastErrorCode: c.key === "bookingPendingApprovalModerator" ? "PRIVILEGED_DELIVERY_FAILED" : "MailerConfigurationError", lastErrorMessage: c.key === "bookingPendingApprovalModerator" ? "Privileged notification delivery failed" : `${c.env} is not configured` });
    expect(JSON.parse(f.getRow().recoveryPayload!)).toMatchObject({ ...c.payload, deliveryMode: "LIVE" });
  });

  it("keeps the failed attempt until a subsequent send invocation uses the repaired binding", async () => {
    const f = fixture(c);
    await expect(f.send()).resolves.toMatchObject({ outcome: "failed" });
    boundaries.bindings.mockResolvedValue({ data: { notifyTemplateBindings: [{ templateKey: c.key, notifyTemplateId: DATABASE_TEMPLATE, reviewedVersion: 1 }] } });

    await Promise.resolve();
    expect(f.getRow()).toMatchObject({ status: NotificationDeliveryStatus.FAILED, attemptCount: 1 });
    expect(boundaries.sendEmail).not.toHaveBeenCalled();
    expect(f.repository.createPending).toHaveBeenCalledTimes(1);

    await expect(f.send()).resolves.toMatchObject({ outcome: "sent", attemptCount: 2, deliveryId: DELIVERY_ID });
    expect(f.repository.createPending).toHaveBeenCalledTimes(1);
    expect(f.repository.tryMarkPending).toHaveBeenCalledTimes(1);
    expect(boundaries.sendEmail).toHaveBeenCalledExactlyOnceWith(DATABASE_TEMPLATE, RECIPIENT, expect.any(Object));
  });

  it("keeps an explicitly skipped delivery suppressed after binding repair without a lookup or new attempt", async () => {
    boundaries.bindings.mockResolvedValue({ data: { notifyTemplateBindings: [{ templateKey: c.key, notifyTemplateId: DATABASE_TEMPLATE, reviewedVersion: 1 }] } });
    const f = fixture(c, {}, true);
    const before = structuredClone(f.getRow());

    await expect(f.send()).resolves.toMatchObject({ outcome: "skipped", reason: "already_skipped", attemptCount: 6 });

    expect(f.getRow()).toEqual(before);
    expect(boundaries.bindings).not.toHaveBeenCalled();
    expect(boundaries.notifyClient).not.toHaveBeenCalled();
    expect(boundaries.sendEmail).not.toHaveBeenCalled();
    for (const method of ["createPending", "tryMarkPending", "tryMarkPendingForRecovery", "markSent", "markFailed", "markSkipped"] as const) expect(f.repository[method]).not.toHaveBeenCalled();
  });
});
