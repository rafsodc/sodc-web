import { useState } from "react";
import {
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  Check,
  DarkMode,
  ExpandMore,
  LightMode,
  SettingsBrightness,
} from "@mui/icons-material";
import {
  useColorMode,
  type ColorModePreference,
} from "../appShell/ColorModeContext";

const OPTIONS: Array<{
  value: ColorModePreference;
  label: string;
  icon: typeof SettingsBrightness;
}> = [
  { value: "system", label: "System", icon: SettingsBrightness },
  { value: "light", label: "Light", icon: LightMode },
  { value: "dark", label: "Dark", icon: DarkMode },
];

export default function AppearanceMenu() {
  const { preference, setPreference } = useColorMode();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const selectedLabel = OPTIONS.find(({ value }) => value === preference)?.label;

  const choose = (value: ColorModePreference) => {
    setPreference(value);
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        size="small"
        color="inherit"
        startIcon={<SettingsBrightness />}
        endIcon={<ExpandMore />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={open ? "true" : undefined}
        aria-controls={open ? "appearance-menu" : undefined}
      >
        Appearance: {selectedLabel}
      </Button>
      <Menu
        id="appearance-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        MenuListProps={{ "aria-label": "Choose appearance" }}
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <MenuItem
            key={value}
            selected={preference === value}
            onClick={() => choose(value)}
          >
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{label}</ListItemText>
            {preference === value ? (
              <Check fontSize="small" aria-label="Selected" />
            ) : null}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
