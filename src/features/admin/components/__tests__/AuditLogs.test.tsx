import { describe, beforeEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../../../../test-utils";
import AuditLogs from "../AuditLogs";
import { executeQuery } from "firebase/data-connect";

vi.mock("firebase/data-connect", () => ({ executeQuery: vi.fn() }));
vi.mock("../../../../config/firebase", () => ({ dataConnect: {} }));
vi.mock("@dataconnect/generated", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dataconnect/generated")>();
  return {
    ...actual,
    listUsersRef: vi.fn(() => ({ kind: "users" })),
    listUserGroupsRef: vi.fn(() => ({ kind: "groups" })),
    listSectionsRef: vi.fn(() => ({ kind: "sections" })),
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
}

describe("AuditLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the current tab loading when an older request resolves out of order", async () => {
    const user = userEvent.setup();
    const staleUsers = deferred<{ data: { users: Array<Record<string, unknown>> } }>();
    const currentGroups = deferred<{ data: { userGroups: Array<Record<string, unknown>> } }>();
    let usersCall = 0;

    vi.mocked(executeQuery).mockImplementation((ref: unknown) => {
      const kind = (ref as { kind: string }).kind;
      if (kind === "users") {
        usersCall += 1;
        if (usersCall === 1) return Promise.resolve({ data: { users: [] } }) as never;
        return staleUsers.promise as never;
      }
      if (kind === "groups") return currentGroups.promise as never;
      return Promise.resolve({ data: { sections: [] } }) as never;
    });

    render(<AuditLogs onBack={vi.fn()} />);
    await waitFor(() => expect(usersCall).toBe(2));
    await user.click(screen.getByRole("tab", { name: "User Groups" }));
    await waitFor(() => expect(vi.mocked(executeQuery).mock.calls.length).toBe(3));

    staleUsers.resolve({
      data: {
        users: [{
          id: "stale-user",
          firstName: "Stale",
          lastName: "User",
          email: "stale@example.com",
          membershipStatus: "REGULAR",
        }],
      },
    });

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });
    expect(screen.queryByText("No user groups found")).not.toBeInTheDocument();

    currentGroups.resolve({
      data: {
        userGroups: [{
          id: "group-1",
          name: "Current Group",
          description: "Latest response",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          createdBy: "system",
          updatedBy: "system",
        }],
      },
    });

    expect(await screen.findByText("Current Group")).toBeInTheDocument();
    expect(screen.queryByText("Stale User")).not.toBeInTheDocument();
  });
});
