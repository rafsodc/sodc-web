export interface PurposeBearingLink {
  purpose?: string;
  purposes?: string[] | null;
}

export function linkHasPurpose(link: PurposeBearingLink, target: string): boolean {
  return link.purpose === target || (link.purposes?.includes(target) ?? false);
}
