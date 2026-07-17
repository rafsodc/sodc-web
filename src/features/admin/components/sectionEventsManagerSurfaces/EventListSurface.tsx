import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  Add as AddIcon,
  Campaign as CampaignIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import PageHeader from "../../../../shared/components/PageHeader";
import type { EventRow } from "../sectionEventsManagerTypes";
import { AdminTable } from "./adminSurfacePrimitives";

interface EventListSurfaceProps {
  sectionName: string;
  onBack: () => void;
  error: string | null;
  onDismissError: () => void;
  onAddEvent: () => void;
  onSendAnnouncement: () => void;
  loadingEvents: boolean;
  errorEvents: boolean;
  events: EventRow[];
  deletingEventId: string | null;
  onManageEventAdmin: (eventId: string) => void;
  onDeleteEvent: (event: EventRow) => void;
}
export function EventListSurface({
  sectionName,
  onBack,
  error,
  onDismissError,
  onAddEvent,
  onSendAnnouncement,
  loadingEvents,
  errorEvents,
  events,
  deletingEventId,
  onManageEventAdmin,
  onDeleteEvent,
}: EventListSurfaceProps) {
  return (
    <>
      <PageHeader title={`Events: ${sectionName}`} onBack={onBack} />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={onDismissError}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        <Button startIcon={<AddIcon />} variant="contained" onClick={onAddEvent}>
          Add event
        </Button>
        <Button startIcon={<CampaignIcon />} variant="outlined" onClick={onSendAnnouncement}>
          Send announcement
        </Button>
      </Box>
      {loadingEvents ? (
        <CircularProgress />
      ) : errorEvents ? (
        <Alert severity="error">Failed to load events.</Alert>
      ) : events.length === 0 ? (
        <Alert severity="info">No events yet. Add one to get started.</Alert>
      ) : (
        <AdminTable>
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
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.title}</TableCell>
                  <TableCell>
                    {new Date(event.startDateTime).toLocaleString()} –{" "}
                    {new Date(event.endDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>{event.location ?? "—"}</TableCell>
                  <TableCell>{event.guestOfHonour ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onManageEventAdmin(event.id)}
                      sx={{ mr: 1 }}
                    >
                      Event admin
                    </Button>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={deletingEventId === event.id}
                      onClick={() => onDeleteEvent(event)}
                    >
                      {deletingEventId === event.id ? <CircularProgress size={16} /> : <DeleteIcon />}
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
        </AdminTable>
      )}
    </>
  );
}
