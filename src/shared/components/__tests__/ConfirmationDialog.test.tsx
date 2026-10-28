import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, within } from "../../../test-utils";
import ConfirmationDialog from "../ConfirmationDialog";

const title = "Delete section";
const consequence = "Delete Events? Its section settings will be removed.";

function show(props: Partial<ComponentProps<typeof ConfirmationDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const result = render(
    <ConfirmationDialog open title={title} onConfirm={onConfirm} onCancel={onCancel} {...props}>
      {consequence}
    </ConfirmationDialog>,
  );
  return { ...result, onConfirm, onCancel };
}

function backdrop(dialog: HTMLElement) {
  // MUI's dialog container is the outside-paper surface a user clicks to dismiss.
  return dialog.parentElement!;
}

describe("ConfirmationDialog", () => {
  it("names and describes the dialog and initially focuses Cancel", () => {
    show();

    const dialog = screen.getByRole("dialog", { name: title });
    expect(dialog).toHaveAccessibleDescription(consequence);
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeEnabled();
  });

  it("does not display a closed confirmation", () => {
    const { onCancel, onConfirm } = show({ open: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it.each(["Cancel", "Escape", "backdrop"] as const)("cancels with %s while idle", async (action) => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = show();

    if (action === "Cancel") await user.click(screen.getByRole("button", { name: "Cancel" }));
    else if (action === "Escape") await user.keyboard("{Escape}");
    else await user.click(backdrop(screen.getByRole("dialog")));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms with the supplied label and leaves closing to its parent", async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = show({ confirmLabel: "Delete section" });

    await user.click(screen.getByRole("button", { name: "Delete section" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
  });

  it("disables both actions and ignores Escape and backdrop clicks while pending", async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = show({ pending: true });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Deleting…" });
    expect(cancel).toBeDisabled();
    expect(confirm).toBeDisabled();

    fireEvent.click(cancel);
    fireEvent.click(confirm);
    await user.keyboard("{Escape}");
    await user.click(backdrop(screen.getByRole("dialog")));

    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
  });

  it("shows a failure inline and enables retry and cancellation after pending ends", async () => {
    const user = userEvent.setup();
    const { rerender, onCancel, onConfirm } = show({ pending: true });
    rerender(
      <ConfirmationDialog open title={title} error="Unable to delete Events. Try again." onConfirm={onConfirm} onCancel={onCancel}>
        {consequence}
      </ConfirmationDialog>,
    );

    const dialog = screen.getByRole("dialog", { name: title });
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Unable to delete Events. Try again.");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeEnabled();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("gives separate instances distinct title and description associations", () => {
    render(
      <>
        <ConfirmationDialog open title="Delete section" onConfirm={vi.fn()} onCancel={vi.fn()}>
          Delete Events and its settings?
        </ConfirmationDialog>
        <ConfirmationDialog open title="Delete group" onConfirm={vi.fn()} onCancel={vi.fn()}>
          Delete Members and its group settings?
        </ConfirmationDialog>
      </>,
    );

    const dialogs = screen.getAllByRole("dialog", { hidden: true });
    const titleIds = dialogs.map((dialog) => dialog.getAttribute("aria-labelledby"));
    const descriptionIds = dialogs.map((dialog) => dialog.getAttribute("aria-describedby"));
    expect(new Set(titleIds).size).toBe(2);
    expect(new Set(descriptionIds).size).toBe(2);
    for (const dialog of dialogs) {
      const titleNode = document.getElementById(dialog.getAttribute("aria-labelledby")!);
      const descriptionNode = document.getElementById(dialog.getAttribute("aria-describedby")!);
      expect(dialog).toContainElement(titleNode);
      expect(dialog).toContainElement(descriptionNode);
      expect(titleNode).not.toBe(descriptionNode);
    }
  });
});
