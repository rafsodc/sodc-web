import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { render, screen, waitFor } from "../test-utils";
import userEvent from "@testing-library/user-event";
import type { User } from "firebase/auth";
import App from "../App";
import { ROUTES } from "../constants";
import { createMockUser } from "../test-utils/mocks/firebase";

let currentUser: User | null = null;
let enabledClaim = false;
let adminClaim = false;

const mockSectionsData = {
  user: {
    id: "user-1",
    membershipStatus: "REGULAR",
    userGroups: [
      {
        userGroup: {
          id: "group-1",
          purposeLinks: [
            {
              purpose: "ACCESS",
              section: { id: "section-1", name: "Signals" },
            },
          ],
        },
      },
    ],
  },
  allUserGroups: [],
};

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(currentUser);
    return vi.fn();
  }),
  onIdTokenChanged: vi.fn((_auth, callback) => {
    callback(currentUser);
    return vi.fn();
  }),
  reload: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../config/firebase", () => ({
  auth: {
    get currentUser() {
      return currentUser;
    },
  },
  dataConnect: {},
  firebaseApp: {},
}));

vi.mock("../features/users/hooks/useUserData", () => ({
  useUserData: vi.fn((user: User | null) => ({
    userData: user
      ? {
          id: user.uid,
          firstName: "Test",
          lastName: "User",
          email: user.email ?? "test@example.com",
          serviceNumber: "123",
          membershipStatus: "REGULAR",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        }
      : null,
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

vi.mock("../features/users/hooks/useEnabledClaim", () => ({
  useEnabledClaim: vi.fn((user: User | null) => Boolean(user && enabledClaim)),
}));

vi.mock("../features/users/hooks/useAdminClaim", () => ({
  useAdminClaim: vi.fn((user: User | null) => Boolean(user && adminClaim)),
}));

vi.mock("@dataconnect/generated/react", () => ({
  useGetSectionsForUser: vi.fn(() => ({
    data: mockSectionsData,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
  useGetMyTicketOrderById: vi.fn(() => ({
    data: {
      user: {
        ticketOrders: [
          {
            status: "PAID",
            ticketType: { title: "Dinner ticket" },
          },
        ],
      },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
}));

vi.mock("../shared/components/Header", () => ({
  default: ({ onAccountClick, onProfileClick }: { onAccountClick: () => void; onProfileClick?: () => void }) => (
    <header>
      <button onClick={onAccountClick}>Account</button>
      <button onClick={onProfileClick}>Profile</button>
    </header>
  ),
}));

vi.mock("../shared/components/HomePage", () => ({
  default: () => <h1>Home Page</h1>,
}));

vi.mock("../features/auth/components/AuthGate", () => ({
  default: ({ onBack }: { onBack?: () => void }) => (
    <div>
      <h1>Account Page</h1>
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));

vi.mock("../features/profile/components/Profile", () => ({
  default: ({ onBack }: { onBack: () => void }) => (
    <div>
      <h1>Profile Page</h1>
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));

vi.mock("../features/sections/components/SectionsList", () => ({
  default: ({ onBack, onSelectSection }: { onBack: () => void; onSelectSection: (sectionId: string) => void }) => (
    <div>
      <h1>Sections Page</h1>
      <button onClick={onBack}>Back</button>
      <button onClick={() => onSelectSection("section-1")}>Open Section</button>
    </div>
  ),
}));

vi.mock("../features/sections/components/SectionDetail", () => ({
  default: ({ sectionId, onBack }: { sectionId: string; onBack: () => void }) => (
    <div>
      <h1>Section Detail {sectionId}</h1>
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));

vi.mock("../features/admin/components/ManageUsers", () => ({
  default: ({ onBack }: { onBack: () => void }) => (
    <div>
      <h1>Manage Users Page</h1>
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));

vi.mock("../features/admin/components/ApproveUsers", () => ({
  default: () => <h1>Approvals Page</h1>,
}));

vi.mock("../features/admin/components/UserGroups", () => ({
  default: () => <h1>User Groups Page</h1>,
}));

vi.mock("../features/admin/components/AuditLogs", () => ({
  default: () => <h1>Audit Logs Page</h1>,
}));

vi.mock("../features/admin/components/ManageSections", () => ({
  default: () => <h1>Manage Sections Page</h1>,
}));

vi.mock("../features/users/components/AccountStatusMessage", () => ({
  default: () => <h1>Account Status Page</h1>,
}));

vi.mock("../features/auth/components/ProfileCompletion", () => ({
  default: () => <h1>Profile Completion Page</h1>,
}));

vi.mock("../features/auth/components/EmailVerificationMessage", () => ({
  default: () => <h1>Email Verification Page</h1>,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderApp(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
      <LocationProbe />
    </MemoryRouter>
  );
}

describe("App routing", () => {
  beforeEach(() => {
    currentUser = null;
    enabledClaim = false;
    adminClaim = false;
    vi.clearAllMocks();
  });

  it("renders the account page from a direct deep link", async () => {
    renderApp([ROUTES.ACCOUNT]);

    expect(await screen.findByRole("heading", { name: "Account Page" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.ACCOUNT);
  });

  it("redirects unauthenticated section deep links to account", async () => {
    renderApp(["/sections/section-1"]);

    expect(await screen.findByRole("heading", { name: "Account Page" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.ACCOUNT));
  });

  it("renders section detail from a direct deep link for enabled users", async () => {
    currentUser = createMockUser({ uid: "user-1" });
    enabledClaim = true;

    renderApp(["/sections/section-1"]);

    expect(await screen.findByRole("heading", { name: "Section Detail section-1" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/sections/section-1");
  });

  it("uses browser history for section detail Back when history exists", async () => {
    currentUser = createMockUser({ uid: "user-1" });
    enabledClaim = true;
    const user = userEvent.setup();

    renderApp([ROUTES.HOME, "/sections/section-1"]);

    expect(await screen.findByRole("heading", { name: "Section Detail section-1" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("heading", { name: "Home Page" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.HOME));
  });

  it("falls back to sections when section detail has no prior history", async () => {
    currentUser = createMockUser({ uid: "user-1" });
    enabledClaim = true;
    const user = userEvent.setup();

    renderApp(["/sections/section-1"]);

    expect(await screen.findByRole("heading", { name: "Section Detail section-1" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("heading", { name: "Sections Page" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.SECTIONS));
  });

  it("renders access denied for non-admin admin deep links", async () => {
    currentUser = createMockUser({ uid: "user-1" });
    enabledClaim = true;

    renderApp([ROUTES.MANAGE_USERS]);

    expect(await screen.findByText(/access denied/i)).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.MANAGE_USERS);
  });

  it("renders admin pages for admin deep links", async () => {
    currentUser = createMockUser({ uid: "admin-1" });
    enabledClaim = true;
    adminClaim = true;

    renderApp([ROUTES.MANAGE_USERS]);

    expect(await screen.findByRole("heading", { name: "Manage Users Page" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.MANAGE_USERS);
  });

  it("cleans checkout query params with replace when dismissed", async () => {
    currentUser = createMockUser({ uid: "user-1" });
    enabledClaim = true;
    const user = userEvent.setup();

    renderApp(["/?checkout=success&orderId=00000000-0000-0000-0000-000000000001"]);

    expect(await screen.findByText(/payment confirmed/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.HOME));
  });
});
