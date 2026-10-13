import { useRef, useState } from "react";
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { MembershipStatus } from "@dataconnect/generated";
import { emptyEventAttendeeTicketFilters, type EventAttendeeTicketFilters } from "../utils/bookingApprovalsAdmin";
import { previewEventAnnouncementAudience, type EventAnnouncementPreview } from "../../../shared/utils/firebaseFunctions";
import { reportError } from "../../../shared/errors";

const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
const fields: Array<{ key: keyof EventAttendeeTicketFilters; label: string; options?: string[] }> = [
  { key: "attendeeName", label: "Attendee name" }, { key: "rank", label: "Rank" },
  { key: "membershipStatus", label: "Membership", options: Object.values(MembershipStatus) },
  { key: "audience", label: "Audience", options: ["MEMBER", "GUEST", "ORGANISER_GUEST"] },
  { key: "ticketType", label: "Ticket" },
  { key: "includesDinner", label: "Dinner", options: ["YES", "NO"] },
  { key: "includesSymposium", label: "Symposium", options: ["YES", "NO"] },
  { key: "accommodationRequested", label: "Accommodation", options: ["YES", "NO"] },
  { key: "approvalStatus", label: "Approval", options: ["APPROVED", "NOT_REQUIRED", "PENDING", "REJECTED"] },
  { key: "paymentState", label: "Payment", options: ["FREE", "UNPAID", "PAID", "PARTIALLY_PAID", "PAYMENT_PENDING", "REFUNDED", "PARTIALLY_REFUNDED", "REFUND_PENDING", "UNKNOWN"] },
];
export default function EventAnnouncementAudience({ sectionId, eventId, filters, onFilters, preview, onPreview, disabled }: {
  sectionId: string; eventId: string; filters: EventAttendeeTicketFilters;
  onFilters: (filters: EventAttendeeTicketFilters) => void; preview: EventAnnouncementPreview | null;
  onPreview: (preview: EventAnnouncementPreview | null) => void; disabled: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const generation = useRef(0);
  const change = (value: EventAttendeeTicketFilters) => {
    generation.current += 1;
    setLoading(false);
    setError(false);
    onPreview(null);
    onFilters(value);
  };
  const load = async () => {
    const current = ++generation.current;
    setLoading(true); setError(false); onPreview(null);
    try {
      const result = await previewEventAnnouncementAudience(sectionId, eventId, filters);
      if (current === generation.current) onPreview(result);
    } catch (caught) {
      reportError("admin.announcements.audience", caught, { sectionId, eventId });
      if (current === generation.current) setError(true);
    } finally { if (current === generation.current) setLoading(false); }
  };
  return <Box component="section" sx={{ mb: 3 }}>
    <Typography variant="h6">Event attendees</Typography>
    <Typography sx={{ mb: 2 }}>Current attendees include unpaid bookings and organiser guests. Filters combine to narrow the audience. Guests without an email use their booking contact where available.</Typography>
    <Stack direction="row" useFlexGap flexWrap="wrap" spacing={2} sx={{ mb: 2 }}>
      {fields.map((field) => <TextField key={field.key} label={field.label} size="small" sx={{ minWidth: 170 }}
        select={!!field.options} value={filters[field.key]} disabled={disabled}
        onChange={(event) => change({ ...filters, [field.key]: event.target.value })}>
        {field.options && [<MenuItem key="all" value="">All</MenuItem>, ...field.options.map((value) => <MenuItem key={value} value={value}>{label(value)}</MenuItem>)]}
      </TextField>)}
    </Stack>
    <Button disabled={disabled} onClick={() => change({ ...emptyEventAttendeeTicketFilters })}>Clear audience filters</Button>
    <Button variant="outlined" disabled={disabled || loading} onClick={() => void load()}>{loading ? "Loading audience…" : "Preview recipients"}</Button>
    {error && <Alert severity="error" sx={{ mt: 2 }}>Unable to load recipients. Preview again before sending.</Alert>}
    {preview && <>
      <Alert severity={preview.recipients.length ? "info" : "warning"} sx={{ my: 2 }}>
        {preview.eventTitle}: {preview.matchedTicketCount} matching tickets, {preview.recipients.length} unique recipients, {preview.skipped.length} skipped.
        {!preview.recipients.length && " No recipients can receive this announcement."}
      </Alert>
      <Box sx={{ maxHeight: 280, overflow: "auto" }} aria-label="Recipient preview">
        {preview.recipients.map((r) => <Typography key={r.email}>{r.name} — {r.email}</Typography>)}
        {preview.skipped.map((r, index) => <Typography color="text.secondary" key={`skipped-${index}`}>{r.name}{r.email && ` — ${r.email}`} — {r.reason === "opted_out" ? "Opted out" : "Missing contact"}</Typography>)}
      </Box>
    </>}
  </Box>;
}
