import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";

export interface PotentialLostMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  membershipStatus: string;
  lastSignInTime: string | null;
  inactivitySince: string | null;
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
  return (await httpsCallable<{ userId: string; reviewToken: string }, { success: boolean }>(functions, "confirmPotentialLostMember")({ userId: member.id, reviewToken: member.reviewToken })).data;
}
