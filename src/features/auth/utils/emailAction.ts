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

export function buildPasswordResetActionCodeSettings(origin: string): ActionCodeSettings {
  return {
    url: new URL(ROUTES.ACCOUNT, origin).toString(),
    // The web app owns the custom action handler. This flag is for native/mobile
    // app-first links, so keep it false for this web-only flow.
    handleCodeInApp: false,
  };
}
