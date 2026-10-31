import { afterEach, describe, expect, it } from "vitest";
import { installModuleLoadRecovery, isModuleLoadError } from "../moduleLoadRecovery";

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()));

function preloadError(payload: unknown) {
  const event = new Event("vite:preloadError", { cancelable: true });
  Object.assign(event, { payload });
  window.dispatchEvent(event);
  return event;
}

describe("module load recovery", () => {
  it("recognises Vite's original error without suppressing its rejection", () => {
    cleanups.push(installModuleLoadRecovery());
    const error = new Error("Unable to preload CSS: /assets/old.css");

    expect(isModuleLoadError(error)).toBe(false);
    const event = preloadError(error);

    expect(isModuleLoadError(error)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    // Classification belongs to this reported error, not every matching message.
    expect(isModuleLoadError(new Error(error.message))).toBe(false);
  });

  it.each([
    "Failed to fetch dynamically imported module: /assets/old.js",
    "error loading dynamically imported module: /assets/old.js",
    "Importing a module script failed.",
  ])("recognises the browser import failure: %s", message => {
    expect(isModuleLoadError(new TypeError(message))).toBe(true);
  });

  it.each([
    new TypeError("Failed to fetch"),
    new Error("permission-denied"),
    new Error("Rendering failed"),
    null,
    undefined,
    "Failed to fetch dynamically imported module",
  ])("does not turn an unrelated failure into deployment recovery: %s", error => {
    expect(isModuleLoadError(error)).toBe(false);
  });

  it("ignores missing/primitive payloads and detaches its listener", () => {
    const uninstall = installModuleLoadRecovery();
    preloadError(null);
    preloadError(undefined);
    preloadError("a network failure");
    uninstall();
    const error = new Error("Unable to preload CSS: /assets/late.css");
    preloadError(error);
    expect(isModuleLoadError(error)).toBe(false);
  });
});
