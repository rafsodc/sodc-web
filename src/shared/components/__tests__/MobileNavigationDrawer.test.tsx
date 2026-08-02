import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "../../../test-utils";
import MobileNavigationDrawer from "../MobileNavigationDrawer";

function renderDrawer(onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <MobileNavigationDrawer
        open
        onClose={onClose}
        pathname="/sections/events"
        sections={[{ label: "Events", to: "/sections/events" }]}
        adminLinks={[{ label: "Manage Users", to: "/admin/users" }]}
      />
    </MemoryRouter>,
  );
  return onClose;
}

describe("MobileNavigationDrawer", () => {
  it("combines application navigation with appearance and cookie settings", () => {
    renderDrawer();

    const drawer = screen.getByRole("navigation", {
      name: "Mobile navigation and settings",
    });
    expect(drawer).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute(
      "href",
      "/sections/events",
    );
    expect(screen.getByRole("link", { name: "Manage Users" })).toHaveAttribute(
      "href",
      "/admin/users",
    );
    expect(
      screen.getByRole("button", { name: /Appearance:/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cookie settings" })).toBeInTheDocument();
  });

  it("closes after navigation or choosing a setting", async () => {
    const user = userEvent.setup();
    const onClose = renderDrawer();

    await user.click(screen.getByRole("link", { name: "Events" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Appearance:/ }));
    await user.click(screen.getByRole("menuitem", { name: /Dark/ }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closes before opening cookie settings", async () => {
    const user = userEvent.setup();
    const onClose = renderDrawer();

    await user.click(screen.getByRole("button", { name: "Cookie settings" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
