import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createSessionLifecycle, installSessionRuntime } from "../../../../shared/appShell/sessionLifecycle";
import { useBookingWizardState } from "../useBookingWizardState";
import { useBookingWizardData } from "../useBookingWizardData";
import { submitEventBooking } from "../../../../shared/utils/firebaseFunctions";
import { refreshMyBookingsFromServer } from "../../../../shared/query/invalidation";

vi.mock("../useBookingWizardData", () => ({ useBookingWizardData: vi.fn() }));
vi.mock("../useSectionMemberSeatingOptions", () => ({ useSectionMemberSeatingSearch: () => ({
  inputValue: "", setInputValue: () => {}, options: [], loading: false,
}) }));
vi.mock("../../../../shared/utils/firebaseFunctions", () => ({ submitEventBooking: vi.fn(), createEventBookingCheckoutSession: vi.fn() }));
vi.mock("../../../../shared/query/invalidation", () => ({ refreshMyBookingsFromServer: vi.fn() }));

const ticket = { id: "ticket-member", audience: "MEMBER", price: 10, userGroup: { id: "group" } };
const guestTicket = { ...ticket, id: "ticket-guest", audience: "GUEST" };
const data = { currentUserData: { user: { id: "member-a" } }, membershipStatus: "REGULAR", gate: { ok: true },
  loadingProfile: false, loadingBookings: false, bookingsError: false, bookingsQueryError: null,
  bookingRevisions: [], refreshingBookings: false, bookingTicketOrders: [], bookingPaymentAdjustments: [], existingDraft: null, existingTerminalBooking: null,
  guestTicketTypes: [guestTicket], memberTicketTypes: [ticket], paymentSummaryForBooking: null, paymentTicketRows: [],
  paymentEligibleBooking: null, refetchMyBookings: vi.fn(), showExpiredDraftHoldNotice: false, ticketOrdersData: undefined,
};
const saved = { bookingId: "saved-booking", status: "SUBMITTED", approvalStatus: "NOT_REQUIRED", paymentReady: true, outcome: "READY_FOR_PAYMENT" };
const uninstalls: Array<() => void> = [];
function session(uid = "member-a") {
  const lifecycle = createSessionLifecycle();
  lifecycle.observe(uid);
  uninstalls.push(installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() }));
  return lifecycle;
}
function renderWizard(initialProps = { sectionId: "section-a", eventId: "event-a" }, onBookingComplete = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(({ sectionId, eventId }) => useBookingWizardState({ section: { id: sectionId } as never,
    event: { id: eventId } as never, wizardOpen: true, onBookingComplete,
  }), { initialProps, wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
}
function unloadBlocked() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
function existingBooking(revisionNumber = 1, note = "Server meal") {
  return { id: `booking-${revisionNumber}`, revisionNumber, updatedAt: `version-${revisionNumber}`,
    lines: [{ id: "line-1", sortOrder: 0, dietaryNote: note,
      ticketType: { id: ticket.id, audience: "MEMBER" }, bookingPlace: { id: "place-1", paymentAllocations: [] } }],
    sitNextToUserIds: [], accommodationRequested: false,
  };
}

beforeEach(() => {
  session();
  vi.mocked(useBookingWizardData).mockReturnValue(data as never);
  (submitEventBooking as Mock).mockReset().mockResolvedValue(saved);
  (refreshMyBookingsFromServer as Mock).mockReset().mockResolvedValue({ user: { bookings: [] } });
});
afterEach(() => { cleanup(); uninstalls.reverse().forEach(uninstall => uninstall()); uninstalls.length = 0; });

describe("member booking navigation draft", () => {
  it("does not warn for defaults/step changes and stops warning when an edit is reverted", () => {
    const hook = renderWizard();
    expect(hook.result.current.memberTicketTypeId).toBe(ticket.id);
    expect(unloadBlocked()).toBe(false);
    act(() => hook.result.current.handleNext());
    expect(unloadBlocked()).toBe(false);
    act(() => hook.result.current.setMemberDietaryNote("Unsaved"));
    expect(unloadBlocked()).toBe(true);
    act(() => hook.result.current.setMemberDietaryNote(""));
    expect(unloadBlocked()).toBe(false);
  });

  it("restores all form fields and progress after leaving the member event URL", () => {
    const first = renderWizard();
    act(() => {
      first.result.current.setMemberDietaryNote("Vegetarian");
      first.result.current.setGuestCount(1);
      first.result.current.setSitNextToUserIds(["friend"]);
      first.result.current.setAccommodationRequested(true);
      first.result.current.handleNext();
    });
    act(() => first.result.current.updateGuest(0, { guestDisplayName: "Named guest", dietaryNote: "Vegan" }));
    act(() => first.result.current.handleNext());
    first.unmount();
    const restored = renderWizard();
    expect(restored.result.current).toMatchObject({ activeStep: 2, memberTicketTypeId: ticket.id,
      guestCountInput: "1", memberDietaryNote: "Vegetarian", sitNextToUserIds: ["friend"], accommodationRequested: true,
      guests: [expect.objectContaining({ guestDisplayName: "Named guest", dietaryNote: "Vegan", ticketTypeId: guestTicket.id })],
    });
    expect(unloadBlocked()).toBe(true);
  });

  it("isolates event and section changes immediately and restores each resource on return", () => {
    const hook = renderWizard();
    act(() => hook.result.current.setMemberDietaryNote("Event A"));
    hook.rerender({ sectionId: "section-a", eventId: "event-b" });
    expect(hook.result.current.memberDietaryNote).toBe("");
    act(() => hook.result.current.setMemberDietaryNote("Event B"));
    hook.rerender({ sectionId: "section-b", eventId: "event-a" });
    expect(hook.result.current.memberDietaryNote).toBe("");
    hook.rerender({ sectionId: "section-a", eventId: "event-a" });
    expect(hook.result.current.memberDietaryNote).toBe("Event A");
    hook.rerender({ sectionId: "section-a", eventId: "event-b" });
    expect(hook.result.current.memberDietaryNote).toBe("Event B");
  });

  it("preserves the same write identity across an uncertain failure, navigation and retry", async () => {
    (submitEventBooking as Mock).mockRejectedValueOnce(new Error("Response interrupted"));
    const first = renderWizard();
    act(() => first.result.current.setMemberDietaryNote("Keep after timeout"));
    await act(() => first.result.current.handleConfirm());
    const firstRequest = vi.mocked(submitEventBooking).mock.calls[0]![0];
    expect(firstRequest.idempotencyKey).toMatch(/^[\da-f-]{36}$/);
    first.unmount();
    const restored = renderWizard();
    (refreshMyBookingsFromServer as Mock).mockRejectedValueOnce(new Error("Read unavailable"));
    await act(() => restored.result.current.handleConfirm());
    expect(vi.mocked(submitEventBooking).mock.calls[1]![0]).toEqual(firstRequest);
    expect(restored.result.current.submitError).toMatch(/saved.*could not be loaded/);
    expect(restored.result.current.lastSubmission).toMatchObject({ bookingId: "saved-booking" });
    expect(unloadBlocked()).toBe(false);
    restored.unmount();
    expect(renderWizard().result.current.memberDietaryNote).toBe("");
  });

  it("keeps a single write for repeated synchronous submit clicks", async () => {
    let resolve!: (value: unknown) => void;
    (submitEventBooking as Mock).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const hook = renderWizard();
    act(() => { void hook.result.current.handleConfirm(); void hook.result.current.handleConfirm(); });
    expect(submitEventBooking).toHaveBeenCalledOnce();
    await act(async () => resolve(saved));
    expect(hook.result.current.lastSubmission).toMatchObject({ bookingId: "saved-booking" });
  });

  it("restores the original write identity even when its first response is still pending", async () => {
    let resolve!: (value: unknown) => void;
    (submitEventBooking as Mock).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const first = renderWizard();
    act(() => { void first.result.current.handleConfirm(); });
    const original = vi.mocked(submitEventBooking).mock.calls[0]![0];
    first.unmount();
    const restored = renderWizard();
    await act(() => restored.result.current.handleConfirm());
    expect(vi.mocked(submitEventBooking).mock.calls[1]![0]).toEqual(original);
    await act(async () => resolve(saved));
    expect(restored.result.current.lastSubmission).toMatchObject({ bookingId: "saved-booking" });
    expect(refreshMyBookingsFromServer).toHaveBeenCalledOnce();
  });

  it("keeps clean booking snapshots authoritative across server refreshes", () => {
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: existingBooking() } as never);
    const hook = renderWizard();
    expect(hook.result.current.memberDietaryNote).toBe("Server meal");
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: existingBooking(2, "Updated server meal") } as never);
    hook.rerender({ sectionId: "section-a", eventId: "event-a" });
    expect(hook.result.current.memberDietaryNote).toBe("Updated server meal");
    expect(unloadBlocked()).toBe(false);
  });

  it("hydrates clean server changes but preserves dirty restored edits and their base revision", async () => {
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: existingBooking() } as never);
    const first = renderWizard();
    expect(first.result.current.memberDietaryNote).toBe("Server meal");
    expect(unloadBlocked()).toBe(false);
    act(() => first.result.current.beginEditingBooking());
    expect(unloadBlocked()).toBe(false);
    act(() => first.result.current.setMemberDietaryNote("My unsaved meal"));
    first.unmount();
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: existingBooking(2, "New server meal") } as never);
    const restored = renderWizard();
    expect(restored.result.current.memberDietaryNote).toBe("My unsaved meal");
    expect(restored.result.current.editingExistingBooking).toBe(true);
    await act(() => restored.result.current.handleConfirm());
    expect(submitEventBooking).toHaveBeenCalledWith(expect.objectContaining({ baseBookingId: "booking-1", baseRevisionNumber: 1 }));
  });

  it("does not replace unsaved restored selection during a temporary loading/permission gap", () => {
    const first = renderWizard();
    act(() => first.result.current.setMemberDietaryNote("Keep"));
    first.unmount();
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, loadingBookings: true, memberTicketTypes: [], guestTicketTypes: [], gate: { ok: false } } as never);
    const restored = renderWizard();
    expect(restored.result.current.memberTicketTypeId).toBe(ticket.id);
    expect(restored.result.current.memberDietaryNote).toBe("Keep");
  });

  it.each(["closeWizard", "cancelEditing"] as const)("discards intentional %s work and the uncertain submission key", async (action) => {
    (submitEventBooking as Mock).mockRejectedValueOnce(new Error("Interrupted"));
    const first = renderWizard();
    act(() => first.result.current.setMemberDietaryNote("Discard this"));
    await act(() => first.result.current.handleConfirm());
    const originalKey = vi.mocked(submitEventBooking).mock.calls[0]![0].idempotencyKey;
    act(() => first.result.current[action]());
    expect(unloadBlocked()).toBe(false);
    first.unmount();
    const next = renderWizard();
    expect(next.result.current.memberDietaryNote).toBe("");
    await act(() => next.result.current.handleConfirm());
    expect(vi.mocked(submitEventBooking).mock.calls[1]![0].idempotencyKey).not.toBe(originalKey);
  });

  it("fences a late save after changing resource without changing the new form or refreshing it", async () => {
    let resolve!: (value: unknown) => void;
    (submitEventBooking as Mock).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const completed = vi.fn();
    const hook = renderWizard(undefined, completed);
    act(() => { void hook.result.current.handleConfirm(); });
    hook.rerender({ sectionId: "section-a", eventId: "event-b" });
    act(() => hook.result.current.setMemberDietaryNote("Current B"));
    await act(async () => resolve(saved));
    expect(hook.result.current.memberDietaryNote).toBe("Current B");
    expect(hook.result.current.lastSubmission).toBeNull();
    expect(hook.result.current.submitting).toBe(false);
    expect(completed).not.toHaveBeenCalled();
    expect(refreshMyBookingsFromServer).not.toHaveBeenCalled();
  });

  it("does not revive abandoned pending state on A to B to A navigation", async () => {
    let resolve!: (value: unknown) => void;
    (submitEventBooking as Mock).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const hook = renderWizard();
    act(() => { void hook.result.current.handleConfirm(); });
    const original = vi.mocked(submitEventBooking).mock.calls[0]![0];
    hook.rerender({ sectionId: "section-a", eventId: "event-b" });
    hook.rerender({ sectionId: "section-a", eventId: "event-a" });
    expect(hook.result.current.submitting).toBe(false);
    expect(hook.result.current.lastSubmission).toBeNull();
    await act(() => hook.result.current.handleConfirm());
    expect(vi.mocked(submitEventBooking).mock.calls[1]![0]).toEqual(original);
    await act(async () => resolve(saved));
    expect(hook.result.current.lastSubmission).toMatchObject({ bookingId: "saved-booking" });
    expect(refreshMyBookingsFromServer).toHaveBeenCalledOnce();
  });

  it("clears restored work and rejects a late save when the signed-in identity is replaced", async () => {
    const owner = session();
    let resolve!: (value: unknown) => void;
    (submitEventBooking as Mock).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const completed = vi.fn();
    const hook = renderWizard(undefined, completed);
    act(() => hook.result.current.setMemberDietaryNote("Private A"));
    act(() => { void hook.result.current.handleConfirm(); });
    act(() => owner.retire());
    session("member-b");
    hook.rerender({ sectionId: "section-a", eventId: "event-a" });
    expect(hook.result.current.memberDietaryNote).toBe("");
    await act(async () => resolve(saved));
    expect(hook.result.current.lastSubmission).toBeNull();
    expect(completed).not.toHaveBeenCalled();
    expect(refreshMyBookingsFromServer).not.toHaveBeenCalled();
  });
  it.each([false, true])("reconciles a %s amendment saved while away without retaining its unload warning", async (amending) => {
    const base = existingBooking();
    if (amending) vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: base, bookingRevisions: [base] } as never);
    let complete!: (value: unknown) => void;
    (submitEventBooking as Mock).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const first = renderWizard();
    if (amending) act(() => first.result.current.beginEditingBooking());
    act(() => first.result.current.setMemberDietaryNote("Saved while away"));
    act(() => { void first.result.current.handleConfirm(); });
    const request = vi.mocked(submitEventBooking).mock.calls[0]![0];
    first.unmount();
    await act(async () => complete(saved));
    const persisted = { ...existingBooking(amending ? 2 : 1, "Saved while away"), status: "SUBMITTED",
      clientSubmissionKey: request.idempotencyKey.replaceAll("-", "").toUpperCase() };
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: persisted, bookingRevisions: [base, persisted] } as never);
    const restored = renderWizard();
    expect(restored.result.current.memberDietaryNote).toBe("Saved while away");
    expect(restored.result.current.showBookingSummary).toBe(true);
    expect(restored.result.current.editingExistingBooking).toBe(false);
    expect(unloadBlocked()).toBe(false);
    expect(submitEventBooking).toHaveBeenCalledOnce();
    act(() => restored.result.current.beginEditingBooking());
    act(() => restored.result.current.setMemberDietaryNote("Next intended change"));
    await act(() => restored.result.current.handleConfirm());
    const next = vi.mocked(submitEventBooking).mock.calls[1]![0];
    expect(next.idempotencyKey).not.toBe(request.idempotencyKey);
    expect(next).toMatchObject({ baseBookingId: persisted.id, baseRevisionNumber: persisted.revisionNumber });
  });

  it("finds a saved request in history and hydrates the newest revision without changing the payable booking", async () => {
    const base = existingBooking();
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: base, bookingRevisions: [base] } as never);
    (submitEventBooking as Mock).mockRejectedValueOnce(new Error("Response lost"));
    const first = renderWizard();
    act(() => first.result.current.beginEditingBooking());
    act(() => first.result.current.setMemberDietaryNote("Submitted amendment"));
    await act(() => first.result.current.handleConfirm());
    const request = vi.mocked(submitEventBooking).mock.calls[0]![0];
    first.unmount();
    const savedRevision = { ...existingBooking(2, "Submitted amendment"), status: "SUBMITTED", clientSubmissionKey: request.idempotencyKey, supersededAt: "later" };
    const current = { ...existingBooking(3, "Current pending amendment"), status: "SUBMITTED", approvalStatus: "PENDING", clientSubmissionKey: "another-request" };
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: current, bookingRevisions: [base, savedRevision, current], paymentEligibleBooking: base } as never);
    const restored = renderWizard();
    expect(restored.result.current.memberDietaryNote).toBe("Current pending amendment");
    expect(restored.result.current.paymentEligibleBooking).toBe(base);
    expect(restored.result.current.showBookingSummary).toBe(true);
    expect(unloadBlocked()).toBe(false);
  });

  it("preserves an uncertain submission when another request advanced the server revision", async () => {
    const base = existingBooking();
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: base, bookingRevisions: [base] } as never);
    (submitEventBooking as Mock).mockRejectedValue(new Error("Unconfirmed"));
    const first = renderWizard();
    act(() => first.result.current.beginEditingBooking());
    act(() => first.result.current.setMemberDietaryNote("Unconfirmed local edit"));
    await act(() => first.result.current.handleConfirm());
    const request = vi.mocked(submitEventBooking).mock.calls[0]![0];
    first.unmount();
    const other = { ...existingBooking(2, "Someone else's update"), status: "SUBMITTED", clientSubmissionKey: "other-request" };
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: other, bookingRevisions: [base, other] } as never);
    const restored = renderWizard();
    expect(restored.result.current.memberDietaryNote).toBe("Unconfirmed local edit");
    expect(restored.result.current.editingExistingBooking).toBe(true);
    await act(() => restored.result.current.handleConfirm());
    expect(vi.mocked(submitEventBooking).mock.calls[1]![0]).toEqual(request);
  });

  it("waits for a successful return read before clearing a saved draft", async () => {
    (submitEventBooking as Mock).mockRejectedValueOnce(new Error("Response lost"));
    const first = renderWizard();
    act(() => first.result.current.setMemberDietaryNote("Original submitted form"));
    await act(() => first.result.current.handleConfirm());
    const request = vi.mocked(submitEventBooking).mock.calls[0]![0];
    first.unmount();
    const persisted = { ...existingBooking(1, "Original submitted form"), status: "SUBMITTED", clientSubmissionKey: request.idempotencyKey };
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: persisted, bookingRevisions: [persisted], refreshingBookings: true } as never);
    const restored = renderWizard();
    expect(unloadBlocked()).toBe(true);
    expect(restored.result.current.submitting).toBe(true);
    await act(() => restored.result.current.handleConfirm());
    expect(submitEventBooking).toHaveBeenCalledOnce();
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: persisted, bookingRevisions: [persisted], bookingsError: true } as never);
    restored.rerender({ sectionId: "section-a", eventId: "event-a" });
    expect(unloadBlocked()).toBe(true);
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: persisted, bookingRevisions: [persisted] } as never);
    restored.rerender({ sectionId: "section-a", eventId: "event-a" });
    expect(unloadBlocked()).toBe(false);
  });

  it.each([false, true])("keeps newer edits visible with a Cancel action after an earlier save, amendment=%s", async (amending) => {
    const base = existingBooking();
    if (amending) vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: base, bookingRevisions: [base] } as never);
    let complete!: (value: unknown) => void;
    (submitEventBooking as Mock).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const first = renderWizard();
    if (amending) act(() => first.result.current.beginEditingBooking());
    act(() => first.result.current.setMemberDietaryNote("Original submitted edit"));
    act(() => { void first.result.current.handleConfirm(); });
    const request = vi.mocked(submitEventBooking).mock.calls[0]![0];
    act(() => first.result.current.setMemberDietaryNote("New unsaved edit"));
    first.unmount();
    await act(async () => complete(saved));
    const persisted = { ...existingBooking(2, "Original submitted edit"), status: "SUBMITTED", clientSubmissionKey: request.idempotencyKey };
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: persisted, bookingRevisions: [base, persisted] } as never);
    const restored = renderWizard();
    expect(restored.result.current.memberDietaryNote).toBe("New unsaved edit");
    expect(restored.result.current.showWizard).toBe(true);
    expect(restored.result.current.showBookingSummary).toBe(false);
    expect(restored.result.current.editingExistingBooking).toBe(true);
    expect(restored.result.current.submitError).toMatch(/newer edits have not been saved/);
    expect(unloadBlocked()).toBe(true);
    await act(() => restored.result.current.handleConfirm());
    expect(submitEventBooking).toHaveBeenCalledOnce();
    act(() => restored.result.current.cancelEditing());
    expect(restored.result.current.memberDietaryNote).toBe("Original submitted edit");
    expect(unloadBlocked()).toBe(false);
  });

  it("retires a late submit response once the server proves it saved, preserving the next edit", async () => {
    let complete!: (value: unknown) => void;
    (submitEventBooking as Mock).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const completed = vi.fn();
    const hook = renderWizard(undefined, completed);
    act(() => hook.result.current.setMemberDietaryNote("Saved first"));
    act(() => { void hook.result.current.handleConfirm(); });
    const request = vi.mocked(submitEventBooking).mock.calls[0]![0];
    const persisted = { ...existingBooking(1, "Saved first"), status: "SUBMITTED", clientSubmissionKey: request.idempotencyKey };
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: persisted, bookingRevisions: [persisted] } as never);
    hook.rerender({ sectionId: "section-a", eventId: "event-a" });
    expect(hook.result.current.submitting).toBe(false);
    act(() => hook.result.current.beginEditingBooking());
    act(() => hook.result.current.setMemberDietaryNote("Next unsaved edit"));
    await act(async () => complete(saved));
    expect(hook.result.current.memberDietaryNote).toBe("Next unsaved edit");
    expect(hook.result.current.editingExistingBooking).toBe(true);
    expect(completed).not.toHaveBeenCalled();
  });

  it("handles used-request conflicts through reads without changing the write identity", async () => {
    (submitEventBooking as Mock).mockRejectedValue({ code: "functions/failed-precondition", details: { code: "IDEMPOTENCY_KEY_REUSE_CONFLICT" }, message: "internal key detail" });
    (refreshMyBookingsFromServer as Mock).mockRejectedValueOnce(new Error("Read unavailable"));
    const hook = renderWizard();
    act(() => hook.result.current.setMemberDietaryNote("Keep until reviewed"));
    await act(() => hook.result.current.handleConfirm());
    const first = vi.mocked(submitEventBooking).mock.calls[0]![0];
    expect(hook.result.current.submitError).toMatch(/latest booking could not be loaded/);
    expect(hook.result.current.memberDietaryNote).toBe("Keep until reviewed");
    await act(() => hook.result.current.handleConfirm());
    expect(vi.mocked(submitEventBooking).mock.calls[1]![0]).toEqual(first);
    expect(hook.result.current.submitError).toMatch(/Cancel these edits/);
    expect(refreshMyBookingsFromServer).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])("reconciles the payload that actually committed after a changed retry, preserving a later revert=%s", async (revertedAfterRetry) => {
    (submitEventBooking as Mock).mockRejectedValueOnce(new Error("First attempt did not commit"));
    const first = renderWizard();
    act(() => first.result.current.setMemberDietaryNote("Attempt A"));
    await act(() => first.result.current.handleConfirm());
    const original = vi.mocked(submitEventBooking).mock.calls[0]![0];
    act(() => first.result.current.setMemberDietaryNote("Saved attempt B"));
    let complete!: (value: unknown) => void;
    (submitEventBooking as Mock).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    act(() => { void first.result.current.handleConfirm(); });
    expect(vi.mocked(submitEventBooking).mock.calls[1]![0].idempotencyKey).toBe(original.idempotencyKey);
    if (revertedAfterRetry) act(() => first.result.current.setMemberDietaryNote("Attempt A"));
    first.unmount();
    await act(async () => complete(saved));
    const persisted = { ...existingBooking(1, "Saved attempt B"), status: "SUBMITTED", clientSubmissionKey: original.idempotencyKey };
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, existingTerminalBooking: persisted, bookingRevisions: [persisted] } as never);
    const returned = renderWizard();
    expect(returned.result.current.memberDietaryNote).toBe(revertedAfterRetry ? "Attempt A" : "Saved attempt B");
    expect(returned.result.current.showBookingSummary).toBe(!revertedAfterRetry);
    expect(unloadBlocked()).toBe(revertedAfterRetry);
    if (revertedAfterRetry) expect(returned.result.current.submitError).toMatch(/newer edits have not been saved/);
    expect(submitEventBooking).toHaveBeenCalledTimes(2);
  });

  it("matches saved request fields after UUID, whitespace, seating order and paid-place hydration", async () => {
    const memberId = "AABBCCDD-1111-4222-8333-ABCDEF123456";
    const memberType = { ...ticket, id: memberId };
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, memberTicketTypes: [memberType] } as never);
    (submitEventBooking as Mock).mockRejectedValueOnce(new Error("Response lost"));
    const first = renderWizard();
    act(() => {
      first.result.current.setMemberDietaryNote("  Vegan  ");
      first.result.current.setGuestCount(1);
      first.result.current.setSitNextToUserIds(["member-z", "member-a"]);
      first.result.current.setAccommodationRequested(true);
    });
    act(() => first.result.current.updateGuest(0, { guestDisplayName: " Guest ", dietaryNote: " No nuts " }));
    await act(() => first.result.current.handleConfirm());
    const request = vi.mocked(submitEventBooking).mock.calls[0]![0];
    first.unmount();
    const persisted = { ...existingBooking(1, "Vegan"), status: "SUBMITTED", clientSubmissionKey: request.idempotencyKey,
      sitNextToUserIds: ["member-a", "member-z"], accommodationRequested: true,
      lines: [{ ...existingBooking().lines[0], dietaryNote: "Vegan", ticketType: { id: memberId.replaceAll("-", "").toLowerCase(), audience: "MEMBER" } },
        { id: "saved-guest-line", sortOrder: 1, guestDisplayName: "Guest", dietaryNote: "No nuts",
          ticketType: { id: guestTicket.id, audience: "GUEST" }, bookingPlace: { id: "saved-guest-place", paymentAllocations: [{ ticketOrderId: "paid-order" }] } }],
    };
    vi.mocked(useBookingWizardData).mockReturnValue({ ...data, memberTicketTypes: [memberType], existingTerminalBooking: persisted,
      bookingRevisions: [persisted], bookingTicketOrders: [{ id: "paid-order", status: "PAID" }] } as never);
    const returned = renderWizard();
    expect(returned.result.current.showBookingSummary).toBe(true);
    expect(returned.result.current.guests[0]).toMatchObject({ guestDisplayName: "Guest", paid: true });
    expect(unloadBlocked()).toBe(false);
  });

});
