export const CURRENT_MEMBER_STATUSES = ["REGULAR", "RESERVE", "CIVIL_SERVICE", "INDUSTRY", "RETIRED"] as const;

export type NewMemberReportSelection =
  | { kind: "migration" }
  | { kind: "event"; eventId: string }
  | { kind: "date"; since: string };
export type NewMemberReportMembership = "current" | "all";
export interface NewMemberReportOptions {
  migrationAt: string | null;
  events: Array<{ id: string; title: string; endsAt: string; sectionName: string }>;
}
export interface NewMemberReportRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  rank: string | null;
  membershipStatus: string;
  joinedAt: string;
}
export interface NewMemberReport {
  since: string;
  through: string;
  baselineLabel: string;
  members: NewMemberReportRow[];
}
