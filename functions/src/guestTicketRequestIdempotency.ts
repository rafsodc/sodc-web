import { createHash } from "node:crypto";

/**
 * Produces a stable RFC 4122-shaped UUID for one row in a client submission.
 * Retrying the same batch therefore targets the same Data Connect primary keys.
 */
export function guestTicketRequestId(args: {
  callerUid: string;
  bookingId: string;
  idempotencyKey: string;
  index: number;
}): string {
  const bytes = createHash("sha256")
    .update(`${args.callerUid}\0${args.bookingId}\0${args.idempotencyKey}\0${args.index}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("idempotency key is already bound to different input");
    this.name = "IdempotencyConflictError";
  }
}

/**
 * Runs a batch so a partial first attempt can be retried safely. Rows already
 * present under their deterministic ids are returned instead of recreated.
 */
export async function runIdempotentBatch<TItem, TExisting, TResult>(args: {
  items: readonly TItem[];
  idForIndex: (index: number) => string;
  load: (id: string) => Promise<TExisting | undefined>;
  create: (item: TItem, index: number, id: string) => Promise<void>;
  matches: (existing: TExisting, item: TItem) => boolean;
  result: (existing: TExisting, id: string, replayed: boolean) => Promise<TResult> | TResult;
}): Promise<TResult[]> {
  const results: TResult[] = [];
  for (const [index, item] of args.items.entries()) {
    const id = args.idForIndex(index);
    let existing = await args.load(id);
    let replayed = Boolean(existing);
    if (!existing) {
      try {
        await args.create(item, index, id);
      } catch (error) {
        existing = await args.load(id);
        if (!existing || !args.matches(existing, item)) throw error;
        replayed = true;
      }
      existing ??= await args.load(id);
    }
    if (!existing || !args.matches(existing, item)) throw new IdempotencyConflictError();
    results.push(await args.result(existing, id, replayed));
  }
  return results;
}

/**
 * Creates every missing row through one atomic bulk write. A concurrent retry that
 * wins the race is accepted only when every deterministic row matches its input.
 */
export async function runIdempotentAtomicBatch<TItem, TExisting, TRow>(args: {
  items: readonly TItem[];
  loadAll: () => Promise<Array<TExisting | undefined>>;
  buildMissingRows: (existing: readonly (TExisting | undefined)[]) => TRow[];
  insertMany: (rows: readonly TRow[]) => Promise<void>;
  matches: (existing: TExisting, item: TItem) => boolean;
}): Promise<TExisting[]> {
  const allMatch = (rows: readonly (TExisting | undefined)[]) =>
    rows.length === args.items.length && rows.every(
      (row, index) => row && args.matches(row, args.items[index]!)
    );
  let existing = await args.loadAll();
  for (const [index, row] of existing.entries()) {
    if (row && !args.matches(row, args.items[index]!)) throw new IdempotencyConflictError();
  }
  const rows = args.buildMissingRows(existing);
  if (rows.length > 0) {
    try {
      await args.insertMany(rows);
    } catch (error) {
      existing = await args.loadAll();
      if (!allMatch(existing)) throw error;
      return existing as TExisting[];
    }
  }
  existing = await args.loadAll();
  if (!allMatch(existing)) throw new IdempotencyConflictError();
  return existing as TExisting[];
}
