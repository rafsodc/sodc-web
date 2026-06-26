import type { UserData } from "../../types";

export function getMemberDisplayName(
  userData: UserData | null,
  fallbackEmail?: string | null
): string {
  const name = `${userData?.firstName ?? ""} ${userData?.lastName ?? ""}`.trim();
  if (name) return name;
  return fallbackEmail?.trim() || "Member";
}
