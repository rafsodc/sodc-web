import { useState, useCallback } from "react";
import {
  Box,
  Alert,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Autocomplete,
} from "@mui/material";
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, ConfirmationNumber as TicketIcon } from "@mui/icons-material";
import { executeQuery, executeMutation } from "firebase/data-connect";
import { dataConnect } from "../../../config/firebase";
import { useGetEventsForSection, useGetEventById } from "@dataconnect/generated/react";
import {
  createEventRef,
  updateEventRef,
  deleteEventRef,
  createTicketTypeRef,
  updateTicketTypeRef,
  deleteTicketTypeRef,
  listAccessGroupsRef,
  getEventByIdRef,
} from "@dataconnect/generated";
import type { UUIDString } from "@dataconnect/generated";
import type { GetEventByIdData } from "@dataconnect/generated";
import PageHeader from "../../../shared/components/PageHeader";
import "../../../shared/components/PageContainer.css";

interface EventRow {
  id: string;
  title: string;
  location?: string | null;
  guestOfHonour?: string | null;
  startDateTime: string;
  endDateTime: string;
  bookingStartDateTime: string;
  bookingEndDateTime: string;
}

type TicketTypeRow = NonNullable<GetEventByIdData["event"]>["ticketTypes"][number];

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(s: string): string {
  return new Date(s).toISOString();
}

interface SectionEventsManagerProps {
  sectionId: string;
  sectionName: string;
  onBack: () => void;
}

export default function SectionEventsManager({ sectionId, sectionName, onBack }: SectionEventsManagerProps) {
  const { data: eventsData, isLoading: loadingEvents, isError: errorEvents, refetch: refetchEvents } = useGetEventsForSection(
    dataConnect,
    { sectionId: sectionId as UUIDString }
  );
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [guestOfHonour, setGuestOfHonour] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [bookingStartDateTime, setBookingStartDateTime] = useState("");
  const [bookingEndDateTime, setBookingEndDateTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  // Ticket types: which event we're managing ticket types for
  const [ticketTypesEventId, setTicketTypesEventId] = useState<string | null>(null);
  const { data: eventDetailData, isLoading: loadingEventDetail, refetch: refetchEventDetail } = useGetEventById(
    dataConnect,
    { id: (ticketTypesEventId ?? "00000000-0000-0000-0000-000000000000") as UUIDString },
    { enabled: !!ticketTypesEventId }
  );
  const [ticketTypeDialogOpen, setTicketTypeDialogOpen] = useState(false);
  const [editingTicketType, setEditingTicketType] = useState<TicketTypeRow | null>(null);
  const [ttTitle, setTtTitle] = useState("");
  const [ttDescription, setTtDescription] = useState("");
  const [ttPrice, setTtPrice] = useState<string>("0");
  const [ttSortOrder, setTtSortOrder] = useState<string>("0");
  const [ttAccessGroup, setTtAccessGroup] = useState<{ id: string; name: string } | null>(null);
  const [allAccessGroups, setAllAccessGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingAccessGroups, setLoadingAccessGroups] = useState(false);
  const [submittingTicketType, setSubmittingTicketType] = useState(false);
  const [deletingTicketTypeId, setDeletingTicketTypeId] = useState<string | null>(null);

  const fetchAccessGroups = useCallback(async () => {
    setLoadingAccessGroups(true);
    try {
      const ref = listAccessGroupsRef(dataConnect);
      const result = await executeQuery(ref);
      setAllAccessGroups((result.data?.accessGroups ?? []).map((ag) => ({ id: ag.id, name: ag.name })));
    } catch {
      setAllAccessGroups([]);
    } finally {
      setLoadingAccessGroups(false);
    }
  }, []);

  const openEventDialog = (event?: EventRow | null) => {
    if (event) {
      setEditingEvent(event);
      setTitle(event.title);
      setLocation(event.location ?? "");
      setGuestOfHonour(event.guestOfHonour ?? "");
      setStartDateTime(toDatetimeLocal(event.startDateTime));
      setEndDateTime(toDatetimeLocal(event.endDateTime));
      setBookingStartDateTime(toDatetimeLocal(event.bookingStartDateTime));
      setBookingEndDateTime(toDatetimeLocal(event.bookingEndDateTime));
    } else {
      setEditingEvent(null);
      setTitle("");
      setLocation("");
      setGuestOfHonour("");
      const now = new Date();
      setStartDateTime(toDatetimeLocal(now.toISOString()));
      setEndDateTime(toDatetimeLocal(now.toISOString()));
      setBookingStartDateTime(toDatetimeLocal(now.toISOString()));
      setBookingEndDateTime(toDatetimeLocal(now.toISOString()));
    }
    setError(null);
    setEventDialogOpen(true);
  };

  const handleEventSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (editingEvent) {
        await executeMutation(
          updateEventRef(dataConnect, {
            id: editingEvent.id,
            title: title.trim(),
            location: location.trim() || null,
            guestOfHonour: guestOfHonour.trim() || null,
            startDateTime: fromDatetimeLocal(startDateTime),
            endDateTime: fromDatetimeLocal(endDateTime),
            bookingStartDateTime: fromDatetimeLocal(bookingStartDateTime),
            bookingEndDateTime: fromDatetimeLocal(bookingEndDateTime),
          })
        );
      } else {
        await executeMutation(
          createEventRef(dataConnect, {
            sectionId: sectionId as UUIDString,
            title: title.trim(),
            location: location.trim() || null,
            guestOfHonour: guestOfHonour.trim() || null,
            startDateTime: fromDatetimeLocal(startDateTime),
            endDateTime: fromDatetimeLocal(endDateTime),
            bookingStartDateTime: fromDatetimeLocal(bookingStartDateTime),
            bookingEndDateTime: fromDatetimeLocal(bookingEndDateTime),
          })
        );
      }
      refetchEvents();
      setEventDialogOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (event: EventRow) => {
    if (!confirm(`Delete event "${event.title}"? This will also remove all ticket types for this event.`)) return;
    setDeletingEventId(event.id);
    setError(null);
    try {
      const detailResult = await executeQuery(getEventByIdRef(dataConnect, { id: event.id as UUIDString }));
      const ticketTypes = detailResult.data?.event?.ticketTypes ?? [];
      for (const tt of ticketTypes) {
        await executeMutation(deleteTicketTypeRef(dataConnect, { id: tt.id }));
      }
      await executeMutation(deleteEventRef(dataConnect, { id: event.id }));
      refetchEvents();
      if (ticketTypesEventId === event.id) setTicketTypesEventId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setDeletingEventId(null);
    }
  };

  const openTicketTypeDialog = (ticketType?: TicketTypeRow) => {
    if (ticketType) {
      setEditingTicketType(ticketType);
      setTtTitle(ticketType.title);
      setTtDescription(ticketType.description ?? "");
      setTtPrice(String(ticketType.price));
      setTtSortOrder(String(ticketType.sortOrder));
      setTtAccessGroup(ticketType.accessGroup ? { id: ticketType.accessGroup.id, name: ticketType.accessGroup.name } : null);
    } else {
      setEditingTicketType(null);
      setTtTitle("");
      setTtDescription("");
      setTtPrice("0");
      setTtSortOrder(String((eventDetailData?.event?.ticketTypes?.length ?? 0)));
      setTtAccessGroup(null);
    }
    setTicketTypeDialogOpen(true);
    fetchAccessGroups();
  };

  const handleTicketTypeSubmit = async () => {
    if (!ticketTypesEventId || !ttTitle.trim() || !ttAccessGroup) {
      setError("Title and access group are required");
      return;
    }
    const priceNum = parseFloat(ttPrice);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError("Price must be a non-negative number");
      return;
    }
    const sortOrderNum = parseInt(ttSortOrder, 10) || 0;
    setSubmittingTicketType(true);
    setError(null);
    try {
      if (editingTicketType) {
        await executeMutation(
          updateTicketTypeRef(dataConnect, {
            id: editingTicketType.id,
            accessGroupId: ttAccessGroup.id as UUIDString,
            title: ttTitle.trim(),
            description: ttDescription.trim() || null,
            price: priceNum,
            sortOrder: sortOrderNum,
          })
        );
      } else {
        await executeMutation(
          createTicketTypeRef(dataConnect, {
            eventId: ticketTypesEventId as UUIDString,
            accessGroupId: ttAccessGroup.id as UUIDString,
            title: ttTitle.trim(),
            description: ttDescription.trim() || null,
            price: priceNum,
            sortOrder: sortOrderNum,
          })
        );
      }
      refetchEventDetail();
      refetchEvents();
      setTicketTypeDialogOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save ticket type");
    } finally {
      setSubmittingTicketType(false);
    }
  };

  const handleDeleteTicketType = async (id: string) => {
    if (!confirm("Delete this ticket type?")) return;
    setDeletingTicketTypeId(id);
    setError(null);
    try {
      await executeMutation(deleteTicketTypeRef(dataConnect, { id }));
      refetchEventDetail();
      refetchEvents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete ticket type");
    } finally {
      setDeletingTicketTypeId(null);
    }
  };

  const events: EventRow[] = eventsData?.section?.events ?? [];

  if (ticketTypesEventId) {
    const event = events.find((e) => e.id === ticketTypesEventId);
    const ticketTypes = eventDetailData?.event?.ticketTypes ?? [];
    return (
      <Box className="page-container" sx={{ backgroundColor: "#fafafa", minHeight: "100vh" }}>
        <PageHeader title={`Ticket types: ${event?.title ?? "Event"}`} onBack={() => setTicketTypesEventId(null)} />
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => openTicketTypeDialog()} sx={{ mb: 2 }}>
          Add ticket type
        </Button>
        {loadingEventDetail ? (
          <CircularProgress />
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Access group</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ticketTypes.map((tt) => (
                  <TableRow key={tt.id}>
                    <TableCell>{tt.title}</TableCell>
                    <TableCell>{tt.description ?? "—"}</TableCell>
                    <TableCell>{tt.price}</TableCell>
                    <TableCell>{tt.accessGroup?.name ?? "—"}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openTicketTypeDialog(tt)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        disabled={deletingTicketTypeId === tt.id}
                        onClick={() => handleDeleteTicketType(tt.id)}
                      >
                        {deletingTicketTypeId === tt.id ? <CircularProgress size={16} /> : <DeleteIcon />}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Dialog open={ticketTypeDialogOpen} onClose={() => setTicketTypeDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editingTicketType ? "Edit ticket type" : "Add ticket type"}</DialogTitle>
          <DialogContent>
            <TextField label="Title" fullWidth value={ttTitle} onChange={(e) => setTtTitle(e.target.value)} margin="dense" required />
            <TextField label="Description" fullWidth value={ttDescription} onChange={(e) => setTtDescription(e.target.value)} margin="dense" multiline />
            <TextField label="Price" type="number" fullWidth value={ttPrice} onChange={(e) => setTtPrice(e.target.value)} margin="dense" inputProps={{ min: 0, step: 0.01 }} />
            <TextField label="Sort order" type="number" fullWidth value={ttSortOrder} onChange={(e) => setTtSortOrder(e.target.value)} margin="dense" />
            <Autocomplete
              options={allAccessGroups}
              getOptionLabel={(o) => o.name}
              value={ttAccessGroup}
              onChange={(_, v) => setTtAccessGroup(v)}
              loading={loadingAccessGroups}
              renderInput={(params) => <TextField {...params} label="Access group" required margin="dense" />}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTicketTypeDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleTicketTypeSubmit} disabled={submittingTicketType || !ttTitle.trim() || !ttAccessGroup}>
              {submittingTicketType ? <CircularProgress size={20} /> : "Save"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  return (
    <Box className="page-container" sx={{ backgroundColor: "#fafafa", minHeight: "100vh" }}>
      <PageHeader title={`Events: ${sectionName}`} onBack={onBack} />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Button startIcon={<AddIcon />} variant="contained" onClick={() => openEventDialog()} sx={{ mb: 2 }}>
        Add event
      </Button>
      {loadingEvents ? (
        <CircularProgress />
      ) : errorEvents ? (
        <Alert severity="error">Failed to load events.</Alert>
      ) : events.length === 0 ? (
        <Alert severity="info">No events yet. Add one to get started.</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Date / time</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Guest of honour</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell>{ev.title}</TableCell>
                  <TableCell>
                    {new Date(ev.startDateTime).toLocaleString()} – {new Date(ev.endDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>{ev.location ?? "—"}</TableCell>
                  <TableCell>{ev.guestOfHonour ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<TicketIcon />} onClick={() => setTicketTypesEventId(ev.id)}>
                      Ticket types
                    </Button>
                    <IconButton size="small" onClick={() => openEventDialog(ev)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={deletingEventId === ev.id}
                      onClick={() => handleDeleteEvent(ev)}
                    >
                      {deletingEventId === ev.id ? <CircularProgress size={16} /> : <DeleteIcon />}
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={eventDialogOpen} onClose={() => setEventDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEvent ? "Edit event" : "Add event"}</DialogTitle>
        <DialogContent>
          <TextField label="Title" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} margin="dense" required />
          <TextField label="Location" fullWidth value={location} onChange={(e) => setLocation(e.target.value)} margin="dense" />
          <TextField label="Guest of honour" fullWidth value={guestOfHonour} onChange={(e) => setGuestOfHonour(e.target.value)} margin="dense" />
          <TextField label="Start date/time" type="datetime-local" fullWidth value={startDateTime} onChange={(e) => setStartDateTime(e.target.value)} margin="dense" InputLabelProps={{ shrink: true }} />
          <TextField label="End date/time" type="datetime-local" fullWidth value={endDateTime} onChange={(e) => setEndDateTime(e.target.value)} margin="dense" InputLabelProps={{ shrink: true }} />
          <TextField label="Booking window start" type="datetime-local" fullWidth value={bookingStartDateTime} onChange={(e) => setBookingStartDateTime(e.target.value)} margin="dense" InputLabelProps={{ shrink: true }} />
          <TextField label="Booking window end" type="datetime-local" fullWidth value={bookingEndDateTime} onChange={(e) => setBookingEndDateTime(e.target.value)} margin="dense" InputLabelProps={{ shrink: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEventDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEventSubmit} disabled={submitting || !title.trim()}>
            {submitting ? <CircularProgress size={20} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
