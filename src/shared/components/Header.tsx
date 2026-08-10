import { useState } from "react";
import { AppBar, Avatar, Box, Button, ButtonBase, IconButton, Menu, MenuItem, Toolbar, Typography } from "@mui/material";
import { ExpandMore, Menu as MenuIcon, Person } from "@mui/icons-material";
import { signOut, type User } from "firebase/auth";
import { auth } from "../../config/firebase";
import type { UserData } from "../../types";
import { useEnabledClaim } from "../../features/users/hooks/useEnabledClaim";
import { BRAND_PRIMARY, BRAND_SECONDARY } from "../../config/theme";

interface HeaderProps {
  user: User | null;
  userData: UserData | null;
  onAccountClick: () => void;
  onJoinClick?: () => void;
  onProfileClick?: () => void;
  onAccountSettingsClick?: () => void;
  onMyBookingsClick?: () => void;
  onMyPaymentsClick?: () => void;
  onLogoClick: () => void;
  /** Opens the responsive navigation and settings menu from this anchor. */
  onNavMenuOpen?: (anchorEl: HTMLElement) => void;
}

function getFullName(userData: UserData | null): string {
  if (!userData) return "";
  return `${userData.firstName ?? ""} ${userData.lastName ?? ""}`.trim();
}

function accountDisplayName(userData: UserData | null, firebaseUser: User | null): string {
  const name = getFullName(userData);
  if (name) return name;
  return firebaseUser?.displayName?.trim() || firebaseUser?.email || "Account";
}

export default function Header({
  user,
  userData,
  onAccountClick,
  onJoinClick,
  onProfileClick,
  onAccountSettingsClick,
  onMyBookingsClick,
  onMyPaymentsClick,
  onLogoClick,
  onNavMenuOpen,
}: HeaderProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const { isEnabled } = useEnabledClaim(user);

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

  const handleAccountSettings = () => {
    handleMenuClose();
    if (onAccountSettingsClick) {
      onAccountSettingsClick();
    } else {
      onAccountClick();
    }
  };

  const handleMyBookings = () => {
    handleMenuClose();
    onMyBookingsClick?.();
  };

  const handleMyPayments = () => {
    handleMenuClose();
    if (onMyPaymentsClick) {
      onMyPaymentsClick();
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
        backgroundColor: BRAND_PRIMARY,
        top: 0,
        left: 0,
        right: 0,
        "& .MuiButtonBase-root.Mui-focusVisible": {
          outline: "3px solid",
          outlineColor: "common.white",
          outlineOffset: 2,
        },
      }}
    >
      <Toolbar>
        {onNavMenuOpen ? (
          <IconButton
            color="inherit"
            edge="start"
            aria-label="Open navigation menu"
            onClick={(event) => onNavMenuOpen(event.currentTarget)}
            sx={{
              mr: 1,
              display: user && isEnabled
                ? { xs: "inline-flex", md: "none" }
                : { xs: "inline-flex", sm: "none" },
            }}
          >
            <MenuIcon />
          </IconButton>
        ) : null}
        <ButtonBase
          onClick={onLogoClick}
          aria-label="Go to home"
          sx={{
            borderRadius: 1,
            px: 0.5,
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "common.white",
              outlineOffset: 2,
            },
          }}
        >
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            SODC
          </Typography>
        </ButtonBase>
        <Box sx={{ flexGrow: 1 }} />
        {user ? (
          <>
            <Button
              id="account-menu-button"
              onClick={handleAvatarClick}
              aria-haspopup="true"
              aria-expanded={open ? "true" : "false"}
              aria-controls={open ? "account-menu" : undefined}
              aria-label="Account menu"
              color="inherit"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                minWidth: 0,
                maxWidth: { xs: 260, sm: 360 },
                py: 0.5,
                px: 0.75,
                textTransform: "none",
                color: "inherit",
                borderRadius: "9999px",
                backgroundColor: "rgba(255, 255, 255, 0.12)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.28)",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.18)",
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                  borderColor: "rgba(255, 255, 255, 0.38)",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.22)",
                },
              }}
            >
              <Avatar
                sx={{
                  flexShrink: 0,
                  backgroundColor: BRAND_SECONDARY,
                  color: "white",
                  width: 40,
                  height: 40,
                }}
              >
                <Person sx={{ fontSize: 22 }} />
              </Avatar>
              <Typography
                component="span"
                variant="body2"
                noWrap
                title={accountDisplayName(userData, user)}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontWeight: 600,
                  textAlign: "left",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: { xs: 140, sm: 240 },
                }}
              >
                {accountDisplayName(userData, user)}
              </Typography>
              <ExpandMore
                sx={{
                  flexShrink: 0,
                  fontSize: 28,
                  opacity: 0.95,
                  transition: (theme) =>
                    theme.transitions.create("transform", { duration: theme.transitions.duration.shortest }),
                  transform: open ? "rotate(180deg)" : "none",
                }}
              />
            </Button>
            <Menu
              id="account-menu"
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
              MenuListProps={{
                "aria-labelledby": "account-menu-button",
              }}
            >
              {isEnabled && (
                <MenuItem onClick={handleProfile}>
                  Profile
                </MenuItem>
              )}
              {isEnabled && (
                <MenuItem onClick={handleAccountSettings}>
                  Account
                </MenuItem>
              )}
              {isEnabled && (
                <MenuItem onClick={handleMyBookings}>
                  My Bookings
                </MenuItem>
              )}
              {isEnabled && (
                <MenuItem onClick={handleMyPayments}>
                  My Payments
                </MenuItem>
              )}
              <MenuItem onClick={handleLogOut}>
                Sign out
              </MenuItem>
            </Menu>
          </>
        ) : (
          <Box sx={{ display: "flex", gap: { xs: 0.5, sm: 1 } }}>
            <Button
              onClick={onAccountClick}
              sx={{
                textTransform: "none",
                backgroundColor: "white",
                color: BRAND_PRIMARY,
                borderRadius: "9999px",
                px: { xs: 2, sm: 3 },
                whiteSpace: "nowrap",
                "&:hover": {
                  backgroundColor: "white",
                  opacity: 0.9,
                },
              }}
            >
              Sign in
            </Button>
            <Button
              onClick={onJoinClick || onAccountClick}
              sx={{
                textTransform: "none",
                backgroundColor: BRAND_SECONDARY,
                color: "white",
                borderRadius: "9999px",
                px: { xs: 2, sm: 3 },
                whiteSpace: "nowrap",
                "&:hover": {
                  backgroundColor: BRAND_SECONDARY,
                  opacity: 0.9,
                },
                border: "1px solid rgba(255, 255, 255, 0.72)",
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
