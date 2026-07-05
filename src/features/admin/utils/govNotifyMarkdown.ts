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
];

export const STANDARD_FOOTER = "---\nSODC\n\n[Unsubscribe](((unsubscribeUrl)))";

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

  // Combined pattern: [text](((var))), [text](url), ((variable))
  const pattern =
    /\[([^\]]+)\]\(\(\(([^)]+)\)\)\)|\[([^\]]+)\]\(([^)]+)\)|\(\(([^)]+)\)\)/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    parts.push(escapeHtml(line.slice(lastIndex, match.index)));

    if (match[1] !== undefined) {
      // [text](((var))) — personalisation variable as URL
      parts.push(`<a href="#">${escapeHtml(match[1])}</a>`);
    } else if (match[3] !== undefined) {
      // [text](url) — regular link
      parts.push(`<a href="${escapeHtml(match[4] ?? "")}">${escapeHtml(match[3])}</a>`);
    } else if (match[5] !== undefined) {
      // ((variable))
      parts.push(
        `<mark style="background:#ffdd00;padding:0 2px">${escapeHtml(match[5])}</mark>`
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
    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      closeList();
      const level = Math.min(headingMatch[1].length, 4);
      const sizes = ["1.5rem", "1.25rem", "1.1rem", "1rem"];
      parts.push(
        `<h${level} style="font-size:${sizes[level - 1]};margin:1em 0 0.5em;font-weight:700">${renderInline(headingMatch[2])}</h${level}>`
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line)) {
      closeList();
      parts.push(
        `<hr style="border:none;border-top:1px solid #b1b4b6;margin:1.5em 0" />`
      );
      continue;
    }

    // Inset text (^)
    if (line.startsWith("^")) {
      closeList();
      parts.push(
        `<div style="border-left:5px solid #b1b4b6;padding-left:1em;margin:1em 0;color:#505a5f">${renderInline(line.slice(1).trim())}</div>`
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
