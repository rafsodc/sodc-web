import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { CheckCircle, Error, Warning, ExpandMore, ExpandLess } from "@mui/icons-material";
import PageHeader from "../../../shared/components/PageHeader";
import {
  getTemplateSyncStatus,
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
  if (status === "not_configured") return "UUID not configured";
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

function TemplateRow({ result }: { result: TemplateSyncResult }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = result.status === "drift";
  const showToggle = hasDiff || result.status === "fetch_error";

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
          <Chip
            size="small"
            label={statusLabel(result.status)}
            color={statusChipColor(result.status)}
          />
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
            {result.expectedSubject}
          </Typography>
        </TableCell>
        <TableCell align="right">
          {showToggle ? (
            expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />
          ) : null}
        </TableCell>
      </TableRow>
      {showToggle && (
        <TableRow>
          <TableCell colSpan={4} sx={{ py: 0 }}>
            <Collapse in={expanded} unmountOnExit>
              <Box sx={{ py: 2, px: 1 }}>
                {result.status === "fetch_error" ? (
                  <Alert severity="error">{result.errorMessage ?? "Unknown error fetching template from GOV Notify."}</Alert>
                ) : (
                  <>
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
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TemplateSyncResult[] | null>(null);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTemplateSyncStatus();
      setResults(data.results);
    } catch {
      setError("Failed to fetch template sync status");

    } finally {
      setLoading(false);
    }
  };

  const driftCount = results?.filter((r) => r.status === "drift").length ?? 0;
  const unconfiguredCount = results?.filter((r) => r.status === "not_configured").length ?? 0;
  const errorCount = results?.filter((r) => r.status === "fetch_error").length ?? 0;

  return (
    <Box className="page-container">
      <PageHeader title="Email Template Sync" onBack={onBack} />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Compares the GOV Notify templates (fetched live) against the{" "}
        <Typography component="span" variant="body2" fontFamily="monospace">
          functions/email-templates/
        </Typography>{" "}
        files in the codebase. Drift means the dashboard was updated without updating the code, or
        vice versa. Update the GOV Notify dashboard manually to resolve.
      </Typography>

      <Button variant="contained" onClick={runCheck} disabled={loading} sx={{ mb: 3 }}>
        {loading ? <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} /> : null}
        {loading ? "Checking…" : results ? "Re-check" : "Check sync status"}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {results && (
        <>
          {driftCount + unconfiguredCount + errorCount === 0 ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              All {results.length} templates are in sync.
            </Alert>
          ) : (
            <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
              {driftCount > 0 && (
                <Chip label={`${driftCount} drift detected`} color="error" size="small" />
              )}
              {unconfiguredCount > 0 && (
                <Chip label={`${unconfiguredCount} UUID not configured`} color="warning" size="small" />
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
                <TableCell>Expected subject</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((result) => (
                <TemplateRow key={result.templateKey} result={result} />
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  );
}
