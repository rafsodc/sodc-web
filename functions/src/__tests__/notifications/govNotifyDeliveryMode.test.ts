import { describe, expect, it } from "vitest";
import {
  configuredGovNotifyDeliveryMode,
  govNotifyReferenceForMode,
  parseGovNotifyDeliveryMode,
  resolveConfiguredGovNotifyDeliveryMode,
  resolveGovNotifyDeliveryMode,
} from "../../govNotifyDeliveryMode";

describe("GOV.UK Notify delivery modes", () => {
  it.each([
    ["SIMULATION", "SIMULATION"],
    ["simulation", "SIMULATION"],
    [" team_test ", "TEAM_TEST"],
    ["LIVE", "LIVE"],
  ] as const)("parses %s", (value, expected) => {
    expect(parseGovNotifyDeliveryMode(value)).toBe(expected);
  });

  it.each([undefined, "", "safe", "test"])("fails closed for %s", (value) => {
    expect(() => parseGovNotifyDeliveryMode(value)).toThrow();
  });

  it.each([
    ["SIMULATION", "SIMULATION", "SIMULATION"],
    ["SIMULATION", "TEAM_TEST", "SIMULATION"],
    ["SIMULATION", "LIVE", "SIMULATION"],
    ["TEAM_TEST", "SIMULATION", "SIMULATION"],
    ["TEAM_TEST", "TEAM_TEST", "TEAM_TEST"],
    ["TEAM_TEST", "LIVE", "TEAM_TEST"],
    ["LIVE", "SIMULATION", "SIMULATION"],
    ["LIVE", "TEAM_TEST", "TEAM_TEST"],
    ["LIVE", "LIVE", "LIVE"],
  ] as const)("caps site %s / request %s at %s", (site, request, expected) => {
    expect(resolveGovNotifyDeliveryMode(site, request)).toBe(expected);
  });

  it("treats transactional sends as live requests subject to the site ceiling", () => {
    expect(resolveConfiguredGovNotifyDeliveryMode("LIVE", {
      GOV_NOTIFY_DELIVERY_MODE: "TEAM_TEST",
    })).toEqual({
      requestedMode: "LIVE",
      siteMode: "TEAM_TEST",
      effectiveMode: "TEAM_TEST",
    });
  });

  it("requires an explicit site-wide mode", () => {
    expect(() => configuredGovNotifyDeliveryMode({})).toThrow(
      "GOV_NOTIFY_DELIVERY_MODE is not configured",
    );
  });

  it("uses mode-specific idempotency namespaces", () => {
    expect(govNotifyReferenceForMode("booking:123", "SIMULATION")).toBe(
      "booking:123:notify-simulation",
    );
    expect(govNotifyReferenceForMode("booking:123", "LIVE")).toBe(
      "booking:123:notify-live",
    );
  });
});
