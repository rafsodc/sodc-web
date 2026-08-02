import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Typography,
} from "@mui/material";
import { CookieOutlined } from "@mui/icons-material";
import type { NavigationLink } from "../navigation/buildNavigationLinks";
import { useCookiePreferences } from "../cookies/CookiePreferencesContext";
import AppearanceMenu from "./AppearanceMenu";
import { SideNavContent } from "./AppSideNav";
import { drawerWidth } from "./appSideNavConstants";

interface MobileNavigationMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  sections: NavigationLink[];
  adminLinks: NavigationLink[];
  pathname: string;
  selectedAdminSectionId?: string | null;
  selectedAdminUserGroupId?: string | null;
}

export default function MobileNavigationMenu({
  anchorEl,
  onClose,
  sections,
  adminLinks,
  pathname,
  selectedAdminSectionId,
  selectedAdminUserGroupId,
}: MobileNavigationMenuProps) {
  const { openSettings } = useCookiePreferences();
  const hasNavigation = sections.length > 0 || adminLinks.length > 0;

  const handleCookieSettings = () => {
    onClose();
    openSettings();
  };

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      marginThreshold={8}
      slotProps={{
        paper: {
          sx: {
            width: drawerWidth,
            maxWidth: "calc(100vw - 16px)",
            maxHeight: "calc(100dvh - 72px)",
            overflow: "auto",
          },
        },
      }}
    >
      <Box component="nav" aria-label="Mobile navigation and settings">
        {hasNavigation ? (
          <SideNavContent
            sections={sections}
            adminLinks={adminLinks}
            pathname={pathname}
            selectedAdminSectionId={selectedAdminSectionId}
            selectedAdminUserGroupId={selectedAdminUserGroupId}
            onItemNavigate={onClose}
          />
        ) : null}
        <Box sx={{ display: { xs: "block", sm: "none" } }}>
          {hasNavigation ? <Divider /> : null}
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ display: "block", px: 2, pt: 1 }}
          >
            Settings
          </Typography>
          <List disablePadding sx={{ pb: 1 }}>
            <AppearanceMenu surface="navigation" onPreferenceChange={onClose} />
            <ListItemButton onClick={handleCookieSettings}>
              <ListItemIcon>
                <CookieOutlined fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Cookie settings" />
            </ListItemButton>
          </List>
        </Box>
      </Box>
    </Popover>
  );
}
