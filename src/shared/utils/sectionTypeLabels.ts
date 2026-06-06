import { SectionType } from "@dataconnect/generated";

export function getSectionTypeLabel(type: SectionType | string): string {
  if (type === SectionType.EVENTS || type === "EVENTS") {
    return "Events";
  }
  if (type === SectionType.MEMBERS || type === "MEMBERS") {
    return "Members";
  }
  return String(type);
}

export function isMembersSectionType(type: SectionType | string): boolean {
  return type === SectionType.MEMBERS || type === "MEMBERS";
}
