import { BookingStatus } from "@dataconnect/generated";

export function getMyBookingActionLabel(status: BookingStatus | string): string {
  if (status === BookingStatus.DRAFT) {
    return "Complete booking";
  }
  return "View booking";
}

export function formatBookingEventWhen(startDateTime: string, endDateTime: string): string {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Date to be confirmed";
  }
  return `${start.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} – ${end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

export function bookingStatusChipColor(
  status: BookingStatus | string
): "success" | "warning" | "default" | "error" {
  if (status === BookingStatus.CONFIRMED) return "success";
  if (status === BookingStatus.SUBMITTED) return "default";
  if (status === BookingStatus.DRAFT) return "warning";
  if (status === BookingStatus.CANCELLED) return "error";
  return "default";
}
