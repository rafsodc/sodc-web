interface TimestampInstant {
  wholeSecondMs: number;
  fraction: string;
}

function timestampInstant(value: string | null): TimestampInstant | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})[Tt]([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d+))?([Zz]|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match) return null;
  const [, date, hour, minute, second, fraction = "", zone] = match;
  const wallSecond = `${date}T${hour}:${minute}:${second}`;
  // Parse only whole seconds; keep every fractional digit out of Date's millisecond conversion.
  const wallSecondMs = Date.parse(`${wallSecond}Z`);
  // Date.parse accepts calendar rollovers; lease identity must fail closed.
  if (!Number.isFinite(wallSecondMs) || new Date(wallSecondMs).toISOString().slice(0, 19) !== wallSecond) return null;
  const offsetMinutes = zone.toUpperCase() === "Z" ? 0
    : (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6))) * (zone[0] === "+" ? 1 : -1);
  return { wholeSecondMs: wallSecondMs - offsetMinutes * 60_000, fraction: fraction.replace(/0+$/, "") };
}

/** Compare RFC3339 instants without discarding any fractional-second precision. */
export function notificationDeliveryTimestampsEqual(left: string | null, right: string | null): boolean {
  const first = timestampInstant(left);
  const second = timestampInstant(right);
  return first !== null && second !== null && first.wholeSecondMs === second.wholeSecondMs && first.fraction === second.fraction;
}
