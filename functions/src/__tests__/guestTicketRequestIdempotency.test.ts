import { describe, expect, it, vi } from "vitest";
import {
  guestTicketRequestId,
  runIdempotentAtomicBatch,
  runIdempotentBatch,
} from "../guestTicketRequestIdempotency";

const base = {
  callerUid: "firebase-user",
  bookingId: "10000000-0000-4000-8000-000000000001",
  idempotencyKey: "20000000-0000-4000-8000-000000000001",
};

describe("guestTicketRequestId", () => {
  it("is stable for a retry and distinct for each guest index", () => {
    expect(guestTicketRequestId({ ...base, index: 0 })).toBe(guestTicketRequestId({ ...base, index: 0 }));
    expect(guestTicketRequestId({ ...base, index: 1 })).not.toBe(guestTicketRequestId({ ...base, index: 0 }));
    expect(guestTicketRequestId({ ...base, index: 0 })).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("binds ids to the caller, booking, and client key", () => {
    const id = guestTicketRequestId({ ...base, index: 0 });
    expect(guestTicketRequestId({ ...base, callerUid: "other", index: 0 })).not.toBe(id);
    expect(guestTicketRequestId({ ...base, idempotencyKey: "20000000-0000-4000-8000-000000000002", index: 0 })).not.toBe(id);
  });
});

describe("runIdempotentBatch", () => {
  it("reconciles a partial failure and creates only missing rows on retry", async () => {
    const stored = new Map<string, string>();
    let failSecond = true;
    const run = () => runIdempotentBatch({
      items: ["Jane", "Sam"],
      idForIndex: (index) => `request-${index}`,
      load: async (id) => stored.get(id),
      create: async (name, index, id) => {
        if (index === 1 && failSecond) throw new Error("temporary failure");
        stored.set(id, name);
      },
      matches: (existing, name) => existing === name,
      result: async (existing, id, replayed) => ({ existing, id, replayed }),
    });

    await expect(run()).rejects.toThrow("temporary failure");
    expect(stored).toEqual(new Map([["request-0", "Jane"]]));
    failSecond = false;
    await expect(run()).resolves.toEqual([
      { existing: "Jane", id: "request-0", replayed: true },
      { existing: "Sam", id: "request-1", replayed: false },
    ]);
    expect(stored).toHaveLength(2);
  });
});

describe("runIdempotentAtomicBatch", () => {
  it("writes all missing rows in one call and replays without another write", async () => {
    const stored = new Map<string, string>();
    const insertMany = vi.fn(async (rows: readonly { id: string; value: string }[]) => {
      for (const row of rows) stored.set(row.id, row.value);
    });
    const args = {
      items: ["Ada", "Grace"],
      loadAll: async () => [stored.get("id-1"), stored.get("id-2")],
      buildMissingRows: (existing: readonly (string | undefined)[]) =>
        ["Ada", "Grace"].flatMap((value, index) => existing[index] ? [] : [{ id: `id-${index + 1}`, value }]),
      insertMany,
      matches: (existing: string, item: string) => existing === item,
    };

    await expect(runIdempotentAtomicBatch(args)).resolves.toEqual(["Ada", "Grace"]);
    await expect(runIdempotentAtomicBatch(args)).resolves.toEqual(["Ada", "Grace"]);
    expect(insertMany).toHaveBeenCalledTimes(1);
    expect(insertMany).toHaveBeenCalledWith([
      { id: "id-1", value: "Ada" },
      { id: "id-2", value: "Grace" },
    ]);
  });
});
