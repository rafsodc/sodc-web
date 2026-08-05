import * as logger from "firebase-functions/logger";
import { getNotifyTemplateBindings } from "@dataconnect/admin-generated";

/**
 * Resolves a transactional template's bound Notify template ID from Data
 * Connect. Returns undefined (rather than throwing) on any lookup failure or
 * missing binding so the caller's own GOV_NOTIFY_TEMPLATE_* env var fallback
 * (functions/src/mailer.ts) can take over -- a missing or unreachable
 * binding must never block a critical transactional email.
 */
export async function resolveNotifyTemplateId(templateKey: string): Promise<string | undefined> {
  try {
    const result = await getNotifyTemplateBindings();
    return result.data.notifyTemplateBindings.find((b) => b.templateKey === templateKey)?.notifyTemplateId;
  } catch (error) {
    logger.error("Unable to load Notify template binding; using env fallback", {
      templateKey,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return undefined;
  }
}
