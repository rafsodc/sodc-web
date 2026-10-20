import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Autocomplete, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { auth } from "../../../config/firebase";
import { MIN_SEARCH_CHARACTERS, SEARCH_DEBOUNCE_MS } from "../../../constants";
import { guestCall } from "../../guests/api";
import TicketPreferencesFields from "../../guests/TicketPreferencesFields";
import { submitEventBooking, type SubmitEventBookingLine } from "../../../shared/utils/firebaseFunctions";
import { toBookingUserFacingError } from "../../../shared/errors/bookingErrors";
import { formatGbpMajorAmount } from "../../../shared/utils/currencyDisplay";
import type { EventAttendeeTicketRow } from "../utils/bookingApprovalsAdmin";

type UserOption = { id: string; firstName: string; lastName: string; email?: string | null };
const userLabel = (user: UserOption) => `${user.firstName} ${user.lastName}${user.email ? ` — ${user.email}` : ""}`;
export interface ManagedBookingContext {
  user: UserOption & { membershipStatus: string };
  ticketTypes: Array<{ id: string; title: string; audience: "MEMBER" | "GUEST"; price: number }>;
  booking: null | {
    id: string; revisionNumber: number; approvalStatus: string;
    lines: SubmitEventBookingLine[]; sitNextToUserIds: string[];
    accommodationRequested: boolean; accommodationNote: string | null;
  };
}

export default function AddUserTicketDialog({ eventId, sectionId, onClose, onSaved, removedTickets = [], onRestore }: {
  eventId: string; sectionId: string; onClose: () => void; onSaved: () => Promise<void>;
  removedTickets?: EventAttendeeTicketRow[];
  onRestore?: (row: EventAttendeeTicketRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [user, setUser] = useState<UserOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);
  const users = useQuery({
    queryKey: ["managed-booking-users", sectionId, auth.currentUser?.uid, searchTerm],
    queryFn: () => guestCall<{ members: UserOption[]; hasMore: boolean }>("searchSectionMembers", { sectionId, searchTerm, forBooking: true }),
    enabled: searchTerm.length >= MIN_SEARCH_CHARACTERS, gcTime: 0,
  });
  const context = useQuery({
    queryKey: ["managed-booking-context", eventId, user?.id, auth.currentUser?.uid],
    queryFn: () => guestCall<ManagedBookingContext>("getManagedBookingContext", { eventId, bookerId: user!.id }),
    enabled: Boolean(user), gcTime: 0, retry: false, refetchOnWindowFocus: false,
  });
  const removedMember = context.data?.booking && removedTickets.find((row) =>
    row.bookingId === context.data.booking?.id && row.audience === "MEMBER");
  return <Dialog open onClose={() => !busy && onClose()} fullWidth maxWidth="sm">
    <DialogTitle>Add ticket for a user</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Autocomplete options={users.data?.members ?? []} value={user} disabled={busy || saved}
          inputValue={search} onInputChange={(_, value, reason) => {
            if (reason === "input" || reason === "clear") setSearch(value);
          }}
          onChange={(_, value) => { setUser(value); setSearch(value ? userLabel(value) : ""); }} filterOptions={(options) => options}
          getOptionLabel={userLabel}
          isOptionEqualToValue={(option, value) => option.id === value.id} getOptionKey={(option) => option.id}
          loading={users.isFetching}
          noOptionsText={search.trim().length < MIN_SEARCH_CHARACTERS ? "Type at least two characters" : "No matching users"}
          renderInput={(params) => <TextField {...params} label="Booking user" />} />
        {users.isError && <Alert severity="error" action={<Button onClick={() => void users.refetch()}>Retry</Button>}>Unable to search users.</Alert>}
        {users.data?.hasMore && <Typography variant="body2">Refine your search to find more users.</Typography>}
        {user && context.isPending && <CircularProgress aria-label="Loading booking" size={24} />}
        {user && context.isError && <Alert severity="error" action={<Button onClick={() => void context.refetch()}>Retry</Button>}>{toBookingUserFacingError(context.error, "booking-submit").message}</Alert>}
        {user && !context.isError && removedMember && onRestore && <Alert severity="info"
          action={<Button disabled={busy || saved} onClick={() => onRestore(removedMember)}>Restore ticket</Button>}>
          This user's member ticket was removed. Restore it to choose a different ticket type. Any payment adjustment is handled manually.
        </Alert>}
        {user && context.data && !context.isError && <AddTicketForm key={`${user.id}:${context.data.booking?.id ?? "new"}`}
          eventId={eventId} sectionId={sectionId} context={context.data} onBusy={setBusy} onCreated={() => setSaved(true)} onSaved={onSaved} />}
      </Stack>
    </DialogContent>
    <DialogActions><Button disabled={busy} onClick={onClose}>{saved ? "Close" : "Cancel"}</Button></DialogActions>
  </Dialog>;
}

function AddTicketForm({ eventId, sectionId, context, onBusy, onCreated, onSaved }: {
  eventId: string; sectionId: string; context: ManagedBookingContext;
  onBusy: (busy: boolean) => void; onCreated: () => void; onSaved: () => Promise<void>;
}) {
  const { booking, user } = context;
  const types = context.ticketTypes.filter((ticket) => ticket.audience === (booking ? "GUEST" : "MEMBER"));
  const [ticketTypeId, setTicketTypeId] = useState(types[0]?.id ?? "");
  const [guestDisplayName, setGuestDisplayName] = useState("");
  const [dietaryNote, setDietaryNote] = useState("");
  const [preferences, setPreferences] = useState({
    accommodationRequested: booking?.accommodationRequested ?? false,
    accommodationNote: booking?.accommodationNote ?? "", sitNextToUserIds: booking?.sitNextToUserIds ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef({ fingerprint: "", key: "" });
  async function save() {
    setBusy(true); onBusy(true); setError("");
    try {
      if (!saved) {
        const lines = [...(booking?.lines ?? []), {
          ticketTypeId, sortOrder: booking ? Math.max(...booking.lines.map((line) => line.sortOrder)) + 1 : 0,
          guestDisplayName: booking ? guestDisplayName.trim() : null, dietaryNote,
        }];
        const payload = { eventId, bookerId: user.id, baseBookingId: booking?.id, baseRevisionNumber: booking?.revisionNumber, lines, ...preferences };
        const fingerprint = JSON.stringify(payload);
        if (attempt.current.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
        await submitEventBooking({ ...payload, idempotencyKey: attempt.current.key });
        setSaved(true); onCreated();
      }
      try {
        await onSaved();
      } catch {
        setError("The ticket was added, but the list could not refresh. Please try refreshing again.");
      }
    } catch (e) {
      setError(toBookingUserFacingError(e, "booking-submit").message);
    } finally {
      setBusy(false); onBusy(false);
    }
  }
  return <>
    <Alert severity="info">{booking
      ? "Add a guest to this user's booking. Existing tickets and booking preferences are kept."
      : "Create the user's member ticket first, then add any guest tickets."} The user pays through their normal checkout. Guest approval rules still apply.</Alert>
    {saved ? <Alert severity="success">Ticket added. Refresh the ticket list to see the updated booking.</Alert> : <>
      {!types.length && <Alert severity="warning">No eligible {booking ? "guest" : "member"} ticket types are available for this user.</Alert>}
      <TextField select label="Ticket type" value={ticketTypeId} disabled={busy} onChange={(e) => setTicketTypeId(e.target.value)}>
        {types.map((ticket) => <MenuItem key={ticket.id} value={ticket.id}>{ticket.title} — {formatGbpMajorAmount(ticket.price)}</MenuItem>)}
      </TextField>
      {booking && <TextField label="Guest name" value={guestDisplayName} disabled={busy} inputProps={{ maxLength: 100 }} onChange={(e) => setGuestDisplayName(e.target.value)} />}
      <TextField label="Dietary requirements" value={dietaryNote} disabled={busy} multiline inputProps={{ maxLength: 500 }} onChange={(e) => setDietaryNote(e.target.value)} />
      <TicketPreferencesFields sectionId={sectionId} bookerId={user.id} value={preferences} onChange={setPreferences}
        disabled={busy || Boolean(booking)} accommodationNoteMaxLength={500} canRequestAccommodation={["REGULAR", "RESERVE"].includes(user.membershipStatus)} />
    </>}
    {error && <Alert severity="error">{error}</Alert>}
    <Button variant="contained" disabled={busy || (!saved && (!ticketTypeId || (Boolean(booking) && !guestDisplayName.trim())))} onClick={() => void save()}>
      {busy ? "Saving…" : saved ? "Refresh tickets" : "Add ticket"}
    </Button>
  </>;
}
