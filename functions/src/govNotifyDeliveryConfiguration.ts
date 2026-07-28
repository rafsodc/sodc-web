import {
  createGovNotifyDeliveryConfiguration,
  getGovNotifyDeliveryConfiguration as dcGetGovNotifyDeliveryConfiguration,
} from "@dataconnect/admin-generated";
import {
  configuredGovNotifyDeliveryMode,
  resolveGovNotifyDeliveryMode,
  type GovNotifyDeliveryMode,
  type GovNotifyDeliveryResolution,
} from "./govNotifyDeliveryMode";

export interface GovNotifyRuntimeConfiguration {
  mode: GovNotifyDeliveryMode;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export async function getGovNotifyRuntimeConfiguration(): Promise<GovNotifyRuntimeConfiguration> {
  let result = await dcGetGovNotifyDeliveryConfiguration();
  if (!result.data.govNotifyDeliveryConfiguration) {
    try {
      await createGovNotifyDeliveryConfiguration();
    } catch {
      // Another invocation may have created the singleton concurrently.
    }
    result = await dcGetGovNotifyDeliveryConfiguration();
  }
  const configuration = result.data.govNotifyDeliveryConfiguration;
  if (!configuration) {
    throw new Error("Unable to initialise GOV.UK Notify delivery configuration");
  }
  return {
    mode: configuration.mode,
    version: configuration.version,
    updatedAt: configuration.updatedAt ?? null,
    updatedBy: configuration.updatedBy ?? null,
  };
}

export async function resolveRuntimeGovNotifyDeliveryMode(
  requestedMode: GovNotifyDeliveryMode = "LIVE",
): Promise<GovNotifyDeliveryResolution> {
  const deploymentCeiling = configuredGovNotifyDeliveryMode();
  const runtime = await getGovNotifyRuntimeConfiguration();
  const siteMode = resolveGovNotifyDeliveryMode(deploymentCeiling, runtime.mode);
  return {
    requestedMode,
    siteMode,
    effectiveMode: resolveGovNotifyDeliveryMode(siteMode, requestedMode),
  };
}
