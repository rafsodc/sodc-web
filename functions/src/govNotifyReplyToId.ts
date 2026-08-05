export const GOV_NOTIFY_EMAIL_REPLY_TO_ID_ENV = "GOV_NOTIFY_EMAIL_REPLY_TO_ID";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseGovNotifyEmailReplyToId(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed.toLowerCase() : undefined;
}

export function getGovNotifyEmailReplyToId(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return parseGovNotifyEmailReplyToId(env[GOV_NOTIFY_EMAIL_REPLY_TO_ID_ENV]);
}
