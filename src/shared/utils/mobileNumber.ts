const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/**
 * Normalises common UK and international phone-number input to E.164.
 * Returns null for blank or ambiguous/invalid input.
 */
export function normalizeMobileNumber(value: string): string | null {
  let normalized = value.trim();
  if (!normalized) return null;

  normalized = normalized.replace(/[\s().-]/g, "");
  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  } else if (normalized.startsWith("0")) {
    normalized = `+44${normalized.slice(1)}`;
  }

  // Users sometimes include the UK trunk prefix in international notation.
  if (normalized.startsWith("+440")) {
    normalized = `+44${normalized.slice(4)}`;
  }

  return E164_PATTERN.test(normalized) ? normalized : null;
}

