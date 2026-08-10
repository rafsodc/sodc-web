import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockUser } from "../../../../test-utils/mocks/firebase";

const authMocks = vi.hoisted(() => ({
  tokenListener: null as ((user: ReturnType<typeof createMockUser> | null) => void) | null,
  unsubscribe: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  onIdTokenChanged: vi.fn((_auth, callback) => {
    authMocks.tokenListener = callback;
    return authMocks.unsubscribe;
  }),
}));

vi.mock("../../../config/firebase", () => ({ auth: {} }));

import { refreshToken, useTokenRefresh } from "../useTokenRefresh";

describe("useTokenRefresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.tokenListener = null;
  });

  it("shares one forced refresh between concurrent callers", async () => {
    let resolveToken!: (token: string) => void;
    const getIdToken = vi.fn(
      () => new Promise<string>((resolve) => {
        resolveToken = resolve;
      }),
    );
    const user = createMockUser({ uid: "concurrent-user", getIdToken });
    const onTokenChange = vi.fn();
    renderHook(() => useTokenRefresh(user, onTokenChange));

    const first = refreshToken(user);
    const second = refreshToken(user);

    expect(second).toBe(first);
    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(getIdToken).toHaveBeenCalledWith(true);

    resolveToken("new-token");
    await act(async () => first);
    expect(onTokenChange).toHaveBeenCalledTimes(1);
  });

  it("does not force another refresh from the token-change listener", async () => {
    const getIdToken = vi.fn().mockResolvedValue("listener-token");
    const user = createMockUser({ uid: "listener-user", getIdToken });
    const onTokenChange = vi.fn();
    renderHook(() => useTokenRefresh(user, onTokenChange));

    await act(async () => {
      await authMocks.tokenListener?.(user);
    });

    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(getIdToken).toHaveBeenCalledWith();
    expect(onTokenChange).toHaveBeenCalledTimes(1);
  });
});
