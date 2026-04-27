import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { executeMutation } from "firebase/data-connect";
import {
  resolvePaymentReconciliationExceptionRef,
  PaymentReconciliationExceptionType,
} from "@dataconnect/generated";
import { useListOpenPaymentReconciliationExceptions } from "@dataconnect/generated/react";
import { dataConnect } from "../../../config/firebase";
import PageHeader from "../../../shared/components/PageHeader";
import "../../../shared/components/PageContainer.css";

interface PaymentReconciliationDashboardProps {
  onBack: () => void;
}

export default function PaymentReconciliationDashboard({ onBack }: PaymentReconciliationDashboardProps) {
  const { data, isLoading, refetch } = useListOpenPaymentReconciliationExceptions(dataConnect);
  const [typeFilter, setTypeFilter] = useState<"ALL" | PaymentReconciliationExceptionType>("ALL");
  const [eventSearch, setEventSearch] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = data?.paymentReconciliationExceptions ?? [];
  const filteredRows = useMemo(() => {
    const eventSearchLower = eventSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter !== "ALL" && row.exceptionType !== typeFilter) {
        return false;
      }
      if (!eventSearchLower) {
        return true;
      }
      const eventTitle = row.ticketOrder?.event?.title?.toLowerCase() ?? "";
      return eventTitle.includes(eventSearchLower);
    });
  }, [rows, typeFilter, eventSearch]);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    setError(null);
    try {
      await executeMutation(resolvePaymentReconciliationExceptionRef(dataConnect, { id, note: "Reviewed in dashboard" }));
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark exception reviewed");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <Box className="page-container">
      <PageHeader title="Payment Reconciliation" onBack={onBack} />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 260 }}>
          <InputLabel id="exception-type-filter">Exception type</InputLabel>
          <Select
            labelId="exception-type-filter"
            value={typeFilter}
            label="Exception type"
            onChange={(event) => setTypeFilter(event.target.value as "ALL" | PaymentReconciliationExceptionType)}
          >
            <MenuItem value="ALL">All exceptions</MenuItem>
            <MenuItem value={PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT}>Missing payment intent</MenuItem>
            <MenuItem value={PaymentReconciliationExceptionType.REFUND_AMOUNT_MISMATCH}>Refund amount mismatch</MenuItem>
            <MenuItem value={PaymentReconciliationExceptionType.ACTIVE_DISPUTE}>Active dispute</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Event title"
          value={eventSearch}
          onChange={(event) => setEventSearch(event.target.value)}
          sx={{ minWidth: 260 }}
        />
        <Button variant="outlined" onClick={() => refetch()}>
          Refresh
        </Button>
      </Box>

      {isLoading ? (
        <CircularProgress size={24} />
      ) : filteredRows.length === 0 ? (
        <Alert severity="info">No open reconciliation exceptions match current filters.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Exception</TableCell>
                <TableCell>Event</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Note</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Chip size="small" color="warning" label={row.exceptionType.replaceAll("_", " ")} />
                  </TableCell>
                  <TableCell>{row.ticketOrder?.event?.title ?? "—"}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.ticketOrder?.id ?? "—"}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.ticketOrder?.status ?? "UNKNOWN"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {row.ticketOrder?.user
                      ? `${row.ticketOrder.user.firstName} ${row.ticketOrder.user.lastName}`
                      : "—"}
                  </TableCell>
                  <TableCell>{row.note ?? "—"}</TableCell>
                  <TableCell>{new Date(row.updatedAt).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={resolvingId === row.id}
                      onClick={() => handleResolve(row.id)}
                    >
                      {resolvingId === row.id ? "Resolving..." : "Mark reviewed"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
