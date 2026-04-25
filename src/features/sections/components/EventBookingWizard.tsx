import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import {
  useGetCurrentUser,
  useGetMyBookingsForEvent,
  useGetUserAccessGroups,
} from "@dataconnect/generated/react";
import { dataConnect } from "../../../config/firebase";
import { colors } from "../../../config/colors";
import type { GetEventByIdData, GetSectionByIdData, UUIDString } from "@dataconnect/generated";
import { BookingStatus, TicketAudience } from "@dataconnect/generated";
import { getSectionMembersMerged, submitEventBooking } from "../../../shared/utils/firebaseFunctions";
import { toCanonicalUuid } from "../../../shared/utils/uuid";
import { evaluateBookingGatePreview, userMatchesUserGroup } from "../utils/bookingEligibility";
import AdditionalGuestRequestSection from "./AdditionalGuestRequestSection";

type EventDetail = NonNullable<GetEventByIdData["event"]>;
type SectionDetail = NonNullable<GetSectionByIdData["section"]>;

const STEPS = ["Your ticket", "Guest (optional)", "Summary"];

function extractCallableErrorCode(err: unknown): string | undefined {
  const e = err as {
    code?: string;
    message?: string;
    details?: { code?: string };
    customData?: { code?: string };
  };
  return e?.details?.code ?? e?.customData?.code;
}

export interface EventBookingWizardProps {
  section: SectionDetail;
  event: EventDetail;
  onBookingComplete?: () => void;
}

export default function EventBookingWizard({ section, event, onBookingComplete }: EventBookingWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [memberTicketTypeId, setMemberTicketTypeId] = useState<string | null>(null);
  const [includeGuest, setIncludeGuest] = useState(false);
  const [guestTicketTypeId, setGuestTicketTypeId] = useState<string | null>(null);
  const [guestDisplayName, setGuestDisplayName] = useState("");
  const [bookerDietaryNote, setBookerDietaryNote] = useState("");
  const [sitNextToUserIds, setSitNextToUserIds] = useState<string[]>([]);
  const [accommodationRequested, setAccommodationRequested] = useState(false);
  const [accommodationNote, setAccommodationNote] = useState("");
  const [seatingOptions, setSeatingOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const idempotencyKeyRef = useRef<string | null>(null);

  const { data: currentUserData, isLoading: loadingProfile } = useGetCurrentUser(dataConnect, {});
  const { data: accessData } = useGetUserAccessGroups(dataConnect, {});
  const {
    data: myBookingsData,
    isLoading: loadingBookings,
    refetch: refetchMyBookings,
  } = useGetMyBookingsForEvent(dataConnect, { eventId: event.id as UUIDString });

  const membershipStatus = currentUserData?.user?.membershipStatus;

  const explicitGroupIds = useMemo(() => {
    const ids = accessData?.user?.userGroups?.map((g) => g.userGroup.id) ?? [];
    return new Set(ids);
  }, [accessData]);

  const gate = useMemo(() => {
    if (!membershipStatus) {
      return { ok: false as const, message: "Your profile must include a membership status before booking." };
    }
    return evaluateBookingGatePreview({
      purposeLinks: section.purposeLinks ?? [],
      membershipStatus,
      explicitGroupIds,
      bookingStartDateTime: event.bookingStartDateTime,
      bookingEndDateTime: event.bookingEndDateTime,
    });
  }, [membershipStatus, section.purposeLinks, explicitGroupIds, event]);

  const memberTicketTypes = useMemo(() => {
    if (!membershipStatus || gate.ok !== true) return [];
    return (event.ticketTypes ?? []).filter(
      (tt) =>
        tt.audience === TicketAudience.MEMBER &&
        userMatchesUserGroup(membershipStatus, tt.userGroup, explicitGroupIds)
    );
  }, [event.ticketTypes, membershipStatus, explicitGroupIds, gate]);

  const guestTicketTypes = useMemo(() => {
    if (!membershipStatus || gate.ok !== true) return [];
    return (event.ticketTypes ?? []).filter(
      (tt) =>
        tt.audience === TicketAudience.GUEST &&
        userMatchesUserGroup(membershipStatus, tt.userGroup, explicitGroupIds)
    );
  }, [event.ticketTypes, membershipStatus, explicitGroupIds, gate]);

  const existingTerminalBooking = useMemo(() => {
    const list = myBookingsData?.user?.bookings ?? [];
    return list.find((b) => b.status === BookingStatus.SUBMITTED || b.status === BookingStatus.CONFIRMED);
  }, [myBookingsData]);

  /** Server draft for this event — reuse its idempotency key after refresh (new random UUID would conflict). */
  const existingDraft = useMemo(() => {
    const list = myBookingsData?.user?.bookings ?? [];
    return list.find((b) => b.status === BookingStatus.DRAFT) ?? null;
  }, [myBookingsData]);

  useEffect(() => {
    const raw = existingDraft?.clientSubmissionKey;
    if (!raw || typeof raw !== "string" || !raw.trim()) {
      return;
    }
    try {
      idempotencyKeyRef.current = toCanonicalUuid(raw.trim());
    } catch {
      // leave ref unchanged if stored value is malformed
    }
  }, [existingDraft?.id, existingDraft?.clientSubmissionKey]);

  const selectedMember = memberTicketTypes.find((t) => t.id === memberTicketTypeId);
  const selectedGuest = guestTicketTypes.find((t) => t.id === guestTicketTypeId);
  const canRequestAccommodation = membershipStatus === "REGULAR" || membershipStatus === "RESERVE";

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const merged = await getSectionMembersMerged(section.id);
        if (!alive) return;
        const options = (merged.members ?? [])
          .filter((m) => m.id !== currentUserData?.user?.id)
          .map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName}` }));
        setSeatingOptions(options);
      } catch {
        if (alive) setSeatingOptions([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [section.id, currentUserData?.user?.id]);

  const resetWizardState = useCallback(() => {
    setActiveStep(0);
    setMemberTicketTypeId(null);
    setIncludeGuest(false);
    setGuestTicketTypeId(null);
    setGuestDisplayName("");
    setBookerDietaryNote("");
    setSitNextToUserIds([]);
    setAccommodationRequested(false);
    setAccommodationNote("");
    setSubmitError(null);
    // Keep idempotency key when a server draft exists; otherwise clear so the next submit starts fresh.
    if (!existingDraft?.clientSubmissionKey?.trim()) {
      idempotencyKeyRef.current = null;
    }
  }, [existingDraft?.clientSubmissionKey]);

  const handleNext = () => {
    setSubmitError(null);
    if (activeStep === 0) {
      if (!memberTicketTypeId) {
        setSubmitError("Choose a ticket for yourself.");
        return;
      }
      setActiveStep(1);
      return;
    }
    if (activeStep === 1) {
      if (includeGuest) {
        if (!guestTicketTypeId) {
          setSubmitError("Choose a guest ticket type, or turn off the guest option.");
          return;
        }
        if (!guestDisplayName.trim()) {
          setSubmitError("Enter a name for your guest.");
          return;
        }
      }
      setActiveStep(2);
    }
  };

  const handleBack = () => {
    setSubmitError(null);
    if (activeStep > 0) {
      setActiveStep((s) => s - 1);
    }
  };

  const handleConfirm = async () => {
    if (!memberTicketTypeId || !membershipStatus || gate.ok !== true) return;

    setSubmitting(true);
    setSubmitError(null);

    if (!idempotencyKeyRef.current) {
      const fromDraft = existingDraft?.clientSubmissionKey?.trim();
      if (fromDraft) {
        try {
          idempotencyKeyRef.current = toCanonicalUuid(fromDraft);
        } catch {
          idempotencyKeyRef.current = crypto.randomUUID();
        }
      } else {
        idempotencyKeyRef.current = crypto.randomUUID();
      }
    }
    const idempotencyKey = idempotencyKeyRef.current;

    const lines: {
      ticketTypeId: string;
      sortOrder: number;
      guestUserId: string | null;
      guestDisplayName: string | null;
      dietaryNote: string | null;
    }[] = [
      {
        ticketTypeId: memberTicketTypeId,
        sortOrder: 0,
        guestUserId: null,
        guestDisplayName: null,
        dietaryNote: null,
      },
    ];

    if (includeGuest && guestTicketTypeId) {
      lines.push({
        ticketTypeId: guestTicketTypeId,
        sortOrder: 1,
        guestUserId: null,
        guestDisplayName: guestDisplayName.trim(),
        dietaryNote: null,
      });
    }

    try {
      await submitEventBooking({
        idempotencyKey,
        eventId: event.id,
        lines,
        bookerDietaryNote,
        sitNextToUserIds,
        accommodationRequested,
        accommodationNote,
      });
      await refetchMyBookings();
      onBookingComplete?.();
    } catch (err: unknown) {
      const code = extractCallableErrorCode(err);
      const message =
        err && typeof (err as { message?: string }).message === "string"
          ? (err as { message: string }).message
          : "Booking failed. Please try again.";
      if (code === "BOOKING_ALREADY_SUBMITTED") {
        setSubmitError("You already have a submitted booking for this event.");
        await refetchMyBookings();
      } else if (code === "OUTSIDE_BOOKING_WINDOW") {
        setSubmitError("The booking window is closed.");
      } else if (code === "IDEMPOTENCY_DRAFT_CONFLICT") {
        const refreshed = await refetchMyBookings();
        const bookings = refreshed.data?.user?.bookings ?? [];
        const draft = bookings.find((b) => b.status === BookingStatus.DRAFT);
        const raw = draft?.clientSubmissionKey?.trim();
        if (raw) {
          try {
            idempotencyKeyRef.current = toCanonicalUuid(raw);
            setSubmitError(
              "Your in-progress booking was found. Review your choices and press Confirm booking again."
            );
          } catch {
            setSubmitError(
              "A draft booking is in progress but could not be resumed. Please contact support if this continues."
            );
          }
        } else {
          setSubmitError(
            "A draft booking exists without a resume key. Please contact a moderator to clear it, or try again later."
          );
        }
      } else {
        setSubmitError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProfile || loadingBookings) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!membershipStatus) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Complete your membership profile before booking events.
      </Alert>
    );
  }

  if (gate.ok !== true) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        {gate.message}
      </Alert>
    );
  }

  if (existingTerminalBooking) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="success">
          You already have a booking for this event ({existingTerminalBooking.status.toLowerCase()}).
        </Alert>
        <AdditionalGuestRequestSection
          bookingId={existingTerminalBooking.id}
          eventTitle={event.title}
          maxGuestsWithoutModeratorApproval={event.maxGuestsWithoutModeratorApproval}
          guestTicketTypes={guestTicketTypes.map((tt) => ({
            id: tt.id,
            title: tt.title,
            price: tt.price ?? null,
          }))}
          requests={existingTerminalBooking.guestTicketRequests ?? []}
          onRequestCreated={() => void refetchMyBookings()}
        />
      </Box>
    );
  }

  if (!memberTicketTypes.length) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        There are no member ticket types you are eligible for. If you believe this is wrong, contact a moderator.
      </Alert>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
        Book this event
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        {activeStep === 0 && (
          <FormControl component="fieldset" fullWidth>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Select your member ticket category.
            </Typography>
            <RadioGroup
              value={memberTicketTypeId ?? ""}
              onChange={(_, v) => setMemberTicketTypeId(v || null)}
            >
              {memberTicketTypes.map((tt) => (
                <FormControlLabel
                  key={tt.id}
                  value={tt.id}
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" component="span">
                        {tt.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {tt.price != null ? String(tt.price) : "—"}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>
            <TextField
              label="Dietary requirements (you)"
              fullWidth
              size="small"
              value={bookerDietaryNote}
              onChange={(e) => setBookerDietaryNote(e.target.value)}
              sx={{ mt: 2 }}
            />
            <Autocomplete
              multiple
              options={seatingOptions}
              value={seatingOptions.filter((o) => sitNextToUserIds.includes(o.id))}
              onChange={(_, next) => setSitNextToUserIds(next.map((n) => n.id))}
              getOptionLabel={(o) => o.label}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Sit next to (optional)"
                  helperText="Member picker sourced from section member list."
                  size="small"
                  sx={{ mt: 2 }}
                />
              )}
            />
            <FormControlLabel
              sx={{ mt: 1 }}
              control={<Checkbox checked={accommodationRequested} onChange={(_, checked) => setAccommodationRequested(checked)} />}
              label="Request accommodation (booker only)"
              disabled={!canRequestAccommodation}
            />
            {accommodationRequested && (
              <TextField
                label="Accommodation details (optional)"
                fullWidth
                size="small"
                value={accommodationNote}
                onChange={(e) => setAccommodationNote(e.target.value)}
              />
            )}
            {!canRequestAccommodation && (
              <Typography variant="caption" color="text.secondary">
                Accommodation requests are only available for REGULAR or RESERVE members.
              </Typography>
            )}
          </FormControl>
        )}

        {activeStep === 1 && (
          <Box>
            {!guestTicketTypes.length ? (
              <Typography variant="body2" color="text.secondary">
                No guest ticket types are available for this event. Continue to review your booking.
              </Typography>
            ) : (
              <>
                <RadioGroup
                  value={includeGuest ? "guest" : "self"}
                  onChange={(_, v) => {
                    const next = v === "guest";
                    setIncludeGuest(next);
                    if (!next) {
                      setGuestTicketTypeId(null);
                      setGuestDisplayName("");
                    } else if (!guestTicketTypeId && guestTicketTypes[0]) {
                      setGuestTicketTypeId(guestTicketTypes[0].id);
                    }
                  }}
                >
                  <FormControlLabel value="self" control={<Radio />} label="No guest — just my ticket" />
                  <FormControlLabel value="guest" control={<Radio />} label="Add one guest ticket" />
                </RadioGroup>
                {includeGuest && (
                  <Box sx={{ mt: 2, pl: 1, borderLeft: 2, borderColor: "divider" }}>
                    <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                        Guest ticket category
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
                            label={`${tt.title} (${tt.price != null ? String(tt.price) : "—"})`}
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
                      helperText="Shown on the guest ticket"
                    />
                  </Box>
                )}
              </>
            )}
          </Box>
        )}

        {activeStep === 2 && (
          <Box component="dl" sx={{ m: 0, "& dt": { fontWeight: 600, mt: 1.5 }, "& dd": { m: 0 } }}>
            <Typography component="dt" variant="body2">
              Your ticket
            </Typography>
            <Typography component="dd" variant="body2" color="text.secondary">
              {selectedMember?.title ?? "—"}
              {selectedMember?.price != null ? ` · ${String(selectedMember.price)}` : ""}
            </Typography>
            <Typography component="dt" variant="body2">
              Guest
            </Typography>
            <Typography component="dd" variant="body2" color="text.secondary">
              {includeGuest && selectedGuest
                ? `${selectedGuest.title} (${String(selectedGuest.price ?? "—")}) — ${guestDisplayName.trim()}`
                : "None"}
            </Typography>
            <Typography component="dt" variant="body2">
              Event
            </Typography>
            <Typography component="dd" variant="body2" color="text.secondary">
              {event.title}
            </Typography>
            <Typography component="dt" variant="body2">
              Dietary (you)
            </Typography>
            <Typography component="dd" variant="body2" color="text.secondary">
              {bookerDietaryNote.trim() || "None"}
            </Typography>
            <Typography component="dt" variant="body2">
              Sit next to
            </Typography>
            <Typography component="dd" variant="body2" color="text.secondary">
              {sitNextToUserIds.length > 0
                ? seatingOptions
                    .filter((o) => sitNextToUserIds.includes(o.id))
                    .map((o) => o.label)
                    .join(", ")
                : "No preference"}
            </Typography>
            <Typography component="dt" variant="body2">
              Accommodation
            </Typography>
            <Typography component="dd" variant="body2" color="text.secondary">
              {accommodationRequested ? accommodationNote.trim() || "Requested" : "Not requested"}
            </Typography>
          </Box>
        )}
      </Paper>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
        <Button onClick={handleBack} disabled={activeStep === 0 || submitting}>
          Back
        </Button>
        <Box sx={{ display: "flex", gap: 1 }}>
          {activeStep < 2 && (
            <Button variant="contained" onClick={handleNext} disabled={submitting} sx={{ backgroundColor: colors.callToAction }}>
              Next
            </Button>
          )}
          {activeStep === 2 && (
            <Button
              variant="contained"
              onClick={handleConfirm}
              disabled={submitting}
              sx={{ backgroundColor: colors.callToAction }}
            >
              {submitting ? "Submitting…" : "Confirm booking"}
            </Button>
          )}
        </Box>
      </Box>

      {activeStep > 0 && (
        <Button size="small" onClick={resetWizardState} disabled={submitting} sx={{ mt: 1 }}>
          Start over
        </Button>
      )}
    </Box>
  );
}
