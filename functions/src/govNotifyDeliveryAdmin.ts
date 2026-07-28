import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  changeGovNotifyDeliveryMode as dcChangeGovNotifyDeliveryMode,
  listGovNotifyDeliveryModeAudits,
  GovNotifyDeliveryMode as DataConnectGovNotifyDeliveryMode,
} from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { requireAdmin, requireString, validateStringLength } from "./helpers";
import {
  configuredGovNotifyDeliveryMode,
  parseGovNotifyDeliveryMode,
  resolveGovNotifyDeliveryMode,
  type GovNotifyDeliveryMode,
} from "./govNotifyDeliveryMode";
import { getGovNotifyRuntimeConfiguration } from "./govNotifyDeliveryConfiguration";

const AUDIT_LIMIT = 25;

export interface GovNotifyDeliveryAdminConfiguration {
  runtimeMode: GovNotifyDeliveryMode;
  deploymentCeiling: GovNotifyDeliveryMode;
  effectiveSiteMode: GovNotifyDeliveryMode;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  audits: Array<{
    id: string;
    previousMode: GovNotifyDeliveryMode;
    newMode: GovNotifyDeliveryMode;
    deploymentCeiling: GovNotifyDeliveryMode;
    changedBy: string;
    reason: string;
    changedAt: string;
  }>;
}

async function readAdminConfiguration(): Promise<GovNotifyDeliveryAdminConfiguration> {
  const [runtime, auditsResult] = await Promise.all([
    getGovNotifyRuntimeConfiguration(),
    listGovNotifyDeliveryModeAudits({ limit: AUDIT_LIMIT }),
  ]);
  const deploymentCeiling = configuredGovNotifyDeliveryMode();
  return {
    runtimeMode: runtime.mode,
    deploymentCeiling,
    effectiveSiteMode: resolveGovNotifyDeliveryMode(deploymentCeiling, runtime.mode),
    version: runtime.version,
    updatedAt: runtime.updatedAt,
    updatedBy: runtime.updatedBy,
    audits: auditsResult.data.govNotifyDeliveryModeAudits,
  };
}

export const getGovNotifyDeliveryAdminConfiguration = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<GovNotifyDeliveryAdminConfiguration> => {
    requireAdmin(request);
    return readAdminConfiguration();
  },
);

export const updateGovNotifyDeliveryMode = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<GovNotifyDeliveryAdminConfiguration> => {
    requireAdmin(request);
    let newMode: GovNotifyDeliveryMode;
    try {
      newMode = parseGovNotifyDeliveryMode(request.data?.mode, "mode");
    } catch (error) {
      throw new HttpsError(
        "invalid-argument",
        error instanceof Error ? error.message : "mode is invalid",
      );
    }
    const reason = validateStringLength(
      requireString(request.data?.reason, "reason"),
      "reason",
      500,
      5,
    );
    const expectedVersion = request.data?.expectedVersion;
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw new HttpsError("invalid-argument", "expectedVersion must be a positive integer");
    }

    const current = await getGovNotifyRuntimeConfiguration();
    if (current.version !== expectedVersion) {
      throw new HttpsError("aborted", "Email delivery mode changed; reload and try again");
    }
    if (current.mode === newMode) {
      throw new HttpsError("failed-precondition", "Email delivery mode is already set to that value");
    }

    const deploymentCeiling = configuredGovNotifyDeliveryMode();
    if (resolveGovNotifyDeliveryMode(deploymentCeiling, newMode) !== newMode) {
      throw new HttpsError(
        "failed-precondition",
        `The deployment ceiling does not permit ${newMode}`,
      );
    }

    try {
      await dcChangeGovNotifyDeliveryMode({
        expectedVersion,
        previousMode: current.mode as DataConnectGovNotifyDeliveryMode,
        newMode: newMode as DataConnectGovNotifyDeliveryMode,
        deploymentCeiling: deploymentCeiling as DataConnectGovNotifyDeliveryMode,
        changedBy: request.auth!.uid,
        reason,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("DELIVERY_MODE_CONFLICT")) {
        throw new HttpsError("aborted", "Email delivery mode changed; reload and try again");
      }
      throw error;
    }
    return readAdminConfiguration();
  },
);
