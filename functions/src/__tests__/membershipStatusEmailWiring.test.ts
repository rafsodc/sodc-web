import { beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleMembershipStatusEmailIfChanged } from "../membershipStatus";
import { notifyMembershipStatusEmailIfNeeded } from "../membershipStatusEmailDispatcher";

vi.mock("../membershipStatusEmailDispatcher", () => ({
  notifyMembershipStatusEmailIfNeeded: vi.fn(),
}));

describe("scheduleMembershipStatusEmailIfChanged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("notifies when status changes", () => {
    scheduleMembershipStatusEmailIfChanged({
      userId: "uid-1",
      previousStatus: "PENDING",
      newStatus: "REGULAR",
      appBaseUrl: "https://app.example",
    });

    expect(notifyMembershipStatusEmailIfNeeded).toHaveBeenCalledTimes(1);
    expect(notifyMembershipStatusEmailIfNeeded).toHaveBeenCalledWith({
      userId: "uid-1",
      previousStatus: "PENDING",
      newStatus: "REGULAR",
      appBaseUrl: "https://app.example",
    });
  });

  it("does not notify when status is unchanged", () => {
    scheduleMembershipStatusEmailIfChanged({
      userId: "uid-1",
      previousStatus: "REGULAR",
      newStatus: "REGULAR",
      appBaseUrl: "https://app.example",
    });

    expect(notifyMembershipStatusEmailIfNeeded).not.toHaveBeenCalled();
  });
});
