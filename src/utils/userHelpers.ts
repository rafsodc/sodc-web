import { type SearchUser } from "./searchUsers";

/**
 * Parses a display name into first and last name
 * Handles both "LastName, FirstName" and "FirstName LastName" formats
 */
export function parseDisplayName(displayName: string | undefined): { firstName: string; lastName: string } {
  if (!displayName) {
    return { firstName: "", lastName: "" };
  }

  // Try "LastName, FirstName" format first
  if (displayName.includes(", ")) {
    const parts = displayName.split(", ");
    return {
      lastName: parts[0] || "",
      firstName: parts[1] || "",
    };
  }

  // Fall back to "FirstName LastName" format
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] || "", lastName: "" };
  }

  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

/**
 * Validates user form fields
 */
export function validateUserForm(
  firstName: string,
  lastName: string,
  email: string,
  serviceNumber: string
): { isValid: boolean; error?: string } {
  if (!firstName.trim()) {
    return { isValid: false, error: "First name is required" };
  }
  if (!lastName.trim()) {
    return { isValid: false, error: "Last name is required" };
  }
  if (!email.trim()) {
    return { isValid: false, error: "Email is required" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { isValid: false, error: "Invalid email format" };
  }
  if (!serviceNumber.trim()) {
    return { isValid: false, error: "Service number is required" };
  }
  return { isValid: true };
}

