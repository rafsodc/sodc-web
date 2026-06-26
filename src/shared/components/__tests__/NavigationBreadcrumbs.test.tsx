import { describe, expect, it, vi } from "vitest";
import { render, screen } from "../../../test-utils";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import NavigationBreadcrumbs from "../NavigationBreadcrumbs";

describe("NavigationBreadcrumbs", () => {
  it("renders linked and current breadcrumb items", () => {
    render(
      <MemoryRouter>
        <NavigationBreadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Signals", onClick: vi.fn() },
            { label: "Annual Dinner" },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Signals" })).toBeInTheDocument();
    expect(screen.getByText("Annual Dinner")).toBeInTheDocument();
  });

  it("calls onClick for intermediate breadcrumb actions", async () => {
    const onSectionClick = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NavigationBreadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Signals", onClick: onSectionClick },
            { label: "Annual Dinner" },
          ]}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Signals" }));
    expect(onSectionClick).toHaveBeenCalledTimes(1);
  });

  it("uses body2 typography for button breadcrumbs (matches router links)", () => {
    render(
      <MemoryRouter>
        <NavigationBreadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Signals", onClick: vi.fn() },
            { label: "Annual Dinner" },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveClass("MuiTypography-body2");
    expect(screen.getByRole("button", { name: "Signals" })).toHaveClass("MuiTypography-body2");
    expect(screen.getByText("Annual Dinner")).toHaveClass("MuiTypography-body2");
  });
});
