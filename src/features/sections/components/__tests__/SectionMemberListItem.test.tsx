import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Table, TableBody } from "@mui/material";
import SectionMemberListItem from "../SectionMemberListItem";
import { MembershipStatus } from "@dataconnect/generated";
import type { SectionMember } from "../../utils/sectionHelpers";

function renderRow(member: SectionMember, onSelect: (member: SectionMember) => void) {
  return render(
    <Table>
      <TableBody>
        <SectionMemberListItem member={member} onSelect={onSelect} />
      </TableBody>
    </Table>
  );
}

describe("SectionMemberListItem", () => {
  const sharedMember: SectionMember = {
    userId: "user-1",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    membershipStatus: MembershipStatus.REGULAR,
    rank: null,
    sharesContactInfo: true,
  };

  it("shows name, initials, rank, and membership status in separate cells", () => {
    renderRow(sharedMember, vi.fn());

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("JD")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Regular")).toBeInTheDocument();
  });

  it("shows the rank cell when set", () => {
    renderRow({ ...sharedMember, rank: "Wing Commander" }, vi.fn());

    expect(screen.getByText("Wing Commander")).toBeInTheDocument();
    expect(screen.getByText("Regular")).toBeInTheDocument();
  });

  it("calls onSelect with the member when a shared-info row is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderRow(sharedMember, onSelect);

    await user.click(screen.getByText("John Doe"));

    expect(onSelect).toHaveBeenCalledWith(sharedMember);
  });

  it("shows a Private indicator and is not clickable when the member has not shared contact info", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const privateMember: SectionMember = { ...sharedMember, sharesContactInfo: false, email: null };
    renderRow(privateMember, onSelect);

    expect(screen.getByTitle("Private")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    await user.click(screen.getByText("John Doe"));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
