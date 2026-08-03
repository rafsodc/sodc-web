import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";

export type NotifyReplyToVerificationStatus = "UNVERIFIED" | "PROVIDER_ACCEPTED" | "VERIFIED";

export interface NotifyReplyToAddress {
  id: string;
  displayLabel: string;
  emailAddress: string;
  notifyUuid: string;
  enabled: boolean;
  announcementSelectable: boolean;
  verificationStatus: NotifyReplyToVerificationStatus;
  providerAcceptedAt?: string | null;
  providerNotificationId?: string | null;
  verificationMode?: "SIMULATION" | "TEAM_TEST" | "LIVE" | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface NotifyReplyToAdminConfiguration {
  configuration: { version: number; defaultAddressId: string | null };
  addresses: NotifyReplyToAddress[];
  templateOverrides: Array<{
    templateKey: string;
    addressId: string;
    updatedAt: string;
    updatedBy: string;
  }>;
  templateKeys: string[];
  environmentFallbackConfigured: boolean;
  audits: Array<{
    id: string;
    action: string;
    replyToAddressId?: string | null;
    templateKey?: string | null;
    previousValue?: string | null;
    newValue?: string | null;
    changedBy: string;
    reason: string;
    changedAt: string;
  }>;
}

async function call<TRequest, TResponse>(name: string, data: TRequest): Promise<TResponse> {
  return (await httpsCallable<TRequest, TResponse>(functions, name)(data)).data;
}

export const getNotifyReplyToAdminConfiguration = () =>
  call<void, NotifyReplyToAdminConfiguration>("getNotifyReplyToAdminConfiguration", undefined);

export const createNotifyReplyToAddress = (data: {
  displayLabel: string; emailAddress: string; notifyUuid: string; reason: string;
}) => call<typeof data, NotifyReplyToAdminConfiguration>("createNotifyReplyToAddress", data);

export const updateNotifyReplyToAddress = (data: {
  addressId: string; expectedVersion: number; displayLabel: string;
  emailAddress: string; notifyUuid: string; reason: string;
}) => call<typeof data, NotifyReplyToAdminConfiguration>("updateNotifyReplyToAddress", data);

export const sendNotifyReplyToVerificationTest = (data: {
  addressId: string; expectedVersion: number; reason: string;
}) => call<typeof data, NotifyReplyToAdminConfiguration>("sendNotifyReplyToVerificationTest", data);

export const confirmNotifyReplyToVerification = (data: {
  addressId: string; expectedVersion: number; reason: string;
}) => call<typeof data, NotifyReplyToAdminConfiguration>("confirmNotifyReplyToVerification", data);

export const updateNotifyReplyToAvailability = (data: {
  addressId: string; expectedVersion: number; expectedConfigurationVersion: number;
  enabled: boolean; announcementSelectable: boolean; clearDefault?: boolean;
  replacementAddressId?: string; reason: string;
}) => call<typeof data, NotifyReplyToAdminConfiguration>("updateNotifyReplyToAvailability", data);

export const changeNotifyReplyToDefault = (data: {
  addressId?: string; clearDefault?: boolean; expectedVersion: number; reason: string;
}) => call<typeof data, NotifyReplyToAdminConfiguration>("changeNotifyReplyToDefault", data);

export const setNotifyTemplateReplyToOverride = (data: {
  templateKey: string; addressId?: string; reason: string;
}) => call<typeof data, NotifyReplyToAdminConfiguration>("setNotifyTemplateReplyToOverride", data);
