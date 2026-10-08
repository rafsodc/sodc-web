import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  guestCall,
  money,
  paymentLabel,
  type GuestTicket as GuestTicketData,
} from "./api";

export default function GuestTicketPage() {
  const { hash } = useLocation();
  return <GuestTicket key={hash} token={hash.slice(1)} />;
}

function GuestTicket({ token }: { token: string }) {
  const [dietary, setDietary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["guest-ticket", token],
    queryFn: () =>
      guestCall<GuestTicketData>("getOrganiserGuestTicket", { token }),
    retry: false,
    gcTime: 0,
  });
  async function act(pay: boolean) {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      if (pay) {
        const result = await guestCall<{ url: string }>(
          "createOrganiserGuestCheckout",
          { token },
        );
        window.location.assign(result.url);
      } else {
        await guestCall("updateOrganiserGuestDietary", {
          token,
          version: data!.version,
          dietaryRequirements: dietary ?? data!.dietaryRequirements,
        });
        setDietary(null);
        await refetch();
        setSaved(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box sx={{ maxWidth: 640, mx: "auto", p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Guest ticket
      </Typography>
      {isPending ? (
        <CircularProgress aria-label="Loading guest ticket" />
      ) : isError || !data ? (
        <Alert
          severity="error"
          action={<Button onClick={() => void refetch()}>Retry</Button>}
        >
          This guest link is unavailable. Please try again or ask your organiser
          for a replacement link.
        </Alert>
      ) : (
        <Stack spacing={2}>
          <Typography variant="h5">{data.eventTitle}</Typography>
          <Typography>
            {data.firstName} {data.lastName} — {data.ticketTitle} (
            {money(data.priceMinor)})
          </Typography>
          <Typography>
            Symposium: {data.includesSymposium ? "Yes" : "No"} · Dinner:{" "}
            {data.includesDinner ? "Yes" : "No"}
          </Typography>
          <Alert severity={data.cancelled ? "warning" : "info"}>
            {data.cancelled
              ? "This ticket has been cancelled."
              : "Your place is reserved."}{" "}
            Payment: {paymentLabel(data.paymentStatus)}.
          </Alert>
          {["REFUND_REQUIRED", "REFUND_FAILED"].includes(data.paymentStatus) && (
            <Typography>
              Please contact the organiser about your outstanding refund.
            </Typography>
          )}
          {!data.cancelled && ["UNPAID", "PAYMENT_REQUIRED"].includes(data.paymentStatus) && (
            <>
              <Typography>
                {data.paymentStatus === "PAYMENT_REQUIRED"
                  ? "Payment required—please pay as soon as possible."
                  : <>{Date.now() >= Date.parse(data.paymentDueAt)
                    ? "Payment is overdue. It was due by "
                    : "Payment is due by "}
                    {new Date(data.paymentDueAt).toLocaleString("en-GB")}.</>} Your reservation remains until the organiser cancels it.
              </Typography>
              <Button
                variant="contained"
                disabled={busy}
                onClick={() => void act(true)}
              >
                Pay {money(data.paymentRequiredMinor)}
              </Button>
            </>
          )}
          <TextField
            label="Dietary requirements"
            multiline
            minRows={3}
            value={dietary ?? data.dietaryRequirements}
            disabled={!data.dietaryEditable || busy}
            onChange={(e) => setDietary(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
          />
          {data.dietaryEditable ? (
            <Button
              variant="outlined"
              disabled={busy}
              onClick={() => void act(false)}
            >
              Save dietary requirements
            </Button>
          ) : (
            <Typography>
              Dietary updates are closed. Contact the organiser if you need
              help.
            </Typography>
          )}
          {saved && (
            <Alert severity="success">Dietary requirements saved.</Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          <Button disabled={busy} onClick={() => void refetch()}>
            Refresh payment status
          </Button>
          <Typography variant="body2">
            Keep this personal link private. No account is needed. Contact your
            organiser to change other details or cancel.
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
