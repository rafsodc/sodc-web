import { Box, Divider, Drawer, List, ListItemButton, ListItemText, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { ROUTES } from "../../constants";
import type { NavigationLink } from "../navigation/buildNavigationLinks";
import { drawerWidth } from "./appSideNavConstants";

const headerHeight = 64;

interface AppSideNavProps {
  sections: NavigationLink[];
  adminLinks: NavigationLink[];
  pathname: string;
  selectedAdminSectionId?: string | null;
  selectedAdminUserGroupId?: string | null;
  /** Controlled open state for the temporary (mobile) drawer. */
  mobileOpen: boolean;
  onMobileClose: () => void;
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
  selectedAdminSectionId,
  selectedAdminUserGroupId,
  onItemNavigate,
}: {
  title: string;
  links: NavigationLink[];
  pathname: string;
  selectedAdminSectionId?: string | null;
  selectedAdminUserGroupId?: string | null;
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
        {links.map((link) => {
          const selectedChild = getSelectedChild({
            link,
            pathname,
            selectedAdminSectionId,
            selectedAdminUserGroupId,
          });
          return (
            <Box key={`${title}-${link.to}-${link.label}`}>
              <ListItemButton
                component={RouterLink}
                to={link.to}
                state={link.state}
                selected={isActive(pathname, link.to) && !selectedChild}
                onClick={onItemNavigate}
                sx={{ borderRadius: 1, my: 0.5 }}
              >
                <ListItemText primary={link.label} />
              </ListItemButton>
              {link.children?.map((child) => (
                <ListItemButton
                  key={`${link.to}-${child.to}-${child.label}`}
                  component={RouterLink}
                  to={child.to}
                  state={child.state}
                  selected={selectedChild === child}
                  onClick={onItemNavigate}
                  sx={{ borderRadius: 1, my: 0.5, ml: 2, py: 0.5 }}
                >
                  <ListItemText
                    primary={child.label}
                    primaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
                  />
                </ListItemButton>
              ))}
            </Box>
          );
        })}
      </List>
    </Box>
  );
}

function getSelectedChild({
  link,
  pathname,
  selectedAdminSectionId,
  selectedAdminUserGroupId,
}: {
  link: NavigationLink;
  pathname: string;
  selectedAdminSectionId?: string | null;
  selectedAdminUserGroupId?: string | null;
}): NavigationLink | null {
  if (!link.children?.length) {
    return null;
  }

  return (
    link.children.find((child) => {
      if (pathname !== child.to) {
        return false;
      }
      const childState = child.state as
        | { managedSection?: { id?: string }; expandedGroupId?: string }
        | null
        | undefined;
      if (child.to === ROUTES.MANAGE_SECTIONS) {
        return childState?.managedSection?.id === selectedAdminSectionId;
      }
      if (child.to === ROUTES.USER_GROUPS) {
        return childState?.expandedGroupId === selectedAdminUserGroupId;
      }
      return false;
    }) ?? null
  );
}

function SideNavContent({
  sections,
  adminLinks,
  pathname,
  selectedAdminSectionId,
  selectedAdminUserGroupId,
  onItemNavigate,
}: {
  sections: NavigationLink[];
  adminLinks: NavigationLink[];
  pathname: string;
  selectedAdminSectionId?: string | null;
  selectedAdminUserGroupId?: string | null;
  onItemNavigate?: () => void;
}) {
  return (
    <Box sx={{ overflow: "auto", py: 1 }}>
      <NavList
        title="Sections"
        links={sections}
        pathname={pathname}
        selectedAdminSectionId={selectedAdminSectionId}
        onItemNavigate={onItemNavigate}
      />
      {adminLinks.length > 0 && (
        <>
          <Divider />
          <NavList
            title="Admin"
            links={adminLinks}
            pathname={pathname}
            selectedAdminSectionId={selectedAdminSectionId}
            selectedAdminUserGroupId={selectedAdminUserGroupId}
            onItemNavigate={onItemNavigate}
          />
        </>
      )}
    </Box>
  );
}

export default function AppSideNav({
  sections,
  adminLinks,
  pathname,
  selectedAdminSectionId,
  selectedAdminUserGroupId,
  mobileOpen,
  onMobileClose,
}: AppSideNavProps) {
  const closeOnNavigate = () => {
    onMobileClose();
  };

  return (
    <>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            top: `${headerHeight}px`,
            height: `calc(100% - ${headerHeight}px)`,
          },
        }}
      >
        <SideNavContent
          sections={sections}
          adminLinks={adminLinks}
          pathname={pathname}
          selectedAdminSectionId={selectedAdminSectionId}
          selectedAdminUserGroupId={selectedAdminUserGroupId}
          onItemNavigate={closeOnNavigate}
        />
      </Drawer>

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
        <SideNavContent
          sections={sections}
          adminLinks={adminLinks}
          pathname={pathname}
          selectedAdminSectionId={selectedAdminSectionId}
          selectedAdminUserGroupId={selectedAdminUserGroupId}
        />
      </Drawer>
    </>
  );
}
