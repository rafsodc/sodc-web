import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, CircularProgress, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
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
    <Paper component="section" aria-labelledby="event-attendees-heading" sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography id="event-attendees-heading" variant="h6" component="h2">Attendees</Typography>
      {isPending ? <CircularProgress aria-label="Loading attendees" /> : isError ? (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void refetch()}>Retry</Button>}>
          We could not load the attendee list. Please try again.
        </Alert>
      ) : attendees.length === 0 ? (
        <Typography>No attendees yet.</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            {attendees.length} {attendees.length === 1 ? "attendee" : "attendees"}
          </Typography>
          <TableContainer>
            <Table aria-label="Event attendees" size="small" sx={{ tableLayout: "fixed", "& th, & td": { px: { xs: 1, sm: 2 }, py: 1.5 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: "50%" }}>Name</TableCell>
                  <TableCell align="center" sx={{ overflowWrap: "anywhere" }}>Symposium</TableCell>
                  <TableCell align="center">Dinner</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {attendees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((attendee, index) => (
                  <TableRow key={`${currentPage}-${index}`} sx={{ "&:nth-of-type(odd)": { bgcolor: "action.hover" }, "&:last-child td, &:last-child th": { border: 0 } }}>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 500, overflowWrap: "anywhere" }}>
                      {"displayName" in attendee ? attendee.displayName : `${attendee.firstName} ${attendee.lastName}`}
                    </TableCell>
                    <TableCell align="center"><Chip size="small" label={attendee.includesSymposium ? "Yes" : "No"} variant={attendee.includesSymposium ? "filled" : "outlined"} /></TableCell>
                    <TableCell align="center"><Chip size="small" label={attendee.includesDinner ? "Yes" : "No"} variant={attendee.includesDinner ? "filled" : "outlined"} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <PaginationDisplay page={currentPage} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </Paper>
  );
}
