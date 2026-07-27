import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";

export const GOV_NOTIFY_DELIVERY_MODE_ENV = "GOV_NOTIFY_DELIVERY_MODE";
export const govNotifyLiveApiKey = defineSecret("GOV_NOTIFY_LIVE_API_KEY");
export const govNotifyTestApiKey = defineSecret("GOV_NOTIFY_TEST_API_KEY");
export const govNotifyTeamApiKey = defineSecret("GOV_NOTIFY_TEAM_API_KEY");

export const GOV_NOTIFY_DELIVERY_MODES = ["SIMULATION", "TEAM_TEST", "LIVE"] as const;
export type GovNotifyDeliveryMode = typeof GOV_NOTIFY_DELIVERY_MODES[number];

const DELIVERY_RANK: Record<GovNotifyDeliveryMode, number> = {
  SIMULATION: 0,
  TEAM_TEST: 1,
  LIVE: 2,
};

export class GovNotifyDeliveryConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GovNotifyDeliveryConfigurationError";
  }
}

export function parseGovNotifyDeliveryMode(
  value: unknown,
  settingName = GOV_NOTIFY_DELIVERY_MODE_ENV,
): GovNotifyDeliveryMode {
  if (typeof value !== "string" || !value.trim()) {
    throw new GovNotifyDeliveryConfigurationError(`${settingName} is not configured`);
  }
  const normalized = value.trim().toUpperCase();
  if (!GOV_NOTIFY_DELIVERY_MODES.includes(normalized as GovNotifyDeliveryMode)) {
    throw new GovNotifyDeliveryConfigurationError(
      `${settingName} must be SIMULATION, TEAM_TEST, or LIVE`,
    );
  }
  return normalized as GovNotifyDeliveryMode;
}

export function configuredGovNotifyDeliveryMode(
  env: NodeJS.ProcessEnv = process.env,
): GovNotifyDeliveryMode {
  return parseGovNotifyDeliveryMode(env[GOV_NOTIFY_DELIVERY_MODE_ENV]);
}

export function resolveGovNotifyDeliveryMode(
  siteMode: GovNotifyDeliveryMode,
  requestedMode: GovNotifyDeliveryMode = "LIVE",
): GovNotifyDeliveryMode {
  return DELIVERY_RANK[requestedMode] <= DELIVERY_RANK[siteMode] ? requestedMode : siteMode;
}

export interface GovNotifyDeliveryResolution {
  requestedMode: GovNotifyDeliveryMode;
  siteMode: GovNotifyDeliveryMode;
  effectiveMode: GovNotifyDeliveryMode;
}

export function resolveConfiguredGovNotifyDeliveryMode(
  requestedMode: GovNotifyDeliveryMode = "LIVE",
  env: NodeJS.ProcessEnv = process.env,
): GovNotifyDeliveryResolution {
  const siteMode = configuredGovNotifyDeliveryMode(env);
  if (siteMode !== "LIVE") {
    logger.warn("GOV.UK Notify delivery is restricted by the site-wide ceiling", {
      siteDeliveryMode: siteMode,
    });
  }
  return {
    requestedMode,
    siteMode,
    effectiveMode: resolveGovNotifyDeliveryMode(siteMode, requestedMode),
  };
}

export function govNotifyReferenceForMode(
  reference: string,
  mode: GovNotifyDeliveryMode,
): string {
  return `${reference}:notify-${mode.toLowerCase()}`;
}

export function govNotifyApiKeyForMode(mode: GovNotifyDeliveryMode): string {
  const value = mode === "SIMULATION"
    ? govNotifyTestApiKey.value()
    : mode === "TEAM_TEST"
      ? govNotifyTeamApiKey.value()
      : govNotifyLiveApiKey.value();
  const name = mode === "SIMULATION"
    ? "GOV_NOTIFY_TEST_API_KEY"
    : mode === "TEAM_TEST"
      ? "GOV_NOTIFY_TEAM_API_KEY"
      : "GOV_NOTIFY_LIVE_API_KEY";
  if (!value || !value.trim()) {
    throw new GovNotifyDeliveryConfigurationError(`${name} is not configured`);
  }
  return value;
}

export const govNotifySecrets = [
  govNotifyLiveApiKey,
  govNotifyTestApiKey,
  govNotifyTeamApiKey,
] as const;
