import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Collapse,
  Divider,
  IconButton,
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

interface ToolbarItem {
  label: string;
  tooltip: string;
  prefix: string;
  suffix: string;
  placeholder: string;
  block: boolean;
}

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { label: "# H1",        tooltip: "Heading 1",            prefix: "# ",          suffix: "",       placeholder: "Heading",        block: true  },
  { label: "## H2",       tooltip: "Heading 2",            prefix: "## ",         suffix: "",       placeholder: "Heading",        block: true  },
  { label: "• Bullet",    tooltip: "Bullet point",         prefix: "* ",          suffix: "",       placeholder: "item",           block: true  },
  { label: "1. List",     tooltip: "Numbered list",        prefix: "1. ",         suffix: "",       placeholder: "item",           block: true  },
  { label: "^ Inset",     tooltip: "Inset text",           prefix: "^ ",          suffix: "",       placeholder: "note",           block: true  },
  { label: "Link",        tooltip: "Link [text](url)",     prefix: "[",           suffix: "](url)", placeholder: "link text",      block: false },
  { label: "((var))",     tooltip: "Personalisation var",  prefix: "((",          suffix: "))",     placeholder: "firstName",      block: false },
  { label: "((opt??…))",  tooltip: "Optional content",     prefix: "((condition??", suffix: "))",   placeholder: "optional text",  block: false },
];

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
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);

  const suggestedName = `BULK: ${sectionName} — `;
  const templateName = `BULK: ${sectionName} — ${subject || "…"}`;

  const bodyWithFooter = body.trim()
    ? `${body.trim()}\n\n${STANDARD_FOOTER}`
    : STANDARD_FOOTER;

  const warnings = useMemo(() => {
    const found: string[] = [];
    for (const { name, pattern } of UNSUPPORTED_PATTERNS) {
      if (pattern.test(bodyWithFooter) || pattern.test(subject)) {
        found.push(name);
      }
    }
    return found;
  }, [subject, bodyWithFooter]);

  const previewHtml = useMemo(
    () => renderGovNotifyMarkdown(bodyWithFooter),
    [bodyWithFooter]
  );

  const insertAtCursor = (item: ToolbarItem) => {
    const el = bodyInputRef.current;
    if (!el) return;

    const { selectionStart: start, selectionEnd: end } = el;
    const selected = body.slice(start, end) || item.placeholder;

    let linePrefix = "";
    if (item.block) {
      const isAtLineStart = start === 0 || body[start - 1] === "\n";
      linePrefix = isAtLineStart ? "" : "\n";
    }

    const insertion = linePrefix + item.prefix + selected + item.suffix;
    const newBody = body.slice(0, start) + insertion + body.slice(end);
    setBody(newBody);

    requestAnimationFrame(() => {
      el.focus();
      const selStart = start + linePrefix.length + item.prefix.length;
      const selEnd = selStart + selected.length;
      el.setSelectionRange(selStart, selEnd);
    });
  };

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
                <li><code>((firstName))</code> — used in the salutation</li>
                <li><code>((unsubscribeUrl))</code> — required in the footer unsubscribe link</li>
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
        Compose your template here, then copy each field into GOV Notify. The standard SODC
        unsubscribe footer is added to the body automatically.
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
            <Typography variant="body2" fontWeight={500}>Subject</Typography>
            {subject && <CopyButton text={subject} label="subject" />}
          </Stack>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. SODC — Spring Dinner announcement"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            inputProps={{ "aria-label": "Template subject" }}
          />
        </Box>

        {/* Template name (auto-derived, read-only) */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <Typography variant="body2" fontWeight={500}>Template name</Typography>
            <CopyButton text={templateName} label="template name" />
          </Stack>
          <Box
            sx={{
              fontFamily: "monospace",
              fontSize: "0.875rem",
              px: 1.5,
              py: 0.875,
              bgcolor: "action.hover",
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              color: subject ? "text.primary" : "text.disabled",
            }}
            aria-label="Template name"
          >
            {templateName}
          </Box>
          <Typography variant="caption" color="text.secondary">
            Auto-generated from the section and subject — use this as the name in GOV Notify.
          </Typography>
        </Box>

        {/* Body */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <Typography variant="body2" fontWeight={500}>Body</Typography>
            {body && <CopyButton text={bodyWithFooter} label="body" />}
          </Stack>

          {/* Markdown toolbar */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 0.5,
              mb: 0.5,
              p: 0.75,
              bgcolor: "action.hover",
              borderRadius: "4px 4px 0 0",
              border: "1px solid",
              borderColor: "divider",
              borderBottom: "none",
            }}
          >
            {TOOLBAR_ITEMS.map((item) => (
              <Tooltip key={item.label} title={item.tooltip}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => insertAtCursor(item)}
                  sx={{
                    minWidth: 0,
                    px: 1,
                    py: 0.25,
                    fontSize: "0.75rem",
                    fontFamily: item.label.startsWith("#") || item.label.startsWith("((") ? "monospace" : "inherit",
                    lineHeight: 1.5,
                  }}
                  aria-label={item.tooltip}
                >
                  {item.label}
                </Button>
              </Tooltip>
            ))}
          </Box>

          <TextField
            fullWidth
            multiline
            minRows={8}
            size="small"
            placeholder={`Dear ((firstName)),\n\nYour announcement text here...\n\nUse the toolbar above to insert Markdown.`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            inputRef={bodyInputRef}
            inputProps={{
              "aria-label": "Template body",
              style: { fontFamily: "monospace", fontSize: "0.85rem" },
            }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "0 0 4px 4px" } }}
          />
          <Typography variant="caption" color="text.secondary">
            The standard footer (SODC + unsubscribe link) will be appended automatically.
          </Typography>
        </Box>

        {/* Full-width copy buttons */}
        {(subject || body) && (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopy />}
              onClick={() => void navigator.clipboard.writeText(subject)}
              disabled={!subject}
            >
              Copy subject
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopy />}
              onClick={() => void navigator.clipboard.writeText(templateName)}
              disabled={!subject}
            >
              Copy template name
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
              Subject: <strong>{subject}</strong>
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
