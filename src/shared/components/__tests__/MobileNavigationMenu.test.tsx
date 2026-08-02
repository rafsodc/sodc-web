import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "../../../test-utils";
import MobileNavigationMenu from "../MobileNavigationMenu";

function renderMenu(onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <MobileNavigationMenu
        anchorEl={document.body}
        onClose={onClose}
        pathname="/sections/events"
        sections={[{ label: "Events", to: "/sections/events" }]}
        adminLinks={[{ label: "Manage Users", to: "/admin/users" }]}
      />
    </MemoryRouter>,
  );
  return onClose;
}

describe("MobileNavigationMenu", () => {
  it("combines application navigation with aligned appearance and cookie rows", () => {
    renderMenu();

    const menu = screen.getByRole("navigation", {
      name: "Mobile navigation and settings",
    });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute(
      "href",
      "/sections/events",
    );
    expect(screen.getByRole("link", { name: "Manage Users" })).toHaveAttribute(
      "href",
      "/admin/users",
    );

    const appearanceButton = screen.getByRole("button", { name: /Appearance:/ });
    const cookieButton = screen.getByRole("button", { name: "Cookie settings" });
    for (const button of [appearanceButton, cookieButton]) {
      expect(button).toHaveClass("MuiListItemButton-root");
      expect(button.querySelector(".MuiListItemIcon-root")).toBeInTheDocument();
      expect(button.querySelector(".MuiListItemText-root")).toBeInTheDocument();
    }
  });

  it("closes after navigation or choosing a setting", async () => {
    const user = userEvent.setup();
    const onClose = renderMenu();

    await user.click(screen.getByRole("link", { name: "Events" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Appearance:/ }));
    await user.click(screen.getByRole("menuitem", { name: /Dark/ }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closes before opening cookie settings", async () => {
    const user = userEvent.setup();
    const onClose = renderMenu();

    await user.click(screen.getByRole("button", { name: "Cookie settings" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
