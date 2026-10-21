import { httpsCallable } from "firebase/functions";
import { functions } from "../../config/firebase";
export interface OwnAuthorizationStatus {
  status: "enabled" | "restricted" | "pending" | "missing";
  isAdmin: boolean;
  securityVersion: number | null;
  tokenVersionCurrent: boolean;
  verificationRequired: boolean;
}
/** Safe after any authorization denial; this request never replays the failed mutation. */
export async function getMyAuthorizationStatus(): Promise<OwnAuthorizationStatus> {
  return (await httpsCallable<void, OwnAuthorizationStatus>(functions, "getMyAuthorizationStatus")()).data;
}
