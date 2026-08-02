import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { CookieOutlined } from "@mui/icons-material";
import type { NavigationLink } from "../navigation/buildNavigationLinks";
import { useCookiePreferences } from "../cookies/CookiePreferencesContext";
import AppearanceMenu from "./AppearanceMenu";
import { SideNavContent } from "./AppSideNav";
import { drawerWidth } from "./appSideNavConstants";

const headerHeight = 64;

interface MobileNavigationDrawerProps {
  open: boolean;
  onClose: () => void;
  sections: NavigationLink[];
  adminLinks: NavigationLink[];
  pathname: string;
  selectedAdminSectionId?: string | null;
  selectedAdminUserGroupId?: string | null;
}

export default function MobileNavigationDrawer({
  open,
  onClose,
  sections,
  adminLinks,
  pathname,
  selectedAdminSectionId,
  selectedAdminUserGroupId,
}: MobileNavigationDrawerProps) {
  const { openSettings } = useCookiePreferences();

  const handleCookieSettings = () => {
    onClose();
    openSettings();
  };

  return (
    <Drawer
      variant="temporary"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        display: { xs: "block", md: "none" },
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          top: `${headerHeight}px`,
          height: `calc(100% - ${headerHeight}px)`,
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Box
        component="nav"
        aria-label="Mobile navigation and settings"
        sx={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column" }}
      >
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <SideNavContent
            sections={sections}
            adminLinks={adminLinks}
            pathname={pathname}
            selectedAdminSectionId={selectedAdminSectionId}
            selectedAdminUserGroupId={selectedAdminUserGroupId}
            onItemNavigate={onClose}
          />
        </Box>
        <Box sx={{ display: { xs: "block", sm: "none" } }}>
          <Divider />
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ display: "block", px: 2, pt: 1 }}
          >
            Settings
          </Typography>
          <List disablePadding sx={{ pb: 1 }}>
            <AppearanceMenu surface="drawer" onPreferenceChange={onClose} />
            <ListItemButton onClick={handleCookieSettings}>
              <ListItemIcon>
                <CookieOutlined fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Cookie settings" />
            </ListItemButton>
          </List>
        </Box>
      </Box>
    </Drawer>
  );
}
