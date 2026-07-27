import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";
import type { GovNotifyDeliveryMode } from "./announcements";

export interface GovNotifyDeliveryModeAudit {
  id: string;
  previousMode: GovNotifyDeliveryMode;
  newMode: GovNotifyDeliveryMode;
  deploymentCeiling: GovNotifyDeliveryMode;
  changedBy: string;
  reason: string;
  changedAt: string;
}

export interface GovNotifyDeliveryAdminConfiguration {
  runtimeMode: GovNotifyDeliveryMode;
  deploymentCeiling: GovNotifyDeliveryMode;
  effectiveSiteMode: GovNotifyDeliveryMode;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  audits: GovNotifyDeliveryModeAudit[];
}

export async function getGovNotifyDeliveryAdminConfiguration():
Promise<GovNotifyDeliveryAdminConfiguration> {
  const callable = httpsCallable<void, GovNotifyDeliveryAdminConfiguration>(
    functions,
    "getGovNotifyDeliveryAdminConfiguration",
  );
  return (await callable()).data;
}

export async function updateGovNotifyDeliveryMode(
  mode: GovNotifyDeliveryMode,
  expectedVersion: number,
  reason: string,
): Promise<GovNotifyDeliveryAdminConfiguration> {
  const callable = httpsCallable<
    { mode: GovNotifyDeliveryMode; expectedVersion: number; reason: string },
    GovNotifyDeliveryAdminConfiguration
  >(functions, "updateGovNotifyDeliveryMode");
  return (await callable({ mode, expectedVersion, reason })).data;
}
