import { ROUTES } from "../../constants";

export interface SectionDetailLocationState {
  sectionReturnTo?: string;
  selectedEventId?: string;
}

export function getSectionReturnTo(state: unknown, defaultRoute: string = ROUTES.SECTIONS): string {
  const returnTo = (state as SectionDetailLocationState | null)?.sectionReturnTo;
  if (returnTo === ROUTES.HOME || returnTo === ROUTES.SECTIONS) {
    return returnTo;
  }
  return defaultRoute;
}

export function sectionDetailLocationState(
  returnTo: string,
  options?: { selectedEventId?: string }
): SectionDetailLocationState {
  return {
    sectionReturnTo: returnTo,
    ...(options?.selectedEventId ? { selectedEventId: options.selectedEventId } : {}),
  };
}
