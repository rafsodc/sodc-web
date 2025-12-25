import { useState } from "react";
import { AppBar, Avatar, Box, Button, Menu, MenuItem, Toolbar, Typography } from "@mui/material";
import { Person } from "@mui/icons-material";
import { signOut, type User } from "firebase/auth";
import { auth } from "../config/firebase";
import { colors } from "../config/colors";
import type { UserData } from "../hooks/useUserData";

interface HeaderProps {
  user: User | null;
  userData: UserData | null;
  onAccountClick: () => void;
  onJoinClick?: () => void;
  onProfileClick?: () => void;
  onSecurityClick?: () => void;
}

function getInitials(userData: UserData | null): string {
  if (!userData) return "";
  const first = userData.firstName?.charAt(0).toUpperCase() || "";
  const last = userData.lastName?.charAt(0).toUpperCase() || "";
  return `${first}${last}` || "";
}

export default function Header({ user, userData, onAccountClick, onJoinClick, onProfileClick, onSecurityClick }: HeaderProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

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
        <Typography variant="h5" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
          SODC
        </Typography>
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
              <MenuItem onClick={handleProfile}>Profile</MenuItem>
              <MenuItem onClick={handleSecurity}>Security</MenuItem>
              <MenuItem onClick={handleLogOut}>Log Out</MenuItem>
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

