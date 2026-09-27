import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, CircularProgress, List, ListItem, Paper, Typography } from "@mui/material";
import { getEventAttendees } from "../../../shared/utils/firebaseFunctions/sectionAccess";
import PaginationDisplay from "../../../shared/components/PaginationDisplay";
import { auth } from "../../../config/firebase";

const PAGE_SIZE = 50;

export default function EventAttendees({ eventId }: { eventId: string }) {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["eventAttendees", eventId, auth.currentUser?.uid],
    queryFn: () => getEventAttendees(eventId),
    staleTime: 0,
    gcTime: 0,
  });
  const attendees = data?.attendees ?? [];
  const totalPages = Math.ceil(attendees.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(1, totalPages));

  return (
    <Paper component="section" aria-labelledby="event-attendees-heading" sx={{ mt: 2, p: 3 }}>
      <Typography id="event-attendees-heading" variant="h6" component="h2">Attendees</Typography>
      {isPending ? <CircularProgress aria-label="Loading attendees" /> : isError ? (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void refetch()}>Retry</Button>}>
          We could not load the attendee list. Please try again.
        </Alert>
      ) : attendees.length === 0 ? (
        <Typography>No attendees yet.</Typography>
      ) : (
        <>
          <List aria-label="Event attendees">
            {attendees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((attendee, index) => (
              <ListItem key={`${currentPage}-${index}`}>
                {"displayName" in attendee ? attendee.displayName : `${attendee.firstName} ${attendee.lastName}`}
              </ListItem>
            ))}
          </List>
          <PaginationDisplay page={currentPage} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </Paper>
  );
}
