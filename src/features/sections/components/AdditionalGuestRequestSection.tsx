import { useEffect, useRef, useState } from "react";
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
import { submitAdditionalGuestTicketRequests } from "../../../shared/utils/firebaseFunctions";
import { reportError, toBookingUserFacingError } from "../../../shared/errors";
import { formatGbpMajorAmount } from "../../../shared/utils/currencyDisplay";
import {
  EMPTY_GUEST_DETAIL,
  guestDetailsValidationError,
  resizeExtraGuestDetails,
  type ExtraGuestDetailRow,
} from "../hooks/bookingWizardModel";

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
  const [countInput, setCountInput] = useState("1");
  const [guestDetails, setGuestDetails] = useState<ExtraGuestDetailRow[]>([{ ...EMPTY_GUEST_DETAIL }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionKeyRef = useRef<string | null>(null);

  const parsedCount = Number.parseInt(countInput.trim(), 10);
  const count = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 0;

  useEffect(() => {
    setGuestDetails((previous) => resizeExtraGuestDetails(previous, count, "additionalGuests"));
  }, [count]);

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

  const pendingRequests = requests.filter((r) => r.status === "PENDING");

  const handleSubmit = async () => {
    const validationError = guestDetailsValidationError({
      mode: "additionalGuests",
      includeGuest: false,
      guestTicketTypeId: null,
      guestDisplayName: "",
      extraGuestRequestCount: count,
      extraGuestTicketTypeId: guestTicketTypeId,
      extraGuestDetails: guestDetails,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      submissionKeyRef.current ??= crypto.randomUUID();
      await submitAdditionalGuestTicketRequests({
        bookingId,
        guestTicketTypeId: guestTicketTypeId!,
        idempotencyKey: submissionKeyRef.current,
        guests: guestDetails.slice(0, count).map((guest) => ({
          guestDisplayName: guest.guestDisplayName.trim(),
          dietaryNote: guest.dietaryNote.trim() || null,
        })),
      });
      setCountInput("1");
      setGuestDetails([{ ...EMPTY_GUEST_DETAIL }]);
      submissionKeyRef.current = null;
      await onRequestCreated();
    } catch (e: unknown) {
      reportError("booking.guest-request", e);
      setError(toBookingUserFacingError(e, "guest-request").message);
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

      {pendingRequests.length > 0 ? (
        <Alert severity="info">
          You already have {pendingRequests.length} pending request{pendingRequests.length > 1 ? "s" : ""} for
          additional guest tickets. You can submit another request after{" "}
          {pendingRequests.length > 1 ? "they have" : "it has"} been reviewed.
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
              label="How many extra guest tickets?"
              type="number"
              size="small"
              inputProps={{ min: 1, step: 1 }}
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
              disabled={submitting}
              sx={{ minWidth: 220, mb: 2 }}
            />

            {Array.from({ length: count }, (_, index) => {
              const guest = guestDetails[index] ?? EMPTY_GUEST_DETAIL;
              return (
                <Box key={index} sx={{ mb: index < count - 1 ? 2 : 0 }}>
                  {count > 1 && (
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                      Guest {index + 1}
                    </Typography>
                  )}
                  <TextField
                    label="Guest name"
                    fullWidth
                    size="small"
                    value={guest.guestDisplayName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setGuestDetails((prev) => {
                        const next = [...prev];
                        next[index] = { ...(next[index] ?? EMPTY_GUEST_DETAIL), guestDisplayName: value };
                        return next;
                      });
                    }}
                    disabled={submitting}
                    helperText="Shown on the guest ticket"
                  />
                  <TextField
                    label="Dietary requirements (optional)"
                    fullWidth
                    size="small"
                    value={guest.dietaryNote}
                    onChange={(e) => {
                      const value = e.target.value;
                      setGuestDetails((prev) => {
                        const next = [...prev];
                        next[index] = { ...(next[index] ?? EMPTY_GUEST_DETAIL), dietaryNote: value };
                        return next;
                      });
                    }}
                    disabled={submitting}
                    sx={{ mt: 1.5 }}
                  />
                </Box>
              );
            })}
          </Box>
          <Button
            variant="contained"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            sx={{ backgroundColor: "secondary.main", color: "secondary.contrastText" }}
          >
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
        </>
      )}
    </Paper>
  );
}
