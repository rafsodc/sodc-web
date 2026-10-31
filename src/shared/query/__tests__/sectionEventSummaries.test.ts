import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { getSectionEventsForUser } from "../../utils/firebaseFunctions";
import { loadSectionEventSummaries } from "../sectionEventSummaries";
import {
  captureSectionEventSummaryRead, getFreshSectionEventSummaries,
  rememberSectionEventSummaries, removeSectionEventSummaries,
} from "../sectionEventSummaryCache";
import {
  createSessionLifecycle, installSessionRuntime, captureSession,
  suspendPrivateSession, SessionChangedError,
} from "../../appShell/sessionLifecycle";
import { beginAuthorizationUpdate, resumeAuthorizationReads } from "../../auth/authorizationUpdate";

vi.mock("../../utils/firebaseFunctions", () => ({ getSectionEventsForUser: vi.fn() }));
const A = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
const compactA = A.replaceAll("-", "").toLowerCase();
const result = { events: [] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
let client: QueryClient;
let lifecycle: ReturnType<typeof createSessionLifecycle>;
let uninstall: () => void;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  lifecycle = createSessionLifecycle();
  lifecycle.observe("member-a");
  uninstall = installSessionRuntime({ lifecycle, queryClient: client, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() });
  vi.mocked(getSectionEventsForUser).mockReset().mockResolvedValue(result);
});
afterEach(() => { resumeAuthorizationReads(captureSession()); client.clear(); uninstall(); vi.restoreAllMocks(); });

describe("document-local event summary reuse", () => {
  it("shares fresh results and concurrent reads for canonical resource IDs", async () => {
    const pending = deferred<typeof result>();
    vi.mocked(getSectionEventsForUser).mockReturnValueOnce(pending.promise);
    const first = loadSectionEventSummaries(client, A);
    const second = loadSectionEventSummaries(client, compactA);
    await vi.waitFor(() => expect(getSectionEventsForUser).toHaveBeenCalledOnce());
    pending.resolve(result);
    await expect(Promise.all([first, second])).resolves.toEqual([result, result]);
    await expect(loadSectionEventSummaries(client, A)).resolves.toEqual(result);
    expect(getSectionEventsForUser).toHaveBeenCalledOnce();
  });
  it("refreshes after thirty seconds and keeps resources separate", async () => {
    let now = 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    await loadSectionEventSummaries(client, A);
    now += 29_999;
    await loadSectionEventSummaries(client, A);
    expect(getSectionEventsForUser).toHaveBeenCalledOnce();
    now += 1;
    expect(getFreshSectionEventSummaries(client, A)).toBeUndefined();
    await loadSectionEventSummaries(client, A);
    await loadSectionEventSummaries(client, "other-section");
    expect(getSectionEventsForUser).toHaveBeenCalledTimes(3);
  });
  it("a failed forced refresh cannot fall back to an older fresh result", async () => {
    await loadSectionEventSummaries(client, A);
    vi.mocked(getSectionEventsForUser).mockRejectedValueOnce(new Error("offline"));
    await expect(loadSectionEventSummaries(client, A, { force: true })).rejects.toThrow("offline");
    expect(getFreshSectionEventSummaries(client, A)).toBeUndefined();
    await loadSectionEventSummaries(client, A);
    expect(getSectionEventsForUser).toHaveBeenCalledTimes(3);
  });
  it("a forced refresh detaches an older in-flight response", async () => {
    const old = deferred<typeof result>();
    vi.mocked(getSectionEventsForUser).mockReturnValueOnce(old.promise);
    const first = loadSectionEventSummaries(client, A).catch(error => error);
    await vi.waitFor(() => expect(getSectionEventsForUser).toHaveBeenCalledOnce());
    await loadSectionEventSummaries(client, A, { force: true });
    old.resolve({ events: [{ id: "obsolete" }] } as never);
    expect(await first).toBeInstanceOf(Error);
    expect(getFreshSectionEventSummaries(client, A)).toEqual(result);
  });
  it("invalidating access prevents a pending bundle from reseeding the cache", () => {
    const scope = captureSectionEventSummaryRead(client, A);
    removeSectionEventSummaries(client);
    rememberSectionEventSummaries(client, result, scope);
    expect(client.getQueryData(scope.queryKey)).toBeUndefined();
  });
  it("an older bundle cannot overwrite a newer dedicated read", async () => {
    const scope = captureSectionEventSummaryRead(client, A);
    await loadSectionEventSummaries(client, A);
    rememberSectionEventSummaries(client, { events: [{ id: "obsolete" }] } as never, scope);
    expect(getFreshSectionEventSummaries(client, A)).toEqual(result);
  });
  it("shares a current bundle with a later Home/list read", async () => {
    const scope = captureSectionEventSummaryRead(client, A);
    rememberSectionEventSummaries(client, result, scope);
    await expect(loadSectionEventSummaries(client, compactA)).resolves.toEqual(result);
    expect(getSectionEventsForUser).not.toHaveBeenCalled();
  });
  it.each(["retire", "suspend"] as const)("rejects even fresh cache hits when the session is %s", async mode => {
    await loadSectionEventSummaries(client, A);
    if (mode === "retire") lifecycle.retire(); else suspendPrivateSession(captureSession());
    expect(getFreshSectionEventSummaries(client, A)).toBeUndefined();
    await expect(loadSectionEventSummaries(client, A)).rejects.toBeInstanceOf(SessionChangedError);
    expect(getSectionEventsForUser).toHaveBeenCalledOnce();
  });
  it("does not reuse another identity's cached summaries", async () => {
    await loadSectionEventSummaries(client, A);
    uninstall();
    const replacement = createSessionLifecycle(); replacement.observe("member-b");
    uninstall = installSessionRuntime({ lifecycle: replacement, retire: () => replacement.retire(), signOut: async () => replacement.retire() });
    expect(getFreshSectionEventSummaries(client, A)).toBeUndefined();
    await loadSectionEventSummaries(client, A);
    expect(getSectionEventsForUser).toHaveBeenCalledTimes(2);
  });
  it("waits through an own-status update and reads with the new authority epoch", async () => {
    await loadSectionEventSummaries(client, A);
    const update = beginAuthorizationUpdate(captureSession());
    expect(getFreshSectionEventSummaries(client, A)).toBeUndefined();
    const pending = loadSectionEventSummaries(client, A);
    await Promise.resolve();
    expect(getSectionEventsForUser).toHaveBeenCalledOnce();
    update.finish(true);
    await expect(pending).resolves.toEqual(result);
    expect(getSectionEventsForUser).toHaveBeenCalledTimes(2);
  });
  it("a failed token refresh keeps cached data blocked until explicit recovery", async () => {
    await loadSectionEventSummaries(client, A);
    const session = captureSession();
    const update = beginAuthorizationUpdate(session); update.finish(false, true);
    expect(getFreshSectionEventSummaries(client, A)).toBeUndefined();
    await expect(loadSectionEventSummaries(client, A)).rejects.toBeInstanceOf(SessionChangedError);
    resumeAuthorizationReads(session);
    await loadSectionEventSummaries(client, A);
    expect(getSectionEventsForUser).toHaveBeenCalledTimes(2);
  });
});
