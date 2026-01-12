import { useState } from "react";
import { AppBar, Avatar, Box, Button, Menu, MenuItem, Toolbar, Typography } from "@mui/material";
import { Person } from "@mui/icons-material";
import { signOut, type User } from "firebase/auth";
import { auth } from "../../config/firebase";
import { colors } from "../../config/colors";
import type { UserData } from "../../types";
import { useAdminClaim } from "../../features/users/hooks/useAdminClaim";
import { useEnabledClaim } from "../../features/users/hooks/useEnabledClaim";

interface HeaderProps {
  user: User | null;
  userData: UserData | null;
  onAccountClick: () => void;
  onJoinClick?: () => void;
  onProfileClick?: () => void;
  onSecurityClick?: () => void;
  onPermissionsClick?: () => void;
  onManageUsersClick?: () => void;
  onApproveUsersClick?: () => void;
  onAccessGroupsClick?: () => void;
  onAuditLogsClick?: () => void;
  onSectionsClick?: () => void;
}

function getInitials(userData: UserData | null): string {
  if (!userData) return "";
  const first = userData.firstName?.charAt(0).toUpperCase() || "";
  const last = userData.lastName?.charAt(0).toUpperCase() || "";
  return `${first}${last}` || "";
}

export default function Header({ user, userData, onAccountClick, onJoinClick, onProfileClick, onSecurityClick, onPermissionsClick, onManageUsersClick, onApproveUsersClick, onAccessGroupsClick, onAuditLogsClick, onSectionsClick }: HeaderProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [adminAnchorEl, setAdminAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const adminMenuOpen = Boolean(adminAnchorEl);
  const isAdmin = useAdminClaim(user);
  const isEnabled = useEnabledClaim(user);

  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfile = () => {
    handleMenuClose();
    if (onProfileClick) {
      onProfileClick();
    } else {
      onAccountClick();
    }
  };

  const handleSecurity = () => {
    handleMenuClose();
    if (onSecurityClick) {
      onSecurityClick();
    } else {
      onAccountClick();
    }
  };

  const handleLogOut = async () => {
    handleMenuClose();
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleAdminClick = (event: React.MouseEvent<HTMLElement>) => {
    setAdminAnchorEl(event.currentTarget);
  };

  const handleAdminMenuClose = () => {
    setAdminAnchorEl(null);
  };

  const handlePermissions = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleAdminMenuClose();
    if (onPermissionsClick) {
      onPermissionsClick();
    }
  };

  const handleManageUsers = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleAdminMenuClose();
    if (onManageUsersClick) {
      onManageUsersClick();
    }
  };

  const handleApproveUsers = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleAdminMenuClose();
    if (onApproveUsersClick) {
      onApproveUsersClick();
    }
  };

  const handleAccessGroups = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleAdminMenuClose();
    if (onAccessGroupsClick) {
      onAccessGroupsClick();
    }
  };

  const handleAuditLogs = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleAdminMenuClose();
    if (onAuditLogsClick) {
      onAuditLogsClick();
    }
  };

  return (
    <AppBar 
      position="fixed" 
      sx={{ 
        backgroundColor: colors.primary,
        top: 0,
        left: 0,
        right: 0,
      }}
    >
      <Toolbar>
        <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
          SODC
        </Typography>
        {user && isEnabled && (
          <Box sx={{ flexGrow: 1, display: "flex", justifyContent: "center", gap: 2 }}>
            {onSectionsClick && (
              <Button
                onClick={onSectionsClick}
                sx={{
                  textTransform: "none",
                  backgroundColor: "white",
                  color: colors.primary,
                  borderRadius: "9999px",
                  px: 3,
                  fontWeight: 600,
                  "&:hover": {
                    backgroundColor: "white",
                    opacity: 0.9,
                  },
                  "&:focus": {
                    outline: "none",
                  },
                  "&:focus-visible": {
                    outline: "none",
                  },
                }}
              >
                Sections
              </Button>
            )}
            {isAdmin && (
              <Button
                onClick={handleAdminClick}
                sx={{
                  textTransform: "none",
                  backgroundColor: "white",
                  color: colors.primary,
                  borderRadius: "9999px",
                  px: 3,
                  fontWeight: 600,
                  "&:hover": {
                    backgroundColor: "white",
                    opacity: 0.9,
                  },
                  "&:focus": {
                    outline: "none",
                  },
                  "&:focus-visible": {
                    outline: "none",
                  },
                }}
              >
                Admin
              </Button>
            )}
            {isAdmin && (
              <Menu
                anchorEl={adminAnchorEl}
                open={adminMenuOpen}
                onClose={handleAdminMenuClose}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "center",
                }}
                transformOrigin={{
                  vertical: "top",
                  horizontal: "center",
                }}
              >
                <MenuItem 
                  onClick={handlePermissions}
                  sx={{
                    "&:focus": {
                      outline: "none",
                    },
                    "&:focus-visible": {
                      outline: "none",
                    },
                  }}
                >
                  Permissions
                </MenuItem>
                <MenuItem 
                  onClick={handleManageUsers}
                  sx={{
                    "&:focus": {
                      outline: "none",
                    },
                    "&:focus-visible": {
                      outline: "none",
                    },
                  }}
                >
                  Manage Users
                </MenuItem>
                <MenuItem 
                  onClick={handleApproveUsers}
                  sx={{
                    "&:focus": {
                      outline: "none",
                    },
                    "&:focus-visible": {
                      outline: "none",
                    },
                  }}
                >
                  Approve Users
                </MenuItem>
                <MenuItem 
                  onClick={handleAccessGroups}
                  sx={{
                    "&:focus": {
                      outline: "none",
                    },
                    "&:focus-visible": {
                      outline: "none",
                    },
                  }}
                >
                  Access Groups
                </MenuItem>
                <MenuItem 
                  onClick={handleAuditLogs}
                  sx={{
                    "&:focus": {
                      outline: "none",
                    },
                    "&:focus-visible": {
                      outline: "none",
                    },
                  }}
                >
                  Audit Logs
                </MenuItem>
              </Menu>
            )}
          </Box>
        )}
        {!user || !isEnabled ? (
          <Box sx={{ flexGrow: user && isEnabled ? 0 : 1 }} />
        ) : null}
        {user ? (
          <>
            {userData ? (
              <Avatar
                onClick={handleAvatarClick}
                sx={{
                  backgroundColor: colors.callToAction,
                  color: "white",
                  cursor: "pointer",
                  width: 40,
                  height: 40,
                  fontSize: "1rem",
                  fontWeight: 600,
                }}
              >
                {getInitials(userData)}
              </Avatar>
            ) : (
              <Avatar
                onClick={handleAvatarClick}
                sx={{
                  backgroundColor: colors.callToAction,
                  color: "white",
                  cursor: "pointer",
                  width: 40,
                  height: 40,
                }}
              >
                <Person />
              </Avatar>
            )}
            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleMenuClose}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
            >
              {isEnabled && (
                <>
                  <MenuItem 
                    onClick={handleProfile}
                    sx={{
                      "&:focus": {
                        outline: "none",
                      },
                      "&:focus-visible": {
                        outline: "none",
                      },
                    }}
                  >
                    Profile
                  </MenuItem>
                  <MenuItem 
                    onClick={handleSecurity}
                    sx={{
                      "&:focus": {
                        outline: "none",
                      },
                      "&:focus-visible": {
                        outline: "none",
                      },
                    }}
                  >
                    Security
                  </MenuItem>
                </>
              )}
              <MenuItem 
                onClick={handleLogOut}
                sx={{
                  "&:focus": {
                    outline: "none",
                  },
                  "&:focus-visible": {
                    outline: "none",
                  },
                }}
              >
                Log Out
              </MenuItem>
            </Menu>
          </>
        ) : (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button 
              onClick={onAccountClick}
              sx={{ 
                textTransform: "none",
                backgroundColor: "white",
                color: colors.primary,
                borderRadius: "9999px",
                px: 3,
                "&:hover": {
                  backgroundColor: "white",
                  opacity: 0.9,
                },
                "&:focus": {
                  outline: "none",
                },
                "&:focus-visible": {
                  outline: "none",
                },
              }}
            >
              Log In
            </Button>
            <Button 
              onClick={onJoinClick || onAccountClick}
              sx={{ 
                textTransform: "none",
                backgroundColor: colors.callToAction,
                color: "white",
                borderRadius: "9999px",
                px: 3,
                "&:hover": {
                  backgroundColor: colors.callToAction,
                  opacity: 0.9,
                },
                "&:focus": {
                  outline: "none",
                },
                "&:focus-visible": {
                  outline: "none",
                },
              }}
            >
              Join
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}

