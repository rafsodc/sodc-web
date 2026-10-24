import { runSecurityMutation } from "../securityMutation";
import { httpsCallable } from "../sessionCallable";
import { functions } from "../../../config/firebase";

export interface PotentialLostMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  membershipStatus: string;
  lastSignInTime: string | null;
  inactivitySince: string | null;
  lastActivityTime: string | null;
  activitySource: "TOKEN_REFRESH" | "SIGN_IN" | "ACCOUNT_CREATED" | null;
  emailBounceCount: number;
  emailLastBounceAt: string | null;
  reasons: string[];
  canConfirm: boolean;
  blockedReason: string | null;
  reviewToken: string;
}
export async function listPotentialLostMembers() {
  return (await httpsCallable<void, { members: PotentialLostMember[] }>(functions, "listPotentialLostMembers")()).data;
}
export async function confirmPotentialLostMember(member: PotentialLostMember) {
  const callable = httpsCallable<{ userId: string; reviewToken: string; operationId: string }, { success: boolean }>(functions, "confirmPotentialLostMember");
  return (await runSecurityMutation("confirmPotentialLostMember", { userId: member.id, reviewToken: member.reviewToken }, callable)).data;
}
