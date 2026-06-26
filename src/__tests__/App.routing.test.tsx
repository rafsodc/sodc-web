import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { render, screen, waitFor } from "../test-utils";
import userEvent from "@testing-library/user-event";
import type { User } from "firebase/auth";
import type { GetSectionsForUserData } from "@dataconnect/generated";
import { SectionType } from "@dataconnect/generated";
import App from "../App";
import { ROUTES } from "../constants";
import { sectionDetailLocationState } from "../shared/navigation/sectionNavigationState";
import { createMockUser } from "../test-utils/mocks/firebase";

let currentUser: User | null = null;
let enabledClaim = false;
let enabledClaimResolved = true;
let adminClaim = false;

function purposeLink(purpose: "ACCESS" | "MODERATOR", id: string, name: string) {
  return {
    purposes: [purpose],
    section: { id, name, type: SectionType.MEMBERS, description: null },
  };
}

function sectionsData(overrides: Partial<GetSectionsForUserData> = {}): GetSectionsForUserData {
  return {
    user: {
      id: "user-1",
      membershipStatus: "REGULAR",
      userGroups: [
        {
          userGroup: {
            id: "group-1",
            name: "Group 1",
            membershipStatuses: null,
            purposeLinks: [purposeLink("ACCESS", "section-1", "Signals")],
          },
        },
      ],
    },
    allUserGroups: [],
    ...overrides,
  } as GetSectionsForUserData;
}

let mockSectionsData = sectionsData();

function signInEnabledUser({ admin = false, data = sectionsData() } = {}) {
  currentUser = createMockUser({ uid: admin ? "admin-1" : "user-1" });
  enabledClaim = true;
  adminClaim = admin;
  mockSectionsData = data;
}

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
  useEnabledClaim: vi.fn((user: User | null) => ({
    isEnabled: Boolean(user && enabledClaim),
    isEnabledClaimResolved: !user || enabledClaimResolved,
  })),
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

let needsProfileCompletion = false;

vi.mock("../shared/appShell/useUnenabledProfileCheck", () => ({
  useUnenabledProfileCheck: () => ({
    membershipStatusForUnenabled: null,
    needsProfileCompletion,
  }),
}));

vi.mock("../shared/components/Header", () => ({
  default: ({ onAccountClick, onProfileClick }: { onAccountClick: () => void; onProfileClick?: () => void }) => (
    <header>
      <button onClick={onAccountClick}>Account</button>
      <button onClick={onProfileClick}>Profile</button>
    </header>
  ),
}));

vi.mock("../features/welcome/components/PublicHomePage", () => ({
  default: () => <h1>Public Home Page</h1>,
}));

vi.mock("../features/welcome/components/MemberWelcomePage", () => ({
  default: () => <h1>Welcome Dashboard</h1>,
}));

vi.mock("../features/auth/components/AuthGate", () => ({
  default: () => <h1>Account Page</h1>,
}));

vi.mock("../features/auth/components/RegisterPage", () => ({
  default: () => <h1>Register Page</h1>,
}));

vi.mock("../features/auth/components/OnboardingShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

vi.mock("../features/sections/components/MyPayments", () => ({
  default: ({ onBack }: { onBack: () => void }) => (
    <div>
      <h1>My Payments Page</h1>
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));

vi.mock("../features/sections/components/MyBookings", () => ({
  default: ({ onBack }: { onBack: () => void }) => (
    <div>
      <h1>My Bookings Page</h1>
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
  return (
    <>
      <div data-testid="location">{`${location.pathname}${location.search}`}</div>
      <div data-testid="location-state">{JSON.stringify(location.state)}</div>
    </>
  );
}

function renderApp(initialEntries: Array<string | { pathname: string; search?: string; state?: unknown }>) {
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
    enabledClaimResolved = true;
    adminClaim = false;
    needsProfileCompletion = false;
    mockSectionsData = sectionsData();
    vi.clearAllMocks();
  });

  it("renders public home content when logged out at home", async () => {
    renderApp([ROUTES.HOME]);

    expect(await screen.findByRole("heading", { name: "Public Home Page" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.HOME);
  });

  it("renders the register page from a direct deep link when logged out", async () => {
    renderApp([ROUTES.REGISTER]);

    expect(await screen.findByRole("heading", { name: "Register Page" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.REGISTER);
  });

  it("redirects users who need profile completion to the profile completion route", async () => {
    currentUser = createMockUser({ emailVerified: true });
    enabledClaim = false;
    needsProfileCompletion = true;

    renderApp([ROUTES.HOME]);

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.PROFILE_COMPLETION)
    );
    expect(await screen.findByRole("heading", { name: "Profile Completion Page" })).toBeInTheDocument();
  });

  it("renders profile completion from a direct deep link when required", async () => {
    currentUser = createMockUser({ emailVerified: true });
    enabledClaim = false;
    needsProfileCompletion = true;

    renderApp([ROUTES.PROFILE_COMPLETION]);

    expect(await screen.findByRole("heading", { name: "Profile Completion Page" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.PROFILE_COMPLETION);
  });

  it("renders the account page from a direct deep link when logged out", async () => {
    renderApp([ROUTES.ACCOUNT]);

    expect(await screen.findByRole("heading", { name: "Account Page" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.ACCOUNT);
  });

  it("renders welcome dashboard for enabled users at home", async () => {
    signInEnabledUser();

    renderApp([ROUTES.HOME]);

    expect(await screen.findByRole("heading", { name: "Welcome Dashboard" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.HOME);
  });

  it("redirects enabled users from account to home", async () => {
    signInEnabledUser();

    renderApp([ROUTES.ACCOUNT]);

    expect(await screen.findByRole("heading", { name: "Welcome Dashboard" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.HOME));
  });

  it("redirects unauthenticated section deep links to account", async () => {
    renderApp(["/sections/section-1"]);

    expect(await screen.findByRole("heading", { name: "Account Page" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.ACCOUNT));
  });

  it("renders section detail from a direct deep link for enabled users", async () => {
    signInEnabledUser();

    renderApp(["/sections/section-1"]);

    expect(await screen.findByRole("heading", { name: "Section Detail section-1" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/sections/section-1");
  });

  it("renders member payment history from a direct deep link for enabled users", async () => {
    signInEnabledUser();
    renderApp([ROUTES.MY_PAYMENTS]);

    expect(await screen.findByRole("heading", { name: "My Payments Page" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.MY_PAYMENTS);
  });

  it("keeps enabled users on payments after Stripe checkout return", async () => {
    signInEnabledUser();
    renderApp([
      `${ROUTES.MY_PAYMENTS}?checkout=success&orderId=00000000-0000-0000-0000-000000000001`,
    ]);

    expect(await screen.findByText(/payment confirmed/i)).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.MY_PAYMENTS);
    expect(screen.getByRole("heading", { name: "My Payments Page" })).toBeInTheDocument();
  });

  it("waits for enabled claim resolution before redirecting checkout returns away from payments", async () => {
    signInEnabledUser();
    enabledClaimResolved = false;

    renderApp([
      `${ROUTES.MY_PAYMENTS}?checkout=success&orderId=00000000-0000-0000-0000-000000000001`,
    ]);

    expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.MY_PAYMENTS);
    expect(screen.queryByRole("heading", { name: "Account Page" })).not.toBeInTheDocument();
  });

  it("renders member bookings hub from a direct deep link for enabled users", async () => {
    signInEnabledUser();
    renderApp([ROUTES.MY_BOOKINGS]);

    expect(await screen.findByRole("heading", { name: "My Bookings Page" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.MY_BOOKINGS);
  });

  it("uses browser history for section detail Back when history exists", async () => {
    signInEnabledUser();
    const user = userEvent.setup();

    renderApp([ROUTES.HOME, "/sections/section-1"]);

    expect(await screen.findByRole("heading", { name: "Section Detail section-1" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("heading", { name: "Welcome Dashboard" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.HOME));
  });

  it("falls back to home when section detail was opened from welcome", async () => {
    signInEnabledUser();
    const user = userEvent.setup();

    renderApp([{ pathname: "/sections/section-1", state: sectionDetailLocationState(ROUTES.HOME) }]);

    expect(await screen.findByRole("heading", { name: "Section Detail section-1" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("heading", { name: "Welcome Dashboard" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.HOME));
  });

  it("falls back to sections when section detail has no prior history", async () => {
    signInEnabledUser();
    const user = userEvent.setup();

    renderApp(["/sections/section-1"]);

    expect(await screen.findByRole("heading", { name: "Section Detail section-1" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("heading", { name: "Sections Page" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.SECTIONS));
  });

  it("renders access denied for non-admin admin deep links", async () => {
    signInEnabledUser();

    renderApp([ROUTES.MANAGE_USERS]);

    expect(await screen.findByText(/access denied/i)).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.MANAGE_USERS);
  });

  it.each([
    [ROUTES.MANAGE_USERS, "Manage Users Page"],
    [ROUTES.APPROVE_USERS, "Approvals Page"],
    [ROUTES.USER_GROUPS, "User Groups Page"],
    [ROUTES.AUDIT_LOGS, "Audit Logs Page"],
    [ROUTES.MANAGE_SECTIONS, "Manage Sections Page"],
  ])("renders %s for admin deep links", async (route, heading) => {
    signInEnabledUser({ admin: true });

    renderApp([route]);

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(route);
  });

  it("redirects legacy permissions route to manage users", async () => {
    signInEnabledUser({ admin: true });

    renderApp([ROUTES.PERMISSIONS]);

    expect(await screen.findByRole("heading", { name: "Manage Users Page" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.MANAGE_USERS));
  });

  it("shows permitted section links without admin-only nav for enabled members", async () => {
    signInEnabledUser();

    renderApp([ROUTES.HOME]);

    expect(await screen.findByRole("heading", { name: "Welcome Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Signals" })).toHaveAttribute("href", "/sections/section-1");
    expect(screen.queryByRole("link", { name: "Administer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manage Users" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Audit Logs" })).not.toBeInTheDocument();
  });

  it("shows moderator section admin links without admin-only management links", async () => {
    signInEnabledUser({
      data: sectionsData({
        user: {
          id: "user-1",
          membershipStatus: "REGULAR",
          userGroups: [
            {
              userGroup: {
                id: "moderator-group",
                name: "Moderators",
                membershipStatuses: null,
                purposeLinks: [purposeLink("MODERATOR", "section-1", "Signals")],
              },
            },
          ],
        },
      } as Partial<GetSectionsForUserData>),
    });

    renderApp([ROUTES.HOME]);

    expect(await screen.findByRole("heading", { name: "Welcome Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Administer" })).toHaveAttribute("href", ROUTES.MANAGE_SECTIONS);
    expect(screen.getByRole("link", { name: "Manage Sections" })).toHaveAttribute("href", ROUTES.MANAGE_SECTIONS);
    expect(screen.queryByRole("link", { name: "Manage Users" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Audit Logs" })).not.toBeInTheDocument();
  });

  it("navigates section admin links with managed section route state", async () => {
    signInEnabledUser({ admin: true });
    const user = userEvent.setup();

    renderApp([ROUTES.HOME]);

    expect(await screen.findByRole("heading", { name: "Welcome Dashboard" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Administer" }));

    expect(await screen.findByRole("heading", { name: "Manage Sections Page" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.MANAGE_SECTIONS);
    expect(screen.getByTestId("location-state")).toHaveTextContent(
      JSON.stringify({ managedSection: { id: "section-1", name: "Signals" } })
    );
  });

  it("clears managed section route state from the root Manage Sections link", async () => {
    signInEnabledUser({ admin: true });
    const user = userEvent.setup();

    renderApp([ROUTES.HOME]);

    expect(await screen.findByRole("heading", { name: "Welcome Dashboard" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Administer" }));
    await screen.findByRole("heading", { name: "Manage Sections Page" });
    expect(screen.getByTestId("location-state")).toHaveTextContent("section-1");

    await user.click(screen.getByRole("link", { name: "Manage Sections" }));

    await waitFor(() => expect(screen.getByTestId("location-state")).toHaveTextContent("null"));
  });

  it("navigates user group admin links with expanded group route state", async () => {
    signInEnabledUser({
      admin: true,
      data: sectionsData({
        allUserGroups: [
          {
            id: "group-1",
            name: "Access group",
            membershipStatuses: ["REGULAR"],
            purposeLinks: [purposeLink("ACCESS", "section-1", "Signals")],
          },
        ],
      } as Partial<GetSectionsForUserData>),
    });
    const user = userEvent.setup();

    renderApp([ROUTES.HOME]);

    expect(await screen.findByRole("heading", { name: "Welcome Dashboard" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Access group" }));

    expect(await screen.findByRole("heading", { name: "User Groups Page" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.USER_GROUPS);
    expect(screen.getByTestId("location-state")).toHaveTextContent(JSON.stringify({ expandedGroupId: "group-1" }));
  });

  it("uses browser history for admin Back when history exists", async () => {
    signInEnabledUser({ admin: true });
    const user = userEvent.setup();

    renderApp([ROUTES.HOME, ROUTES.MANAGE_USERS]);

    expect(await screen.findByRole("heading", { name: "Manage Users Page" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("heading", { name: "Welcome Dashboard" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.HOME));
  });

  it("cleans checkout query params with replace when dismissed", async () => {
    signInEnabledUser();
    const user = userEvent.setup();

    renderApp(["/?checkout=success&orderId=00000000-0000-0000-0000-000000000001"]);

    expect(await screen.findByText(/payment confirmed/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(ROUTES.HOME));
  });
});
