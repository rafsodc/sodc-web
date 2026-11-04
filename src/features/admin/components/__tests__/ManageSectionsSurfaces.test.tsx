import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "../../../../test-utils";
import { SectionUserGroupPurpose } from "@dataconnect/generated";
import { ManageSectionsListSurface, SectionEditorDialogSurface } from "../ManageSectionsSurfaces";
import type { SectionUserGroupRow, SectionWithDetails } from "../manageSectionsTypes";

const editingSection: SectionWithDetails = {
  id: "section-1",
  name: "Test Section",
  type: "MEMBERS" as SectionWithDetails["type"],
  description: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function renderDialog(overrides: {
  sectionUserGroups: SectionUserGroupRow[];
  sectionType?: SectionWithDetails["type"];
  removingUserGroupId?: string | null;
  onRemoveUserGroup?: (userGroupId: string, purpose: SectionUserGroupPurpose) => void;
}) {
  return render(
    <SectionEditorDialogSurface
      open
      editingSection={editingSection}
      sectionName="Test Section"
      sectionType={overrides.sectionType ?? editingSection.type}
      sectionDescription=""
      submitting={false}
      loadingUserGroups={false}
      sectionUserGroups={overrides.sectionUserGroups}
      removingUserGroupId={overrides.removingUserGroupId ?? null}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
      onSectionNameChange={vi.fn()}
      onSectionTypeChange={vi.fn()}
      onSectionDescriptionChange={vi.fn()}
      onOpenAddUserGroup={vi.fn()}
      onRemoveUserGroup={overrides.onRemoveUserGroup ?? vi.fn()}
    />
  );
}

const secondSection: SectionWithDetails = {
  ...editingSection,
  id: "section-2",
  name: "Another Section",
};

function renderList(configurationHref?: (sectionId: string) => string) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={
          <ManageSectionsListSurface
            configurationHref={configurationHref}
            onBack={vi.fn()}
            error={null}
            onDismissError={vi.fn()}
            loading={false}
            sections={[editingSection, secondSection]}
            onCreate={vi.fn()}
            onManageEvents={vi.fn()}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        } />
        <Route path="/sections/:sectionId/configuration" element={<h1>Section configuration</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  return { onEdit, onDelete };
}

describe("ManageSectionsListSurface accessible actions", () => {
  it("names each section's actions and lets keyboard users edit and delete the intended row", async () => {
    const user = userEvent.setup();
    const { onEdit, onDelete } = renderList();
    const editFirst = screen.getByRole("button", { name: "Edit Test Section" });
    const deleteFirst = screen.getByRole("button", { name: "Delete Test Section" });
    const editSecond = screen.getByRole("button", { name: "Edit Another Section" });
    const deleteSecond = screen.getByRole("button", { name: "Delete Another Section" });

    await user.tab();
    expect(screen.getByRole("button", { name: "Create Section" })).toHaveFocus();
    await user.tab();
    expect(editFirst).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onEdit).toHaveBeenCalledExactlyOnceWith(editingSection);

    await user.tab();
    expect(deleteFirst).toHaveFocus();
    await user.tab();
    expect(editSecond).toHaveFocus();
    await user.tab();
    expect(deleteSecond).toHaveFocus();
    await user.keyboard(" ");
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(secondSection);
  });

  it("keeps contextual names and keyboard navigation when Edit is a configuration link", async () => {
    const user = userEvent.setup();
    const { onEdit } = renderList((id) => `/sections/${id}/configuration`);
    const editFirst = screen.getByRole("link", { name: "Edit Test Section" });
    const editSecond = screen.getByRole("link", { name: "Edit Another Section" });
    expect(editFirst).toHaveAttribute("href", "/sections/section-1/configuration");
    expect(editSecond).toHaveAttribute("href", "/sections/section-2/configuration");

    await user.tab();
    await user.tab();
    expect(editFirst).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("heading", { name: "Section configuration" })).toBeInTheDocument();
    expect(onEdit).not.toHaveBeenCalled();
  });
});

describe("SectionEditorDialogSurface accessible group removal", () => {
  const linkedGroups: SectionUserGroupRow[] = [
    { id: "group-1", name: "Shared Group", purpose: SectionUserGroupPurpose.ACCESS },
    { id: "group-1", name: "Shared Group", purpose: SectionUserGroupPurpose.MEMBER },
  ];

  it("distinguishes group links by section and purpose and removes the keyboard-selected link", async () => {
    const user = userEvent.setup();
    const onRemoveUserGroup = vi.fn();
    renderDialog({ sectionUserGroups: linkedGroups, onRemoveUserGroup });
    const removeAccess = screen.getByRole("button", { name: "Remove Shared Group from Test Section (access)" });
    const removeMember = screen.getByRole("button", { name: "Remove Shared Group from Test Section (member)" });

    expect(screen.getByRole("textbox", { name: "Section Name" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveFocus();
    await user.tab();
    expect(removeAccess).toHaveFocus();
    await user.tab();
    expect(removeMember).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onRemoveUserGroup).toHaveBeenCalledExactlyOnceWith("group-1", SectionUserGroupPurpose.MEMBER);
  });

  it("keeps the pending removal named and disabled while other group links stay keyboard reachable", async () => {
    const user = userEvent.setup();
    const onRemoveUserGroup = vi.fn();
    renderDialog({
      sectionUserGroups: linkedGroups,
      removingUserGroupId: "group-1-ACCESS",
      onRemoveUserGroup,
    });
    const removeAccess = screen.getByRole("button", { name: "Remove Shared Group from Test Section (access)" });
    const removeMember = screen.getByRole("button", { name: "Remove Shared Group from Test Section (member)" });
    expect(removeAccess).toBeDisabled();
    expect(removeMember).toBeEnabled();

    await user.tab();
    await user.tab();
    expect(removeMember).toHaveFocus();
    await user.keyboard(" ");

    expect(onRemoveUserGroup).toHaveBeenCalledExactlyOnceWith("group-1", SectionUserGroupPurpose.MEMBER);
  });
});

const WARNING_TEXT = /no members/i;

describe("SectionEditorDialogSurface — MEMBER-purpose guidance (#322)", () => {
  it("shows guidance when a MEMBERS section has ACCESS-only groups and no MEMBER group", () => {
    renderDialog({
      sectionUserGroups: [
        { id: "group-1", name: "Access Group", description: null, purpose: SectionUserGroupPurpose.ACCESS },
      ],
    });

    expect(screen.getByText(WARNING_TEXT)).toBeInTheDocument();
  });

  it("omits guidance when the section has a MEMBER-purpose group", () => {
    renderDialog({
      sectionUserGroups: [
        { id: "group-1", name: "Access Group", description: null, purpose: SectionUserGroupPurpose.ACCESS },
        { id: "group-2", name: "Member Group", description: null, purpose: SectionUserGroupPurpose.MEMBER },
      ],
    });

    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
  });

  it("omits guidance when the section has no user groups at all", () => {
    renderDialog({ sectionUserGroups: [] });

    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
  });

  it("omits guidance for an EVENTS section without a MEMBER group", () => {
    renderDialog({
      sectionType: "EVENTS" as SectionWithDetails["type"],
      sectionUserGroups: [
        { id: "group-1", name: "Access Group", description: null, purpose: SectionUserGroupPurpose.ACCESS },
      ],
    });

    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
  });
});
