import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { executeMutation, executeQuery } from "firebase/data-connect";
import {
  act,
  fireEvent,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "../../../../test-utils";
import {
  createSessionLifecycle,
  installSessionRuntime,
} from "../../../../shared/appShell/sessionLifecycle";
import ManageSections from "../ManageSections";

vi.mock("firebase/data-connect", () => ({
  executeQuery: vi.fn(),
  executeMutation: vi.fn(),
}));
vi.mock("../../../../config/firebase", () => ({
  auth: { currentUser: { uid: "admin-1" } },
  dataConnect: {},
}));
vi.mock("../../../users/hooks/useAdminClaim", () => ({
  useAdminClaim: () => true,
}));
vi.mock("@dataconnect/generated", async (original) => ({
  ...(await original<typeof import("@dataconnect/generated")>()),
  listSectionsRef: vi.fn(() => ({ kind: "sections" })),
  listUserGroupsRef: vi.fn(() => ({ kind: "groups" })),
  createSectionRef: vi.fn((_dc: unknown, vars: unknown) => ({
    kind: "create",
    vars,
  })),
  updateSectionRef: vi.fn((_dc: unknown, vars: unknown) => ({
    kind: "update",
    vars,
  })),
  getSectionByIdRef: vi.fn(() => ({ kind: "section" })),
}));

let failSectionReads = false;
let committed = false;
let unmountRuntime: () => void;
let owner: ReturnType<typeof createSessionLifecycle>;
let navigate: ReturnType<typeof useNavigate>;
const savedSection = {
  id: "created-section",
  name: "One pending section",
  type: "MEMBERS",
  description: null,
};
function Navigation() {
  const currentNavigation = useNavigate();
  const location = useLocation();
  useEffect(() => {
    navigate = currentNavigation;
  }, [currentNavigation]);
  return <output>{location.pathname + location.search}</output>;
}
function open(path = "/admin/sections?create=section") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Navigation />
      <Routes>
        <Route
          path="/admin/sections"
          element={<ManageSections onBack={() => {}} />}
        />
        <Route path="/elsewhere" element={<div>Elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );
}
async function fill() {
  const user = userEvent.setup();
  const input = await screen.findByLabelText("Section Name");
  await user.type(input, savedSection.name);
  return user;
}
function saveButton() {
  // Save renders a spinner while pending; it remains the final dialog action.
  return within(screen.getByRole("dialog", { name: "Create Section" }))
    .getAllByRole("button")
    .at(-1)!;
}

beforeEach(() => {
  vi.clearAllMocks();
  failSectionReads = false;
  committed = false;
  owner = createSessionLifecycle();
  owner.observe("admin-1");
  unmountRuntime = installSessionRuntime({
    lifecycle: owner,
    retire: () => owner.retire(),
    signOut: async () => owner.retire(),
  });
  vi.mocked(executeQuery).mockImplementation((ref: unknown) => {
    const kind = (ref as { kind: string }).kind;
    if (kind === "sections")
      return (
        failSectionReads
          ? Promise.reject(new Error("Latest list unavailable"))
          : Promise.resolve({
              data: { sections: committed ? [savedSection] : [] },
            })
      ) as never;
    return Promise.resolve({ data: { userGroups: [] } }) as never;
  });
  vi.mocked(executeMutation).mockImplementation(async () => {
    committed = true;
    return { data: {} } as never;
  });
});
afterEach(() => {
  cleanup();
  owner.retire();
  unmountRuntime();
});

describe("global section save receipt reconciliation", () => {
  it("does not permit an uncertain create to reset against a failed latest-list read", async () => {
    vi.mocked(executeMutation).mockImplementationOnce(async () => {
      committed = true;
      throw new Error("Response lost after commit");
    });
    open();
    const user = await fill();
    await user.click(saveButton());
    await screen.findByText(/The previous save could not be confirmed/);
    expect(saveButton()).toBeDisabled();
    failSectionReads = true;
    await user.click(screen.getByRole("button", { name: "Check latest list" }));
    await waitFor(() => expect(executeQuery).toHaveBeenCalledTimes(3));
    expect(
      screen.queryByRole("dialog", {
        name: "Start a new section save request?",
      }),
    ).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(executeMutation).toHaveBeenCalledOnce();
    failSectionReads = false;
    await user.click(screen.getByRole("button", { name: "Check latest list" }));
    const review = await screen.findByRole("dialog", {
      name: "Start a new section save request?",
    });
    expect(within(review).getByText(savedSection.name)).toBeInTheDocument();
    expect(executeMutation).toHaveBeenCalledOnce();
    await user.click(within(review).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: "Start a new section save request?",
          hidden: true,
        }),
      ).not.toBeInTheDocument(),
    );
    expect(saveButton()).toBeDisabled();
  }, 20_000);

  it("retains a successful receipt when its refresh fails and recovers through reads alone", async () => {
    open();
    const user = await fill();
    failSectionReads = true;
    await user.click(saveButton());
    await screen.findByText(/The previous save completed/);
    expect(saveButton()).toBeDisabled();
    expect(screen.getByLabelText("Section Name")).toHaveValue(
      savedSection.name,
    );
    expect(executeMutation).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Load saved change" }));
    expect(saveButton()).toBeDisabled();
    expect(
      screen.getByText("/admin/sections?create=section"),
    ).toBeInTheDocument();
    failSectionReads = false;
    await user.click(screen.getByRole("button", { name: "Load saved change" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Create Section" }),
      ).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(savedSection.name)).toBeInTheDocument();
    expect(executeMutation).toHaveBeenCalledOnce();
  }, 20_000);

  it("keeps one pending CreateSection through leaving and returning, then reconciles its settled success", async () => {
    let complete!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      complete = resolve;
    });
    vi.mocked(executeMutation).mockReturnValueOnce(pending as never);
    open();
    const user = await fill();
    await user.click(saveButton());
    await waitFor(() => expect(executeMutation).toHaveBeenCalledOnce());
    await act(async () => navigate("/elsewhere"));
    await act(async () => navigate(-1));
    expect(await screen.findByLabelText("Section Name")).toHaveValue(
      savedSection.name,
    );
    expect(saveButton()).toBeDisabled();
    expect(
      screen.getByText(/This save is still being confirmed/),
    ).toBeInTheDocument();
    fireEvent.click(saveButton());
    expect(executeMutation).toHaveBeenCalledOnce();
    await act(async () => navigate(1));
    await act(async () => {
      committed = true;
      complete({ data: {} });
      await pending;
    });
    expect(screen.getByText("Elsewhere")).toBeInTheDocument();
    await act(async () => navigate(-1));
    await screen.findByText(/The previous save completed/);
    expect(saveButton()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Load saved change" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Create Section" }),
      ).not.toBeInTheDocument(),
    );
    expect(executeMutation).toHaveBeenCalledOnce();
    expect(await screen.findByText(savedSection.name)).toBeInTheDocument();
  }, 20_000);

  it("retires the previous section editor when history selects a missing resource", async () => {
    committed = true;
    open(`/admin/sections?section=${savedSection.id}`);
    await waitFor(() =>
      expect(screen.getByLabelText("Section Name")).toHaveValue(
        savedSection.name,
      ),
    );
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Section Name"));
    await user.type(
      screen.getByLabelText("Section Name"),
      "Unsent configuration draft",
    );
    await act(async () => navigate("/admin/sections?section=missing-section"));
    expect(
      (
        await screen.findAllByText(
          "Section unavailable. It may have been deleted.",
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("dialog", { name: "Edit Section" }),
    ).not.toBeInTheDocument();
    expect(executeMutation).not.toHaveBeenCalled();
    await act(async () => navigate(-1));
    await waitFor(() =>
      expect(screen.getByLabelText("Section Name")).toHaveValue(
        "Unsent configuration draft",
      ),
    );
  }, 20_000);
  it("changes from an existing configuration URL to a new-section task without updating the old section", async () => {
    committed = true;
    open(`/admin/sections?section=${savedSection.id}`);
    await waitFor(() =>
      expect(screen.getByLabelText("Section Name")).toHaveValue(
        savedSection.name,
      ),
    );
    await act(async () => navigate("/admin/sections?create=section"));
    expect(
      await screen.findByRole("dialog", { name: "Create Section" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Section Name")).toHaveValue("");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Section Name"), "New URL section");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(executeMutation).toHaveBeenCalledOnce());
    expect(executeMutation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "create" }),
    );
  }, 20_000);
});
