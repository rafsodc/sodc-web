const GBP = "gbp";

function isGbpCurrency(currency: string): boolean {
  return currency.trim().toLowerCase() === GBP;
}

const gbpFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

/** Ticket catalog prices are stored in major units (pounds). */
export function formatGbpMajorAmount(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) {
    return "—";
  }
  return gbpFormatter.format(amount);
}

/** Stripe and ticket order amounts are stored in minor units (pence). */
export function formatGbpMinorAmount(amountMinor: number | null | undefined): string {
  if (amountMinor == null || Number.isNaN(amountMinor)) {
    return "—";
  }
  return gbpFormatter.format(amountMinor / 100);
}

export function formatPaymentAmount(amountMinor: number, currency: string): string {
  if (isGbpCurrency(currency)) {
    return formatGbpMinorAmount(amountMinor);
  }
  return `${(amountMinor / 100).toFixed(2)} ${currency.trim().toUpperCase()}`;
}
