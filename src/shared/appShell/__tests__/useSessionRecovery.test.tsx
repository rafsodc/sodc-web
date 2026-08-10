import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockUser } from "../../../test-utils/mocks/firebase";

const refreshTokenMock = vi.hoisted(() => vi.fn());

vi.mock("../../../features/users/hooks/useTokenRefresh", () => ({
  refreshToken: refreshTokenMock,
}));

import { useSessionRecovery } from "../useSessionRecovery";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function setVisibility(value: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useSessionRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshTokenMock.mockResolvedValue(undefined);
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes once and replaces active queries after resuming beyond the idle threshold", async () => {
    const queryClient = new QueryClient();
    const cancelSpy = vi.spyOn(queryClient, "cancelQueries");
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    let currentTime = 1_000;
    const now = () => currentTime;
    const user = createMockUser({ uid: "idle-user" });

    const { result } = renderHook(
      () => useSessionRecovery(user, { idleThresholdMs: 100, now }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => setVisibility("hidden"));
    currentTime += 101;
    act(() => setVisibility("visible"));

    await waitFor(() => expect(refreshTokenMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(cancelSpy).toHaveBeenCalledWith({ type: "active" });
    expect(invalidateSpy).toHaveBeenCalledWith({ type: "active" });
  });

  it("shares recovery when resume and manual retry overlap", async () => {
    let finishRefresh!: () => void;
    refreshTokenMock.mockReturnValue(
      new Promise<void>((resolve) => {
        finishRefresh = resolve;
      }),
    );
    const queryClient = new QueryClient();
    let currentTime = 1_000;
    const now = () => currentTime;
    const user = createMockUser({ uid: "overlap-user" });
    const { result } = renderHook(
      () => useSessionRecovery(user, { idleThresholdMs: 100, now }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => setVisibility("hidden"));
    currentTime += 101;
    act(() => setVisibility("visible"));
    await waitFor(() => expect(result.current.status).toBe("recovering"));

    void result.current.retry();
    expect(refreshTokenMock).toHaveBeenCalledTimes(1);

    finishRefresh();
    await waitFor(() => expect(result.current.status).toBe("idle"));
  });

  it("exits recovery with an actionable failure when token refresh fails", async () => {
    refreshTokenMock.mockRejectedValue(new Error("refresh rejected"));
    const queryClient = new QueryClient();
    const user = createMockUser({ uid: "failed-user" });
    const { result } = renderHook(() => useSessionRecovery(user), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => result.current.retry());

    expect(result.current.status).toBe("failed");
    expect(result.current.failure).toBe("refresh-failed");
    expect(refreshTokenMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes once and retries an active query after an authentication error", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = createMockUser({ uid: "auth-error-user" });
    renderHook(() => useSessionRecovery(user), {
      wrapper: createWrapper(queryClient),
    });
    const queryFn = vi
      .fn()
      .mockRejectedValueOnce({ code: "dataconnect/unauthorized" })
      .mockResolvedValueOnce({ value: "recovered" });
    const observer = new QueryObserver(queryClient, {
      queryKey: ["authenticated-query"],
      queryFn,
      retry: false,
    });
    const unsubscribe = observer.subscribe(() => undefined);

    await waitFor(() => expect(observer.getCurrentResult().isSuccess).toBe(true));

    expect(refreshTokenMock).toHaveBeenCalledTimes(1);
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().data).toEqual({ value: "recovered" });
    unsubscribe();
  });

  it("does not loop when the retried query is still unauthorized", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = createMockUser({ uid: "persistent-auth-error-user" });
    renderHook(() => useSessionRecovery(user), {
      wrapper: createWrapper(queryClient),
    });
    const queryFn = vi.fn().mockRejectedValue({ code: 401 });
    const observer = new QueryObserver(queryClient, {
      queryKey: ["still-unauthorized"],
      queryFn,
      retry: false,
    });
    const unsubscribe = observer.subscribe(() => undefined);

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(observer.getCurrentResult().isError).toBe(true));

    expect(refreshTokenMock).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("cancels a query that never settles and exits its indefinite loading state", async () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const cancelSpy = vi.spyOn(queryClient, "cancelQueries");
    const user = createMockUser({ uid: "timeout-user" });
    const { result } = renderHook(
      () => useSessionRecovery(user, { queryTimeoutMs: 100 }),
      { wrapper: createWrapper(queryClient) },
    );

    const pendingQueryResult = queryClient
      .fetchQuery({
        queryKey: ["never-settles"],
        queryFn: () => new Promise<never>(() => undefined),
      })
      .catch((error: unknown) => error);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(101);
    });

    expect(result.current.status).toBe("failed");
    expect(result.current.failure).toBe("request-timeout");
    expect(cancelSpy).toHaveBeenCalledWith({
      queryKey: ["never-settles"],
      exact: true,
    });
    await expect(pendingQueryResult).resolves.toBeDefined();
  });

  it("exits a generated mutation's indefinite loading state", async () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const user = createMockUser({ uid: "mutation-timeout-user" });
    const { result } = renderHook(
      () => useSessionRecovery(user, { queryTimeoutMs: 100 }),
      { wrapper: createWrapper(queryClient) },
    );
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => new Promise<never>(() => undefined),
    });

    void mutation.execute(undefined);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(101);
    });

    expect(result.current.status).toBe("failed");
    expect(result.current.failure).toBe("request-timeout");
  });
});
