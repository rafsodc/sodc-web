import { describe, expect, it } from "vitest";
import { formatGbpMajorAmount, formatGbpMinorAmount, formatPaymentAmount } from "../currencyDisplay";

describe("currencyDisplay", () => {
  it("formats major-unit ticket prices as GBP", () => {
    expect(formatGbpMajorAmount(50)).toBe("£50.00");
    expect(formatGbpMajorAmount(null)).toBe("—");
  });

  it("formats minor-unit payment amounts as GBP", () => {
    expect(formatGbpMinorAmount(2500)).toBe("£25.00");
    expect(formatGbpMinorAmount(null)).toBe("—");
  });

  it("formats payment amounts for GBP orders", () => {
    expect(formatPaymentAmount(2500, "gbp")).toBe("£25.00");
  });

  it("falls back to currency code for non-GBP orders", () => {
    expect(formatPaymentAmount(2500, "usd")).toBe("25.00 USD");
  });
});
