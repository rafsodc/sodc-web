import { organiserGuestTicketRows } from "./reporting";
import { eventTicketRowsCsv } from "../admin/utils/bookingApprovalsAdmin";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { auth } from "../../config/firebase";
import {
  guestCall,
  money,
  paymentLabel,
  type Guest,
  type GuestList,
} from "./api";

export default function OrganiserGuestsManager({
  eventId,
}: {
  eventId: string;
}) {
  const client = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["organiser-guests", eventId, auth.currentUser?.uid],
    queryFn: () => guestCall<GuestList>("getOrganiserGuestList", { eventId }),
    gcTime: 0,
  });
  const [guest, setGuest] = useState<Partial<Guest> | null>(null);
  const [cancel, setCancel] = useState<Guest | null>(null);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(name: string, input: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await guestCall<{ link?: string }>(name, {
        ...input,
        eventId,
      });
      if (result.link) setLink(result.link);
      setSuccess(
        input.action === "create" && !result.link
          ? "Guest saved. Use Replace link to get a link to send."
          : "Guest list saved.",
      );
      setGuest(null);
      setCancel(null);
      await refetch();
      await client.invalidateQueries({ queryKey: ["eventAttendees", eventId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      await refetch();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Paper component="section" sx={{ p: 3, my: 3 }}>
      <Typography variant="h5" component="h2">
        Organiser guests
      </Typography>
      <Typography sx={{ mb: 2 }}>
        Places remain reserved until you cancel them, including unpaid tickets.
        Copy each personal link and send it yourself. Links do not expire.
      </Typography>
      {success && (
        <Alert severity="success" onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}
      <Button disabled={busy} onClick={() => void refetch()}>
        Refresh guest list
      </Button>
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {isPending ? (
        <Typography>Loading organiser guests…</Typography>
      ) : isError || !data ? (
        <Alert
          severity="error"
          action={<Button onClick={() => void refetch()}>Retry</Button>}
        >
          Unable to load organiser guests.
        </Alert>
      ) : (
        <>
          {!data.ticketTypes.some((t) => t.active) && (
            <Alert severity="info">
              Create an organiser/club guest ticket in Ticket types before
              adding guests.
            </Alert>
          )}
          <Button
            sx={{ my: 2 }}
            variant="contained"
            disabled={busy || !data.ticketTypes.some((t) => t.active)}
            onClick={() =>
              setGuest({
                id: crypto.randomUUID(),
                firstName: "",
                lastName: "",
                email: "",
                dietaryRequirements: "",
                ticketTypeId: data.ticketTypes.find((t) => t.active)?.id,
              })
            }
          >
            Add guest
          </Button>
          <Typography>
            {data.guests.filter((g) => !g.cancelled).length} reserved places ·{" "}
            {
              data.guests.filter((g) => !g.cancelled && g.includesSymposium)
                .length
            }{" "}
            symposium ·{" "}
            {data.guests.filter((g) => !g.cancelled && g.includesDinner).length}{" "}
            dinner
          </Typography>
          <Button
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob(
                  [eventTicketRowsCsv(organiserGuestTicketRows(data.guests))],
                  { type: "text/csv;charset=utf-8" },
                ),
              );
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = "organiser-guest-tickets.csv";
              anchor.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export guest tickets
          </Button>
          <TableContainer>
            <Table size="small" aria-label="Organiser guests">
              <TableHead>
                <TableRow>
                  {[
                    "Guest",
                    "Ticket",
                    "Dietary requirements",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <TableCell key={h}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.guests.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      {g.firstName} {g.lastName}
                      {g.email && (
                        <Typography variant="body2">{g.email}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {g.ticketTitle} · {money(g.priceMinor)}
                      <Typography variant="body2">
                        Symposium: {g.includesSymposium ? "Yes" : "No"} ·
                        Dinner: {g.includesDinner ? "Yes" : "No"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {g.dietaryRequirements || "None entered"}
                    </TableCell>
                    <TableCell>
                      {g.cancelled ? "Cancelled" : "Reserved"} ·{" "}
                      {paymentLabel(g.paymentStatus)}
                    </TableCell>
                    <TableCell>
                      <Button
                        disabled={busy || g.cancelled}
                        onClick={() => setGuest(g)}
                      >
                        Edit guest
                      </Button>
                      <Button
                        disabled={busy || g.cancelled}
                        onClick={() =>
                          void run("manageOrganiserGuest", {
                            action: "replace-link",
                            id: g.id,
                            version: g.version,
                          })
                        }
                      >
                        Replace link
                      </Button>
                      <Button
                        disabled={busy || g.cancelled}
                        onClick={() => setCancel(g)}
                      >
                        Cancel guest
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="body2" sx={{ mt: 2 }}>
            Replacing a link immediately revokes the previous link. Paid
            cancellations retain their payment history and show any refund still
            required.
          </Typography>
        </>
      )}
      <Dialog open={Boolean(link)} onClose={() => setLink("")} fullWidth>
        <DialogTitle>Copy guest link</DialogTitle>
        <DialogContent>
          <Typography>
            Send this link to the guest yourself. It will only be shown here;
            you can replace it later if needed.
          </Typography>
          <TextField
            fullWidth
            value={link}
            slotProps={{ input: { readOnly: true } }}
            onFocus={(e) => e.target.select()}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              void navigator.clipboard
                .writeText(link)
                .catch(() =>
                  setError("Please select and copy the link manually."),
                );
            }}
          >
            Copy link
          </Button>
          <Button onClick={() => setLink("")}>Done</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(guest)}
        onClose={() => !busy && setGuest(null)}
        fullWidth
      >
        <DialogTitle>{guest?.version ? "Edit guest" : "Add guest"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {(
              [
                ["firstName", "First name"],
                ["lastName", "Last name"],
                ["email", "Email (optional)"],
                ["dietaryRequirements", "Dietary requirements"],
              ] as const
            ).map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                value={guest?.[key] ?? ""}
                type={key === "email" ? "email" : "text"}
                multiline={key === "dietaryRequirements"}
                onChange={(e) => setGuest({ ...guest, [key]: e.target.value })}
              />
            ))}
            {guest?.version &&
              !["UNPAID", "FREE"].includes(guest.paymentStatus ?? "") && (
                <Typography variant="body2">
                  To change a paid ticket, cancel this reservation and add a new
                  one. Existing payment and refund history will be retained.
                </Typography>
              )}
            {(!guest?.version ||
              ["UNPAID", "FREE"].includes(guest.paymentStatus ?? "")) && (
              <TextField
                select
                label="Guest ticket"
                value={guest?.ticketTypeId ?? ""}
                onChange={(e) =>
                  setGuest({ ...guest, ticketTypeId: e.target.value })
                }
              >
                {data?.ticketTypes
                  .filter((t) => t.active || t.id === guest?.ticketTypeId)
                  .map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.title} · {money(t.priceMinor)}
                    </MenuItem>
                  ))}
              </TextField>
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setGuest(null)}>
            Back
          </Button>
          <Button
            disabled={
              busy ||
              !guest?.firstName?.trim() ||
              !guest?.lastName?.trim()
            }
            onClick={() =>
              void run("manageOrganiserGuest", {
                ...guest,
                action: guest?.version ? "edit" : "create",
              })
            }
          >
            Save guest
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(cancel)} onClose={() => !busy && setCancel(null)}>
        <DialogTitle>Cancel this guest?</DialogTitle>
        <DialogContent>
          This releases {cancel?.firstName} {cancel?.lastName}'s place and stops
          further payment. Any existing payment remains recorded; cancellation
          does not issue an automatic refund.
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setCancel(null)}>
            Keep reservation
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void run("manageOrganiserGuest", {
                action: "cancel",
                id: cancel!.id,
                version: cancel!.version,
              })
            }
          >
            Confirm cancellation
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
