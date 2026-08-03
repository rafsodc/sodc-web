import * as logger from "firebase-functions/logger";
import {
  createNotifyEmailConfiguration,
  getNotifyReplyToConfiguration,
  type GetNotifyReplyToConfigurationData,
} from "@dataconnect/admin-generated";
import { getGovNotifyEmailReplyToId } from "./govNotifyReplyToId";

type ConfigurationData = GetNotifyReplyToConfigurationData;
type AddressRow = ConfigurationData["notifyReplyToAddresses"][number];

export type NotifyReplyToResolutionSource =
  | "template_override"
  | "system_default"
  | "announcement_selection"
  | "environment_fallback"
  | "notify_default";

export interface ResolvedNotifyReplyTo {
  source: NotifyReplyToResolutionSource;
  addressId?: string;
  displayLabel?: string;
  emailAddress?: string;
  notifyUuid?: string;
}

export class NotifyReplyToSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotifyReplyToSelectionError";
  }
}

function isUsable(address: AddressRow | undefined): address is AddressRow {
  return Boolean(
    address &&
    address.enabled &&
    address.verificationStatus === "VERIFIED",
  );
}

function resolutionFromAddress(
  address: AddressRow,
  source: "template_override" | "system_default",
): ResolvedNotifyReplyTo {
  return {
    source,
    addressId: address.id,
    displayLabel: address.displayLabel,
    emailAddress: address.emailAddress,
    notifyUuid: address.notifyUuid,
  };
}

function environmentResolution(env: NodeJS.ProcessEnv): ResolvedNotifyReplyTo {
  const notifyUuid = getGovNotifyEmailReplyToId(env);
  return notifyUuid
    ? { source: "environment_fallback", notifyUuid }
    : { source: "notify_default" };
}

export async function getOrCreateNotifyReplyToConfiguration(): Promise<ConfigurationData> {
  let result = await getNotifyReplyToConfiguration();
  if (!result.data.notifyEmailConfiguration) {
    try {
      await createNotifyEmailConfiguration();
    } catch {
      // Another invocation may have created the singleton concurrently.
    }
    result = await getNotifyReplyToConfiguration();
  }
  if (!result.data.notifyEmailConfiguration) {
    throw new Error("Unable to initialise GOV.UK Notify reply-to configuration");
  }
  return result.data;
}

export function resolveNotifyReplyToFromConfiguration(
  configuration: ConfigurationData,
  templateKey: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedNotifyReplyTo {
  const override = templateKey
    ? configuration.notifyTemplateReplyToOverrides.find(
      (candidate) => candidate.templateKey === templateKey,
    )?.replyToAddress
    : undefined;
  const overrideRow = override
    ? configuration.notifyReplyToAddresses.find((address) => address.id === override.id)
    : undefined;
  if (isUsable(overrideRow)) {
    return resolutionFromAddress(overrideRow, "template_override");
  }

  const defaultId = configuration.notifyEmailConfiguration?.defaultReplyToAddress?.id;
  const defaultAddress = configuration.notifyReplyToAddresses.find(
    (address) => address.id === defaultId,
  );
  if (isUsable(defaultAddress)) {
    return resolutionFromAddress(defaultAddress, "system_default");
  }
  return environmentResolution(env);
}

export async function resolveNotifyReplyToForAutomatedEmail(
  templateKey: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResolvedNotifyReplyTo> {
  try {
    const configuration = await getOrCreateNotifyReplyToConfiguration();
    return resolveNotifyReplyToFromConfiguration(configuration, templateKey, env);
  } catch (error) {
    logger.error("Unable to load GOV.UK Notify reply-to configuration; using safe fallback", {
      templateKey,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return environmentResolution(env);
  }
}

export async function resolveNotifyReplyToForAnnouncement(
  selectedAddressId: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResolvedNotifyReplyTo> {
  const configuration = await getOrCreateNotifyReplyToConfiguration();
  if (selectedAddressId) {
    const selected = configuration.notifyReplyToAddresses.find(
      (address) => address.id === selectedAddressId,
    );
    if (!isUsable(selected) || !selected.announcementSelectable) {
      throw new NotifyReplyToSelectionError(
        "The selected reply-to address is unavailable; reload and choose another address",
      );
    }
    return {
      source: "announcement_selection",
      addressId: selected.id,
      displayLabel: selected.displayLabel,
      emailAddress: selected.emailAddress,
      notifyUuid: selected.notifyUuid,
    };
  }
  return resolveNotifyReplyToFromConfiguration(configuration, undefined, env);
}

export async function listAnnouncementReplyToOptions(): Promise<{
  options: Array<{ id: string; displayLabel: string; emailAddress: string }>;
  defaultAddressId: string | null;
  fallbackSource: NotifyReplyToResolutionSource;
}> {
  const configuration = await getOrCreateNotifyReplyToConfiguration();
  const fallback = resolveNotifyReplyToFromConfiguration(configuration, undefined);
  return {
    options: configuration.notifyReplyToAddresses
      .filter((address) => isUsable(address) && address.announcementSelectable)
      .map((address) => ({
        id: address.id,
        displayLabel: address.displayLabel,
        emailAddress: address.emailAddress,
      })),
    defaultAddressId: fallback.source === "system_default" ? fallback.addressId ?? null : null,
    fallbackSource: fallback.source,
  };
}
