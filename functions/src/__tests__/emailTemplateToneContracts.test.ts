import { describe, expect, it } from "vitest";
import { EMAIL_TEMPLATE_MANIFEST } from "../generatedEmailTemplateManifest";

const NAMED_MEMBER_TEMPLATES = [
  "bookingConfirmation",
  "bookingRevision",
  "bookingPendingApproval",
  "bookingApproved",
  "bookingChangesRequested",
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
  "bookingPendingApproval",
  "bookingApproved",
  "bookingChangesRequested",
  "ticketOrderPaid",
  "ticketOrderFailed",
  "ticketOrderRefunded",
] as const;

const MEMBER_TEMPLATES = [
  ...NAMED_MEMBER_TEMPLATES,
  ...ACCOUNT_ACTION_TEMPLATES,
] as const;

const INTERNAL_TEMPLATES = [
  "bookingPendingApprovalModerator",
  "newUserPendingApprovalAlert",
  "paymentReconciliationExceptionAlert",
  "paymentDisputeOpsAlert",
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

describe("internal email tone contract (#477)", () => {
  it.each(INTERNAL_TEMPLATES)("uses the common subject prefix in %s", (templateKey) => {
    expect(EMAIL_TEMPLATE_MANIFEST[templateKey].subject).toMatch(/^\[SODC\] /);
  });

  it.each(INTERNAL_TEMPLATES)("uses the automated sign-off in %s", (templateKey) => {
    expect(EMAIL_TEMPLATE_MANIFEST[templateKey].body).toMatch(
      /Kind regards,\n\nSODC Admin$/,
    );
  });

  it.each(INTERNAL_TEMPLATES)("does not invite a reply in %s", (templateKey) => {
    expect(EMAIL_TEMPLATE_MANIFEST[templateKey].body).not.toMatch(
      /\brepl(?:y|ies|ied|ying)\b/i,
    );
  });

  it("keeps member personal data out of the pending-approval subject", () => {
    const subject = EMAIL_TEMPLATE_MANIFEST.newUserPendingApprovalAlert.subject;
    expect(subject).not.toMatch(/\(\((firstName|lastName|email)\)\)/);
  });

  it.each([
    ["bookingPendingApprovalModerator", "moderationUrl"],
    ["newUserPendingApprovalAlert", "approveUsersUrl"],
    ["paymentReconciliationExceptionAlert", "reconciliationDashboardUrl"],
    ["paymentDisputeOpsAlert", "reconciliationDashboardUrl"],
  ] as const)("retains the remediation link in %s", (templateKey, linkVariable) => {
    expect(EMAIL_TEMPLATE_MANIFEST[templateKey].variables).toContain(linkVariable);
  });

  it.each([
    "paymentReconciliationExceptionAlert",
    "paymentDisputeOpsAlert",
  ] as const)("uses member rather than customer wording in %s", (templateKey) => {
    expect(EMAIL_TEMPLATE_MANIFEST[templateKey].body).toContain("Member: ((customerDisplay))");
    expect(EMAIL_TEMPLATE_MANIFEST[templateKey].body).not.toContain("Customer:");
  });
});
