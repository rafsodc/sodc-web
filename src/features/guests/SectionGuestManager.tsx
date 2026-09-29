import OrganiserTicketTypesManager from "./OrganiserTicketTypesManager";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, MenuItem, TextField, Tabs, Tab } from "@mui/material";
import { getSectionEventsForUser } from "../../shared/utils/firebaseFunctions/sectionAccess";
import OrganiserGuestsManager from "./OrganiserGuestsManager";
export default function SectionGuestManager({
  sectionId,
}: {
  sectionId: string;
}) {
  const [tab, setTab] = useState(0);
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
          <Tabs
            value={tab}
            onChange={(_, value: number) => setTab(value)}
            aria-label="Event management"
          >
            <Tab label="Guests" />
            <Tab label="Ticket types" />
          </Tabs>
          {tab === 0 ? (
            <OrganiserGuestsManager key={eventId} eventId={eventId} />
          ) : (
            <OrganiserTicketTypesManager key={eventId} eventId={eventId} />
          )}
        </>
      )}
    </Box>
  );
}
