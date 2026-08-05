import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppSideNav from "../AppSideNav";

describe("AppSideNav", () => {
  it("renders sections and admin links as flat top-level links", () => {
    render(
      <MemoryRouter>
        <AppSideNav
          pathname="/admin/users"
          sections={[{ label: "Events", to: "/sections/events" }]}
          adminLinks={[
            { label: "Manage Sections", to: "/admin/sections" },
            { label: "Manage Users", to: "/admin/users" },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Sections").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute("href", "/sections/events");
    expect(screen.getByRole("link", { name: "Manage Sections" })).toHaveAttribute("href", "/admin/sections");
    expect(screen.getByRole("link", { name: "Manage Users" })).toHaveAttribute("href", "/admin/users");
  });

  it("marks only the link matching the current pathname as selected", () => {
    render(
      <MemoryRouter>
        <AppSideNav
          pathname="/sections/events"
          sections={[
            { label: "Dining", to: "/sections/dining" },
            { label: "Events", to: "/sections/events" },
          ]}
          adminLinks={[{ label: "Manage Sections", to: "/admin/sections" }]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Dining" })).not.toHaveClass("Mui-selected");
    expect(screen.getByRole("link", { name: "Events" })).toHaveClass("Mui-selected");
    expect(screen.getByRole("link", { name: "Manage Sections" })).not.toHaveClass("Mui-selected");
  });

  it("renders no admin section when there are no admin links", () => {
    render(
      <MemoryRouter>
        <AppSideNav pathname="/sections/events" sections={[{ label: "Events", to: "/sections/events" }]} adminLinks={[]} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });
});
