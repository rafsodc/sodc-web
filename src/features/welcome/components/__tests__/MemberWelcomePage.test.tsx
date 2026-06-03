import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SectionType, MembershipStatus } from "@dataconnect/generated";
import type { GetSectionsForUserData } from "@dataconnect/generated";
import MemberWelcomePage from "../MemberWelcomePage";

vi.mock("../../hooks/useUpcomingEventsForUser", () => ({
  useUpcomingEventsForUser: () => ({
    events: [
      {
        id: "event-1",
        title: "Summer Dinner",
        location: "RAF Club",
        guestOfHonour: null,
        startDateTime: "2030-06-01T18:00:00.000Z",
        endDateTime: "2030-06-01T22:00:00.000Z",
        sectionId: "section-1",
        sectionName: "Signals",
      },
    ],
    loading: false,
    isError: false,
  }),
}));

const sectionsData = {
  user: {
    id: "user-1",
    membershipStatus: "REGULAR",
    userGroups: [
      {
        userGroup: {
          id: "group-1",
          name: "Group",
          membershipStatuses: null,
          purposeLinks: [
            {
              purposes: ["ACCESS"],
              section: {
                id: "section-1",
                name: "Signals",
                type: SectionType.EVENTS,
                description: "Signals section",
              },
            },
          ],
        },
      },
    ],
  },
  allUserGroups: [],
} as GetSectionsForUserData;

describe("MemberWelcomePage", () => {
  it("greets the member by name and does not show UID", () => {
    render(
      <MemoryRouter>
        <MemberWelcomePage
          userData={{
            id: "user-1",
            firstName: "Alex",
            lastName: "Smith",
            email: "alex@example.com",
            serviceNumber: "123",
            membershipStatus: MembershipStatus.REGULAR,
            createdAt: "",
            updatedAt: "",
          }}
          sectionsData={sectionsData}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /welcome, alex smith/i })).toBeInTheDocument();
    expect(screen.queryByText(/uid/i)).not.toBeInTheDocument();
    expect(screen.getByText("Summer Dinner")).toBeInTheDocument();
    expect(screen.getByText("Signals")).toBeInTheDocument();
    expect(screen.getByText("Signals section")).toBeInTheDocument();
  });
});
