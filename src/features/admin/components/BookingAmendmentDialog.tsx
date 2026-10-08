import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";
import { TicketAudience } from "@dataconnect/generated";
import type { EventBookingAdminRow, TicketTypeRow } from "./sectionEventsManagerTypes";
import {
  amendEventBookingAsOrganiser,
  type OrganiserBookingAmendmentLine,
  type OrganiserBookingAmendmentPreview,
} from "../../../shared/utils/firebaseFunctions";

interface EditableLine extends OrganiserBookingAmendmentLine {
  key: string;
  linkedGuestName?: string | null;
}

function money(minor: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(minor / 100);
}

export default function BookingAmendmentDialog({
  open,
  booking,
  ticketTypes,
  onClose,
  onApplied,
}: {
  open: boolean;
  booking: EventBookingAdminRow | null;
  ticketTypes: TicketTypeRow[];
  onClose: () => void;
  onApplied: (message: string) => Promise<void> | void;
}) {
  const availableTypes = useMemo(
    () => ticketTypes.filter((ticketType) => ticketType.audience !== TicketAudience.ORGANISER_GUEST),
    [ticketTypes]
  );
  const ticketTypeById = useMemo(() => new Map(availableTypes.map((ticketType) => [ticketType.id, ticketType])), [availableTypes]);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [preview, setPreview] = useState<OrganiserBookingAmendmentPreview | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !booking) return;
    setLines([...booking.lines].sort((a, b) => a.sortOrder - b.sortOrder).map((line) => ({
      key: line.id,
      ticketTypeId: line.ticketType.id,
      sortOrder: line.sortOrder,
      guestUserId: line.guestUser?.id ?? null,
      guestDisplayName: line.guestDisplayName ?? null,
      linkedGuestName: line.guestUser ? `${line.guestUser.firstName} ${line.guestUser.lastName}`.trim() : null,
      dietaryNote: line.dietaryNote ?? null,
    })));
    setPreview(null);
    setPreviewToken(null);
    setIdempotencyKey(crypto.randomUUID());
    setError("");
  }, [booking, open]);

  const invalidatePreview = (next: EditableLine[]) => {
    setLines(next.map((line, index) => ({ ...line, sortOrder: index })));
    setPreview(null);
    setPreviewToken(null);
  };

  const payloadLines = lines.map(({ key: _key, linkedGuestName: _linkedGuestName, ...line }) => line);
  const requestPreview = async () => {
    if (!booking) return;
    setBusy(true);
    setError("");
    try {
      const result = await amendEventBookingAsOrganiser({
        bookingId: booking.id,
        expectedRevisionNumber: booking.revisionNumber,
        idempotencyKey,
        lines: payloadLines,
        confirm: false,
      });
      if (!result.preview || !result.previewToken) throw new Error("The amendment preview was incomplete. Please try again.");
      setPreview(result.preview);
      setPreviewToken(result.previewToken);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The amendment could not be previewed.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!booking || !previewToken) return;
    setBusy(true);
    setError("");
    try {
      const result = await amendEventBookingAsOrganiser({
        bookingId: booking.id,
        expectedRevisionNumber: booking.revisionNumber,
        idempotencyKey,
        lines: payloadLines,
        confirm: true,
        previewToken,
      });
      const refundFailed = (result.refund?.failedAmountMinor ?? 0) > 0;
      await onApplied(refundFailed
        ? "Booking amended. A refund needs attention in payment activity."
        : "Booking amended and the customer has been notified.");
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The amendment could not be applied.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Amend booking{booking ? ` — ${booking.booker.firstName} ${booking.booker.lastName}` : ""}</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Changes apply immediately. Added places remain reserved while payment is outstanding; removing every ticket cancels the booking.
        </Alert>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <Stack spacing={2}>
          {lines.map((line, index) => {
            const selected = ticketTypeById.get(line.ticketTypeId);
            return (
              <Box key={line.key} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id={`amend-ticket-${line.key}`}>Ticket type</InputLabel>
                    <Select
                      labelId={`amend-ticket-${line.key}`}
                      label="Ticket type"
                      value={line.ticketTypeId}
                      onChange={(event) => invalidatePreview(lines.map((item, itemIndex) => itemIndex === index
                        ? { ...item, ticketTypeId: event.target.value, guestUserId: null, guestDisplayName: null }
                        : item))}
                    >
                      {availableTypes.map((ticketType) => (
                        <MenuItem key={ticketType.id} value={ticketType.id}>
                          {ticketType.title} — {money(Math.round(ticketType.price * 100))}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => invalidatePreview(lines.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    Remove
                  </Button>
                </Stack>
                {selected?.audience === TicketAudience.GUEST ? (
                  <TextField
                    sx={{ mt: 2 }}
                    size="small"
                    fullWidth
                    label="Guest name"
                    placeholder={line.linkedGuestName ?? undefined}
                    value={line.guestDisplayName ?? ""}
                    onChange={(event) => invalidatePreview(lines.map((item, itemIndex) => itemIndex === index
                      ? { ...item, guestUserId: null, guestDisplayName: event.target.value }
                      : item))}
                  />
                ) : null}
                <TextField
                  sx={{ mt: 2 }}
                  size="small"
                  fullWidth
                  label="Dietary requirements"
                  value={line.dietaryNote ?? ""}
                  onChange={(event) => invalidatePreview(lines.map((item, itemIndex) => itemIndex === index
                    ? { ...item, dietaryNote: event.target.value }
                    : item))}
                />
              </Box>
            );
          })}
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            disabled={availableTypes.length === 0 || lines.length >= 100}
            onClick={() => {
              const fallback = availableTypes.find((ticketType) => ticketType.audience === TicketAudience.GUEST) ?? availableTypes[0];
              if (!fallback) return;
              invalidatePreview([...lines, {
                key: crypto.randomUUID(),
                ticketTypeId: fallback.id,
                sortOrder: lines.length,
                guestUserId: null,
                guestDisplayName: fallback.audience === TicketAudience.GUEST ? "" : null,
                dietaryNote: null,
              }]);
            }}
          >
            Add ticket
          </Button>
        </Stack>

        {preview ? (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="h6">Financial effect</Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              <Typography>Previous booking total: {money(preview.previousTotalMinor)}</Typography>
              <Typography>New booking total: {money(preview.revisedTotalMinor)}</Typography>
              <Typography>Amount paid after refunds: {money(preview.paidAfterCompletedAndPendingRefundsMinor)}</Typography>
              <Typography>Refunds already completed: {money(preview.completedRefundsMinor)}</Typography>
              <Typography>Refunds currently pending: {money(preview.pendingRefundsMinor)}</Typography>
              {preview.refundToInitiateMinor > 0 ? (
                <Alert severity="warning">A refund of {money(preview.refundToInitiateMinor)} will be started immediately.</Alert>
              ) : null}
              {preview.paymentRequiredMinor > 0 ? (
                <Alert severity="warning">Payment required—please pay as soon as possible: {money(preview.paymentRequiredMinor)}. The customer will be emailed a payment link.</Alert>
              ) : null}
              {preview.refundToInitiateMinor === 0 && preview.paymentRequiredMinor === 0 ? (
                <Alert severity="success">No further payment or refund is required.</Alert>
              ) : null}
            </Stack>
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        {!preview ? (
          <Button variant="contained" onClick={() => void requestPreview()} disabled={busy}>
            {busy ? <CircularProgress size={20} /> : "Review amendment"}
          </Button>
        ) : (
          <Button variant="contained" color="warning" onClick={() => void apply()} disabled={busy}>
            {busy ? <CircularProgress size={20} /> : "Confirm and apply amendment"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
