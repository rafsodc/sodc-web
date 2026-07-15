import { describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../../test-utils";
import ColorModeToggle from "../ColorModeToggle";

describe("ColorModeToggle", () => {
  it("shows the appearance menu with System, Light, and Dark options", async () => {
    const user = userEvent.setup();
    render(<ColorModeToggle />);

    await user.click(screen.getByRole("button", { name: "Appearance" }));

    expect(screen.getByRole("menuitem", { name: "System" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Dark" })).toBeInTheDocument();
  });

  it("defaults to System selected", async () => {
    const user = userEvent.setup();
    render(<ColorModeToggle />);

    await user.click(screen.getByRole("button", { name: "Appearance" }));

    expect(screen.getByRole("menuitem", { name: "System" })).toHaveClass("Mui-selected");
  });

  it("selecting Dark closes the menu and marks Dark as selected next time it's opened", async () => {
    const user = userEvent.setup();
    render(<ColorModeToggle />);

    await user.click(screen.getByRole("button", { name: "Appearance" }));
    await user.click(screen.getByRole("menuitem", { name: "Dark" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Appearance" }));
    expect(screen.getByRole("menuitem", { name: "Dark" })).toHaveClass("Mui-selected");
  });

  it("selecting Light marks Light as selected next time it's opened", async () => {
    const user = userEvent.setup();
    render(<ColorModeToggle />);

    await user.click(screen.getByRole("button", { name: "Appearance" }));
    await user.click(screen.getByRole("menuitem", { name: "Light" }));

    await user.click(screen.getByRole("button", { name: "Appearance" }));
    expect(screen.getByRole("menuitem", { name: "Light" })).toHaveClass("Mui-selected");
  });
});
