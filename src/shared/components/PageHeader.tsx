import type { ReactNode } from "react";
import { AdminPanelSettings } from "@mui/icons-material";
import { Box, Button, Typography } from "@mui/material";
import "./PageHeader.css";

export interface PageHeaderAdminAction {
  visible: boolean;
  onClick: () => void;
}

interface PageHeaderProps {
  title: string;
  // Accepted for compatibility with existing callers but no longer rendered -- the Back
  // button was removed as unnecessary navigation chrome.
  onBack?: () => void;
  adminAction?: PageHeaderAdminAction;
  breadcrumbs?: ReactNode;
  // Extra page-specific controls rendered alongside the Admin button, e.g. the section
  // detail page's announcement-emails toggle.
  extraActions?: ReactNode;
}

export default function PageHeader({ title, adminAction, breadcrumbs, extraActions }: PageHeaderProps) {
  const hasActions = adminAction?.visible || extraActions;
  return (
    <Box sx={{ mb: 3 }}>
      {breadcrumbs}
      <Box className="page-header" sx={{ mb: 0 }}>
        <Typography variant="h4" sx={{ color: "primary.light" }}>
          {title}
        </Typography>
        {hasActions && (
          <Box className="page-header-actions">
            {extraActions}
            {adminAction?.visible && (
              <Button variant="contained" startIcon={<AdminPanelSettings />} onClick={adminAction.onClick}>
                Admin
              </Button>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
