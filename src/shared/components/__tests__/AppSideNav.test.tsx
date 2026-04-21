import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppSideNav from "../AppSideNav";

describe("AppSideNav", () => {
  it("renders sections, quick actions, and admin links", () => {
    render(
      <MemoryRouter>
        <AppSideNav
          pathname="/admin/users"
          sections={[{ label: "Sections", to: "/sections" }]}
          adminLinks={[{ label: "Manage Users", to: "/admin/users" }]}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Sections").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Manage Users" })).toHaveAttribute("href", "/admin/users");
  });
});
