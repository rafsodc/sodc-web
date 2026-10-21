import type { User } from "firebase/auth";
import { useAccountClaim } from "./useAccountClaim";

export interface EnabledClaimState {
  isEnabled: boolean;
  isEnabledClaimResolved: boolean;
}
export function useEnabledClaim(user: User | null): EnabledClaimState {
  const claim = useAccountClaim(user, "enabled");
  return { isEnabled: claim.value, isEnabledClaimResolved: claim.resolved };
}
