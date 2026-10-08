import MemberTicketsManager from "./MemberTicketsManager";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, MenuItem, TextField } from "@mui/material";
import { getSectionEventsForUser } from "../../shared/utils/firebaseFunctions/sectionAccess";
import OrganiserGuestsManager from "./OrganiserGuestsManager";
export default function SectionGuestManager({
  sectionId,
}: {
  sectionId: string;
}) {
  const [eventId, setEventId] = useState("");
  const { data, isError } = useQuery({
    queryKey: ["guest-section-events", sectionId],
    queryFn: () => getSectionEventsForUser(sectionId),
  });
  return (
    <Box>
      {isError && <Alert severity="error">Unable to load events.</Alert>}
      <TextField
        select
        fullWidth
        label="Event"
        value={eventId}
        onChange={(e) => setEventId(e.target.value)}
      >
        {data?.events.map((event) => (
          <MenuItem key={event.id} value={event.id}>
            {event.title}
          </MenuItem>
        ))}
      </TextField>
      {eventId && (
        <>
          <MemberTicketsManager sectionId={sectionId} key={`members:${eventId}`} eventId={eventId} />
          <OrganiserGuestsManager sectionId={sectionId} key={eventId} eventId={eventId} />
        </>
      )}
    </Box>
  );
}
