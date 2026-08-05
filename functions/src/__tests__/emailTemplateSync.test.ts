import { describe, expect, it, vi } from "vitest";

vi.mock("../generatedEmailTemplateManifest", () => ({
  EMAIL_TEMPLATE_MANIFEST: {
    bookingConfirmation: {
      subject: "Booking confirmed",
      variables: ["firstName"],
      body: "Hi ((firstName)), your booking is confirmed.",
    },
    passwordReset: {
      subject: "Reset your password",
      variables: ["resetLink"],
      body: "Reset here: ((resetLink))",
    },
  },
}));

import { buildTemplateSyncResults, type NotifyTemplateBindingRow } from "../emailTemplateSync";

function liveTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "bookingConfirmation",
    version: 1,
    subject: "Booking confirmed",
    body: "Hi ((firstName)), your booking is confirmed.",
    ...overrides,
  };
}

function binding(overrides: Partial<NotifyTemplateBindingRow> = {}): NotifyTemplateBindingRow {
  return {
    templateKey: "bookingConfirmation",
    notifyTemplateId: "11111111-1111-4111-8111-111111111111",
    reviewedVersion: 1,
    updatedAt: "2026-08-04T10:00:00.000Z",
    updatedBy: "admin-1",
    ...overrides,
  };
}

function resultFor(results: ReturnType<typeof buildTemplateSyncResults>, templateKey: string) {
  const result = results.find((r) => r.templateKey === templateKey);
  if (!result) throw new Error(`no result for ${templateKey}`);
  return result;
}

describe("buildTemplateSyncResults", () => {
  it("only offers exact, case-sensitive name matches as candidates", () => {
    const templates = [
      liveTemplate({ id: "match", name: "bookingConfirmation" }),
      liveTemplate({ id: "wrong-case", name: "BookingConfirmation" }),
      liveTemplate({ id: "extra-text", name: "bookingConfirmation copy" }),
    ];
    const result = resultFor(buildTemplateSyncResults(templates, [], undefined), "bookingConfirmation");
    expect(result.candidates.map((c) => c.id)).toEqual(["match"]);
  });

  it("reports not_configured when no binding exists, even if a matching candidate is live", () => {
    const templates = [liveTemplate()];
    const result = resultFor(buildTemplateSyncResults(templates, [], undefined), "bookingConfirmation");
    expect(result.status).toBe("not_configured");
    expect(result.boundTemplateId).toBeUndefined();
    expect(result.candidates).toHaveLength(1);
  });

  it("reports in_sync when the bound template's live content matches the manifest", () => {
    const templates = [liveTemplate()];
    const result = resultFor(
      buildTemplateSyncResults(templates, [binding()], undefined),
      "bookingConfirmation",
    );
    expect(result.status).toBe("in_sync");
    expect(result.subjectMatch).toBe(true);
    expect(result.bodyMatch).toBe(true);
  });

  it("reports drift when the bound template's live content diverges from the manifest", () => {
    const templates = [liveTemplate({ body: "Hi ((firstName)), something changed." })];
    const result = resultFor(
      buildTemplateSyncResults(templates, [binding()], undefined),
      "bookingConfirmation",
    );
    expect(result.status).toBe("drift");
    expect(result.bodyMatch).toBe(false);
    expect(result.subjectMatch).toBe(true);
  });

  it("reports fetch_error when the bound template id is no longer live (e.g. deleted)", () => {
    const result = resultFor(
      buildTemplateSyncResults([], [binding({ notifyTemplateId: "deleted-id" })], undefined),
      "bookingConfirmation",
    );
    expect(result.status).toBe("fetch_error");
    expect(result.errorMessage).toMatch(/could not be found/);
  });

  it("flags version drift independently of content drift status", () => {
    const templates = [liveTemplate({ version: 3 })];
    const result = resultFor(
      buildTemplateSyncResults(templates, [binding({ reviewedVersion: 1 })], undefined),
      "bookingConfirmation",
    );
    expect(result.status).toBe("in_sync");
    expect(result.versionDrift).toBe(true);
    expect(result.currentLiveVersion).toBe(3);
    expect(result.reviewedVersion).toBe(1);
  });

  it("does not flag version drift when the live version matches the reviewed version", () => {
    const templates = [liveTemplate({ version: 2 })];
    const result = resultFor(
      buildTemplateSyncResults(templates, [binding({ reviewedVersion: 2 })], undefined),
      "bookingConfirmation",
    );
    expect(result.versionDrift).toBe(false);
  });

  it("resolves the bound template's live name even when it's no longer an exact-key match", () => {
    const templates = [liveTemplate({ name: "bookingConfirmation (renamed)" })];
    const result = resultFor(
      buildTemplateSyncResults(templates, [binding()], undefined),
      "bookingConfirmation",
    );
    expect(result.boundTemplateName).toBe("bookingConfirmation (renamed)");
    expect(result.candidates).toHaveLength(0);
  });

  it("builds the Notify edit URL only when a service id is configured and a binding exists", () => {
    const templates = [liveTemplate()];
    const withServiceId = resultFor(
      buildTemplateSyncResults(templates, [binding()], "service-123"),
      "bookingConfirmation",
    );
    expect(withServiceId.notifyEditUrl).toBe(
      "https://www.notifications.service.gov.uk/services/service-123/templates/11111111-1111-4111-8111-111111111111/edit",
    );

    const withoutServiceId = resultFor(
      buildTemplateSyncResults(templates, [binding()], undefined),
      "bookingConfirmation",
    );
    expect(withoutServiceId.notifyEditUrl).toBeUndefined();

    const unboundResult = resultFor(
      buildTemplateSyncResults(templates, [], "service-123"),
      "bookingConfirmation",
    );
    expect(unboundResult.notifyEditUrl).toBeUndefined();
  });

  it("produces one result per manifest key, independent of binding/template presence", () => {
    const results = buildTemplateSyncResults([], [], undefined);
    expect(results.map((r) => r.templateKey).sort()).toEqual(["bookingConfirmation", "passwordReset"]);
    expect(results.every((r) => r.status === "not_configured")).toBe(true);
  });
});
