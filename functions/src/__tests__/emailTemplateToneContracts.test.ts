import { describe, expect, it } from "vitest";
import { EMAIL_TEMPLATE_MANIFEST } from "../generatedEmailTemplateManifest";

const NAMED_MEMBER_TEMPLATES = [
  "bookingConfirmation",
  "bookingRevision",
  "guestTicketRequestApproved",
  "guestTicketRequestRejected",
  "membershipActivated",
  "membershipAccessRestricted",
  "ticketOrderPaid",
  "ticketOrderFailed",
  "ticketOrderRefunded",
] as const;

const ACCOUNT_ACTION_TEMPLATES = [
  "passwordReset",
  "emailVerification",
  "emailChangeVerification",
] as const;

const EVENT_TEMPLATES = [
  "bookingConfirmation",
  "bookingRevision",
  "guestTicketRequestApproved",
  "guestTicketRequestRejected",
  "ticketOrderPaid",
  "ticketOrderFailed",
  "ticketOrderRefunded",
] as const;

const MEMBER_TEMPLATES = [
  ...NAMED_MEMBER_TEMPLATES,
  ...ACCOUNT_ACTION_TEMPLATES,
] as const;

describe("member email tone contract (#476)", () => {
  it.each(MEMBER_TEMPLATES)("uses the automated sign-off in %s", (templateKey) => {
    expect(EMAIL_TEMPLATE_MANIFEST[templateKey].body).toMatch(
      /Kind regards,\n\nSODC Admin$/,
    );
  });

  it.each(MEMBER_TEMPLATES)("does not use commercial or reply wording in %s", (templateKey) => {
    const body = EMAIL_TEMPLATE_MANIFEST[templateKey].body;
    expect(body).not.toMatch(/\b(customer|purchase|order)\b/i);
    expect(body).not.toMatch(/\brepl(?:y|ies|ied|ying)\b/i);
  });

  it.each(NAMED_MEMBER_TEMPLATES)("greets the member by firstName in %s", (templateKey) => {
    const template = EMAIL_TEMPLATE_MANIFEST[templateKey];
    expect(template.body).toMatch(/^Hello \(\(firstName\)\),/);
    expect(template.variables).toContain("firstName");
    expect(template.variables).not.toContain("customerFirstName");
  });

  it.each(ACCOUNT_ACTION_TEMPLATES)("uses a privacy-safe generic greeting in %s", (templateKey) => {
    const template = EMAIL_TEMPLATE_MANIFEST[templateKey];
    expect(template.body).toMatch(/^Hello,\n/);
    expect(template.variables).not.toContain("firstName");
  });

  it.each(EVENT_TEMPLATES)("includes useful event context in %s", (templateKey) => {
    const variables = EMAIL_TEMPLATE_MANIFEST[templateKey].variables;
    expect(variables).toEqual(
      expect.arrayContaining(["eventTitle", "eventDateTime", "eventLocation"]),
    );
  });
});
