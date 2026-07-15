/**
 * Rank/title options for the member profile dropdown (see #273). Stored as free text on
 * User.rank so the list can change without a schema migration — this just constrains input.
 * Grouped for display, RAF first (this is an RAF club).
 */
export interface RankOptionGroup {
  label: string;
  options: readonly string[];
}

export const RANK_OPTION_GROUPS: readonly RankOptionGroup[] = [
  {
    label: "Titles",
    options: ["Mr", "Mrs", "Ms", "Miss", "Dr"],
  },
  {
    label: "RAF",
    options: [
      "Pilot Officer",
      "Flying Officer",
      "Flight Lieutenant",
      "Squadron Leader",
      "Wing Commander",
      "Group Captain",
      "Air Commodore",
      "Air Vice-Marshal",
      "Air Marshal",
      "Air Chief Marshal",
      "Marshal of the Royal Air Force",
    ],
  },
  {
    label: "Army",
    options: [
      "Second Lieutenant",
      "Lieutenant",
      "Captain",
      "Major",
      "Lieutenant Colonel",
      "Colonel",
      "Brigadier",
      "Major General",
      "Lieutenant General",
      "General",
      "Field Marshal",
    ],
  },
  {
    label: "Royal Navy",
    options: [
      "Midshipman",
      "Sub-Lieutenant",
      "Lieutenant",
      "Lieutenant Commander",
      "Commander",
      "Captain",
      "Commodore",
      "Rear Admiral",
      "Vice Admiral",
      "Admiral",
      "Admiral of the Fleet",
    ],
  },
] as const;
