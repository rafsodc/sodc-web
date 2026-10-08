import TicketPreferencesFields from "../../guests/TicketPreferencesFields";
import { useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { guestCall } from "../../guests/api";
import type { EventAttendeeTicketRow } from "../utils/bookingApprovalsAdmin";
import type { TicketTypeRow } from "./sectionEventsManagerTypes";

export default function TicketAttendanceDialog({ sectionId, eventId, row, action, ticketTypes, onClose, onSaved }: {
  sectionId: string;
  eventId: string;
  row: EventAttendeeTicketRow;
  action: "edit" | "delete";
  ticketTypes: TicketTypeRow[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [attendeeName, setAttendeeName] = useState(row.attendeeName);
  const [dietaryNote, setDietaryNote] = useState(row.dietaryNote ?? "");
  const [ticketTypeId, setTicketTypeId] = useState(row.ticketTypeId ?? "");
  const [preferences, setPreferences] = useState({
    accommodationRequested: row.accommodationRequested,
    accommodationNote: row.accommodationNote ?? "",
    sitNextToUserIds: row.sitNextToUserIds ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      await guestCall("manageTicketAttendance", {
        eventId, id: row.ticketId, version: row.attendanceVersion, action,
        attendeeName, dietaryNote, ticketTypeId,
        ...(preferences.accommodationRequested !== row.accommodationRequested ? { accommodationRequested: preferences.accommodationRequested } : {}),
        ...(preferences.accommodationNote !== (row.accommodationNote ?? "") ? { accommodationNote: preferences.accommodationNote } : {}),
        ...(JSON.stringify(preferences.sitNextToUserIds) !== JSON.stringify(row.sitNextToUserIds ?? []) ? { sitNextToUserIds: preferences.sitNextToUserIds } : {}),
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save ticket. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return <Dialog open onClose={() => !busy && onClose()} fullWidth maxWidth="sm">
    <DialogTitle>{action === "delete" ? "Delete ticket?" : "Edit ticket"}</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Alert severity="info">Transactions stay unchanged. Handle any payment or refund adjustment manually.</Alert>
        {action === "delete" ? <Typography>Remove {row.attendeeName}'s ticket from attendance? Other tickets in this booking are kept.</Typography> : <>
          <TextField label="Attendee name" value={attendeeName} onChange={(e) => setAttendeeName(e.target.value)} disabled={busy} inputProps={{ maxLength: 200 }} />
          <TextField select label="Ticket type" value={ticketTypeId} onChange={(e) => setTicketTypeId(e.target.value)} disabled={busy}>
            {ticketTypes.filter((t) => t.audience === row.audience).map((t) => <MenuItem key={t.id} value={t.id}>{t.title}</MenuItem>)}
          </TextField>
          <TicketPreferencesFields sectionId={sectionId} value={preferences} onChange={setPreferences} disabled={busy} />
          <TextField label="Dietary requirements" multiline value={dietaryNote} onChange={(e) => setDietaryNote(e.target.value)} disabled={busy} inputProps={{ maxLength: 2000 }} />
        </>}
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button disabled={busy} onClick={onClose}>Cancel</Button>
      <Button disabled={busy || !attendeeName.trim() || !ticketTypeId} color={action === "delete" ? "error" : "primary"} variant="contained" onClick={() => void save()}>{action === "delete" ? "Delete ticket" : "Save"}</Button>
    </DialogActions>
  </Dialog>;
}
