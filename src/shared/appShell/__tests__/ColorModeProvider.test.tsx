import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { ColorModeProvider } from "../ColorModeProvider";
import { useColorMode } from "../ColorModeContext";
import { CookiePreferencesProvider } from "../../cookies/CookiePreferencesProvider";
import { useCookiePreferences } from "../../cookies/CookiePreferencesContext";

function TestProviders({ children }: { children: ReactNode }) {
  return (
    <CookiePreferencesProvider>
      <ColorModeProvider>{children}</ColorModeProvider>
    </CookiePreferencesProvider>
  );
}

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
    const { result } = renderHook(() => useColorMode(), { wrapper: TestProviders });

    expect(result.current.preference).toBe("system");
    expect(result.current.resolvedMode).toBe("light");
  });

  it("defaults to system preference resolving to dark when the OS prefers dark", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useColorMode(), { wrapper: TestProviders });

    expect(result.current.preference).toBe("system");
    expect(result.current.resolvedMode).toBe("dark");
  });

  it("setPreference overrides the system preference", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useColorMode(), { wrapper: TestProviders });

    act(() => result.current.setPreference("dark"));

    expect(result.current.preference).toBe("dark");
    expect(result.current.resolvedMode).toBe("dark");
  });

  it("persists an explicit preference in a cookie and restores it on the next mount", () => {
    mockMatchMedia(false);
    const first = renderHook(() => useColorMode(), { wrapper: TestProviders });
    act(() => first.result.current.setPreference("dark"));

    expect(document.cookie).toContain("sodc-color-mode-preference=dark");

    const second = renderHook(() => useColorMode(), { wrapper: TestProviders });
    expect(second.result.current.preference).toBe("dark");
    expect(second.result.current.resolvedMode).toBe("dark");
  });

  it("setPreference('system') clears the cookie and follows the OS again", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useColorMode(), { wrapper: TestProviders });

    act(() => result.current.setPreference("light"));
    expect(result.current.resolvedMode).toBe("light");

    act(() => result.current.setPreference("system"));
    expect(result.current.preference).toBe("system");
    expect(result.current.resolvedMode).toBe("dark");
    expect(document.cookie).not.toContain("sodc-color-mode-preference=");
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

  it("clears a saved appearance when optional cookies are rejected", () => {
    mockMatchMedia(false);
    const { result } = renderHook(
      () => ({ colorMode: useColorMode(), cookies: useCookiePreferences() }),
      { wrapper: TestProviders }
    );

    act(() => result.current.colorMode.setPreference("dark"));
    expect(result.current.cookies.decision).toBe("accepted");

    act(() => result.current.cookies.rejectPreferenceCookies());

    expect(result.current.colorMode.preference).toBe("system");
    expect(result.current.colorMode.resolvedMode).toBe("light");
    expect(document.cookie).not.toContain("sodc-color-mode-preference=");
  });
});
