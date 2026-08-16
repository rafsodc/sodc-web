/** Escape a literal substring for a Data Connect/Postgres regular expression. */
export function dataConnectContainsPattern(searchTerm: string): string {
  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  return `.*${escaped}.*`;
}

/** Data Connect regex pattern for a literal, case-insensitive substring search. */
export function caseInsensitiveContainsPattern(searchTerm: string): string {
  return `(?i)${dataConnectContainsPattern(searchTerm)}`;
}
