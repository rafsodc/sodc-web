import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeQuery, queryRef } from "firebase/data-connect";
import type { User } from "firebase/auth";
import { useUnenabledProfileCheck } from "../useUnenabledProfileCheck";
import { createMockUser } from "../../../test-utils/mocks/firebase";

beforeEach(() => { vi.mocked(executeQuery).mockReset(); vi.mocked(queryRef).mockReturnValue({} as never); });
describe("unenabled profile request ownership", () => {
  it("does not query anonymously and ignores A's completion after B starts", async () => {
    let resolveA!: (value: unknown) => void;
    let resolveB!: (value: unknown) => void;
    vi.mocked(executeQuery).mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }) as never)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }) as never);
    const a = createMockUser({ uid: "A" });
    const b = createMockUser({ uid: "B" });
    const { result, rerender } = renderHook(({ user }: { user: User | null }) => useUnenabledProfileCheck(user, null, false), { initialProps: { user: null as User | null } });
    expect(executeQuery).not.toHaveBeenCalled();
    rerender({ user: a });
    await waitFor(() => expect(executeQuery).toHaveBeenCalledOnce());
    rerender({ user: b });
    await waitFor(() => expect(executeQuery).toHaveBeenCalledTimes(2));
    await act(async () => resolveA({ data: { user: { membershipStatus: "RESIGNED" } } }));
    expect(result.current).toEqual({ membershipStatusForUnenabled: null, needsProfileCompletion: false });
    await act(async () => resolveB({ data: { user: { membershipStatus: "PENDING" } } }));
    expect(result.current.membershipStatusForUnenabled).toBe("PENDING");
    rerender({ user: null });
    expect(result.current).toEqual({ membershipStatusForUnenabled: null, needsProfileCompletion: false });
  });
});
