import { Accordion, AccordionDetails, AccordionSummary, Button, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { EventAttendeeTicketRow } from "../utils/bookingApprovalsAdmin";

export default function RemovedTicketsSection({ rows, onRestore }: {
  rows: EventAttendeeTicketRow[];
  onRestore: (row: EventAttendeeTicketRow) => void;
}) {
  if (!rows.length) return null;
  return <Accordion sx={{ mt: 2 }}>
    <AccordionSummary expandIcon={<ExpandMoreIcon />}>Removed tickets ({rows.length})</AccordionSummary>
    <AccordionDetails>
      <Typography variant="body2" sx={{ mb: 2 }}>Restore a ticket to bring someone back to the attendee list. You can change the ticket type before restoring. Transactions stay unchanged.</Typography>
      <Stack spacing={1}>
        {rows.map((row) => <Stack key={row.key} direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography>{row.attendeeName} — {row.ticketType}</Typography>
          <Button onClick={() => onRestore(row)} aria-label={`Restore ticket for ${row.attendeeName}`}>Restore</Button>
        </Stack>)}
      </Stack>
    </AccordionDetails>
  </Accordion>;
}
