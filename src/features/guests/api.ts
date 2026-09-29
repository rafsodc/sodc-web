import { httpsCallable } from "firebase/functions";
import { functions } from "../../config/firebase";
export interface GuestType {
  description?: string | null;
  sortOrder?: number;
  id: string;
  title: string;
  priceMinor: number;
  includesSymposium: boolean;
  includesDinner: boolean;
  active: boolean;
  version: number;
}
export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dietaryRequirements: string;
  ticketTypeId: string;
  ticketTitle: string;
  priceMinor: number;
  includesSymposium: boolean;
  includesDinner: boolean;
  version: number;
  cancelled: boolean;
  paymentStatus: string;
  refundedAmountMinor: number;
}
export interface GuestList {
  event: { id: string; title: string; bookingEndDateTime: string };
  ticketTypes: GuestType[];
  guests: Guest[];
}
export interface GuestTicket {
  firstName: string;
  lastName: string;
  eventTitle: string;
  ticketTitle: string;
  priceMinor: number;
  includesSymposium: boolean;
  includesDinner: boolean;
  dietaryRequirements: string;
  dietaryEditable: boolean;
  paymentDueAt: string;
  paymentStatus: string;
  cancelled: boolean;
  version: number;
}
export async function guestCall<T>(
  name: string,
  input: Record<string, unknown>,
): Promise<T> {
  return (
    await httpsCallable<Record<string, unknown>, T>(functions, name)(input)
  ).data;
}
export const money = (minor: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    minor / 100,
  );
export const paymentLabel = (status: string) =>
  status.toLowerCase().replaceAll("_", " ");
