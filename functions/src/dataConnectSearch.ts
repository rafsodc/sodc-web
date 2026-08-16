function escapeDataConnectRegex(searchTerm: string): string {
  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  return escaped;
}

/** Self-contained, literal, case-insensitive Data Connect substring pattern. */
export function caseInsensitiveContainsPattern(searchTerm: string): string {
  return `(?i).*${escapeDataConnectRegex(searchTerm)}.*`;
}
