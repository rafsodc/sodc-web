import type { SectionType, SectionUserGroupPurpose } from "@dataconnect/generated";

export interface SectionWithDetails {
  id: string;
  name: string;
  type: SectionType;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SectionUserGroupRow {
  id: string;
  name: string;
  description?: string | null;
  purpose: SectionUserGroupPurpose;
}
