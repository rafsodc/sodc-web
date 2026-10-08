import type { TicketOrderStatus } from "@dataconnect/generated";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Paper, Typography } from "@mui/material";
import { auth } from "../../config/firebase";
import { guestCall } from "./api";
import { activeEventTicketRows, type EventAttendeeTicketRow } from "../admin/utils/bookingApprovalsAdmin";
import type { EventBookingAdminRow, TicketTypeRow } from "../admin/components/sectionEventsManagerTypes";
import { EventAttendeeTicketsSection } from "../admin/components/sectionEventsManagerSurfaces/TicketAdminSurface";
import TicketAttendanceDialog from "../admin/components/TicketAttendanceDialog";

type Tickets = { seatingUsers: Array<{ id: string; firstName: string; lastName: string }>; bookings: EventBookingAdminRow[]; orders: Array<{ id: string; status: TicketOrderStatus }>; ticketTypes: TicketTypeRow[] };

export default function MemberTicketsManager({ eventId }: { eventId: string }) {
  const client = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["managed-event-tickets", eventId, auth.currentUser?.uid],
    queryFn: () => guestCall<Tickets>("getManagedEventTickets", { eventId }), gcTime: 0,
  });
  const [editing, setEditing] = useState<{ row: EventAttendeeTicketRow; action: "edit" | "delete" } | null>(null);
  const rows = activeEventTicketRows(data?.bookings ?? [], new Map(data?.orders.map((order) => [order.id, order])),
    new Map(data?.seatingUsers?.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()])));
  return <Paper component="section" sx={{ p: 3, my: 3 }}>
    <Typography variant="h5" component="h2">Member and accompanying guest tickets</Typography>
    {isError ? <Alert severity="error" action={<Button onClick={() => void refetch()}>Retry</Button>}>Unable to load tickets.</Alert> :
      <EventAttendeeTicketsSection eventTitle="Member tickets" loading={isPending} rows={rows} onManageTicket={(row, action) => setEditing({ row, action })} />}
    {editing && <TicketAttendanceDialog key={editing.row.key} eventId={eventId} {...editing} ticketTypes={data?.ticketTypes ?? []}
      onClose={() => setEditing(null)} onSaved={async () => {
        await Promise.all([refetch(), client.invalidateQueries({ queryKey: ["eventAttendees", eventId] })]);
        setEditing(null);
      }} />}
  </Paper>;
}
