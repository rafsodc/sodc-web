import { createContext, useContext, type ReactNode } from "react";
import { AdminPanelSettings } from "@mui/icons-material";
import { Box, Button, Typography } from "@mui/material";
import "./PageHeader.css";

export interface PageHeaderAdminAction {
  visible: boolean;
  onClick: () => void;
}

const PageHeaderAdminActionContext = createContext<PageHeaderAdminAction>({
  visible: false,
  onClick: () => {},
});

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  adminAction?: PageHeaderAdminAction;
}

interface PageHeaderAdminActionProviderProps {
  value: PageHeaderAdminAction;
  children: ReactNode;
}

export function PageHeaderAdminActionProvider({ value, children }: PageHeaderAdminActionProviderProps) {
  return (
    <PageHeaderAdminActionContext.Provider value={value}>
      {children}
    </PageHeaderAdminActionContext.Provider>
  );
}

export default function PageHeader({ title, onBack, adminAction: adminActionOverride }: PageHeaderProps) {
  const contextAdminAction = useContext(PageHeaderAdminActionContext);
  const adminAction = adminActionOverride ?? contextAdminAction;

  return (
    <Box className="page-header">
      <Typography variant="h4" className="page-header-title">
        {title}
      </Typography>
      <Box className="page-header-actions">
        {adminAction.visible && (
          <Button variant="contained" startIcon={<AdminPanelSettings />} onClick={adminAction.onClick}>
            Admin
          </Button>
        )}
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
      </Box>
    </Box>
  );
}

