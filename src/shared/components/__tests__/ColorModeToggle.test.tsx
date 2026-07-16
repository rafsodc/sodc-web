import { describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../../test-utils";
import ColorModeToggle from "../ColorModeToggle";

describe("ColorModeToggle", () => {
  it("shows a switch reflecting the current resolved mode", () => {
    render(<ColorModeToggle />);

    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("toggling the switch flips resolved mode", async () => {
    const user = userEvent.setup();
    render(<ColorModeToggle />);

    const initiallyChecked = (screen.getByRole("switch") as HTMLInputElement).checked;
    await user.click(screen.getByRole("switch"));

    expect((screen.getByRole("switch") as HTMLInputElement).checked).toBe(!initiallyChecked);
  });

  it("toggling twice returns to the original resolved mode", async () => {
    const user = userEvent.setup();
    render(<ColorModeToggle />);

    const initiallyChecked = (screen.getByRole("switch") as HTMLInputElement).checked;
    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("switch"));

    expect((screen.getByRole("switch") as HTMLInputElement).checked).toBe(initiallyChecked);
  });
});
