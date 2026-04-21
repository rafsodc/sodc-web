import { Box, Divider, Drawer, List, ListItemButton, ListItemText, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { ROUTES } from "../../constants";

const drawerWidth = 280;
const headerHeight = 64;

type NavLink = {
  label: string;
  to: string;
};

interface AppSideNavProps {
  sections: NavLink[];
  quickActions: NavLink[];
  adminLinks: NavLink[];
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
}: {
  title: string;
  links: NavLink[];
  pathname: string;
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
            key={`${title}-${link.to}`}
            component={RouterLink}
            to={link.to}
            selected={isActive(pathname, link.to)}
            sx={{ borderRadius: 1, my: 0.5 }}
          >
            <ListItemText primary={link.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}

export default function AppSideNav({ sections, quickActions, adminLinks, pathname }: AppSideNavProps) {
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          borderRight: "1px solid rgba(0,0,0,0.08)",
          top: `${headerHeight}px`,
          height: `calc(100% - ${headerHeight}px)`,
        },
        display: { xs: "none", md: "block" },
      }}
    >
      <Box sx={{ overflow: "auto", py: 1 }}>
        <NavList title="Sections" links={sections} pathname={pathname} />
        <Divider />
        <NavList title="Quick Actions" links={quickActions} pathname={pathname} />
        {adminLinks.length > 0 && (
          <>
            <Divider />
            <NavList title="Admin" links={adminLinks} pathname={pathname} />
          </>
        )}
      </Box>
    </Drawer>
  );
}

export { drawerWidth };
