import { Box, Drawer, Divider, List, ListItemButton, ListItemText, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { ROUTES } from "../../constants";
import type { NavigationLink } from "../navigation/buildNavigationLinks";
import { drawerWidth } from "./appSideNavConstants";

const headerHeight = 64;

interface AppSideNavProps {
  sections: NavigationLink[];
  adminLinks: NavigationLink[];
  pathname: string;
}

function isActive(pathname: string, to: string): boolean {
  if (to === ROUTES.HOME) {
    return pathname === ROUTES.HOME;
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavList({
  title,
  links,
  pathname,
  onItemNavigate,
}: {
  title: string;
  links: NavigationLink[];
  pathname: string;
  onItemNavigate?: () => void;
}) {
  if (links.length === 0) {
    return null;
  }

  return (
    <Box sx={{ px: 1, py: 1 }}>
      <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>
        {title}
      </Typography>
      <List disablePadding>
        {links.map((link) => (
          <ListItemButton
            key={`${title}-${link.to}-${link.label}`}
            component={RouterLink}
            to={link.to}
            state={link.state}
            selected={isActive(pathname, link.to)}
            onClick={onItemNavigate}
            sx={{ borderRadius: 1, my: 0.5 }}
          >
            <ListItemText primary={link.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}

export function SideNavContent({
  sections,
  adminLinks,
  pathname,
  onItemNavigate,
}: {
  sections: NavigationLink[];
  adminLinks: NavigationLink[];
  pathname: string;
  onItemNavigate?: () => void;
}) {
  return (
    <Box sx={{ overflow: "auto", py: 1 }}>
      <NavList title="Sections" links={sections} pathname={pathname} onItemNavigate={onItemNavigate} />
      {adminLinks.length > 0 && (
        <>
          <Divider />
          <NavList title="Admin" links={adminLinks} pathname={pathname} onItemNavigate={onItemNavigate} />
        </>
      )}
    </Box>
  );
}

export default function AppSideNav({ sections, adminLinks, pathname }: AppSideNavProps) {
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          borderRight: "1px solid",
          borderRightColor: "divider",
          top: `${headerHeight}px`,
          height: `calc(100% - ${headerHeight}px)`,
        },
        display: { xs: "none", md: "block" },
      }}
    >
      <SideNavContent sections={sections} adminLinks={adminLinks} pathname={pathname} />
    </Drawer>
  );
}
