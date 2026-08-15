import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLatestRequestGuard } from "../useLatestRequestGuard";

describe("useLatestRequestGuard", () => {
  it("keeps its API stable across rerenders", () => {
    const { result, rerender } = renderHook(() => useLatestRequestGuard());
    const initialGuard = result.current;

    rerender();

    expect(result.current).toBe(initialGuard);
  });

  it("supersedes an older request when a newer request starts", () => {
    const { result } = renderHook(() => useLatestRequestGuard());
    let firstToken = 0;
    let secondToken = 0;

    act(() => {
      firstToken = result.current.start();
      secondToken = result.current.start();
    });

    expect(result.current.isCurrent(firstToken)).toBe(false);
    expect(result.current.isCurrent(secondToken)).toBe(true);
  });

  it("invalidates the current request explicitly", () => {
    const { result } = renderHook(() => useLatestRequestGuard());
    let token = 0;

    act(() => {
      token = result.current.start();
      result.current.invalidate();
    });

    expect(result.current.isCurrent(token)).toBe(false);
  });

  it("invalidates the current request on unmount", () => {
    const { result, unmount } = renderHook(() => useLatestRequestGuard());
    const guard = result.current;
    let token = 0;

    act(() => {
      token = guard.start();
    });
    unmount();

    expect(guard.isCurrent(token)).toBe(false);
  });
});
