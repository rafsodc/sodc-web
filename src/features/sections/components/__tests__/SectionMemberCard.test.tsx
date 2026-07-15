import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SectionMemberCard from "../SectionMemberCard";
import { MembershipStatus } from "@dataconnect/generated";
import type { SectionMember } from "../../utils/sectionHelpers";

describe("SectionMemberCard", () => {
  const sharedMember: SectionMember = {
    userId: "user-1",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    membershipStatus: MembershipStatus.REGULAR,
    rank: null,
    sharesContactInfo: true,
  };

  it("shows name, initials, and membership label, with no email visible by default", () => {
    render(<SectionMemberCard member={sharedMember} onSelect={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "John Doe" })).toBeInTheDocument();
    expect(screen.getByText("JD")).toBeInTheDocument();
    expect(screen.getByText("Membership: Regular")).toBeInTheDocument();
    expect(screen.queryByText("john@example.com")).not.toBeInTheDocument();
  });

  it("shows rank below the name when set", () => {
    render(<SectionMemberCard member={{ ...sharedMember, rank: "Wing Commander" }} onSelect={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "John Doe" })).toBeInTheDocument();
    expect(screen.getByText("Wing Commander")).toBeInTheDocument();
  });

  it("does not show a rank line when rank is not set", () => {
    render(<SectionMemberCard member={sharedMember} onSelect={vi.fn()} />);

    expect(screen.queryByText("Wing Commander")).not.toBeInTheDocument();
  });

  it("calls onSelect with the member when a shared-info card is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SectionMemberCard member={sharedMember} onSelect={onSelect} />);

    await user.click(screen.getByRole("heading", { name: "John Doe" }));

    expect(onSelect).toHaveBeenCalledWith(sharedMember);
  });

  it("shows a Private indicator and is not clickable when the member has not shared contact info", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const privateMember: SectionMember = { ...sharedMember, sharesContactInfo: false, email: null };
    render(<SectionMemberCard member={privateMember} onSelect={onSelect} />);

    expect(screen.getByTitle("Private")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    await user.click(screen.getByRole("heading", { name: "John Doe" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
