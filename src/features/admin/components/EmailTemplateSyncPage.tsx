import { useEffect, useMemo, useState } from "react";
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
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { CheckCircle, ContentCopy, Error, ExpandLess, ExpandMore, OpenInNew, Warning } from "@mui/icons-material";
import PageHeader from "../../../shared/components/PageHeader";
import { reportError, toAdminUserFacingError } from "../../../shared/errors";
import {
  getTemplateSyncStatus,
  moveAllNotifyTemplateBindingsToLatestVersion,
  setNotifyTemplateBinding,
  type NotifyTemplateCandidate,
  type TemplateSyncResult,
  type TemplateSyncStatus,
} from "../../../shared/utils/firebaseFunctions";

interface EmailTemplateSyncPageProps {
  onBack: () => void;
}

function statusChipColor(status: TemplateSyncStatus): "success" | "error" | "warning" | "default" {
  if (status === "in_sync") return "success";
  if (status === "drift") return "error";
  if (status === "not_configured") return "warning";
  return "default";
}

function statusLabel(status: TemplateSyncStatus): string {
  if (status === "in_sync") return "In sync";
  if (status === "drift") return "Drift detected";
  if (status === "not_configured") return "Not bound";
  return "Fetch error";
}

function statusIcon(status: TemplateSyncStatus) {
  if (status === "in_sync") return <CheckCircle fontSize="small" color="success" />;
  if (status === "drift") return <Error fontSize="small" color="error" />;
  if (status === "not_configured") return <Warning fontSize="small" color="warning" />;
  return <Error fontSize="small" color="disabled" />;
}

function lineDiff(expected: string, live: string): { line: string; kind: "same" | "added" | "removed" }[] {
  const expectedLines = expected.split("\n");
  const liveLines = live.split("\n");
  const result: { line: string; kind: "same" | "added" | "removed" }[] = [];
  const maxLen = Math.max(expectedLines.length, liveLines.length);
  for (let i = 0; i < maxLen; i++) {
    const e = expectedLines[i];
    const l = liveLines[i];
    if (e === l) {
      result.push({ line: e ?? "", kind: "same" });
    } else {
      if (e !== undefined) result.push({ line: e, kind: "removed" });
      if (l !== undefined) result.push({ line: l, kind: "added" });
    }
  }
  return result;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Tooltip title={copied ? "Copied!" : `Copy ${label}`}>
      <IconButton size="small" onClick={handleCopy} aria-label={`Copy ${label}`}>
        <ContentCopy fontSize="inherit" color={copied ? "success" : "inherit"} />
      </IconButton>
    </Tooltip>
  );
}

function DiffBlock({ label, expected, live }: { label: string; expected: string; live: string }) {
  const lines = lineDiff(expected, live);
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        {label}
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          fontFamily: "monospace",
          fontSize: "0.75rem",
          lineHeight: 1.6,
          overflowX: "auto",
          bgcolor: "grey.50",
        }}
      >
        {lines.map((l, i) => (
          <Box
            key={i}
            sx={{
              bgcolor:
                l.kind === "removed"
                  ? "#fde8e8"
                  : l.kind === "added"
                    ? "#e8f5e9"
                    : "transparent",
              px: 0.5,
              borderRadius: 0.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {l.kind === "removed" ? "− " : l.kind === "added" ? "+ " : "  "}
            {l.line}
          </Box>
        ))}
      </Paper>
    </Box>
  );
}

function UpdateInstructions({ result }: { result: TemplateSyncResult }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        How to update
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Open the template in GOV Notify and update the fields below.
      </Typography>

      <Stack spacing={1}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="body2" sx={{ minWidth: 80, fontWeight: 600 }}>Template name</Typography>
          <Typography variant="body2" fontFamily="monospace" sx={{ flex: 1, bgcolor: "grey.100", px: 1, py: 0.5, borderRadius: 1 }}>
            {result.templateKey}
          </Typography>
          <CopyButton value={result.templateKey} label="template name" />
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>no change needed</Typography>
        </Stack>

        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="body2" sx={{ minWidth: 80, fontWeight: 600 }}>Subject</Typography>
          <Typography variant="body2" fontFamily="monospace" sx={{ flex: 1, bgcolor: "grey.100", px: 1, py: 0.5, borderRadius: 1 }}>
            {result.expectedSubject}
          </Typography>
          <CopyButton value={result.expectedSubject} label="subject" />
        </Stack>

        <Stack direction="row" alignItems="flex-start" gap={1}>
          <Typography variant="body2" sx={{ minWidth: 80, fontWeight: 600, pt: 0.5 }}>Message</Typography>
          <Typography
            variant="body2"
            fontFamily="monospace"
            sx={{
              flex: 1,
              bgcolor: "grey.100",
              px: 1,
              py: 0.5,
              borderRadius: 1,
              whiteSpace: "pre-wrap",
              maxHeight: 120,
              overflow: "hidden",
              WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
            }}
          >
            {result.expectedBody}
          </Typography>
          <CopyButton value={result.expectedBody} label="message body" />
        </Stack>
      </Stack>

      {result.notifyEditUrl && (
        <Button
          href={result.notifyEditUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="outlined"
          size="small"
          endIcon={<OpenInNew fontSize="small" />}
          sx={{ mt: 2 }}
        >
          Edit in GOV Notify
        </Button>
      )}
    </Box>
  );
}

function BindingControls({
  result,
  onSaved,
}: {
  result: TemplateSyncResult;
  onSaved: (results: TemplateSyncResult[]) => void;
}) {
  const [pendingTemplateId, setPendingTemplateId] = useState(result.boundTemplateId ?? "");
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  // Stay in sync when the parent refreshes (Refresh / Move all to latest version).
  useEffect(() => {
    setPendingTemplateId(result.boundTemplateId ?? "");
  }, [result.boundTemplateId]);

  const options: NotifyTemplateCandidate[] = useMemo(() => {
    const list = [...result.candidates];
    if (result.boundTemplateId && !list.some((c) => c.id === result.boundTemplateId)) {
      list.push({
        id: result.boundTemplateId,
        name: result.boundTemplateName
          ? `${result.boundTemplateName} (not an exact key match)`
          : `${result.boundTemplateId} (not found in GOV Notify)`,
        version: result.currentLiveVersion ?? result.reviewedVersion ?? 1,
      });
    }
    return list;
  }, [result]);

  const selected = options.find((c) => c.id === pendingTemplateId);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setRowError(null);
    try {
      // GOV Notify's send API has no version parameter -- it always sends
      // whichever version is currently live. There is never a meaningful
      // choice of version to "select"; reviewedVersion just records that an
      // admin has confirmed the current live content, for drift detection.
      const { results } = await setNotifyTemplateBinding({
        templateKey: result.templateKey,
        notifyTemplateId: selected.id,
        reviewedVersion: selected.version,
      });
      onSaved(results);
    } catch (caught) {
      reportError("admin.email-templates.set-binding", caught, { templateKey: result.templateKey });
      setRowError(toAdminUserFacingError(caught, "email-configuration").message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box onClick={(e) => e.stopPropagation()}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id={`template-${result.templateKey}`}>Notify template</InputLabel>
          <Select
            labelId={`template-${result.templateKey}`}
            label="Notify template"
            value={pendingTemplateId}
            disabled={saving}
            onChange={(event) => setPendingTemplateId(event.target.value)}
          >
            {options.length === 0 && (
              <MenuItem value="" disabled>No exact-name match found</MenuItem>
            )}
            {options.map((candidate) => (
              <MenuItem key={candidate.id} value={candidate.id}>{candidate.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          size="small"
          variant="contained"
          disabled={saving || !selected}
          onClick={() => void handleSave()}
        >
          Save
        </Button>
      </Stack>
      {rowError && <Alert severity="error" sx={{ mt: 1 }}>{rowError}</Alert>}
    </Box>
  );
}

function TemplateRow({
  result,
  onSaved,
}: {
  result: TemplateSyncResult;
  onSaved: (results: TemplateSyncResult[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const showToggle = result.status === "drift" || result.status === "fetch_error" || result.status === "not_configured";

  return (
    <>
      <TableRow
        sx={{
          cursor: showToggle ? "pointer" : "default",
          "&:hover": showToggle ? { bgcolor: "action.hover" } : undefined,
        }}
        onClick={showToggle ? () => setExpanded((v) => !v) : undefined}
      >
        <TableCell>
          <Stack direction="row" alignItems="center" gap={1}>
            {statusIcon(result.status)}
            <Typography variant="body2" fontFamily="monospace">
              {result.templateKey}
            </Typography>
          </Stack>
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={statusLabel(result.status)}
              color={statusChipColor(result.status)}
            />
            {result.versionDrift && (
              <Tooltip title="GOV Notify's live version has moved past the version an admin last reviewed">
                <Chip size="small" label={`v${result.reviewedVersion} → v${result.currentLiveVersion}`} color="warning" variant="outlined" />
              </Tooltip>
            )}
          </Stack>
        </TableCell>
        <TableCell>
          <BindingControls result={result} onSaved={onSaved} />
        </TableCell>
        <TableCell align="right">
          {showToggle ? (
            expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />
          ) : result.notifyEditUrl ? (
            <Tooltip title="Edit in GOV Notify">
              <IconButton
                size="small"
                href={result.notifyEditUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label="Edit in GOV Notify"
              >
                <OpenInNew fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </TableCell>
      </TableRow>
      {showToggle && (
        <TableRow>
          <TableCell colSpan={4} sx={{ py: 0 }}>
            <Collapse in={expanded} unmountOnExit>
              <Box sx={{ py: 2, px: 1 }}>
                {result.status === "fetch_error" ? (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {result.errorMessage ?? "Unknown error fetching template from GOV Notify."}
                  </Alert>
                ) : result.status === "not_configured" ? (
                  <>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      No binding saved yet. Create the template in GOV Notify using the values
                      below, named exactly <strong>{result.templateKey}</strong>, then select it
                      from the dropdown and save.
                    </Alert>
                    <UpdateInstructions result={result} />
                  </>
                ) : (
                  <>
                    <UpdateInstructions result={result} />
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom>Diff</Typography>
                    {!result.subjectMatch && (
                      <DiffBlock
                        label="Subject"
                        expected={result.expectedSubject}
                        live={result.liveSubject ?? ""}
                      />
                    )}
                    {!result.bodyMatch && (
                      <DiffBlock
                        label="Body"
                        expected={result.expectedBody}
                        live={result.liveBody ?? ""}
                      />
                    )}
                  </>
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function EmailTemplateSyncPage({ onBack }: EmailTemplateSyncPageProps) {
  const [loading, setLoading] = useState(false);
  const [bulkMoving, setBulkMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TemplateSyncResult[] | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTemplateSyncStatus();
      setResults(data.results);
    } catch (caught) {
      reportError("admin.email-templates.sync-status", caught);
      setError(toAdminUserFacingError(caught, "email-configuration").message);
    } finally {
      setLoading(false);
    }
  };

  const moveAllToLatest = async () => {
    setBulkMoving(true);
    setError(null);
    try {
      const data = await moveAllNotifyTemplateBindingsToLatestVersion();
      setResults(data.results);
    } catch (caught) {
      reportError("admin.email-templates.move-all-latest", caught);
      setError(toAdminUserFacingError(caught, "email-configuration").message);
    } finally {
      setBulkMoving(false);
    }
  };

  const driftCount = results?.filter((r) => r.status === "drift").length ?? 0;
  const unconfiguredCount = results?.filter((r) => r.status === "not_configured").length ?? 0;
  const errorCount = results?.filter((r) => r.status === "fetch_error").length ?? 0;
  const versionDriftCount = results?.filter((r) => r.versionDrift).length ?? 0;
  const anyBound = results?.some((r) => r.boundTemplateId) ?? false;

  return (
    <Box className="page-container">
      <PageHeader title="Email Templates" onBack={onBack} />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Bind each transactional template key to a live GOV Notify template whose name exactly
        matches the key, and record the version you've reviewed. Drift means the reviewed
        content no longer matches the live GOV Notify template, or the code in{" "}
        <Typography component="span" variant="body2" fontFamily="monospace">
          functions/email-templates/
        </Typography>{" "}
        no longer matches what's bound. Click a drifted or errored template to see details.
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button variant="contained" onClick={() => void refresh()} disabled={loading || bulkMoving}>
          {loading ? <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} /> : null}
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
        {results && (
          <Button
            variant="outlined"
            onClick={() => void moveAllToLatest()}
            disabled={loading || bulkMoving || !anyBound}
          >
            {bulkMoving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            {bulkMoving ? "Moving…" : "Move all to latest version"}
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {results && (
        <>
          {driftCount + unconfiguredCount + errorCount + versionDriftCount === 0 ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              All {results.length} templates are bound, reviewed, and in sync.
            </Alert>
          ) : (
            <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
              {driftCount > 0 && (
                <Chip label={`${driftCount} drift detected`} color="error" size="small" />
              )}
              {unconfiguredCount > 0 && (
                <Chip label={`${unconfiguredCount} not bound`} color="warning" size="small" />
              )}
              {versionDriftCount > 0 && (
                <Chip label={`${versionDriftCount} live version changed since review`} color="warning" size="small" variant="outlined" />
              )}
              {errorCount > 0 && (
                <Chip label={`${errorCount} fetch error`} color="default" size="small" />
              )}
            </Stack>
          )}

          <Divider sx={{ mb: 2 }} />

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Template</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Binding</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((result) => (
                <TemplateRow key={result.templateKey} result={result} onSaved={setResults} />
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  );
}
