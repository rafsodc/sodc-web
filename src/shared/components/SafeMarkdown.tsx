import { Box, Divider, Link, Typography } from "@mui/material";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";

const ALLOWED_ELEMENTS = [
  "h1",
  "h2",
  "h3",
  "p",
  "em",
  "strong",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
  "code",
  "hr",
  "br",
] as const;

const components: Components = {
  h1: ({ children }) => <Typography component="h3" variant="h5" sx={{ mt: 2, mb: 1 }}>{children}</Typography>,
  h2: ({ children }) => <Typography component="h4" variant="h6" sx={{ mt: 2, mb: 1 }}>{children}</Typography>,
  h3: ({ children }) => <Typography component="h5" variant="subtitle1" fontWeight={600} sx={{ mt: 2, mb: 1 }}>{children}</Typography>,
  p: ({ children }) => <Typography component="p" variant="body1" sx={{ my: 1 }}>{children}</Typography>,
  ul: ({ children }) => <Box component="ul" sx={{ my: 1, pl: 3 }}>{children}</Box>,
  ol: ({ children }) => <Box component="ol" sx={{ my: 1, pl: 3 }}>{children}</Box>,
  li: ({ children }) => <Box component="li" sx={{ mb: 0.5 }}>{children}</Box>,
  a: ({ href, children }) => {
    if (!href) return <Typography component="span">{children}</Typography>;
    const external = href?.startsWith("http://") || href?.startsWith("https://");
    return (
      <Link href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer noopener" : undefined}>
        {children}
      </Link>
    );
  },
  blockquote: ({ children }) => (
    <Box component="blockquote" sx={{ my: 1.5, mx: 0, pl: 2, borderLeft: 4, borderColor: "divider", color: "text.secondary" }}>
      {children}
    </Box>
  ),
  code: ({ children }) => (
    <Box component="code" sx={{ px: 0.5, py: 0.25, borderRadius: 0.5, bgcolor: "action.hover", fontFamily: "monospace" }}>
      {children}
    </Box>
  ),
  hr: () => <Divider sx={{ my: 2 }} />,
};

export interface SafeMarkdownProps {
  children: string;
}

export default function SafeMarkdown({ children }: SafeMarkdownProps) {
  return (
    <Box sx={{ overflowWrap: "anywhere", color: "text.primary" }}>
      <ReactMarkdown
        allowedElements={[...ALLOWED_ELEMENTS]}
        components={components}
        skipHtml
        unwrapDisallowed
        urlTransform={defaultUrlTransform}
      >
        {children}
      </ReactMarkdown>
    </Box>
  );
}
