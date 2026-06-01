import { describe, expect, it } from "vitest";
import {
  PaymentReconciliationExceptionStatus,
  PaymentReconciliationExceptionType,
} from "@dataconnect/admin-generated";
import { shouldSendReconciliationExceptionOpenedAlert } from "../payments";

describe("shouldSendReconciliationExceptionOpenedAlert", () => {
  const base = {
    status: PaymentReconciliationExceptionStatus.OPEN,
    hasSignal: true,
    isNewOpen: true,
    reopenedFromResolved: false,
    exceptionType: PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT,
    fromDisputeWebhook: false,
  };

  it("sends when a new open exception is created", () => {
    expect(shouldSendReconciliationExceptionOpenedAlert(base)).toBe(true);
  });

  it("sends when reopened from resolved", () => {
    expect(
      shouldSendReconciliationExceptionOpenedAlert({
        ...base,
        isNewOpen: false,
        reopenedFromResolved: true,
      })
    ).toBe(true);
  });

  it("does not send when exception is resolved", () => {
    expect(
      shouldSendReconciliationExceptionOpenedAlert({
        ...base,
        status: PaymentReconciliationExceptionStatus.RESOLVED,
      })
    ).toBe(false);
  });

  it("does not send when there is no active signal", () => {
    expect(
      shouldSendReconciliationExceptionOpenedAlert({
        ...base,
        hasSignal: false,
      })
    ).toBe(false);
  });

  it("does not send when already open and not reopened", () => {
    expect(
      shouldSendReconciliationExceptionOpenedAlert({
        ...base,
        isNewOpen: false,
        reopenedFromResolved: false,
      })
    ).toBe(false);
  });

  it("skips ACTIVE_DISPUTE opened from dispute webhook (dispute alert covers it)", () => {
    expect(
      shouldSendReconciliationExceptionOpenedAlert({
        ...base,
        exceptionType: PaymentReconciliationExceptionType.ACTIVE_DISPUTE,
        fromDisputeWebhook: true,
      })
    ).toBe(false);
  });

  it("still sends ACTIVE_DISPUTE opened outside dispute webhook path", () => {
    expect(
      shouldSendReconciliationExceptionOpenedAlert({
        ...base,
        exceptionType: PaymentReconciliationExceptionType.ACTIVE_DISPUTE,
        fromDisputeWebhook: false,
      })
    ).toBe(true);
  });
});
