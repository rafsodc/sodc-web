import { describe, expect, it, vi } from "vitest";
import { render, screen } from "../../../../test-utils";
import { SectionUserGroupPurpose } from "@dataconnect/generated";
import { SectionEditorDialogSurface } from "../ManageSectionsSurfaces";
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
      removingUserGroupId={null}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
      onSectionNameChange={vi.fn()}
      onSectionTypeChange={vi.fn()}
      onSectionDescriptionChange={vi.fn()}
      onOpenAddUserGroup={vi.fn()}
      onRemoveUserGroup={vi.fn()}
    />
  );
}

const WARNING_TEXT = /no members/i;

describe("SectionEditorDialogSurface — MEMBER-purpose warning (#322)", () => {
  it("warns when a MEMBERS section has ACCESS-only groups and no MEMBER group", () => {
    renderDialog({
      sectionUserGroups: [
        { id: "group-1", name: "Access Group", description: null, purpose: SectionUserGroupPurpose.ACCESS },
      ],
    });

    expect(screen.getByText(WARNING_TEXT)).toBeInTheDocument();
  });

  it("does not warn when the section has a MEMBER-purpose group", () => {
    renderDialog({
      sectionUserGroups: [
        { id: "group-1", name: "Access Group", description: null, purpose: SectionUserGroupPurpose.ACCESS },
        { id: "group-2", name: "Member Group", description: null, purpose: SectionUserGroupPurpose.MEMBER },
      ],
    });

    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
  });

  it("does not warn when the section has no user groups at all", () => {
    renderDialog({ sectionUserGroups: [] });

    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
  });

  it("does not warn for an EVENTS section without a MEMBER group", () => {
    renderDialog({
      sectionType: "EVENTS" as SectionWithDetails["type"],
      sectionUserGroups: [
        { id: "group-1", name: "Access Group", description: null, purpose: SectionUserGroupPurpose.ACCESS },
      ],
    });

    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
  });
});
