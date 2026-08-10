import { afterEach, describe, expect, it, vi } from "vitest";

const dataConnectMocks = vi.hoisted(() => ({
  executeQuery: vi.fn(),
  executeMutation: vi.fn(),
}));

vi.mock("firebase/data-connect", () => dataConnectMocks);

import {
  DATA_CONNECT_OPERATION_TIMEOUT_MS,
  executeDataConnectMutation,
  executeDataConnectQuery,
} from "../dataConnectExecution";

describe("bounded Data Connect execution", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("returns query results normally", async () => {
    const response = { data: { users: [] } };
    dataConnectMocks.executeQuery.mockResolvedValue(response);

    await expect(executeDataConnectQuery({} as never)).resolves.toBe(response);
  });

  it("rejects a query that never settles", async () => {
    vi.useFakeTimers();
    dataConnectMocks.executeQuery.mockReturnValue(new Promise<never>(() => undefined));
    const result = executeDataConnectQuery({} as never).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(DATA_CONNECT_OPERATION_TIMEOUT_MS);

    await expect(result).resolves.toMatchObject({
      code: "operation-timeout",
      message: "The Data Connect query timed out",
    });
  });

  it("rejects a mutation that never settles", async () => {
    vi.useFakeTimers();
    dataConnectMocks.executeMutation.mockReturnValue(new Promise<never>(() => undefined));
    const result = executeDataConnectMutation({} as never).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(DATA_CONNECT_OPERATION_TIMEOUT_MS);

    await expect(result).resolves.toMatchObject({
      code: "operation-timeout",
      message: "The Data Connect mutation timed out",
    });
  });
});
