import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import type { GetMyBookingsForEventData } from "@dataconnect/generated";
import { submitGuestTicketRequest } from "../../../shared/utils/firebaseFunctions";
import { formatGbpMajorAmount } from "../../../shared/utils/currencyDisplay";

type BookingList = NonNullable<GetMyBookingsForEventData["user"]>["bookings"];
export type GuestTicketRequestRow = BookingList[number]["guestTicketRequests"][number];

/** Same shape as guest ticket options in `EventBookingWizard` (GUEST audience, eligible types). */
export interface GuestTicketTypeOption {
  id: string;
  title: string;
  price: number | null;
}

export interface AdditionalGuestRequestSectionProps {
  bookingId: string;
  eventTitle: string;
  maxGuestsWithoutModeratorApproval?: number | null;
  guestTicketTypes: GuestTicketTypeOption[];
  requests: GuestTicketRequestRow[];
  onRequestCreated: () => void | Promise<void>;
}

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending review";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
}

function statusColor(status: string): "warning" | "success" | "error" | "default" {
  switch (status) {
    case "PENDING":
      return "warning";
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "error";
    default:
      return "default";
  }
}

export default function AdditionalGuestRequestSection({
  bookingId,
  eventTitle,
  maxGuestsWithoutModeratorApproval,
  guestTicketTypes,
  requests,
  onRequestCreated,
}: AdditionalGuestRequestSectionProps) {
  const [guestTicketTypeId, setGuestTicketTypeId] = useState<string | null>(null);
  const [guestDisplayName, setGuestDisplayName] = useState("");
  const [dietaryNote, setDietaryNote] = useState("");
  const [countInput, setCountInput] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!guestTicketTypes.length) {
      setGuestTicketTypeId(null);
      return;
    }
    setGuestTicketTypeId((prev) => {
      if (prev && guestTicketTypes.some((t) => t.id === prev)) return prev;
      return guestTicketTypes[0].id;
    });
  }, [guestTicketTypes]);

  const pendingRequest = requests.find((r) => r.status === "PENDING");

  const handleSubmit = async () => {
    const n = Number.parseInt(countInput.trim(), 10);
    if (!Number.isFinite(n) || n < 1) {
      setError("Enter a whole number of at least 1.");
      return;
    }
    if (!guestTicketTypes.length || !guestTicketTypeId) {
      setError("Select a guest ticket type.");
      return;
    }
    const name = guestDisplayName.trim();
    if (!name) {
      setError("Enter the guest name as it should appear on the ticket.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const dietary = dietaryNote.trim();
      await submitGuestTicketRequest({
        bookingId,
        requestedGuestCount: n,
        guestTicketTypeId,
        guestDisplayName: name,
        dietaryNote: dietary.length > 0 ? dietary : null,
      });
      setCountInput("1");
      setGuestDisplayName("");
      setDietaryNote("");
      await onRequestCreated();
    } catch (e: unknown) {
      const msg =
        e && typeof (e as { message?: string }).message === "string"
          ? (e as { message: string }).message
          : "Could not submit request. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const hasGuestTypes = guestTicketTypes.length > 0;

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        Additional guest tickets
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Request extra guest places beyond your main booking for <strong>{eventTitle}</strong>. A moderator will
        review your request. Provide the same guest ticket type, name, and dietary details as when you add a guest
        during booking.
        {maxGuestsWithoutModeratorApproval != null && (
          <> Event policy: up to <strong>{maxGuestsWithoutModeratorApproval}</strong> extra guests may be allowed without
          moderator approval (your organiser may still apply other limits).</>
        )}
      </Typography>

      {requests.length > 0 && (
        <TableContainer sx={{ width: "100%", maxWidth: "100%", overflowX: "auto", mb: 2 }}>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell>Ticket</TableCell>
                <TableCell>Guest name</TableCell>
                <TableCell sx={{ minWidth: 120 }}>Dietary</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>Reviewed</TableCell>
                <TableCell sx={{ minWidth: 120 }}>Note</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Chip size="small" label={statusLabel(r.status)} color={statusColor(r.status)} variant="outlined" />
                  </TableCell>
                  <TableCell align="right">{r.requestedGuestCount}</TableCell>
                  <TableCell>{r.guestTicketType?.title ?? "—"}</TableCell>
                  <TableCell>{r.guestDisplayName ?? "—"}</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>{r.dietaryNote ?? "—"}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {r.reviewedAt ? new Date(r.reviewedAt).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell sx={{ minWidth: 120 }}>{r.moderatorNote ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {pendingRequest ? (
        <Alert severity="info">
          You already have a pending request for <strong>{pendingRequest.requestedGuestCount}</strong> additional guest
          ticket(s). You can submit another request after it has been reviewed.
        </Alert>
      ) : !hasGuestTypes ? (
        <Alert severity="warning">
          No guest ticket types are available for this event. You cannot request additional guest tickets until an
          organiser configures them.
        </Alert>
      ) : (
        <>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Box sx={{ pl: 1, borderLeft: 2, borderColor: "divider", mb: 2 }}>
            <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                Guest ticket type
              </Typography>
              <RadioGroup
                value={guestTicketTypeId ?? ""}
                onChange={(_, v) => setGuestTicketTypeId(v || null)}
              >
                {guestTicketTypes.map((tt) => (
                  <FormControlLabel
                    key={tt.id}
                    value={tt.id}
                    control={<Radio size="small" />}
                    label={`${tt.title} (${formatGbpMajorAmount(tt.price)})`}
                    disabled={submitting}
                  />
                ))}
              </RadioGroup>
            </FormControl>
            <TextField
              label="Guest name"
              fullWidth
              size="small"
              value={guestDisplayName}
              onChange={(e) => setGuestDisplayName(e.target.value)}
              disabled={submitting}
              helperText="Shown on the guest ticket"
              sx={{ mb: 2 }}
            />
            <TextField
              label="Dietary requirements (optional)"
              fullWidth
              size="small"
              value={dietaryNote}
              onChange={(e) => setDietaryNote(e.target.value)}
              disabled={submitting}
            />
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
            <TextField
              label="How many extra guest tickets?"
              type="number"
              size="small"
              inputProps={{ min: 1, step: 1 }}
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
              disabled={submitting}
              sx={{ minWidth: 220 }}
            />
            <Button
              variant="contained"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              sx={{ mt: 0.5, backgroundColor: "secondary.main" }}
            >
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
}
