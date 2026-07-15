import { useState, type ReactNode } from "react";
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from "@mui/material";
import { DarkMode, LightMode, SettingsBrightness } from "@mui/icons-material";
import { useColorMode, type ColorModePreference } from "../appShell/ColorModeContext";

const OPTIONS: Array<{ value: ColorModePreference; label: string; icon: ReactNode }> = [
  { value: "system", label: "System", icon: <SettingsBrightness fontSize="small" /> },
  { value: "light", label: "Light", icon: <LightMode fontSize="small" /> },
  { value: "dark", label: "Dark", icon: <DarkMode fontSize="small" /> },
];

export default function ColorModeToggle() {
  const { preference, resolvedMode, setPreference } = useColorMode();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const currentIcon =
    preference === "system" ? (
      <SettingsBrightness />
    ) : resolvedMode === "dark" ? (
      <DarkMode />
    ) : (
      <LightMode />
    );

  return (
    <>
      <Tooltip title="Appearance">
        <IconButton
          color="inherit"
          aria-label="Appearance"
          aria-haspopup="true"
          aria-expanded={open ? "true" : "false"}
          aria-controls={open ? "color-mode-menu" : undefined}
          onClick={(event) => setAnchorEl(event.currentTarget)}
        >
          {currentIcon}
        </IconButton>
      </Tooltip>
      <Menu
        id="color-mode-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            selected={preference === option.value}
            onClick={() => {
              setPreference(option.value);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon>{option.icon}</ListItemIcon>
            <ListItemText>{option.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
