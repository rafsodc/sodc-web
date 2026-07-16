import { Switch, Tooltip } from "@mui/material";
import { DarkMode, LightMode } from "@mui/icons-material";
import { useColorMode } from "../appShell/ColorModeContext";

export default function ColorModeToggle() {
  const { resolvedMode, toggleSessionMode } = useColorMode();
  const isDark = resolvedMode === "dark";

  return (
    <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      <Switch
        checked={isDark}
        onChange={toggleSessionMode}
        icon={<LightMode fontSize="small" sx={{ p: "1px", color: "warning.main" }} />}
        checkedIcon={<DarkMode fontSize="small" sx={{ p: "1px", color: "primary.dark" }} />}
        slotProps={{
          input: { role: "switch", "aria-label": isDark ? "Switch to light mode" : "Switch to dark mode" },
        }}
      />
    </Tooltip>
  );
}
