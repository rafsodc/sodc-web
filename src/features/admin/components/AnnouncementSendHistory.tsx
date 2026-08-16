import { useState, useEffect, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { ExpandLess, ExpandMore, History, Refresh } from "@mui/icons-material";
import {
  getAnnouncementSendHistory,
  getAnnouncementSendRecipients,
  retryAnnouncementPreparation,
  type AnnouncementSend,
  type AnnouncementRecipient,
  type AnnouncementRecipientInitial,
  type AnnouncementRecipientPage,
  type AnnouncementRecipientStatusFilter,
} from "../../../shared/utils/firebaseFunctions";
import { reportError, toAdminUserFacingError } from "../../../shared/errors";
import { useLatestRequestGuard } from "../../../shared/hooks/useLatestRequestGuard";
import {
  announcementRecipientRetryDelayMs,
  loadCompleteInitialGroup,
  type CompleteInitialLoadOutcome,
} from "../utils/announcementRecipientInitialLoader";

interface Props {
  sectionId: string;
  refreshTrigger?: number;
}

const ALPHABET = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
] as const;
const VIRTUAL_ROW_HEIGHT = 53;
const VIRTUAL_VIEWPORT_HEIGHT = 530;
const VIRTUAL_OVERSCAN = 5;
const STATUS_OPTIONS: Array<{ value: AnnouncementRecipientStatusFilter; label: string; noun: string }> = [
  { value: "ALL", label: "All statuses", noun: "recipients" },
  { value: "IN_PROGRESS", label: "In progress", noun: "in-progress recipients" },
  { value: "PASSED", label: "Passed", noun: "passed recipients" },
  { value: "NOT_ON_TEAM", label: "Not on Notify team", noun: "recipients not on the Notify team" },
  { value: "FAILED", label: "Other failures", noun: "failed recipients" },
  { value: "SKIPPED", label: "Skipped", noun: "skipped recipients" },
];

function statusChip(recipient: AnnouncementRecipient) {
  const { status, effectiveDeliveryMode: mode } = recipient;
  if (recipient.failureCategory === "notify_team_only") {
    return <Chip label="Not on Notify team" color="warning" size="small" />;
  }
  if (status === "queued") return <Chip label="Queued" size="small" variant="outlined" />;
  if (status === "sending") return <Chip label="Sending" color="info" size="small" />;
  if (status === "retrying") return <Chip label="Retrying" color="warning" size="small" />;
  if (status === "delivery_unknown") return <Chip label="Checking delivery" color="warning" size="small" />;
  if (status === "enqueue_failed") return <Chip label="Queue failed" color="error" size="small" />;
  if (status === "delivered") return <Chip label="Delivered" color="success" size="small" />;
  if (status === "sent" && mode === "SIMULATION") {
    return <Chip label="Simulated acceptance" color="info" size="small" variant="outlined" />;
  }
  if (status === "sent") return <Chip label="Accepted" color="success" size="small" variant="outlined" />;
  if (status === "bounced") return <Chip label="Bounced" color="error" size="small" />;
  if (status === "skipped") return <Chip label="Skipped" size="small" />;
  return <Chip label="Failed" color="error" size="small" />;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function recipientDetail(recipient: AnnouncementRecipient): string {
  if (recipient.status === "skipped" && recipient.skippedReason === "opted_out") {
    return "Recipient opted out";
  }
  if (recipient.failureCategory === "notify_team_only") {
    return "Recipient is not on the GOV.UK Notify team or guest list.";
  }
  if (recipient.status === "failed" || recipient.status === "enqueue_failed" || recipient.status === "bounced") {
    return "Delivery failed; diagnostic detail is available in secure logs.";
  }
  return "";
}

function emptyRecipientPage(): AnnouncementRecipientPage {
  return {
    recipients: [],
    totalCount: 0,
    filteredCount: 0,
    initialCounts: Object.fromEntries([...ALPHABET, "OTHER"].map((key) => [key, 0])),
    page: 1,
    pageSize: 50,
    pageCount: 1,
  };
}

function RecipientRow({ recipient }: { recipient: AnnouncementRecipient }) {
  return (
    <TableRow sx={{ height: VIRTUAL_ROW_HEIGHT }}>
      <TableCell sx={{ whiteSpace: "nowrap" }}>{recipient.firstName} {recipient.lastName}</TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>{recipient.email}</TableCell>
      <TableCell>{statusChip(recipient)}</TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>{recipient.effectiveDeliveryMode.replace("_", " ")}</TableCell>
      <TableCell>
        <Typography variant="caption" color="text.secondary" noWrap display="block">
          {recipientDetail(recipient)}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

function RecipientTable({
  recipients,
  virtualized,
}: {
  recipients: AnnouncementRecipient[];
  virtualized: boolean;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const visibleRows = Math.ceil(VIRTUAL_VIEWPORT_HEIGHT / VIRTUAL_ROW_HEIGHT);
  const startIndex = virtualized
    ? Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN)
    : 0;
  const endIndex = virtualized
    ? Math.min(recipients.length, startIndex + visibleRows + (VIRTUAL_OVERSCAN * 2))
    : recipients.length;
  const topSpacerHeight = startIndex * VIRTUAL_ROW_HEIGHT;
  const bottomSpacerHeight = (recipients.length - endIndex) * VIRTUAL_ROW_HEIGHT;

  return (
    <TableContainer
      aria-label={virtualized ? "Virtualized recipient results" : undefined}
      onScroll={virtualized ? (event) => setScrollTop(event.currentTarget.scrollTop) : undefined}
      sx={{
        overflowX: "auto",
        ...(virtualized ? { maxHeight: VIRTUAL_VIEWPORT_HEIGHT, overflowY: "auto" } : {}),
      }}
    >
      <Table size="small" stickyHeader={virtualized} sx={virtualized ? { tableLayout: "fixed" } : undefined}>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Mode</TableCell>
            <TableCell>Detail</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {topSpacerHeight > 0 && (
            <TableRow aria-hidden="true" sx={{ height: topSpacerHeight }}>
              <TableCell colSpan={5} sx={{ height: topSpacerHeight, p: 0, border: 0 }} />
            </TableRow>
          )}
          {recipients.slice(startIndex, endIndex).map((recipient) => (
            <RecipientRow key={recipient.id} recipient={recipient} />
          ))}
          {bottomSpacerHeight > 0 && (
            <TableRow aria-hidden="true" sx={{ height: bottomSpacerHeight }}>
              <TableCell colSpan={5} sx={{ height: bottomSpacerHeight, p: 0, border: 0 }} />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

type InitialLoadState =
  | { status: "idle" | "loading" }
  | { status: "complete"; resultsChanged: boolean }
  | { status: "partial"; failedPage: number; message: string };

function SendRow({
  send,
  sectionId,
  refreshVersion,
}: {
  send: AnnouncementSend;
  sectionId: string;
  refreshVersion: number;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AnnouncementRecipientPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AnnouncementRecipientStatusFilter>("ALL");
  const [initial, setInitial] = useState<AnnouncementRecipientInitial>("ALL");
  const [page, setPage] = useState(1);
  const [initialLoadState, setInitialLoadState] = useState<InitialLoadState>({ status: "idle" });
  const [retryingPreparation, setRetryingPreparation] = useState(false);
  const [retryAttemptId, setRetryAttemptId] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const recipientRequestGuard = useLatestRequestGuard();
  const retryRequestGuard = useLatestRequestGuard();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const fetchRecipientPage = useCallback((requestedPage: number) => (
    getAnnouncementSendRecipients(send.id, sectionId, {
      search,
      statusFilter,
      initial,
      page: requestedPage,
    })
  ), [initial, search, sectionId, send.id, statusFilter]);

  const applyInitialOutcome = useCallback((outcome: CompleteInitialLoadOutcome) => {
    if (outcome.status === "stale") return;
    setData(outcome.data);
    if (outcome.status === "partial") {
      reportError("admin.announcements.recipients.remainder", outcome.error, {
        sendId: send.id,
        initial,
        failedPage: outcome.failedPage,
      });
      setInitialLoadState({
        status: "partial",
        failedPage: outcome.failedPage,
        message: toAdminUserFacingError(outcome.error, "announcements").message,
      });
      return;
    }
    setInitialLoadState({ status: "complete", resultsChanged: outcome.resultsChanged });
  }, [initial, send.id]);

  const loadInitialRemainder = useCallback(async (
    requestToken: number,
    seed: AnnouncementRecipientPage,
    startPage: number,
  ) => {
    if (initial === "ALL") return;
    const outcome = await loadCompleteInitialGroup({
      initial,
      seed,
      startPage,
      fetchPage: fetchRecipientPage,
      isCurrent: () => recipientRequestGuard.isCurrent(requestToken),
      onProgress: (progress) => {
        if (recipientRequestGuard.isCurrent(requestToken)) setData(progress);
      },
      retryDelayMs: announcementRecipientRetryDelayMs,
    });
    if (recipientRequestGuard.isCurrent(requestToken)) applyInitialOutcome(outcome);
  }, [applyInitialOutcome, fetchRecipientPage, initial, recipientRequestGuard]);

  const load = useCallback(async () => {
    const requestToken = recipientRequestGuard.start();
    setLoading(true);
    setError(null);
    setInitialLoadState({ status: initial === "ALL" ? "idle" : "loading" });
    try {
      const result = await fetchRecipientPage(initial === "ALL" ? page : 1);
      if (!recipientRequestGuard.isCurrent(requestToken)) return;
      if (initial !== "ALL" && (result.initialCounts[initial] ?? 0) === 0) {
        setInitial("ALL");
        setPage(1);
        return;
      }
      setData(result);
      if (initial === "ALL") {
        if (result.page !== page) setPage(result.page);
      } else if (result.pageCount > 1) {
        await loadInitialRemainder(requestToken, result, 2);
      } else {
        setInitialLoadState({ status: "complete", resultsChanged: false });
      }
    } catch (caught) {
      if (!recipientRequestGuard.isCurrent(requestToken)) return;
      reportError("admin.announcements.recipients", caught, { sendId: send.id });
      setError(toAdminUserFacingError(caught, "announcements").message);
      setInitialLoadState({ status: "idle" });
    } finally {
      if (recipientRequestGuard.isCurrent(requestToken)) setLoading(false);
    }
  }, [fetchRecipientPage, initial, loadInitialRemainder, page, recipientRequestGuard, send.id]);

  const retryRemainingRecipients = useCallback(async () => {
    if (initial === "ALL" || initialLoadState.status !== "partial" || data === null) return;
    const requestToken = recipientRequestGuard.start();
    setLoading(true);
    setInitialLoadState({ status: "loading" });
    try {
      await loadInitialRemainder(requestToken, data, initialLoadState.failedPage);
    } finally {
      if (recipientRequestGuard.isCurrent(requestToken)) setLoading(false);
    }
  }, [data, initial, initialLoadState, loadInitialRemainder, recipientRequestGuard]);

  const retryPreparation = useCallback(async () => {
    const requestToken = retryRequestGuard.start();
    const attemptId = retryAttemptId ?? crypto.randomUUID();
    if (!retryAttemptId) setRetryAttemptId(attemptId);
    setRetryingPreparation(true);
    setRetryMessage(null);
    try {
      await retryAnnouncementPreparation(send.id, sectionId, attemptId);
      if (!retryRequestGuard.isCurrent(requestToken)) return;
      setRetryAttemptId(null);
      setRetryMessage("Preparation retry queued. Refresh shortly to see progress.");
    } catch (caught) {
      if (!retryRequestGuard.isCurrent(requestToken)) return;
      reportError("admin.announcements.retryPreparation", caught, { sendId: send.id });
      setRetryMessage(toAdminUserFacingError(caught, "announcements").message);
    } finally {
      if (retryRequestGuard.isCurrent(requestToken)) setRetryingPreparation(false);
    }
  }, [retryAttemptId, retryRequestGuard, sectionId, send.id]);

  useEffect(() => {
    if (open) void load();
  }, [open, load, refreshVersion]);

  const selectInitial = (nextInitial: AnnouncementRecipientInitial) => {
    setInitial(nextInitial);
    setPage(1);
    setInitialLoadState({ status: nextInitial === "ALL" ? "idle" : "loading" });
    setData((current) => current === null ? null : {
      ...current,
      recipients: [],
      page: 1,
      pageCount: 1,
    });
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("ALL");
    setInitial("ALL");
    setPage(1);
  };

  const result = data ?? emptyRecipientPage();
  const selectedCount = initial === "ALL"
    ? result.filteredCount
    : result.initialCounts[initial] ?? 0;
  const start = selectedCount === 0
    ? 0
    : initial === "ALL" ? (result.page - 1) * result.pageSize + 1 : 1;
  const end = selectedCount === 0 ? 0 : start + result.recipients.length - 1;
  const resultNoun = STATUS_OPTIONS.find((option) => option.value === statusFilter)?.noun ?? "recipients";
  const initialSuffix = initial === "ALL"
    ? ""
    : initial === "OTHER"
      ? " in Other surnames"
      : ` with surname ${initial}`;

  return (
    <>
      <TableRow
        hover
        onClick={() => setOpen((current) => !current)}
        sx={{ cursor: "pointer", "& > *": { borderBottom: "unset" } }}
      >
        <TableCell>
          <IconButton size="small" aria-label={open ? "Collapse" : "Expand"}>
            {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell><Typography variant="body2">{formatDate(send.sentAt)}</Typography></TableCell>
        <TableCell>
          <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
            {send.templateName ?? send.templateUuid}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip
            label={send.effectiveDeliveryMode.replace("_", " ")}
            size="small"
            color={send.effectiveDeliveryMode === "LIVE" ? "error" : "warning"}
            variant={send.effectiveDeliveryMode === "SIMULATION" ? "outlined" : "filled"}
          />
        </TableCell>
        <TableCell align="right">
          {!send.progressAvailable || send.processedCount === null ? (
            <Tooltip title="Progress is temporarily unavailable">
              <Typography variant="body2" color="warning.main">Unavailable</Typography>
            </Tooltip>
          ) : send.processedCount < send.recipientCount ? (
            <Tooltip title={`${send.processedCount} of ${send.recipientCount} processed`}>
              <Box sx={{ minWidth: 80 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {send.processedCount} / {send.recipientCount}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={send.recipientCount > 0 ? (send.processedCount / send.recipientCount) * 100 : 0}
                  sx={{ height: 4, borderRadius: 2 }}
                />
              </Box>
            </Tooltip>
          ) : (
            <Typography variant="body2" color="success.main">{send.recipientCount}</Typography>
          )}
        </TableCell>
        <TableCell align="right"><Typography variant="body2" color="text.secondary">{send.skippedCount}</Typography></TableCell>
        <TableCell align="right">
          <Typography variant="body2" color={(send.failureCount ?? 0) > 0 ? "error.main" : "text.secondary"}>
            {send.failureCount ?? "—"}
          </Typography>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ py: 0 }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ px: { xs: 0, sm: 2 }, py: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Replies: {send.replyToDisplayLabel
                  ? `${send.replyToDisplayLabel}${send.replyToEmailAddress ? ` — ${send.replyToEmailAddress}` : ""}`
                  : "system / GOV.UK Notify default"}
              </Typography>

              {send.preparationIncomplete && (
                <Alert
                  severity="warning"
                  action={(
                    <Button
                      color="inherit"
                      size="small"
                      disabled={retryingPreparation}
                      onClick={() => void retryPreparation()}
                    >
                      {retryingPreparation ? "Queuing…" : "Retry preparation"}
                    </Button>
                  )}
                  sx={{ mb: 2 }}
                >
                  Some recipient emails were not queued for delivery.
                </Alert>
              )}
              {retryMessage && <Alert severity="info" sx={{ mb: 2 }}>{retryMessage}</Alert>}

              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
                <TextField
                  size="small"
                  label="Search recipients"
                  placeholder="Name or email"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  sx={{ minWidth: { md: 280 } }}
                />
                <FormControl size="small" sx={{ minWidth: 190 }}>
                  <InputLabel id={`recipient-status-${send.id}`}>Delivery status</InputLabel>
                  <Select
                    labelId={`recipient-status-${send.id}`}
                    label="Delivery status"
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value as AnnouncementRecipientStatusFilter);
                      setPage(1);
                    }}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              <Box
                role="group"
                aria-label="Filter recipients by surname initial"
                sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1.5 }}
              >
                <Button
                  size="small"
                  variant={initial === "ALL" ? "contained" : "outlined"}
                  onClick={() => selectInitial("ALL")}
                  aria-pressed={initial === "ALL"}
                >
                  All ({result.filteredCount})
                </Button>
                {ALPHABET.map((letter) => (
                  <Button
                    key={letter}
                    size="small"
                    variant={initial === letter ? "contained" : "text"}
                    disabled={(result.initialCounts[letter] ?? 0) === 0}
                    onClick={() => selectInitial(letter)}
                    aria-pressed={initial === letter}
                    aria-label={`${letter}: ${result.initialCounts[letter] ?? 0} recipients`}
                    sx={{ minWidth: 38, px: 0.75 }}
                  >
                    {letter} ({result.initialCounts[letter] ?? 0})
                  </Button>
                ))}
                <Button
                  size="small"
                  variant={initial === "OTHER" ? "contained" : "text"}
                  disabled={(result.initialCounts.OTHER ?? 0) === 0}
                  onClick={() => selectInitial("OTHER")}
                  aria-pressed={initial === "OTHER"}
                >
                  Other ({result.initialCounts.OTHER ?? 0})
                </Button>
              </Box>

              <Typography variant="body2" color="text.secondary" aria-live="polite" sx={{ mb: 1 }}>
                {selectedCount === 0
                  ? `No ${resultNoun} to show`
                  : initial !== "ALL" && initialLoadState.status !== "complete"
                    ? `Loaded ${result.recipients.length} of ${selectedCount} ${resultNoun}${initialSuffix}`
                    : `Showing ${start}–${end} of ${selectedCount} ${resultNoun}${initialSuffix}`}
              </Typography>

              {loading && <LinearProgress aria-label="Loading recipients" sx={{ mb: 1 }} />}
              {error && <Alert severity="error" sx={{ my: 1 }}>{error}</Alert>}
              {initialLoadState.status === "complete" && initialLoadState.resultsChanged && (
                <Alert severity="info" sx={{ my: 1 }}>
                  Recipient results changed while this group was loading. The completed list reflects each recipient when loaded; use Refresh for the latest statuses.
                </Alert>
              )}
              {initialLoadState.status === "partial" && (
                <Alert
                  severity="error"
                  action={<Button color="inherit" size="small" onClick={() => void retryRemainingRecipients()}>Retry loading remaining recipients</Button>}
                  sx={{ my: 1 }}
                >
                  {initialLoadState.message} Loading stopped at chunk {initialLoadState.failedPage} of {result.pageCount}.
                  {" "}Loaded {result.recipients.length} of {selectedCount}; the group is incomplete.
                </Alert>
              )}
              {!loading && !error && result.totalCount === 0 && (
                <Alert severity="info" sx={{ my: 1 }}>No recipients recorded.</Alert>
              )}
              {!loading && !error && result.totalCount > 0 && selectedCount === 0 && (
                <Alert
                  severity="info"
                  action={<Button color="inherit" size="small" onClick={clearFilters}>Clear filters</Button>}
                  sx={{ my: 1 }}
                >
                  No recipients match the current filters.
                </Alert>
              )}
              {!error && result.recipients.length > 0 && (
                <RecipientTable
                  key={`${initial}:${search}:${statusFilter}`}
                  recipients={result.recipients}
                  virtualized={initial !== "ALL" && selectedCount > 250}
                />
              )}
              {initial === "ALL" && result.pageCount > 1 && (
                <Pagination
                  page={result.page}
                  count={result.pageCount}
                  onChange={(_event, nextPage) => setPage(nextPage)}
                  aria-label="Recipient result pages"
                  sx={{ display: "flex", justifyContent: "center", mt: 2 }}
                />
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function AnnouncementSendHistory({ sectionId, refreshTrigger }: Props) {
  const [sends, setSends] = useState<AnnouncementSend[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualRefresh, setManualRefresh] = useState(0);
  const historyRequestGuard = useLatestRequestGuard();

  useEffect(() => {
    const requestToken = historyRequestGuard.start();
    setLoading(true);
    setError(null);
    getAnnouncementSendHistory(sectionId)
      .then((result) => {
        if (historyRequestGuard.isCurrent(requestToken)) setSends(result);
      })
      .catch((caught: unknown) => {
        if (!historyRequestGuard.isCurrent(requestToken)) return;
        reportError("admin.announcements.history", caught, { sectionId });
        setError(toAdminUserFacingError(caught, "announcements").message);
      })
      .finally(() => {
        if (historyRequestGuard.isCurrent(requestToken)) setLoading(false);
      });
    return () => {
      if (historyRequestGuard.isCurrent(requestToken)) historyRequestGuard.invalidate();
    };
  }, [sectionId, refreshTrigger, manualRefresh, historyRequestGuard]);

  return (
    <Box sx={{ mt: 4 }}>
      <Divider sx={{ mb: 3 }} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <History fontSize="small" color="action" />
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>Send history</Typography>
        <Tooltip title="Refresh send history and expanded recipients">
          <span>
            <IconButton
              onClick={() => setManualRefresh((value) => value + 1)}
              disabled={loading}
              aria-label="Refresh send history"
              size="small"
            >
              {loading ? <CircularProgress size={20} /> : <Refresh fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {loading && sends === null && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {sends && sends.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No announcements have been sent yet.
        </Typography>
      )}
      {sends && sends.length > 0 && (
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }} />
                <TableCell>Date</TableCell>
                <TableCell>Template</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell align="right">Processed</TableCell>
                <TableCell align="right">Skipped</TableCell>
                <TableCell align="right">Attention</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sends.map((send) => (
                <SendRow
                  key={send.id}
                  send={send}
                  sectionId={sectionId}
                  refreshVersion={manualRefresh + (refreshTrigger ?? 0)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
