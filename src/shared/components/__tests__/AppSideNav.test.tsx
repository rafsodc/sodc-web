import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppSideNav from "../AppSideNav";

describe("AppSideNav", () => {
  it("renders sections and admin links", () => {
    render(
      <MemoryRouter>
        <AppSideNav
          pathname="/admin/users"
          sections={[{ label: "Sections", to: "/sections" }]}
          adminLinks={[{ label: "Manage Users", to: "/admin/users" }]}
          mobileOpen={false}
          onMobileClose={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Sections").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Manage Users" })).toHaveAttribute("href", "/admin/users");
  });
});
