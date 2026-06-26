import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SectionMemberCard from "../SectionMemberCard";
import { MembershipStatus } from "@dataconnect/generated";

describe("SectionMemberCard", () => {
  const member = {
    userId: "user-1",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    membershipStatus: MembershipStatus.REGULAR,
  };

  it("shows name and membership label without email by default", () => {
    render(<SectionMemberCard member={member} />);

    expect(screen.getByRole("heading", { name: "John Doe" })).toBeInTheDocument();
    expect(screen.getByText("Regular")).toBeInTheDocument();
    expect(screen.queryByText("john@example.com")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show email" })).toHaveAttribute("aria-expanded", "false");
  });

  it("reveals email when Show email is clicked", async () => {
    const user = userEvent.setup();
    render(<SectionMemberCard member={member} />);

    await user.click(screen.getByRole("button", { name: "Show email" }));

    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide email" })).toHaveAttribute("aria-expanded", "true");
  });
});
