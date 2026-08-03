import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../../test-utils";
import FailureState from "../FailureState";

describe("FailureState", () => {
  it("renders safe default copy as an accessible inline error", () => {
    render(<FailureState />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Something went wrong" })).toHaveFocus();
    expect(screen.getByText(/couldn’t display this page/i)).toBeInTheDocument();
  });

  it("offers only the supplied recovery actions", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onBack = vi.fn();
    const onHome = vi.fn();
    render(<FailureState onRetry={onRetry} onBack={onBack} onHome={onHome} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Home" }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledOnce();
    expect(onHome).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Reload page" })).not.toBeInTheDocument();
  });

  it("uses a main landmark for a full-page failure", () => {
    render(<FailureState variant="page" />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong" })).toHaveFocus();
  });
});
