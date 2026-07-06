import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Collapse,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ContentCopy,
  ExpandLess,
  ExpandMore,
  Help,
} from "@mui/icons-material";
import {
  STANDARD_FOOTER,
  UNSUPPORTED_PATTERNS,
  renderGovNotifyMarkdown,
} from "../utils/govNotifyMarkdown";

interface TemplateEditorProps {
  sectionName: string;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Tooltip title={copied ? "Copied!" : `Copy ${label}`}>
      <IconButton size="small" onClick={handleCopy} aria-label={`Copy ${label}`}>
        <ContentCopy fontSize="small" color={copied ? "success" : "inherit"} />
      </IconButton>
    </Tooltip>
  );
}

export default function TemplateEditor({ sectionName }: TemplateEditorProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const suggestedName = `BULK: ${sectionName} — `;
  const fullSubject = subject ? `BULK: ${subject}` : "";

  const bodyWithFooter = body.trim()
    ? `${body.trim()}\n\n${STANDARD_FOOTER}`
    : STANDARD_FOOTER;

  const warnings = useMemo(() => {
    const found: string[] = [];
    for (const { name, pattern } of UNSUPPORTED_PATTERNS) {
      if (pattern.test(bodyWithFooter) || pattern.test(fullSubject)) {
        found.push(name);
      }
    }
    return found;
  }, [fullSubject, bodyWithFooter]);

  const previewHtml = useMemo(
    () => renderGovNotifyMarkdown(bodyWithFooter),
    [bodyWithFooter]
  );

  return (
    <Box>
      <Divider sx={{ my: 3 }} />

      {/* Collapsible guide */}
      <Box
        sx={{ display: "flex", alignItems: "center", cursor: "pointer", mb: 1 }}
        onClick={() => setGuideOpen((o) => !o)}
        role="button"
        aria-expanded={guideOpen}
      >
        <Help fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          How to create a GOV Notify template
        </Typography>
        {guideOpen ? <ExpandLess /> : <ExpandMore />}
      </Box>

      <Collapse in={guideOpen}>
        <Box
          sx={{
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            p: 2,
            mb: 2,
          }}
        >
          <Typography variant="body2" component="ol" sx={{ m: 0, pl: 2 }}>
            <li>Log into the GOV Notify dashboard</li>
            <li>Go to <strong>Templates → New template → Email</strong></li>
            <li>
              Name it starting with <code>BULK:</code> — for example:{" "}
              <code>{suggestedName}&lt;description&gt;</code>
            </li>
            <li>
              Add these required personalisation variables in the body:
              <ul style={{ marginTop: 4 }}>
                <li>
                  <code>((firstName))</code> — used in the salutation
                </li>
                <li>
                  <code>((unsubscribeUrl))</code> — required in the footer unsubscribe link
                </li>
              </ul>
            </li>
          </Typography>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>
            Supported Markdown syntax
          </Typography>
          <Typography variant="body2" component="ul" sx={{ m: 0, pl: 2 }}>
            <li>Headings: <code># H1</code>, <code>## H2</code></li>
            <li>Bullets: <code>* item</code> or <code>- item</code></li>
            <li>Numbered lists: <code>1. item</code></li>
            <li>Inset text: <code>^ note</code></li>
            <li>Links: <code>[text](url)</code></li>
            <li>Personalisation: <code>((firstName))</code></li>
            <li>Optional content: <code>((show_extra??Text shown only if set))</code></li>
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: "error.main" }}>
            Not supported: <strong>bold</strong>, <em>italic</em>, H3+, inline code, images, or HTML tags.
          </Typography>
        </Box>
      </Collapse>

      {/* Editor */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Template editor
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Compose your template here, then copy the subject and body into GOV Notify. The standard
        SODC unsubscribe footer is added automatically.
      </Typography>

      {warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>Unsupported GOV Notify syntax detected:</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Stack spacing={2}>
        {/* Subject */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <Typography variant="body2" fontWeight={500}>
              Subject
            </Typography>
            {subject && <CopyButton text={fullSubject} label="subject" />}
          </Stack>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. Spring Dinner announcement"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Typography
                    variant="body2"
                    sx={{ color: "text.disabled", userSelect: "none", whiteSpace: "nowrap" }}
                  >
                    BULK:
                  </Typography>
                </InputAdornment>
              ),
            }}
            inputProps={{ "aria-label": "Template subject" }}
          />
        </Box>

        {/* Body */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <Typography variant="body2" fontWeight={500}>
              Body
            </Typography>
            {body && <CopyButton text={bodyWithFooter} label="body" />}
          </Stack>
          <TextField
            fullWidth
            multiline
            minRows={8}
            size="small"
            placeholder={`Dear ((firstName)),\n\nYour announcement text here...\n\nTip: use # for headings, * for bullets, [text](url) for links`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            inputProps={{ "aria-label": "Template body", style: { fontFamily: "monospace", fontSize: "0.85rem" } }}
          />
          <Typography variant="caption" color="text.secondary">
            The standard footer (SODC + unsubscribe link) will be appended automatically.
          </Typography>
        </Box>

        {/* Copy buttons (full-width) */}
        {(subject || body) && (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopy />}
              onClick={() => void navigator.clipboard.writeText(fullSubject)}
              disabled={!subject}
            >
              Copy subject
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopy />}
              onClick={() => void navigator.clipboard.writeText(bodyWithFooter)}
              disabled={!body}
            >
              Copy body
            </Button>
          </Stack>
        )}
      </Stack>

      {/* Live preview */}
      {body && (
        <>
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Preview
          </Typography>
          {subject && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Subject: <strong>{fullSubject}</strong>
            </Typography>
          )}
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              p: 2,
              bgcolor: "background.paper",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              fontFamily: "Arial, sans-serif",
              "& a": { color: "primary.main" },
              "& h1,h2": { fontFamily: "inherit" },
            }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </>
      )}
    </Box>
  );
}
