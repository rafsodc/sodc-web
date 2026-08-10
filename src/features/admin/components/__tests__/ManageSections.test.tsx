import { describe, beforeEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { executeMutation, executeQuery } from "firebase/data-connect";
import { render, screen } from "../../../../test-utils";
import ManageSections from "../ManageSections";

vi.mock("firebase/data-connect", () => ({
  executeQuery: vi.fn(),
  executeMutation: vi.fn(),
}));
vi.mock("../../../../config/firebase", () => ({
  auth: { currentUser: { uid: "admin-1" } },
  dataConnect: {},
}));
vi.mock("../../../users/hooks/useAdminClaim", () => ({ useAdminClaim: () => true }));
vi.mock("../SectionEventsManager", () => ({ default: () => null }));
vi.mock("@dataconnect/generated", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dataconnect/generated")>();
  return {
    ...actual,
    listSectionsRef: vi.fn(() => ({ kind: "list-sections" })),
    listUserGroupsRef: vi.fn(() => ({ kind: "list-user-groups" })),
    createSectionRef: vi.fn((_dc: unknown, vars: unknown) => ({ kind: "create-section", vars })),
    updateSectionRef: vi.fn(),
    deleteSectionRef: vi.fn(),
    getSectionByIdRef: vi.fn(),
    grantUserGroupToSectionForPurposeRef: vi.fn(),
    revokeUserGroupFromSectionForPurposeRef: vi.fn(),
  };
});
vi.mock("../ManageSectionsSurfaces", () => ({
  ManageSectionsListSurface: ({ sections, onCreate }: { sections: Array<{ id: string; name: string }>; onCreate: () => void }) => (
    <div>
      <button onClick={onCreate}>Create Section</button>
      {sections.map((section) => <div key={section.id}>{section.name}</div>)}
    </div>
  ),
  SectionEditorDialogSurface: ({
    open,
    sectionName,
    onSectionNameChange,
    onSubmit,
  }: {
    open: boolean;
    sectionName: string;
    onSectionNameChange: (value: string) => void;
    onSubmit: () => void;
  }) => open ? (
    <div>
      <label>Section Name<input value={sectionName} onChange={(event) => onSectionNameChange(event.target.value)} /></label>
      <button onClick={onSubmit}>Save Section</button>
    </div>
  ) : null,
  AddSectionUserGroupDialogSurface: () => null,
}));

let created = false;
let navigationLabel = "Old navigation";

function NavigationProbe() {
  const query = useQuery({
    queryKey: ["GetSectionsForUser"],
    queryFn: async () => navigationLabel,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return <div>Navigation: {query.data ?? "Loading"}</div>;
}

describe("ManageSections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    created = false;
    navigationLabel = "Old navigation";
    vi.mocked(executeQuery).mockImplementation((ref: unknown) => {
      const kind = (ref as { kind: string }).kind;
      if (kind === "list-user-groups") return Promise.resolve({ data: { userGroups: [] } }) as never;
      if (kind === "list-sections") {
        return Promise.resolve({
          data: {
            sections: created
              ? [
                  { id: "section-1", name: "Existing Section", type: "MEMBERS", description: null },
                  { id: "section-2", name: "New Section", type: "MEMBERS", description: null },
                ]
              : [{ id: "section-1", name: "Existing Section", type: "MEMBERS", description: null }],
          },
        }) as never;
      }
      return Promise.resolve({ data: null }) as never;
    });
    vi.mocked(executeMutation).mockImplementation(async () => {
      created = true;
      navigationLabel = "New Section";
      return {} as never;
    });
  });

  it("renders the saved section and refreshes the persistent navigation query", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NavigationProbe />
        <ManageSections onBack={vi.fn()} />
      </MemoryRouter>
    );

    expect(await screen.findByText("Existing Section")).toBeInTheDocument();
    expect(await screen.findByText("Navigation: Old navigation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create Section" }));
    await user.type(screen.getByLabelText("Section Name"), "New Section");
    await user.click(screen.getByRole("button", { name: "Save Section" }));

    expect(await screen.findByText("New Section")).toBeInTheDocument();
    expect(await screen.findByText("Navigation: New Section")).toBeInTheDocument();
  });
});
