import { FormControl, InputLabel, ListSubheader, MenuItem, Select, type SelectChangeEvent } from "@mui/material";
import { RANK_OPTION_GROUPS } from "../../constants";

interface RankSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Grouped rank/title dropdown shared between ProfileCompletion.tsx and Profile.tsx. See #273. */
export default function RankSelect({ value, onChange, disabled }: RankSelectProps) {
  return (
    <FormControl fullWidth disabled={disabled}>
      <InputLabel id="rank-select-label">Rank / Title</InputLabel>
      <Select
        labelId="rank-select-label"
        value={value}
        label="Rank / Title"
        onChange={(e: SelectChangeEvent) => onChange(e.target.value)}
      >
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
        {RANK_OPTION_GROUPS.flatMap((group) => [
          <ListSubheader key={`header-${group.label}`}>{group.label}</ListSubheader>,
          ...group.options.map((option) => (
            <MenuItem key={`${group.label}-${option}`} value={option}>
              {option}
            </MenuItem>
          )),
        ])}
      </Select>
    </FormControl>
  );
}
