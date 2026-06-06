import { ROUTES } from "../../constants";

export interface SectionDetailLocationState {
  sectionReturnTo?: string;
}

export function getSectionReturnTo(state: unknown, defaultRoute: string = ROUTES.SECTIONS): string {
  const returnTo = (state as SectionDetailLocationState | null)?.sectionReturnTo;
  if (returnTo === ROUTES.HOME || returnTo === ROUTES.SECTIONS) {
    return returnTo;
  }
  return defaultRoute;
}

export function sectionDetailLocationState(returnTo: string): SectionDetailLocationState {
  return { sectionReturnTo: returnTo };
}
