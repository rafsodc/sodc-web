import type { MembershipStatus } from "@dataconnect/generated";
import { MEMBERSHIP_STATUS_OPTIONS } from "../../constants";

export function getMembershipStatusLabel(
  status: MembershipStatus | string | null | undefined
): string {
  if (!status) {
    return "Unknown";
  }
  const option = MEMBERSHIP_STATUS_OPTIONS.find((entry) => entry.value === status);
  return option?.label ?? status;
}
