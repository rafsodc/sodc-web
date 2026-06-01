import { describe, expect, it, vi } from "vitest";

vi.mock("firebase-functions/params", () => ({
  defineSecret: vi.fn((name: string) => ({
    name,
    value: vi.fn(() => undefined),
  })),
}));

import {
  createGovNotifyMailer,
  govNotifyTemplateEnvVarName,
  readGovNotifyTemplateIds,
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

  it("sends typed template payloads through GOV.UK Notify", async () => {
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
      clientFactory: () => ({ sendEmail }),
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
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("buyer@example.com");
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
    const logger = fakeLogger();
    const mailer = createGovNotifyMailer<TestTemplates>({
      apiKey: "notify-api-key",
      templateIds: {
        paymentFailure: "template-failed",
      },
      clientFactory: () => ({ sendEmail }),
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
