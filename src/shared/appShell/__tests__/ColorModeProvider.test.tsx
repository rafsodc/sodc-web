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

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("ColorModeProvider / useColorMode", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createMockStorage(),
      writable: true,
    });
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

  it("persists an explicit preference and restores it on the next mount", () => {
    mockMatchMedia(false);
    const first = renderHook(() => useColorMode(), { wrapper: ColorModeProvider });
    act(() => first.result.current.setPreference("dark"));

    const second = renderHook(() => useColorMode(), { wrapper: ColorModeProvider });
    expect(second.result.current.preference).toBe("dark");
    expect(second.result.current.resolvedMode).toBe("dark");
  });

  it("setPreference('system') clears the stored preference and follows the OS again", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useColorMode(), { wrapper: ColorModeProvider });

    act(() => result.current.setPreference("light"));
    expect(result.current.resolvedMode).toBe("light");

    act(() => result.current.setPreference("system"));
    expect(result.current.preference).toBe("system");
    expect(result.current.resolvedMode).toBe("dark");
    expect(window.localStorage.getItem("sodc-color-mode-preference")).toBeNull();
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
