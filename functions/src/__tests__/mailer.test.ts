import { describe, expect, it, vi } from "vitest";

vi.mock("firebase-functions/params", () => ({
  defineSecret: vi.fn((name: string) => ({
    name,
    value: vi.fn(() => undefined),
  })),
}));

import {
  createGovNotifyMailer,
  createConfiguredGovNotifyMailer,
  getGovNotifyEmailReplyToId,
  govNotifyTemplateEnvVarName,
  MailerConfigurationError,
  readGovNotifyTemplateIds,
  recipientScopedNotifyReference,
  type NotifyEmailClient,
} from "../mailer";

type TestTemplates = {
  paymentConfirmation: {
    event_title: string;
    amount_paid: string;
  };
  paymentFailure: {
    recovery_link: string;
  };
};

function fakeLogger() {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
}

describe("mailer", () => {
  it("derives GOV.UK Notify template environment variable names", () => {
    expect(govNotifyTemplateEnvVarName("paymentConfirmation")).toBe("GOV_NOTIFY_TEMPLATE_PAYMENT_CONFIRMATION");
    expect(govNotifyTemplateEnvVarName("booking-revision")).toBe("GOV_NOTIFY_TEMPLATE_BOOKING_REVISION");
  });

  it("reads configured template ids from environment", () => {
    expect(
      readGovNotifyTemplateIds(["paymentConfirmation", "paymentFailure"] as const, {
        GOV_NOTIFY_TEMPLATE_PAYMENT_CONFIRMATION: "template-paid",
      })
    ).toEqual({
      paymentConfirmation: "template-paid",
    });
  });

  it("reads the optional reply-to ID and builds the environment-configured mailer", () => {
    expect(getGovNotifyEmailReplyToId({ GOV_NOTIFY_EMAIL_REPLY_TO_ID: "reply-to-id" })).toBe("reply-to-id");
    expect(getGovNotifyEmailReplyToId({ GOV_NOTIFY_EMAIL_REPLY_TO_ID: "  " })).toBeUndefined();
    expect(
      createConfiguredGovNotifyMailer<TestTemplates>(["paymentConfirmation"], {
        GOV_NOTIFY_TEMPLATE_PAYMENT_CONFIRMATION: "template-paid",
        GOV_NOTIFY_EMAIL_REPLY_TO_ID: "reply-to-id",
      })
    ).toHaveProperty("sendEmail");
  });

  it("builds stable recipient-scoped references without exposing recipient PII", () => {
    const first = recipientScopedNotifyReference("event-123", " First@Example.com ");
    const sameRecipient = recipientScopedNotifyReference("event-123", "first@example.com");
    const second = recipientScopedNotifyReference("event-123", "second@example.com");

    expect(first).toBe(sameRecipient);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^event-123:[0-9a-f]{24}$/);
    expect(first).not.toContain("example.com");
  });

  it("fails with a typed configuration error before contacting Notify", async () => {
    const sendEmail = vi.fn<NotifyEmailClient["sendEmail"]>();
    const getNotifications = vi.fn<NotifyEmailClient["getNotifications"]>();
    const mailer = createGovNotifyMailer<TestTemplates>({
      templateIds: { paymentConfirmation: "template-paid" },
      clientFactory: () => ({ getNotifications, sendEmail }),
      logger: fakeLogger(),
    });

    await expect(
      mailer.sendEmail({
        templateName: "paymentConfirmation",
        to: "buyer@example.com",
        personalisation: { event_title: "Dinner", amount_paid: "GBP 10.00" },
      })
    ).rejects.toBeInstanceOf(MailerConfigurationError);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends typed template payloads through GOV.UK Notify", async () => {
    const getNotifications = vi.fn<NotifyEmailClient["getNotifications"]>(async () => ({
      data: { notifications: [] },
    }));
    const sendEmail = vi.fn<NotifyEmailClient["sendEmail"]>(async () => ({
      data: {
        id: "notify-message-id",
        reference: "order-123",
      },
    }));
    const logger = fakeLogger();
    const mailer = createGovNotifyMailer<TestTemplates>({
      apiKey: "notify-api-key",
      templateIds: {
        paymentConfirmation: "template-paid",
      },
      emailReplyToId: "reply-to-id",
      clientFactory: () => ({ getNotifications, sendEmail }),
      logger,
    });

    await expect(
      mailer.sendEmail({
        templateName: "paymentConfirmation",
        to: "buyer@example.com",
        personalisation: {
          event_title: "Annual Dinner",
          amount_paid: "GBP 10.00",
        },
        reference: "order-123",
      })
    ).resolves.toEqual({
      provider: "govuk_notify",
      providerNotificationId: "notify-message-id",
      reference: "order-123",
    });

    expect(sendEmail).toHaveBeenCalledWith("template-paid", "buyer@example.com", {
      personalisation: {
        event_title: "Annual Dinner",
        amount_paid: "GBP 10.00",
      },
      reference: "order-123",
      emailReplyToId: "reply-to-id",
    });
    expect(getNotifications).toHaveBeenCalledWith("email", undefined, "order-123");
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("buyer@example.com");
  });

  it("adopts an existing provider notification with the same reference", async () => {
    const getNotifications = vi.fn<NotifyEmailClient["getNotifications"]>(async () => ({
      data: {
        notifications: [{ id: "existing-notify-id", reference: "order-123" }],
      },
    }));
    const sendEmail = vi.fn<NotifyEmailClient["sendEmail"]>();
    const mailer = createGovNotifyMailer<TestTemplates>({
      apiKey: "notify-api-key",
      templateIds: {
        paymentConfirmation: "template-paid",
      },
      clientFactory: () => ({ getNotifications, sendEmail }),
      logger: fakeLogger(),
    });

    await expect(
      mailer.sendEmail({
        templateName: "paymentConfirmation",
        to: "buyer@example.com",
        personalisation: {
          event_title: "Annual Dinner",
          amount_paid: "GBP 10.00",
        },
        reference: "order-123",
      })
    ).resolves.toEqual({
      provider: "govuk_notify",
      providerNotificationId: "existing-notify-id",
      reference: "order-123",
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends every fan-out recipient while still deduplicating retries", async () => {
    const accepted: Array<{ id: string; reference: string }> = [];
    const getNotifications = vi.fn<NotifyEmailClient["getNotifications"]>(
      async (_templateType, _status, reference) => ({
        data: {
          notifications: accepted.filter((notification) => notification.reference === reference),
        },
      })
    );
    const sendEmail = vi.fn<NotifyEmailClient["sendEmail"]>(
      async (_templateId, _emailAddress, options) => {
        const notification = {
          id: `notify-${accepted.length + 1}`,
          reference: options?.reference ?? "",
        };
        accepted.push(notification);
        return { data: notification };
      }
    );
    const mailer = createGovNotifyMailer<TestTemplates>({
      apiKey: "notify-api-key",
      templateIds: { paymentConfirmation: "template-paid" },
      clientFactory: () => ({ getNotifications, sendEmail }),
      logger: fakeLogger(),
    });
    const personalisation = {
      event_title: "Annual Dinner",
      amount_paid: "GBP 10.00",
    };
    const firstReference = recipientScopedNotifyReference("order-123", "first@example.com");
    const secondReference = recipientScopedNotifyReference("order-123", "second@example.com");

    await mailer.sendEmail({
      templateName: "paymentConfirmation",
      to: "first@example.com",
      personalisation,
      reference: firstReference,
    });
    await mailer.sendEmail({
      templateName: "paymentConfirmation",
      to: "second@example.com",
      personalisation,
      reference: secondReference,
    });
    await mailer.sendEmail({
      templateName: "paymentConfirmation",
      to: "first@example.com",
      personalisation,
      reference: firstReference,
    });

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(accepted.map((notification) => notification.reference)).toEqual([
      firstReference,
      secondReference,
    ]);
  });

  it("logs provider failures without recipient PII", async () => {
    const providerError = new Error("Notify rejected buyer@example.com") as Error & {
      response?: unknown;
    };
    providerError.response = {
      status: 400,
      statusText: "Bad Request",
      data: {
        errors: [
          {
            error: "BadRequestError",
            message: "email_address buyer@example.com is invalid",
          },
        ],
      },
    };
    const sendEmail = vi.fn<NotifyEmailClient["sendEmail"]>(async () => {
      throw providerError;
    });
    const getNotifications = vi.fn<NotifyEmailClient["getNotifications"]>(async () => ({
      data: { notifications: [] },
    }));
    const logger = fakeLogger();
    const mailer = createGovNotifyMailer<TestTemplates>({
      apiKey: "notify-api-key",
      templateIds: {
        paymentFailure: "template-failed",
      },
      clientFactory: () => ({ getNotifications, sendEmail }),
      logger,
    });

    await expect(
      mailer.sendEmail({
        templateName: "paymentFailure",
        to: "buyer@example.com",
        personalisation: {
          recovery_link: "https://example.test/payments",
        },
        reference: "order-456",
      })
    ).rejects.toThrow("Notify rejected buyer@example.com");

    const loggedMetadata = JSON.stringify(logger.error.mock.calls[0][1]);
    expect(loggedMetadata).not.toContain("buyer@example.com");
    expect(loggedMetadata).toContain("[redacted-email]");
    expect(loggedMetadata).toContain("BadRequestError");
  });
});
