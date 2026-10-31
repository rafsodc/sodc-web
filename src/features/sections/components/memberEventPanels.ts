import type { EventDetailTab } from "../utils/sectionDetailTabs";

// Share code-only imports between URL-intent preloading and React.lazy. Keep a
// rejection too: a failed module uses the existing explicit reload recovery.
let bookingModule: ReturnType<typeof importBookingWizard> | undefined;
let attendeesModule: ReturnType<typeof importAttendees> | undefined;
let detailsModule: ReturnType<typeof importDetails> | undefined;
const importBookingWizard = () => import("./EventBookingWizard");
const importAttendees = () => import("./EventAttendees");
const importDetails = () => import("./EventDetailsContent");

export const loadEventBookingWizard = () => bookingModule ??= importBookingWizard();
export const loadEventAttendees = () => attendeesModule ??= importAttendees();
export const loadEventDetailsContent = () => detailsModule ??= importDetails();

export async function preloadMemberEventPanel(tab: EventDetailTab): Promise<void> {
  if (tab === "book") await loadEventBookingWizard();
  else if (tab === "attendees") await loadEventAttendees();
  else await loadEventDetailsContent();
}
