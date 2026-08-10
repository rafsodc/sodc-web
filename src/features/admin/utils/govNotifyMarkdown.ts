export const UNSUPPORTED_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "bold (**text**)", pattern: /\*\*[^*]+\*\*/ },
  { name: "bold (__text__)", pattern: /__[^_]+__/ },
  {
    name: "italic (*text*)",
    pattern: /(?<!\*)\*(?!\*)(?!\s)([^*\n]+)(?<!\s)\*(?!\*)/,
  },
  { name: "italic (_text_)", pattern: /(?<!_)_(?!_)(?!\s)([^_\n]+)(?<!\s)_(?!_)/ },
  { name: "strikethrough (~~text~~)", pattern: /~~[^~]+~~/ },
  { name: "inline code (`code`)", pattern: /`[^`]+`/ },
  { name: "fenced code block (```)", pattern: /^```/m },
  { name: "blockquote (> text)", pattern: /^> /m },
  { name: "image (![alt](url))", pattern: /!\[[^\]]*\]\([^)]+\)/ },
  { name: "HTML tag (<tag>)", pattern: /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/ },
  { name: "heading H3 or deeper (### text)", pattern: /^#{3,}\s/m },
];

export const STANDARD_FOOTER =
  "---\n" +
  "This email is being sent as part of the RAF SODC. " +
  "It has been sent to you as you are a member of the ((section)) section. " +
  "To unsubscribe from this section, please click the link below. " +
  "Your communication preferences can be updated from your user account.\n\n" +
  "[Unsubscribe](((unsubscribeUrl)))\n\n" +
  "SODC";

export interface GovNotifyPreviewColors {
  optionalBackground: string;
  optionalText: string;
  optionalBorder: string;
  variableBackground: string;
  variableText: string;
  divider: string;
  insetText: string;
}

export function getGovNotifyPreviewColors(
  mode: "light" | "dark"
): GovNotifyPreviewColors {
  return mode === "dark"
    ? {
        optionalBackground: "#1B5E20",
        optionalText: "#E8F5E9",
        optionalBorder: "#81C784",
        variableBackground: "#665A00",
        variableText: "#FFF8C5",
        divider: "rgba(255, 255, 255, 0.23)",
        insetText: "rgba(255, 255, 255, 0.7)",
      }
    : {
        optionalBackground: "#E8F5E9",
        optionalText: "#1B5E20",
        optionalBorder: "#66BB6A",
        variableBackground: "#FFDD00",
        variableText: "#0B0C0C",
        divider: "#B1B4B6",
        insetText: "#505A5F",
      };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(line: string): string {
  const parts: string[] = [];
  let lastIndex = 0;

  // Combined pattern (order matters — more specific first):
  // 1. ((var??optional text))  — conditional/optional content
  // 2. [text](((var)))         — personalisation variable as URL
  // 3. [text](url)             — regular link
  // 4. ((variable))            — personalisation variable
  const pattern =
    /\(\(([^?)]+)\?\?([^)]*)\)\)|\[([^\]]+)\]\(\(\(([^)]+)\)\)\)|\[([^\]]+)\]\(([^)]+)\)|\(\(([^)]+)\)\)/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    parts.push(escapeHtml(line.slice(lastIndex, match.index)));

    if (match[1] !== undefined) {
      // ((var??optional text))
      parts.push(
        `<span style="background:var(--notify-optional-bg,#E8F5E9);color:var(--notify-optional-text,#1B5E20);padding:0 2px;border:1px dashed var(--notify-optional-border,#66BB6A)">${escapeHtml(match[2])}</span>`
      );
    } else if (match[3] !== undefined) {
      // [text](((var))) — personalisation variable as URL
      parts.push(`<a href="#">${escapeHtml(match[3])}</a>`);
    } else if (match[5] !== undefined) {
      // [text](url) — regular link
      parts.push(`<a href="${escapeHtml(match[6] ?? "")}">${escapeHtml(match[5])}</a>`);
    } else if (match[7] !== undefined) {
      // ((variable))
      parts.push(
        `<mark style="background:var(--notify-variable-bg,#FFDD00);color:var(--notify-variable-text,#0B0C0C);padding:0 2px">${escapeHtml(match[7])}</mark>`
      );
    }

    lastIndex = match.index + match[0].length;
  }

  parts.push(escapeHtml(line.slice(lastIndex)));
  return parts.join("");
}

export function renderGovNotifyMarkdown(body: string): string {
  const lines = body.split("\n");
  const parts: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (inList) {
      parts.push(listType === "ul" ? "</ul>" : "</ol>");
      inList = false;
      listType = null;
    }
  };

  for (const line of lines) {
    // Heading (H1 and H2 only — H3+ warned as unsupported)
    const headingMatch = line.match(/^(#{1,2})\s+(.+)/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length as 1 | 2;
      const sizes: Record<1 | 2, string> = { 1: "1.5rem", 2: "1.25rem" };
      parts.push(
        `<h${level} style="font-size:${sizes[level]};margin:1em 0 0.5em;font-weight:700">${renderInline(headingMatch[2])}</h${level}>`
      );
      continue;
    }

    // Horizontal rule (used by footer — not advertised but supported)
    if (/^---+$/.test(line)) {
      closeList();
      parts.push(
        `<hr style="border:none;border-top:1px solid var(--notify-divider,#B1B4B6);margin:1.5em 0" />`
      );
      continue;
    }

    // Inset text (^)
    if (line.startsWith("^")) {
      closeList();
      parts.push(
        `<div style="border-left:5px solid var(--notify-divider,#B1B4B6);padding-left:1em;margin:1em 0;color:var(--notify-inset-text,#505A5F)">${renderInline(line.slice(1).trim())}</div>`
      );
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[*-]\s+(.+)/);
    if (ulMatch) {
      if (!inList || listType !== "ul") {
        closeList();
        parts.push(`<ul style="margin:0.5em 0;padding-left:1.5em">`);
        inList = true;
        listType = "ul";
      }
      parts.push(`<li>${renderInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        closeList();
        parts.push(`<ol style="margin:0.5em 0;padding-left:1.5em">`);
        inList = true;
        listType = "ol";
      }
      parts.push(`<li>${renderInline(olMatch[1])}</li>`);
      continue;
    }

    // Empty line closes list / paragraph break
    if (line.trim() === "") {
      closeList();
      continue;
    }

    // Regular paragraph line — close list first
    closeList();
    parts.push(`<p style="margin:0.5em 0">${renderInline(line)}</p>`);
  }

  closeList();
  return parts.join("\n");
}
