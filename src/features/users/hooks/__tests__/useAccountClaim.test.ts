import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAdminClaim } from "../useAdminClaim";
import { useEnabledClaim } from "../useEnabledClaim";
import { createMockUser } from "../../../../test-utils/mocks/firebase";
import type { User, IdTokenResult } from "firebase/auth";
vi.mock("../useTokenRefresh", () => ({ useTokenRefresh: vi.fn() }));

describe("owned account claims", () => {
  it("immediately hides A privileges and ignores late A claims after B or logout", async () => {
    let resolveA!: (claims: IdTokenResult) => void;
    const a = createMockUser({ uid: "A", getIdTokenResult: vi.fn(() => new Promise<IdTokenResult>((resolve) => { resolveA = resolve; })) });
    const b = createMockUser({ uid: "B", getIdTokenResult: vi.fn().mockResolvedValue({ claims: { admin: false, enabled: false } }) });
    const { result, rerender } = renderHook(({ user }: { user: User | null }) => ({ admin: useAdminClaim(user), enabled: useEnabledClaim(user) }), { initialProps: { user: a as User | null } });
    rerender({ user: b });
    expect(result.current.admin).toBe(false);
    await waitFor(() => expect(result.current.enabled.isEnabledClaimResolved).toBe(true));
    await act(async () => resolveA({ claims: { admin: true, enabled: true } } as unknown as IdTokenResult));
    expect(result.current.admin).toBe(false);
    expect(result.current.enabled.isEnabled).toBe(false);
    rerender({ user: null });
    expect(result.current).toEqual({ admin: false, enabled: { isEnabled: false, isEnabledClaimResolved: true } });
  });
  it("removes resolved A claims on the first B render while B claims are pending", async () => {
    const a = createMockUser({ uid: "A", getIdTokenResult: vi.fn().mockResolvedValue({ claims: { admin: true, enabled: true } }) });
    const b = createMockUser({ uid: "B", getIdTokenResult: vi.fn(() => new Promise<IdTokenResult>(() => undefined)) });
    const { result, rerender } = renderHook(({ user }) => ({ admin: useAdminClaim(user), enabled: useEnabledClaim(user) }), { initialProps: { user: a } });
    await waitFor(() => expect(result.current.admin).toBe(true));
    rerender({ user: b });
    expect(result.current.admin).toBe(false);
    expect(result.current.enabled).toEqual({ isEnabled: false, isEnabledClaimResolved: false });
  });
});
