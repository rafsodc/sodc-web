import { useState } from "react";
import {
  Box,
  Button,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
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
import { useCookiePreferences } from "../cookies/CookiePreferencesContext";
import { footerUtilityButtonSx } from "./footerUtilityStyles";

const OPTIONS: Array<{
  value: ColorModePreference;
  label: string;
  icon: typeof SettingsBrightness;
}> = [
  { value: "light", label: "Light", icon: LightMode },
  { value: "dark", label: "Dark", icon: DarkMode },
  { value: "system", label: "System", icon: SettingsBrightness },
];

interface AppearanceMenuProps {
  surface?: "footer" | "navigation";
  onPreferenceChange?: () => void;
}

export default function AppearanceMenu({
  surface = "footer",
  onPreferenceChange,
}: AppearanceMenuProps) {
  const { preference, resolvedMode, setPreference } = useColorMode();
  const { decision } = useCookiePreferences();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const resolvedLabel = resolvedMode === "dark" ? "Dark mode" : "Light mode";
  const accessibleLabel =
    preference === "system"
      ? `Appearance: System, currently ${resolvedLabel}`
      : `Appearance: ${resolvedLabel}`;
  const StatusIcon =
    preference === "system"
      ? SettingsBrightness
      : resolvedMode === "dark"
        ? DarkMode
        : LightMode;

  const choose = (value: ColorModePreference) => {
    setPreference(value);
    setAnchorEl(null);
    onPreferenceChange?.();
  };

  const isNavigation = surface === "navigation";
  const menuId = `appearance-menu-${surface}`;

  return (
    <>
      {isNavigation ? (
        <ListItemButton
          onClick={(event) => setAnchorEl(event.currentTarget)}
          aria-label={accessibleLabel}
          aria-haspopup="menu"
          aria-expanded={open ? "true" : undefined}
          aria-controls={open ? menuId : undefined}
        >
          <ListItemIcon>
            <StatusIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={resolvedLabel} />
          <ExpandMore fontSize="small" />
        </ListItemButton>
      ) : (
        <Button
          size="small"
          color="inherit"
          startIcon={<StatusIcon />}
          endIcon={<ExpandMore />}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          aria-label={accessibleLabel}
          aria-haspopup="menu"
          aria-expanded={open ? "true" : undefined}
          aria-controls={open ? menuId : undefined}
          sx={footerUtilityButtonSx}
        >
          {resolvedLabel}
        </Button>
      )}
      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: isNavigation ? "bottom" : "top", horizontal: "left" }}
        transformOrigin={{ vertical: isNavigation ? "top" : "bottom", horizontal: "left" }}
        MenuListProps={{ "aria-label": "Choose appearance" }}
        slotProps={{ paper: { sx: { minWidth: 180 } } }}
      >
        {decision !== "accepted" ? (
          <Box component="li" role="presentation" sx={{ maxWidth: 260, px: 2, py: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Light and Dark use one cookie to remember your choice.
            </Typography>
          </Box>
        ) : null}
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
