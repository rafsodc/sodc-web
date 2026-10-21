import { sendNotificationOnce, type SendNotificationOnceRequest, type SendNotificationOnceDependencies, type NotificationSendResult } from "./notificationDelivery";
import { authorizePrivilegedNotificationRecipient, type PrivilegedNotificationScope } from "./privilegedNotificationRecipient";
import { hasLegacyPrivilegedNotificationEvent, type PrivilegedNotificationEvent } from "./privilegedNotificationLegacy";
import type { GovNotifyDeliveryMode } from "./govNotifyDeliveryMode";

export interface PrivilegedDeliveryDependencies {
  authorize?: typeof authorizePrivilegedNotificationRecipient;
  hasLegacyEvent?: typeof hasLegacyPrivilegedNotificationEvent;
  delivery?: SendNotificationOnceDependencies;
}

/** Only staff alerts opt into this policy; member receipts retain their domain rules. */
export async function sendPrivilegedNotification(
  request: Omit<SendNotificationOnceRequest, "send" | "recipientUserId"> & {
    recipientUserId: string;
    scope: PrivilegedNotificationScope;
    event: PrivilegedNotificationEvent;
    sendAuthorized: (email: string, mode?: GovNotifyDeliveryMode) => Promise<NotificationSendResult>;
  },
  dependencies: PrivilegedDeliveryDependencies = {},
) {
  return sendNotificationOnce({
    ...request,
    send: async (mode, assertOwnership) => {
      if (!mode) throw new Error("PRIVILEGED_DELIVERY_MODE_MISSING");
      if (request.preserveDeliveryKey && request.deliveryMode && mode !== request.deliveryMode) {
        return { outcome: "skipped", reason: "DELIVERY_MODE_CHANGED" };
      }
      if (await (dependencies.hasLegacyEvent ?? hasLegacyPrivilegedNotificationEvent)(request.event, mode)) {
        return { outcome: "skipped", reason: "LEGACY_EVENT_ALREADY_RECORDED" };
      }
      // This is deliberately the last lookup before submitting to the provider.
      const recipient = await (dependencies.authorize ?? authorizePrivilegedNotificationRecipient)(request.recipientUserId, request.scope);
      if (!recipient.eligible) return { outcome: "skipped", reason: recipient.reason };
      await assertOwnership?.();
      return request.sendAuthorized(recipient.email, mode);
    },
  }, dependencies.delivery);
}
