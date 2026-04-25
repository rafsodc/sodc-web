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
          sections={[
            {
              label: "Events",
              to: "/sections/events",
              children: [{ label: "Administer", to: "/admin/sections", state: { managedSection: { id: "events" } } }],
            },
          ]}
          adminLinks={[
            {
              label: "Manage Sections",
              to: "/admin/sections",
              state: null,
              children: [{ label: "Events", to: "/admin/sections", state: { managedSection: { id: "events" } } }],
            },
            { label: "Manage Users", to: "/admin/users" },
          ]}
          mobileOpen={false}
          onMobileClose={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Sections").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Events" })[0]).toHaveAttribute("href", "/sections/events");
    expect(screen.getByRole("link", { name: "Administer" })).toHaveAttribute("href", "/admin/sections");
    expect(screen.getByRole("link", { name: "Manage Sections" })).toHaveAttribute("href", "/admin/sections");
    expect(screen.getAllByRole("link", { name: "Events" })[1]).toHaveAttribute("href", "/admin/sections");
    expect(screen.getByRole("link", { name: "Manage Users" })).toHaveAttribute("href", "/admin/users");
  });

  it("does not mark admin section children selected when on the normal section route", () => {
    render(
      <MemoryRouter>
        <AppSideNav
          pathname="/sections/events"
          sections={[
            {
              label: "Events",
              to: "/sections/events",
              children: [{ label: "Administer", to: "/admin/sections", state: { managedSection: { id: "events" } } }],
            },
          ]}
          adminLinks={[
            {
              label: "Manage Sections",
              to: "/admin/sections",
              state: null,
              children: [{ label: "Events", to: "/admin/sections", state: { managedSection: { id: "events" } } }],
            },
          ]}
          mobileOpen={false}
          onMobileClose={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Administer" })).not.toHaveClass("Mui-selected");
    const adminEventsLink = screen.getAllByRole("link", { name: "Events" })[1];
    expect(adminEventsLink).not.toHaveClass("Mui-selected");
    expect(screen.getAllByRole("link", { name: "Events" })[0]).toHaveClass("Mui-selected");
  });

  it("selects only the matching nested section link for the active admin section", () => {
    render(
      <MemoryRouter>
        <AppSideNav
          pathname="/admin/sections"
          selectedAdminSectionId="events"
          sections={[
            {
              label: "Dining",
              to: "/sections/dining",
              children: [{ label: "Administer", to: "/admin/sections", state: { managedSection: { id: "dining" } } }],
            },
            {
              label: "Events",
              to: "/sections/events",
              children: [{ label: "Administer", to: "/admin/sections", state: { managedSection: { id: "events" } } }],
            },
          ]}
          adminLinks={[
            {
              label: "Manage Sections",
              to: "/admin/sections",
              state: null,
              children: [
                { label: "Dining", to: "/admin/sections", state: { managedSection: { id: "dining" } } },
                { label: "Events", to: "/admin/sections", state: { managedSection: { id: "events" } } },
              ],
            },
          ]}
          mobileOpen={false}
          onMobileClose={vi.fn()}
        />
      </MemoryRouter>
    );

    const diningLinks = screen.getAllByRole("link", { name: "Dining" });
    const eventsLinks = screen.getAllByRole("link", { name: "Events" });
    const administerLinks = screen.getAllByRole("link", { name: "Administer" });
    expect(administerLinks[0]).not.toHaveClass("Mui-selected");
    expect(administerLinks[1]).toHaveClass("Mui-selected");
    expect(diningLinks[1]).not.toHaveClass("Mui-selected");
    expect(eventsLinks[1]).toHaveClass("Mui-selected");
    expect(screen.getByRole("link", { name: "Manage Sections" })).not.toHaveClass("Mui-selected");
  });

  it("selects the global Manage Sections link outside a section administer context", () => {
    render(
      <MemoryRouter>
        <AppSideNav
          pathname="/admin/sections"
          sections={[
            {
              label: "Events",
              to: "/sections/events",
              children: [{ label: "Administer", to: "/admin/sections", state: { managedSection: { id: "events" } } }],
            },
          ]}
          adminLinks={[
            {
              label: "Manage Sections",
              to: "/admin/sections",
              state: null,
              children: [{ label: "Events", to: "/admin/sections", state: { managedSection: { id: "events" } } }],
            },
          ]}
          mobileOpen={false}
          onMobileClose={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Administer" })).not.toHaveClass("Mui-selected");
    expect(screen.getAllByRole("link", { name: "Events" })[1]).not.toHaveClass("Mui-selected");
    expect(screen.getByRole("link", { name: "Manage Sections" })).toHaveClass("Mui-selected");
  });

  it("selects only the matching nested user group link", () => {
    render(
      <MemoryRouter>
        <AppSideNav
          pathname="/admin/user-groups"
          selectedAdminUserGroupId="group-2"
          sections={[]}
          adminLinks={[
            {
              label: "User Groups",
              to: "/admin/user-groups",
              state: null,
              children: [
                { label: "Members", to: "/admin/user-groups", state: { expandedGroupId: "group-1" } },
                { label: "Volunteers", to: "/admin/user-groups", state: { expandedGroupId: "group-2" } },
              ],
            },
          ]}
          mobileOpen={false}
          onMobileClose={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Members" })).not.toHaveClass("Mui-selected");
    expect(screen.getByRole("link", { name: "Volunteers" })).toHaveClass("Mui-selected");
    expect(screen.getByRole("link", { name: "User Groups" })).not.toHaveClass("Mui-selected");
  });
});
