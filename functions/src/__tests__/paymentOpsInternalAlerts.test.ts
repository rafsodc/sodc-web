import { describe, expect, it } from "vitest";
import {
  PAYMENT_OPS_ALERT_EMAILS_ENV,
  parsePaymentOpsAlertEmails,
} from "../paymentOpsInternalAlerts";
import { govNotifyTemplateEnvVarName } from "../mailer";

describe("parsePaymentOpsAlertEmails", () => {
  it("returns empty list when unset or blank", () => {
    expect(parsePaymentOpsAlertEmails({})).toEqual([]);
    expect(parsePaymentOpsAlertEmails({ [PAYMENT_OPS_ALERT_EMAILS_ENV]: "  " })).toEqual([]);
  });

  it("parses comma-separated addresses, lowercases, trims, and dedupes", () => {
    expect(
      parsePaymentOpsAlertEmails({
        [PAYMENT_OPS_ALERT_EMAILS_ENV]: " OPS@EXAMPLE.COM , finance@example.com , ops@example.com ",
      })
    ).toEqual(["ops@example.com", "finance@example.com"]);
  });
});

describe("payment ops internal template env vars", () => {
  it("matches mailer naming for GOV.UK Notify template keys", () => {
    expect(govNotifyTemplateEnvVarName("paymentReconciliationExceptionAlert")).toBe(
      "GOV_NOTIFY_TEMPLATE_PAYMENT_RECONCILIATION_EXCEPTION_ALERT"
    );
    expect(govNotifyTemplateEnvVarName("paymentDisputeOpsAlert")).toBe(
      "GOV_NOTIFY_TEMPLATE_PAYMENT_DISPUTE_OPS_ALERT"
    );
  });
});
