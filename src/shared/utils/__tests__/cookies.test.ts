import { describe, it, expect, beforeEach } from "vitest";
import { getCookie, setCookie, removeCookie } from "../cookies";

function clearCookies() {
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=; max-age=0; path=/`;
    }
  });
}

describe("cookies", () => {
  beforeEach(() => {
    clearCookies();
  });

  it("returns null for a cookie that isn't set", () => {
    expect(getCookie("missing")).toBeNull();
  });

  it("sets and reads back a cookie value", () => {
    setCookie("test-cookie", "dark");
    expect(getCookie("test-cookie")).toBe("dark");
  });

  it("URL-encodes and decodes values", () => {
    setCookie("test-cookie", "a b=c;d");
    expect(getCookie("test-cookie")).toBe("a b=c;d");
  });

  it("removeCookie clears a previously set value", () => {
    setCookie("test-cookie", "dark");
    removeCookie("test-cookie");
    expect(getCookie("test-cookie")).toBeNull();
  });

  it("does not confuse cookies with similar name prefixes", () => {
    setCookie("theme", "dark");
    setCookie("theme-extra", "light");
    expect(getCookie("theme")).toBe("dark");
    expect(getCookie("theme-extra")).toBe("light");
  });
});
