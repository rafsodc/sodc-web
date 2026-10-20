import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, CircularProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { auth } from "../../../config/firebase";
import { getNewMemberReportOptions, getNewMembersReport, type NewMemberReportSelection, type NewMemberReportMembership } from "../../../shared/utils/firebaseFunctions/newMembers";
import { getMembershipStatusLabel } from "../../../shared/utils/membershipStatusLabels";
import PaginationDisplay from "../../../shared/components/PaginationDisplay";
import { newMembersCsv, reportDate, reportDateStart } from "../utils/newMembersReport";

export default function NewMembersReport() {
  const [period, setPeriod] = useState<NewMemberReportSelection["kind"]>("migration");
  const [eventId, setEventId] = useState("");
  const [date, setDate] = useState("");
  const [membership, setMembership] = useState<NewMemberReportMembership>("current");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exportError, setExportError] = useState(false);
  const options = useQuery({ queryKey: ["new-member-report-options", auth.currentUser?.uid], queryFn: getNewMemberReportOptions, retry: false, refetchOnWindowFocus: false });
  const since = reportDateStart(date);
  const selection: NewMemberReportSelection | null = period === "migration"
    ? options.data?.migrationAt ? { kind: "migration" } : null
    : period === "event" ? eventId ? { kind: "event", eventId } : null
      : since ? { kind: "date", since } : null;
  const report = useQuery({
    queryKey: ["new-members-report", auth.currentUser?.uid, selection, membership],
    queryFn: () => getNewMembersReport(selection!, membership),
    enabled: Boolean(selection) && !options.isError, retry: false, refetchOnWindowFocus: false,
  });
  const members = report.data?.members.filter((member) =>
    `${member.firstName} ${member.lastName} ${member.email}`.toLowerCase().includes(search.trim().toLowerCase())) ?? [];
  const totalPages = Math.ceil(members.length / 25);
  const currentPage = Math.min(page, Math.max(1, totalPages));
  const ready = Boolean(selection && report.data && !report.isError && !options.isError && !report.isFetching);
  function exportCsv() {
    if (!ready) return;
    setExportError(false);
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob(["\uFEFF", newMembersCsv(members)], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `new-members-${reportDate(report.data!.since).split("/").reverse().join("-")}-${membership}.csv`;
      link.click();
    } catch { setExportError(true); }
    finally { if (url) URL.revokeObjectURL(url); }
  }
  return <Box>
    <Typography component="h2" variant="h6">New members</Typography>
    <Typography sx={{ mb: 2 }}>Members who registered on this site during the selected period. Accounts imported or linked from the old site are excluded. Registration dates are when the site profile was created, not the date they originally joined SODC.</Typography>
    {options.isPending ? <CircularProgress aria-label="Loading report options" /> : options.isError ?
      <Alert severity="error" action={<Button onClick={() => void options.refetch()}>Retry</Button>}>We could not load the report options. Please try again.</Alert> : <>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ my: 2 }}>
        <TextField select label="Joined since" value={period} onChange={(e) => { setPeriod(e.target.value as typeof period); setPage(1); }} sx={{ minWidth: 180 }}>
          <MenuItem value="migration">Site migration</MenuItem><MenuItem value="event">An event</MenuItem><MenuItem value="date">A date</MenuItem>
        </TextField>
        {period === "event" && <TextField select label="Previous event" value={eventId} onChange={(e) => { setEventId(e.target.value); setPage(1); }} sx={{ minWidth: 240 }}>
          {options.data?.events.map((event) => <MenuItem key={event.id} value={event.id}>{event.title} — {event.sectionName} — {reportDate(event.endsAt)}</MenuItem>)}
        </TextField>}
        {period === "date" && <TextField type="date" label="Start date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} slotProps={{ inputLabel: { shrink: true } }} helperText="From midnight UK time" />}
        <TextField select label="Membership" value={membership} onChange={(e) => { setMembership(e.target.value as NewMemberReportMembership); setPage(1); }} sx={{ minWidth: 220 }}>
          <MenuItem value="current">Current members</MenuItem><MenuItem value="all">All registrations</MenuItem>
        </TextField>
      </Stack>
      <Typography variant="body2" sx={{ mb: 2 }}>{membership === "current" ? "Current members includes Regular, Reserve, Civil Service, Industry and Retired. Select All registrations to include pending and former members." : "Includes all membership statuses, including pending, resigned, lost and deceased."} Event periods start when the selected event ended.</Typography>
      {period === "migration" && !options.data?.migrationAt && <Alert severity="info">No migration date is recorded. Select an event or a date to run the report.</Alert>}
      {period === "event" && !options.data?.events.length && <Alert severity="info">No completed events are available. Select a date instead.</Alert>}
      {selection && <>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ my: 2 }}>
          <TextField label="Find a member" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Button disabled={report.isFetching} onClick={() => void report.refetch()}>Refresh report</Button>
          <Button variant="outlined" disabled={!ready || members.length === 0} onClick={exportCsv}>Export CSV ({ready ? members.length : 0})</Button>
        </Stack>
        {report.isFetching ? <CircularProgress aria-label="Loading new members" /> : report.isError ?
          <Alert severity="error" action={<Button onClick={() => void report.refetch()}>Retry</Button>}>We could not load new members. Check the selected period is in the past and try again.</Alert> : report.data && <>
          <Typography sx={{ mb: 1 }}>{report.data.baselineLabel}: {reportDate(report.data.since)} to {reportDate(report.data.through)}. Showing {members.length} of {report.data.members.length} registrations.</Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>CSV includes every matching row across all pages.</Typography>
          {!members.length ? <Alert severity="info">No new members match this period and the selected filters.</Alert> : <>
            <TableContainer><Table aria-label="New members"><TableHead><TableRow>
              <TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Membership</TableCell><TableCell>Registered on site</TableCell>
            </TableRow></TableHead><TableBody>{members.slice((currentPage - 1) * 25, currentPage * 25).map((member) => <TableRow key={member.id}>
              <TableCell>{[member.rank, member.firstName, member.lastName].filter(Boolean).join(" ")}</TableCell>
              <TableCell>{member.email}</TableCell><TableCell>{getMembershipStatusLabel(member.membershipStatus)}</TableCell><TableCell>{reportDate(member.joinedAt)}</TableCell>
            </TableRow>)}</TableBody></Table></TableContainer>
            <PaginationDisplay page={currentPage} totalPages={totalPages} onChange={setPage} />
          </>}
        </>}
      </>}
    </>}
    {exportError && <Alert severity="error">The CSV could not be downloaded. Please try again.</Alert>}
  </Box>;
}
