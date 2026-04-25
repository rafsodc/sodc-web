import { vi } from "vitest";

export interface DataConnectQueryResultOverrides {
  data?: unknown;
  isLoading?: boolean;
  isError?: boolean;
  refetch?: ReturnType<typeof vi.fn>;
}

export function dataConnectQueryResult<THook extends (...args: never[]) => unknown>(
  overrides: DataConnectQueryResultOverrides = {}
): ReturnType<THook> {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as ReturnType<THook>;
}
