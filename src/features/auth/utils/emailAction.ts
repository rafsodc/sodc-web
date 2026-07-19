import type { ActionCodeSettings } from "firebase/auth";
import { ROUTES } from "../../../constants";

export interface EmailActionParameters {
  mode: string | null;
  oobCode: string | null;
}

export function parseEmailActionParameters(search: URLSearchParams): EmailActionParameters {
  return {
    mode: search.get("mode"),
    oobCode: search.get("oobCode"),
  };
}

export function isPasswordResetAction(
  parameters: EmailActionParameters,
): parameters is EmailActionParameters & { mode: "resetPassword"; oobCode: string } {
  return parameters.mode === "resetPassword" && Boolean(parameters.oobCode?.trim());
}

export function isEmailVerificationAction(
  parameters: EmailActionParameters,
): parameters is EmailActionParameters & { mode: "verifyEmail"; oobCode: string } {
  return parameters.mode === "verifyEmail" && Boolean(parameters.oobCode?.trim());
}

export function buildPasswordResetActionCodeSettings(origin: string): ActionCodeSettings {
  return {
    url: new URL(ROUTES.ACCOUNT, origin).toString(),
    // The web app owns the custom action handler. This flag is for native/mobile
    // app-first links, so keep it false for this web-only flow.
    handleCodeInApp: false,
  };
}

export function buildEmailVerificationActionCodeSettings(origin: string): ActionCodeSettings {
  return {
    url: new URL(ROUTES.PROFILE_COMPLETION, origin).toString(),
    // The custom web handler is configured in Firebase Authentication's email
    // template. This continue URL is fixed application state, not navigation
    // supplied by the incoming action link.
    handleCodeInApp: false,
  };
}
