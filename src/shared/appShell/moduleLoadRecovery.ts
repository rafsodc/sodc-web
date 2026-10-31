// Vite reports the original import error before React.lazy rejects. Remember its
// identity without suppressing it: the existing boundary still owns the UI.
const preloadErrors = new WeakSet<object>();

export function installModuleLoadRecovery(target: Window = window): () => void {
  const onPreloadError = (event: Event) => {
    const error = (event as Event & { payload?: unknown }).payload;
    if (typeof error === "object" && error !== null) preloadErrors.add(error);
  };
  target.addEventListener("vite:preloadError", onPreloadError);
  return () => target.removeEventListener("vite:preloadError", onPreloadError);
}

export function isModuleLoadError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if (preloadErrors.has(error)) return true;
  // Browser import failures can also reach a boundary without Vite's event.
  // Do not mistake an ordinary API/auth "Failed to fetch" for a module failure.
  return error instanceof Error && (
    /failed to fetch dynamically imported module/i.test(error.message) ||
    /error loading dynamically imported module/i.test(error.message) ||
    /importing a module script failed/i.test(error.message)
  );
}
