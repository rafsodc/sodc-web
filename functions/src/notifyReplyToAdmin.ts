import { randomUUID } from "node:crypto";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { NotifyClient } from "notifications-node-client";
import {
  changeNotifyReplyToDefault as dcChangeDefault,
  clearNotifyTemplateReplyToOverride as dcClearOverride,
  confirmNotifyReplyToVerification as dcConfirmVerification,
  createNotifyReplyToAddress as dcCreateAddress,
  disableDefaultNotifyReplyToAddress as dcDisableDefault,
  listNotifyReplyToAudits,
  recordNotifyReplyToProviderAcceptance as dcRecordProviderAcceptance,
  setNotifyTemplateReplyToOverride as dcSetOverride,
  updateNotifyReplyToAddressIdentity as dcUpdateIdentity,
  updateNotifyReplyToAvailability as dcUpdateAvailability,
  GovNotifyDeliveryMode as DataConnectGovNotifyDeliveryMode,
} from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { EMAIL_TEMPLATE_MANIFEST } from "./generatedEmailTemplateManifest";
import {
  requireAdmin,
  requireString,
  validateEmail,
  validateStringLength,
  validateUUID,
} from "./helpers";
import {
  govNotifyApiKeyForMode,
  govNotifySecrets,
} from "./govNotifyDeliveryMode";
import { resolveRuntimeGovNotifyDeliveryMode } from "./govNotifyDeliveryConfiguration";
import {
  getOrCreateNotifyReplyToConfiguration,
  type NotifyReplyToResolutionSource,
} from "./notifyReplyToConfiguration";
import { getGovNotifyEmailReplyToId } from "./govNotifyReplyToId";
import { enforceRateLimit } from "./rateLimiter";

const AUDIT_LIMIT = 50;
const APP_BASE_URL = (process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");

type Configuration = Awaited<ReturnType<typeof getOrCreateNotifyReplyToConfiguration>>;
type Address = Configuration["notifyReplyToAddresses"][number];

export interface NotifyReplyToAdminConfiguration {
  configuration: { version: number; defaultAddressId: string | null };
  addresses: Address[];
  templateOverrides: Array<{ templateKey: string; addressId: string; updatedAt: string; updatedBy: string }>;
  templateKeys: string[];
  environmentFallbackConfigured: boolean;
  audits: Awaited<ReturnType<typeof listNotifyReplyToAudits>>["data"]["notifyReplyToAudits"];
}

// Reply-to actions do not require a reason; only the site-wide delivery mode
// audit (functions/src/govNotifyDeliveryAdmin.ts) does.
function optionalReason(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? validateStringLength(trimmed, "reason", 500, 0) : undefined;
}

function expectedVersion(value: unknown, fieldName = "expectedVersion"): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new HttpsError("invalid-argument", `${fieldName} must be a positive integer`);
  }
  return Number(value);
}

function addressValue(address: Address): string {
  return JSON.stringify({
    id: address.id,
    displayLabel: address.displayLabel,
    emailAddress: address.emailAddress,
    notifyUuid: address.notifyUuid,
    enabled: address.enabled,
    announcementSelectable: address.announcementSelectable,
    verificationStatus: address.verificationStatus,
  });
}

function requireAddress(configuration: Configuration, idValue: unknown): Address {
  const id = validateUUID(requireString(idValue, "addressId"), "addressId");
  const address = configuration.notifyReplyToAddresses.find((candidate) => candidate.id === id);
  if (!address) throw new HttpsError("not-found", "Reply-to address not found");
  return address;
}

function requireUsableAddress(configuration: Configuration, idValue: unknown): Address {
  const address = requireAddress(configuration, idValue);
  if (!address.enabled || address.verificationStatus !== "VERIFIED") {
    throw new HttpsError("failed-precondition", "Reply-to address must be enabled and verified");
  }
  return address;
}

function assertChanged(changed: number, message: string): void {
  if (changed !== 1) throw new HttpsError("aborted", message);
}

async function readAdminConfiguration(): Promise<NotifyReplyToAdminConfiguration> {
  const [configuration, auditResult] = await Promise.all([
    getOrCreateNotifyReplyToConfiguration(),
    listNotifyReplyToAudits({ limit: AUDIT_LIMIT }),
  ]);
  return {
    configuration: {
      version: configuration.notifyEmailConfiguration!.version,
      defaultAddressId: configuration.notifyEmailConfiguration!.defaultReplyToAddress?.id ?? null,
    },
    addresses: configuration.notifyReplyToAddresses,
    templateOverrides: configuration.notifyTemplateReplyToOverrides.map((override) => ({
      templateKey: override.templateKey,
      addressId: override.replyToAddress.id,
      updatedAt: override.updatedAt,
      updatedBy: override.updatedBy,
    })),
    templateKeys: Object.keys(EMAIL_TEMPLATE_MANIFEST).sort(),
    environmentFallbackConfigured: Boolean(getGovNotifyEmailReplyToId()),
    audits: auditResult.data.notifyReplyToAudits,
  };
}

export const getNotifyReplyToAdminConfiguration = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<NotifyReplyToAdminConfiguration> => {
    requireAdmin(request);
    return readAdminConfiguration();
  },
);

export const createNotifyReplyToAddress = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<NotifyReplyToAdminConfiguration> => {
    requireAdmin(request);
    const displayLabel = validateStringLength(requireString(request.data?.displayLabel, "displayLabel"), "displayLabel", 100);
    const emailAddress = validateEmail(requireString(request.data?.emailAddress, "emailAddress"));
    const notifyUuid = validateUUID(requireString(request.data?.notifyUuid, "notifyUuid"), "Notify UUID");
    const id = randomUUID();
    await dcCreateAddress({
      id,
      displayLabel,
      emailAddress,
      notifyUuid,
      changedBy: request.auth!.uid,
      reason: optionalReason(request.data?.reason),
      newValue: JSON.stringify({ id, displayLabel, emailAddress, notifyUuid }),
    });
    return readAdminConfiguration();
  },
);

export const updateNotifyReplyToAddress = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<NotifyReplyToAdminConfiguration> => {
    requireAdmin(request);
    const configuration = await getOrCreateNotifyReplyToConfiguration();
    const address = requireAddress(configuration, request.data?.addressId);
    if (configuration.notifyEmailConfiguration?.defaultReplyToAddress?.id === address.id) {
      throw new HttpsError("failed-precondition", "Move or clear the system default before editing this address");
    }
    const displayLabel = validateStringLength(requireString(request.data?.displayLabel, "displayLabel"), "displayLabel", 100);
    const emailAddress = validateEmail(requireString(request.data?.emailAddress, "emailAddress"));
    const notifyUuid = validateUUID(requireString(request.data?.notifyUuid, "notifyUuid"), "Notify UUID");
    const result = await dcUpdateIdentity({
      id: address.id,
      expectedVersion: expectedVersion(request.data?.expectedVersion),
      displayLabel,
      emailAddress,
      notifyUuid,
      changedBy: request.auth!.uid,
      reason: optionalReason(request.data?.reason),
      previousValue: addressValue(address),
      newValue: JSON.stringify({ id: address.id, displayLabel, emailAddress, notifyUuid }),
    });
    assertChanged(result.data.changed, "Reply-to address changed; reload and try again");
    return readAdminConfiguration();
  },
);

export const sendNotifyReplyToVerificationTest = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] },
  async (request): Promise<NotifyReplyToAdminConfiguration> => {
    requireAdmin(request);
    await enforceRateLimit("sendNotifyReplyToVerificationTest", request.auth!.uid);
    const configuration = await getOrCreateNotifyReplyToConfiguration();
    const address = requireAddress(configuration, request.data?.addressId);
    const version = expectedVersion(request.data?.expectedVersion);
    const changeReason = optionalReason(request.data?.reason);
    if (address.version !== version) throw new HttpsError("aborted", "Reply-to address changed; reload and try again");
    const adminEmail = request.auth!.token.email;
    if (typeof adminEmail !== "string" || request.auth!.token.email_verified !== true) {
      throw new HttpsError("failed-precondition", "Your admin account must have a verified email address");
    }
    const delivery = await resolveRuntimeGovNotifyDeliveryMode("TEAM_TEST");
    if (delivery.effectiveMode === "SIMULATION") {
      throw new HttpsError("failed-precondition", "Raise the site email mode to Team test before sending a verification email");
    }
    const templateId = process.env.GOV_NOTIFY_TEMPLATE_EMAIL_VERIFICATION?.trim();
    if (!templateId) throw new HttpsError("failed-precondition", "The email verification Notify template is not configured");
    const response = await new NotifyClient(govNotifyApiKeyForMode(delivery.effectiveMode)).sendEmail(
      templateId,
      adminEmail,
      {
        personalisation: { verificationLink: `${APP_BASE_URL}/account` },
        reference: `reply-to-test:${address.id}:${address.version}:${randomUUID()}`,
        emailReplyToId: address.notifyUuid,
      },
    );
    const providerNotificationId = response.data?.id?.trim();
    if (!providerNotificationId) throw new HttpsError("internal", "Notify did not return a notification ID");
    const result = await dcRecordProviderAcceptance({
      id: address.id,
      expectedVersion: version,
      providerNotificationId,
      verificationMode: delivery.effectiveMode as DataConnectGovNotifyDeliveryMode,
      changedBy: request.auth!.uid,
      reason: changeReason,
    });
    assertChanged(result.data.changed, "Reply-to address changed; reload and try again");
    return readAdminConfiguration();
  },
);

export const confirmNotifyReplyToVerification = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<NotifyReplyToAdminConfiguration> => {
    requireAdmin(request);
    const configuration = await getOrCreateNotifyReplyToConfiguration();
    const address = requireAddress(configuration, request.data?.addressId);
    if (address.verificationStatus !== "PROVIDER_ACCEPTED") {
      throw new HttpsError("failed-precondition", "Send and inspect a verification email first");
    }
    const result = await dcConfirmVerification({
      id: address.id,
      expectedVersion: expectedVersion(request.data?.expectedVersion),
      changedBy: request.auth!.uid,
      reason: optionalReason(request.data?.reason),
    });
    assertChanged(result.data.changed, "Reply-to address changed; reload and try again");
    return readAdminConfiguration();
  },
);

export const updateNotifyReplyToAvailability = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<NotifyReplyToAdminConfiguration> => {
    requireAdmin(request);
    const configuration = await getOrCreateNotifyReplyToConfiguration();
    const address = requireAddress(configuration, request.data?.addressId);
    const version = expectedVersion(request.data?.expectedVersion);
    const changeReason = optionalReason(request.data?.reason);
    const enabled = request.data?.enabled === true;
    const announcementSelectable = enabled && request.data?.announcementSelectable === true;
    if (enabled && address.verificationStatus !== "VERIFIED") {
      throw new HttpsError("failed-precondition", "Verify this reply-to address before enabling it");
    }
    const isDefault = configuration.notifyEmailConfiguration?.defaultReplyToAddress?.id === address.id;
    if (!enabled && isDefault) {
      const replacementId = request.data?.replacementAddressId
        ? requireUsableAddress(configuration, request.data.replacementAddressId).id
        : null;
      if (!replacementId && request.data?.clearDefault !== true) {
        throw new HttpsError("failed-precondition", "Choose a replacement default or explicitly clear it");
      }
      const result = await dcDisableDefault({
        id: address.id,
        expectedAddressVersion: version,
        expectedConfigurationVersion: expectedVersion(request.data?.expectedConfigurationVersion, "expectedConfigurationVersion"),
        replacementAddressId: replacementId,
        changedBy: request.auth!.uid,
        reason: changeReason,
        previousValue: addressValue(address),
      });
      assertChanged(result.data.addressChanged, "Reply-to address changed; reload and try again");
      assertChanged(result.data.configurationChanged, "System default changed; reload and try again");
    } else {
      const result = await dcUpdateAvailability({
        id: address.id,
        expectedVersion: version,
        enabled,
        announcementSelectable,
        changedBy: request.auth!.uid,
        reason: changeReason,
        previousValue: addressValue(address),
        newValue: JSON.stringify({ enabled, announcementSelectable }),
      });
      assertChanged(result.data.changed, "Reply-to address changed; reload and try again");
    }
    return readAdminConfiguration();
  },
);

export const changeNotifyReplyToDefault = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<NotifyReplyToAdminConfiguration> => {
    requireAdmin(request);
    const configuration = await getOrCreateNotifyReplyToConfiguration();
    const previousAddressId = configuration.notifyEmailConfiguration?.defaultReplyToAddress?.id ?? null;
    const newAddressId = request.data?.addressId
      ? requireUsableAddress(configuration, request.data.addressId).id
      : null;
    if (newAddressId === previousAddressId) throw new HttpsError("failed-precondition", "That address is already the system default");
    if (!newAddressId && request.data?.clearDefault !== true) {
      throw new HttpsError("invalid-argument", "Explicit confirmation is required to clear the default");
    }
    const result = await dcChangeDefault({
      expectedVersion: expectedVersion(request.data?.expectedVersion),
      previousAddressId,
      newAddressId,
      changedBy: request.auth!.uid,
      reason: optionalReason(request.data?.reason),
      previousValue: JSON.stringify({ addressId: previousAddressId }),
      newValue: JSON.stringify({ addressId: newAddressId }),
    });
    assertChanged(result.data.changed, "System default changed; reload and try again");
    return readAdminConfiguration();
  },
);

export const setNotifyTemplateReplyToOverride = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<NotifyReplyToAdminConfiguration> => {
    requireAdmin(request);
    const templateKey = requireString(request.data?.templateKey, "templateKey");
    if (!EMAIL_TEMPLATE_MANIFEST[templateKey]) throw new HttpsError("invalid-argument", "Unknown automated email template");
    const configuration = await getOrCreateNotifyReplyToConfiguration();
    const existing = configuration.notifyTemplateReplyToOverrides.find((row) => row.templateKey === templateKey);
    const changeReason = optionalReason(request.data?.reason);
    if (!request.data?.addressId) {
      if (!existing) throw new HttpsError("failed-precondition", "This template already uses the system default");
      await dcClearOverride({
        templateKey,
        changedBy: request.auth!.uid,
        reason: changeReason,
        previousValue: JSON.stringify({ addressId: existing.replyToAddress.id }),
      });
    } else {
      const address = requireUsableAddress(configuration, request.data.addressId);
      await dcSetOverride({
        templateKey,
        replyToAddressId: address.id,
        changedBy: request.auth!.uid,
        reason: changeReason,
        previousValue: existing ? JSON.stringify({ addressId: existing.replyToAddress.id }) : null,
        newValue: JSON.stringify({ addressId: address.id }),
      });
    }
    return readAdminConfiguration();
  },
);

// Kept exported for UI documentation and resolver tests without exposing provider UUIDs.
export type { NotifyReplyToResolutionSource };
