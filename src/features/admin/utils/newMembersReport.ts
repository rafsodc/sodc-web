import type { NewMemberReportRow } from "../../../../functions/src/shared/newMemberReport";
import { getMembershipStatusLabel } from "../../../shared/utils/membershipStatusLabels";

export const reportDate = (value: string) => new Date(value).toLocaleDateString("en-GB", { timeZone: "Europe/London" });

/** Interpret a calendar date at UK midnight, including either side of BST changes. */
export function reportDateStart(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const midnight = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== value) return null;
  const ukHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).format(new Date(midnight));
  return new Date(midnight - Number(ukHour) * 60 * 60 * 1000).toISOString();
}

export function newMembersCsv(members: NewMemberReportRow[]): string {
  const cell = (value: string) => {
    const safe = /^\s*[=+\-@]|^[\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return [
    ["Rank", "First name", "Last name", "Email", "Membership", "Site registration (UTC)"],
    ...members.map((member) => [member.rank ?? "", member.firstName, member.lastName, member.email,
      getMembershipStatusLabel(member.membershipStatus), member.joinedAt]),
  ].map((row) => row.map(cell).join(",")).join("\r\n");
}
