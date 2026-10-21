import type { User } from "firebase/auth";
import { useAccountClaim } from "./useAccountClaim";

export function useAdminClaim(user: User | null): boolean {
  return useAccountClaim(user, "admin").value;
}
