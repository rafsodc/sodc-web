import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ColorModeProvider } from "../ColorModeProvider";
import { useColorMode } from "../ColorModeContext";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function clearCookies() {
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=; max-age=0; path=/`;
    }
  });
}

describe("ColorModeProvider / useColorMode", () => {
  beforeEach(() => {
    clearCookies();
  });

  it("defaults to system preference resolving to light when the OS prefers light", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useColorMode(), { wrapper: ColorModeProvider });

    expect(result.current.preference).toBe("system");
    expect(result.current.resolvedMode).toBe("light");
  });

  it("defaults to system preference resolving to dark when the OS prefers dark", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useColorMode(), { wrapper: ColorModeProvider });

    expect(result.current.preference).toBe("system");
    expect(result.current.resolvedMode).toBe("dark");
  });

  it("setPreference overrides the system preference", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useColorMode(), { wrapper: ColorModeProvider });

    act(() => result.current.setPreference("dark"));

    expect(result.current.preference).toBe("dark");
    expect(result.current.resolvedMode).toBe("dark");
  });

  it("persists an explicit preference in a cookie and restores it on the next mount", () => {
    mockMatchMedia(false);
    const first = renderHook(() => useColorMode(), { wrapper: ColorModeProvider });
    act(() => first.result.current.setPreference("dark"));

    expect(document.cookie).toContain("sodc-color-mode-preference=dark");

    const second = renderHook(() => useColorMode(), { wrapper: ColorModeProvider });
    expect(second.result.current.preference).toBe("dark");
    expect(second.result.current.resolvedMode).toBe("dark");
  });

  it("setPreference('system') clears the cookie and follows the OS again", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useColorMode(), { wrapper: ColorModeProvider });

    act(() => result.current.setPreference("light"));
    expect(result.current.resolvedMode).toBe("light");

    act(() => result.current.setPreference("system"));
    expect(result.current.preference).toBe("system");
    expect(result.current.resolvedMode).toBe("dark");
    expect(document.cookie).not.toContain("sodc-color-mode-preference=");
  });

  it("toggleSessionMode flips resolvedMode without changing the persisted preference", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useColorMode(), { wrapper: ColorModeProvider });

    expect(result.current.resolvedMode).toBe("light");

    act(() => result.current.toggleSessionMode());

    expect(result.current.resolvedMode).toBe("dark");
    expect(result.current.preference).toBe("system");
    expect(document.cookie).not.toContain("sodc-color-mode-preference=");
  });

  it("a fresh mount ignores a previous session's toggleSessionMode override", () => {
    mockMatchMedia(false);
    const first = renderHook(() => useColorMode(), { wrapper: ColorModeProvider });
    act(() => first.result.current.toggleSessionMode());
    expect(first.result.current.resolvedMode).toBe("dark");

    const second = renderHook(() => useColorMode(), { wrapper: ColorModeProvider });
    expect(second.result.current.resolvedMode).toBe("light");
  });

  it("setPreference clears any active session override", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useColorMode(), { wrapper: ColorModeProvider });

    act(() => result.current.toggleSessionMode());
    expect(result.current.resolvedMode).toBe("dark");

    act(() => result.current.setPreference("light"));
    expect(result.current.resolvedMode).toBe("light");
  });

  it("throws when useColorMode is used outside a ColorModeProvider", () => {
    const { result } = renderHook(() => {
      try {
        return useColorMode();
      } catch (error) {
        return error;
      }
    });
    expect(result.current).toBeInstanceOf(Error);
  });
});
