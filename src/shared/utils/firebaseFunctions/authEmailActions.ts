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

export async function requestEmailChange(newEmail: string): Promise<void> {
  const callable = httpsCallable<{ newEmail: string }, { success: true }>(
    functions,
    "requestEmailChange",
  );
  await callable({ newEmail });
}

export async function reconcileMyEmail(): Promise<string> {
  const callable = httpsCallable<void, { success: true; email: string }>(
    functions,
    "reconcileMyEmail",
  );
  return (await callable()).data.email;
}
