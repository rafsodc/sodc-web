import {
  listLegacyApplicantStaffNotificationDeliveries,
  listLegacyBookingStaffNotificationDeliveries,
  type UUIDString,
} from "@dataconnect/admin-generated";
import { GOV_NOTIFY_DELIVERY_MODES, type GovNotifyDeliveryMode } from "./govNotifyDeliveryMode";
import { PrivilegedRecipientLookupError } from "./privilegedNotificationRecipient";

export type PrivilegedNotificationEvent =
  | { kind: "BOOKING"; bookingId: UUIDString }
  | { kind: "APPLICANT"; subjectUserId: string };
type LegacyRow = { deliveryKey: string; deliveryMode?: string | null; recoveryPayload?: string | null };

/** Unknown historical mode fences every mode; an address never proves a legacy UID. */
export function legacyStaffEventMatchesMode(row: LegacyRow, mode: GovNotifyDeliveryMode): boolean {
  const modes = new Set<string>();
  if (row.deliveryMode && GOV_NOTIFY_DELIVERY_MODES.includes(row.deliveryMode as GovNotifyDeliveryMode)) {
    modes.add(row.deliveryMode);
  }
  try {
    const payload = JSON.parse(row.recoveryPayload ?? "{}") as { deliveryMode?: GovNotifyDeliveryMode };
    if (payload.deliveryMode && GOV_NOTIFY_DELIVERY_MODES.includes(payload.deliveryMode)) modes.add(payload.deliveryMode);
  } catch { /* Unreadable legacy records still fence the historical event. */ }
  const suffix = /:notify-(simulation|team_test|live)$/.exec(row.deliveryKey);
  if (suffix) modes.add(suffix[1].toUpperCase());
  // Missing or contradictory historical mode information must never enable a replay.
  return modes.size !== 1 || modes.has(mode);
}

export async function hasLegacyPrivilegedNotificationEvent(
  event: PrivilegedNotificationEvent,
  mode: GovNotifyDeliveryMode,
): Promise<boolean> {
  try {
    const result = event.kind === "BOOKING"
      ? await listLegacyBookingStaffNotificationDeliveries({ bookingId: event.bookingId })
      : await listLegacyApplicantStaffNotificationDeliveries({ subjectUserId: event.subjectUserId });
    const rows = result.data.notificationDeliveries;
    if (rows.length >= 1000) throw new PrivilegedRecipientLookupError("LEGACY_NOTIFICATION_LOOKUP_LIMIT");
    return rows.some((row) => legacyStaffEventMatchesMode(row, mode));
  } catch (error) {
    if (error instanceof PrivilegedRecipientLookupError) throw error;
    throw new PrivilegedRecipientLookupError("LEGACY_NOTIFICATION_LOOKUP_FAILED");
  }
}
