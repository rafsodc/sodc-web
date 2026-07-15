const PREFIX = "announcement:";

/**
 * GOV Notify round-trips the `reference` string we set at send time back in delivery
 * receipts (see #334) — this is the correlation id used to find which AnnouncementRecipient
 * row a receipt is about, without needing a separate notifyId column/lookup.
 */
export function buildAnnouncementReference(sendId: string, recipientId: string): string {
  return `${PREFIX}${sendId}:${recipientId}`;
}

export interface ParsedAnnouncementReference {
  sendId: string;
  recipientId: string;
}

/** Returns null for references that aren't ours (e.g. other transactional emails sharing this webhook). */
export function parseAnnouncementReference(reference: string | undefined | null): ParsedAnnouncementReference | null {
  if (!reference || !reference.startsWith(PREFIX)) {
    return null;
  }
  const [sendId, recipientId] = reference.slice(PREFIX.length).split(":");
  if (!sendId || !recipientId) {
    return null;
  }
  return { sendId, recipientId };
}
