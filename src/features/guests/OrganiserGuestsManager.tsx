import TicketPreferencesFields from "./TicketPreferencesFields";
import { seatingPreferenceNames } from "./ticketPreferences";
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

type LinkResult = { link?: string };

function startClipboardWrite(
  result: Promise<LinkResult>,
): Promise<boolean> | null {
  if (
    typeof ClipboardItem === "undefined" ||
    typeof navigator.clipboard?.write !== "function"
  ) {
    return null;
  }
  try {
    const link = result.then(
      (value) => new Blob([value.link ?? ""], { type: "text/plain" }),
    );
    return navigator.clipboard
      .write([new ClipboardItem({ "text/plain": link })])
      .then(
        () => true,
        () => false,
      );
  } catch {
    return null;
  }
}

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
  const [seatingText, setSeatingText] = useState("");
  const [cancel, setCancel] = useState<Guest | null>(null);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(name: string, input: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setSuccess("");
    setLink("");
    try {
      const resultPromise = guestCall<LinkResult>(name, {
        ...input,
        eventId,
      });
      const shouldCopyLink = ["create", "replace-link"].includes(
        String(input.action),
      );
      const clipboardWrite = shouldCopyLink
        ? startClipboardWrite(resultPromise)
        : null;
      const result = await resultPromise;
      if (result.link) {
        const copied = clipboardWrite
          ? await clipboardWrite
          : await navigator.clipboard.writeText(result.link).then(
              () => true,
              () => false,
            );
        if (copied) {
          setSuccess(
            input.action === "create"
              ? "Guest saved and link copied."
              : "New guest link copied. The previous link no longer works.",
          );
        } else {
          setLink(result.link);
          setError(
            "The guest was saved, but the link could not be copied automatically. Copy it from the dialog.",
          );
        }
      } else {
        setSuccess(
          input.action === "create"
            ? "Guest saved. Use Copy link to create a link to send."
            : "Guest list saved.",
        );
      }
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
          {data.ticketTypes.length === 0 && (
            <Alert severity="info">
              Create an organiser/club guest ticket in Ticket types before
              adding guests.
            </Alert>
          )}
          <Button
            sx={{ my: 2 }}
            variant="contained"
            disabled={busy || data.ticketTypes.length === 0}
            onClick={() => {
              setSeatingText("");
              setGuest({
                id: crypto.randomUUID(),
                firstName: "",
                lastName: "",
                email: "",
                dietaryRequirements: "",
                ticketTypeId: data.ticketTypes[0]?.id,
                accommodationRequested: false,
                accommodationNote: "",
                seatingPreferences: [],
              });
            }}
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
                    "Accommodation",
                    "Seating preferences",
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
                    <TableCell>{g.accommodationRequested ? "Requested" : "Not requested"}
                      {g.accommodationNote && <Typography variant="body2">{g.accommodationNote}</Typography>}
                    </TableCell>
                    <TableCell>{g.seatingPreferences?.join(", ") || "None"}</TableCell>
                    <TableCell>
                      {g.cancelled ? "Cancelled" : "Reserved"} ·{" "}
                      {paymentLabel(g.paymentStatus)}
                    </TableCell>
                    <TableCell>
                      <Button
                        disabled={busy || g.cancelled}
                        onClick={() => { setGuest(g); setSeatingText((g.seatingPreferences ?? []).join("\n")); }}
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
                        Copy link
                      </Button>
                      <Button
                        disabled={busy || g.cancelled}
                        onClick={() => setCancel(g)}
                      >
                        Delete ticket
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="body2" sx={{ mt: 2 }}>
            Copy link creates a new personal link and immediately revokes the
            previous one. Paid cancellations retain their payment history and
            show any refund still required.
          </Typography>
        </>
      )}
      <Dialog open={Boolean(link)} onClose={() => setLink("")} fullWidth>
        <DialogTitle>Copy guest link</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Send this link to the guest yourself. This is the link already
            created; copying it here will not replace it again.
          </Typography>
          <TextField
            fullWidth
            label="Guest link"
            value={link}
            slotProps={{ input: { readOnly: true } }}
            onFocus={(event) => event.target.select()}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              void navigator.clipboard.writeText(link).then(
                () => {
                  setSuccess("Guest link copied.");
                  setError("");
                  setLink("");
                },
                () => setError("Please select and copy the link manually."),
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
            <TicketPreferencesFields value={{
              accommodationRequested: guest?.accommodationRequested ?? false,
              accommodationNote: guest?.accommodationNote ?? "",
              seatingPreferences: seatingText,
            }} disabled={busy} onChange={(value) => {
              setSeatingText(value.seatingPreferences);
              setGuest({ ...guest, accommodationRequested: value.accommodationRequested,
                accommodationNote: value.accommodationNote, seatingPreferences: seatingPreferenceNames(value.seatingPreferences) });
            }} />
            {guest?.version && <Alert severity="info">Transactions stay unchanged. Handle any payment or refund adjustment manually.</Alert>}
            <TextField select label="Guest ticket" value={guest?.ticketTypeId ?? ""}
              onChange={(e) => setGuest({ ...guest, ticketTypeId: e.target.value })}>
              {guest?.ticketTypeId && !data?.ticketTypes.some((t) => t.id === guest.ticketTypeId) &&
                <MenuItem value={guest.ticketTypeId}>{guest.ticketTitle}</MenuItem>}
              {data?.ticketTypes.map((t) => <MenuItem key={t.id} value={t.id}>{t.title}</MenuItem>)}
            </TextField>
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
        <DialogTitle>Delete this guest ticket?</DialogTitle>
        <DialogContent>
          This releases {cancel?.firstName} {cancel?.lastName}'s place and stops
          new checkout requests. Transactions stay unchanged. Handle any payment
          or refund adjustment manually.
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
            Delete ticket
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
