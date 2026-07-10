import { useState, useEffect, useCallback } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { ExpandLess, ExpandMore, History } from "@mui/icons-material";
import {
  getAnnouncementSendHistory,
  getAnnouncementSendRecipients,
  type AnnouncementSend,
  type AnnouncementRecipient,
} from "../../../shared/utils/firebaseFunctions";

interface Props {
  sectionId: string;
  refreshTrigger?: number;
}

function statusChip(status: AnnouncementRecipient["status"]) {
  if (status === "sent") return <Chip label="Sent" color="success" size="small" />;
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

function SendRow({ send, sectionId }: { send: AnnouncementSend; sectionId: string }) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<AnnouncementRecipient[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (recipients !== null) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAnnouncementSendRecipients(send.id, sectionId);
      setRecipients(data);
    } catch {
      setError("Failed to load recipients");
    } finally {
      setLoading(false);
    }
  }, [send.id, sectionId, recipients]);

  const toggle = () => {
    if (!open) void load();
    setOpen((o) => !o);
  };

  return (
    <>
      <TableRow
        hover
        onClick={toggle}
        sx={{ cursor: "pointer", "& > *": { borderBottom: "unset" } }}
      >
        <TableCell>
          <IconButton size="small" aria-label={open ? "Collapse" : "Expand"}>
            {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{formatDate(send.sentAt)}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
            {send.templateName ?? send.templateUuid}
          </Typography>
        </TableCell>
        <TableCell align="right">
          {send.processedCount < send.recipientCount ? (
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
        <TableCell align="right">
          <Typography variant="body2" color="text.secondary">{send.skippedCount}</Typography>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5} sx={{ py: 0 }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ px: 2, py: 1 }}>
              {loading && <CircularProgress size={20} sx={{ my: 1 }} />}
              {error && <Alert severity="error" sx={{ my: 1 }}>{error}</Alert>}
              {recipients && recipients.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
                  No recipients recorded.
                </Typography>
              )}
              {recipients && recipients.length > 0 && (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Detail</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recipients.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.firstName} {r.lastName}</TableCell>
                        <TableCell>{r.email}</TableCell>
                        <TableCell>{statusChip(r.status)}</TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {r.skippedReason ?? r.failureReason ?? ""}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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

  useEffect(() => {
    setLoading(true);
    setError(null);
    getAnnouncementSendHistory(sectionId)
      .then(setSends)
      .catch((err: unknown) => {
        const msg = err && typeof (err as { message?: string }).message === "string"
          ? (err as { message: string }).message
          : "Unknown error";
        setError(`Failed to load send history: ${msg}`);
      })
      .finally(() => setLoading(false));
  }, [sectionId, refreshTrigger]);

  return (
    <Box sx={{ mt: 4 }}>
      <Divider sx={{ mb: 3 }} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <History fontSize="small" color="action" />
        <Typography variant="subtitle1">Send history</Typography>
      </Box>

      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {sends && sends.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No announcements have been sent yet.
        </Typography>
      )}
      {sends && sends.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }} />
              <TableCell>Date</TableCell>
              <TableCell>Template</TableCell>
              <TableCell align="right">Sent</TableCell>
              <TableCell align="right">Skipped</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sends.map((s) => (
              <SendRow key={s.id} send={s} sectionId={sectionId} />
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
