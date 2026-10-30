import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Divider, Link, Paper, Stack, Typography } from "@mui/material";
import { eventManagementPath } from "../../../shared/navigation/sectionRoutes";
import { formatGbpMinorAmount } from "../../../shared/utils/currencyDisplay";
import { formatSectionEventDate, formatSectionEventTime } from "../../../shared/utils/sectionEventDisplay";
import type { EventRow } from "./sectionEventsManagerTypes";

export interface EventOverviewProps {
  event: EventRow;
  sectionId: string;
  activeTicketCount?: number;
  pendingRevisionCount?: number;
  outstandingAmountPence?: number;
  outstandingTicketCount?: number;
}

/** Summary values come from the same authoritative datasets as their task views. */
export default function EventOverview({
  event,
  sectionId,
  activeTicketCount,
  pendingRevisionCount,
  outstandingAmountPence,
  outstandingTicketCount,
}: EventOverviewProps) {
  const approvalsPath = eventManagementPath(sectionId, event.id, "approvals");
  const paymentsPath = eventManagementPath(sectionId, event.id, "payments");
  const approvalAttention = pendingRevisionCount === undefined || pendingRevisionCount > 0;
  const paymentUnknown = outstandingAmountPence === undefined || outstandingTicketCount === undefined;
  const paymentAttention = paymentUnknown || outstandingAmountPence > 0 || outstandingTicketCount > 0;

  return (
    <Stack gap={3}>
      <Box>
        <Typography variant="h5" component="h2">Overview</Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>Check the event at a glance, then open the task you need.</Typography>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
        {[
          { label: "Active tickets", value: activeTicketCount?.toLocaleString() ?? "Not available", detail: "Members, accompanying guests and organiser guests", link: "View tickets & attendees", path: eventManagementPath(sectionId, event.id, "attendees") },
          { label: "Pending revisions", value: pendingRevisionCount?.toLocaleString() ?? "Not available", detail: "Booking revisions awaiting a decision", link: "View approvals", path: approvalsPath },
          { label: "Outstanding payments", value: outstandingAmountPence === undefined ? "Not available" : formatGbpMinorAmount(outstandingAmountPence), detail: outstandingTicketCount === undefined ? "Ticket count unavailable" : `${outstandingTicketCount.toLocaleString()} ${outstandingTicketCount === 1 ? "ticket requires" : "tickets require"} payment`, link: "View payments", path: paymentsPath },
        ].map((summary) => (
          <Paper key={summary.label} variant="outlined" sx={{ p: 2.5, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <Typography variant="body2" color="text.secondary">{summary.label}</Typography>
            <Typography component="p" variant="h4" sx={{ my: 1, fontVariantNumeric: "tabular-nums" }}>{summary.value}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, flex: 1 }}>{summary.detail}</Typography>
            <Link component={RouterLink} to={summary.path} fontSize="0.875rem">{summary.link}</Link>
          </Paper>
        ))}
      </Box>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6" component="h3" sx={{ mb: 1 }}>Needs attention</Typography>
        {!approvalAttention && !paymentAttention && <Typography variant="body2" color="text.secondary">No pending revisions or outstanding payments in the current summaries.</Typography>}
        {approvalAttention && (
          <Stack direction={{ xs: "column", sm: "row" }} gap={1} justifyContent="space-between" alignItems={{ sm: "center" }} sx={{ py: 1.5, borderTop: 1, borderColor: "divider" }}>
            <Typography variant="body2">{pendingRevisionCount === undefined ? "Approval summary is unavailable." : `${pendingRevisionCount.toLocaleString()} booking ${pendingRevisionCount === 1 ? "revision needs" : "revisions need"} review.`}</Typography>
            <Button component={RouterLink} to={approvalsPath} size="small" sx={{ alignSelf: { xs: "flex-start", sm: "auto" }, flexShrink: 0 }}>Review approvals</Button>
          </Stack>
        )}
        {paymentAttention && (
          <Stack direction={{ xs: "column", sm: "row" }} gap={1} justifyContent="space-between" alignItems={{ sm: "center" }} sx={{ py: 1.5, borderTop: 1, borderColor: "divider" }}>
            <Typography variant="body2">{paymentUnknown ? "Payment summary is unavailable." : `${formatGbpMinorAmount(outstandingAmountPence)} is outstanding across ${outstandingTicketCount.toLocaleString()} ${outstandingTicketCount === 1 ? "ticket" : "tickets"}.`}</Typography>
            <Button component={RouterLink} to={paymentsPath} size="small" sx={{ alignSelf: { xs: "flex-start", sm: "auto" }, flexShrink: 0 }}>Review payments</Button>
          </Stack>
        )}
      </Paper>
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Typography variant="h6" component="h3">Event information</Typography>
          <Button component={RouterLink} to={eventManagementPath(sectionId, event.id, "details")} size="small">Edit details</Button>
        </Stack>
        <Divider sx={{ my: 1.5 }} />
        <Box component="dl" sx={{ m: 0, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "max-content 1fr" }, columnGap: 3, rowGap: 1 }}>
          <Typography component="dt" variant="body2" color="text.secondary">When</Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0 }}>{formatSectionEventDate(event.startDateTime, event.endDateTime)} · {formatSectionEventTime(event.startDateTime, event.endDateTime)}</Typography>
          <Typography component="dt" variant="body2" color="text.secondary">Where</Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0 }}>{event.location?.trim() || "Location not specified"}</Typography>
          {event.guestOfHonour?.trim() && <><Typography component="dt" variant="body2" color="text.secondary">Guest of honour</Typography><Typography component="dd" variant="body2" sx={{ m: 0 }}>{event.guestOfHonour.trim()}</Typography></>}
          {event.sponsors?.trim() && <><Typography component="dt" variant="body2" color="text.secondary">Sponsors</Typography><Typography component="dd" variant="body2" sx={{ m: 0 }}>{event.sponsors.trim()}</Typography></>}
        </Box>
      </Box>
    </Stack>
  );
}
