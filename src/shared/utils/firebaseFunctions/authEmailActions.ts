import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";

export async function requestPasswordResetEmail(email: string): Promise<void> {
  const callable = httpsCallable<{ email: string }, { success: true }>(
    functions,
    "requestPasswordReset",
  );
  await callable({ email });
}

export async function requestEmailVerification(): Promise<void> {
  const callable = httpsCallable<void, { success: true }>(
    functions,
    "requestEmailVerification",
  );
  await callable();
}
