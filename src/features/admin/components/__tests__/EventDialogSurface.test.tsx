import { Alert } from "@mui/material";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "../../../../test-utils";
import { EventDialogSurface, type EventDialogSurfaceProps } from "../sectionEventsManagerSurfaces/EventDialogSurface";

function props(overrides: Partial<EventDialogSurfaceProps> = {}): EventDialogSurfaceProps {
  return {
    open: true, editingEvent: null, title: "Annual Dinner", location: "RAF Club",
    guestOfHonour: "Air Marshal Example", sponsors: "Example sponsor", details: "## Welcome\nJoin us for dinner.",
    startDateTime: "2026-11-20T13:00", endDateTime: "2026-11-20T22:30",
    bookingStartDateTime: "2026-10-01T09:00", bookingEndDateTime: "2026-11-12T17:00", maxGuestsStr: "1",
    submitting: false,
    onClose: vi.fn(), onSubmit: vi.fn(), onTitleChange: vi.fn(), onLocationChange: vi.fn(),
    onGuestOfHonourChange: vi.fn(), onSponsorsChange: vi.fn(), onDetailsChange: vi.fn(),
    onStartDateTimeChange: vi.fn(), onEndDateTimeChange: vi.fn(),
    onBookingStartDateTimeChange: vi.fn(), onBookingEndDateTimeChange: vi.fn(), onMaxGuestsChange: vi.fn(),
    ...overrides,
  };
}

describe("Event details editor presentation", () => {
  it("preserves the modal default and its existing Save and Cancel callbacks", async () => {
    const user = userEvent.setup();
    const editor = props();
    render(<EventDialogSurface {...editor} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Add event" })).toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(editor.onSubmit).toHaveBeenCalledTimes(1);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(editor.onClose).toHaveBeenCalledTimes(1);
  });

  it("groups the inline editor under one labelled form with clear Save and Discard actions", async () => {
    const user = userEvent.setup();
    const editor = props({ embedded: true });
    render(<EventDialogSurface {...editor} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const form = screen.getByRole("form", { name: "Event details" });
    expect(within(form).getByRole("heading", { level: 2, name: "Event details" })).toBeInTheDocument();
    expect(within(form).getByRole("status")).toHaveTextContent("Saved");
    expect(within(form).getByRole("group", { name: "Event information" })).toContainElement(screen.getByRole("textbox", { name: "Title" }));
    expect(within(form).getByRole("group", { name: "Event schedule" })).toContainElement(screen.getByLabelText("Start date/time", { exact: false }));
    expect(within(form).getByRole("group", { name: "Booking window" })).toContainElement(screen.getByLabelText("Booking window end", { exact: false }));
    expect(screen.getByRole("button", { name: "Save" })).toHaveTextContent("Save changes");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(editor.onSubmit).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(editor.onClose).toHaveBeenCalledTimes(1);
  });

  it("reflects the supplied dirty state and displays current recovery notices and errors", () => {
    const editor = props({ embedded: true, dirty: true, notice: <Alert severity="warning">Saved, but the latest event could not be loaded. Retry.</Alert>, error: "Unable to save the event." });
    render(<EventDialogSurface {...editor} />);
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
    expect(screen.getByText("Saved, but the latest event could not be loaded. Retry.")).toBeInTheDocument();
    expect(screen.getByText("Unable to save the event.")).toBeInTheDocument();
  });

  it.each([
    ["Title", "New title", "onTitleChange"], ["Location", "New location", "onLocationChange"],
    ["Guest of honour", "New guest", "onGuestOfHonourChange"], ["Sponsors", "New sponsor", "onSponsorsChange"],
    ["Event details", "New description", "onDetailsChange"], ["Start date/time", "2026-11-21T13:00", "onStartDateTimeChange"],
    ["End date/time", "2026-11-21T22:30", "onEndDateTimeChange"], ["Booking window start", "2026-10-02T09:00", "onBookingStartDateTimeChange"],
    ["Booking window end", "2026-11-13T17:00", "onBookingEndDateTimeChange"], ["Max guests without moderator approval", "2", "onMaxGuestsChange"],
  ] as const)("passes inline %s edits to the existing callback", (label, value, callback) => {
    const editor = props({ embedded: true });
    render(<EventDialogSurface {...editor} />);
    fireEvent.change(screen.getByLabelText(label, { exact: false, selector: "input,textarea" }), { target: { value } });
    expect(editor[callback]).toHaveBeenCalledWith(value);
  });

  it("submits a valid inline form through the same handler when Enter is pressed", async () => {
    const user = userEvent.setup();
    const editor = props({ embedded: true });
    render(<EventDialogSurface {...editor} />);
    screen.getByRole("textbox", { name: "Title" }).focus();
    await user.keyboard("{Enter}");
    expect(editor.onSubmit).toHaveBeenCalledTimes(1);
  });

  it.each([{ submitting: true }, { saveDisabled: true }, { title: " " }])("honours existing save-blocking conditions %j", (state) => {
    const editor = props({ embedded: true, ...state });
    render(<EventDialogSurface {...editor} />);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(editor.onSubmit).not.toHaveBeenCalled();
    fireEvent.submit(screen.getByRole("form", { name: "Event details" }));
    expect(editor.onSubmit).not.toHaveBeenCalled();
  });

  it("does not render a closed inline editor", () => {
    render(<EventDialogSurface {...props({ embedded: true, open: false })} />);
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  describe.each([false, true])("date validation (embedded=%s)", (embedded) => {
    it.each([
      ["startDateTime", "", "Start date/time", "Start date/time is required."],
      ["endDateTime", "", "End date/time", "End date/time is required."],
      ["bookingStartDateTime", "", "Booking window start", "Booking window start is required."],
      ["bookingEndDateTime", "", "Booking window end", "Booking window end is required."],
      ["endDateTime", "2026-11-20T12:59", "End date/time", "End date/time must be on or after start date/time."],
      ["bookingEndDateTime", "2026-10-01T08:59", "Booking window end", "Booking window end must be on or after booking window start."],
    ] as const)("keeps the draft and focuses invalid %s", async (field, value, label, message) => {
      const user = userEvent.setup();
      const editor = props({ embedded, [field]: value });
      render(<EventDialogSurface {...editor} />);
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(editor.onSubmit).not.toHaveBeenCalled();
      const input = screen.getByLabelText(label, { exact: false, selector: "input" });
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAccessibleDescription(message);
      expect(input).toHaveFocus();
      expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Annual Dinner");
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });

    it("clears the field error after correction and allows one explicit save", async () => {
      const user = userEvent.setup();
      const editor = props({ embedded, endDateTime: "2026-11-20T12:00" });
      const view = render(<EventDialogSurface {...editor} />);
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(editor.onSubmit).not.toHaveBeenCalled();
      view.rerender(<EventDialogSurface {...editor} endDateTime="2026-11-20T13:00" />);
      expect(screen.queryByText("End date/time must be on or after start date/time.")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(editor.onSubmit).toHaveBeenCalledTimes(1);
    });
  });
});
