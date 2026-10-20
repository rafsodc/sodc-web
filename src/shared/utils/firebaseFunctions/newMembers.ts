import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";
import type { NewMemberReport, NewMemberReportOptions, NewMemberReportSelection, NewMemberReportMembership } from "../../../../functions/src/shared/newMemberReport";

export type { NewMemberReport, NewMemberReportOptions, NewMemberReportSelection, NewMemberReportMembership };
export function getNewMemberReportOptions() {
  return httpsCallable<void, NewMemberReportOptions>(functions, "getNewMemberReportOptions")().then((result) => result.data);
}
export function getNewMembersReport(selection: NewMemberReportSelection, membership: NewMemberReportMembership) {
  return httpsCallable<{ selection: NewMemberReportSelection; membership: NewMemberReportMembership }, NewMemberReport>(functions, "getNewMembersReport")({ selection, membership }).then((result) => result.data);
}
