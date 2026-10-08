export function seatingPreferenceNames(value: string): string[] {
  return value.split("\n").map((name) => name.trim()).filter(Boolean);
}

