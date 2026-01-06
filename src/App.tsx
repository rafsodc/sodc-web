import { useEffect, useState, useCallback, useRef } from "react";
import { Box, Button, CssBaseline, Typography, Snackbar, Alert } from "@mui/material";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, dataConnect } from "./config/firebase";
import { reload } from "firebase/auth";
import { queryRef, executeQuery } from "firebase/data-connect";
import { useUserData } from "./features/users/hooks/useUserData";
import type { UserData } from "./types";
import { useEnabledClaim } from "./features/users/hooks/useEnabledClaim";
import AuthGate from "./features/auth/components/AuthGate";
import Header from "./shared/components/Header";
import HomePage from "./shared/components/HomePage";
import Profile from "./features/profile/components/Profile";
import Permissions from "./features/admin/components/Permissions";
import ManageUsers from "./features/admin/components/ManageUsers";
import ApproveUsers from "./features/admin/components/ApproveUsers";
import AccountStatusMessage from "./features/users/components/AccountStatusMessage";
import ProfileCompletion from "./features/auth/components/ProfileCompletion";
import EmailVerificationMessage from "./features/auth/components/EmailVerificationMessage";
import { colors } from "./config/colors";
import { ROUTES } from "./constants";

import type { Route } from "./constants/routes";

export default function App() {
  const [view, setView] = useState<Route>("home");
  const [user, setUser] = useState<User | null>(null);
  const [emailCheckTrigger, setEmailCheckTrigger] = useState(0);
  const [logoutSuccess, setLogoutSuccess] = useState(false);
  const { userData, refetch } = useUserData(user);
  const isEnabled = useEnabledClaim(user);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const wasLoggedIn = user !== null;
      const isNowLoggedOut = u === null;
      
      setUser(u);
      
      // If user logged out, clear state and redirect to login
      if (wasLoggedIn && isNowLoggedOut) {
        setView(ROUTES.ACCOUNT);
        setEmailCheckTrigger(0);
        setLogoutSuccess(true);
      }
    });
    return () => unsub();
  }, [user]);

  // Re-check email verification when triggered
  useEffect(() => {
    if (user && emailCheckTrigger > 0) {
      reload(user).then(() => {
        // The onAuthStateChanged listener will update the user state
      }).catch(() => {
        // Silently fail
      });
    }
  }, [emailCheckTrigger, user]);

  const handleProfileUpdate = useCallback(() => {
    // Refetch user data after profile update
    if (refetch) {
      refetch();
    }
  }, [refetch]);

  // Check if email is verified
  const emailNotVerified = user && !user.emailVerified;

  // Check if user needs to complete profile
  // We need to check if profile exists even if user doesn't have enabled claim
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [membershipStatusForUnenabled, setMembershipStatusForUnenabled] = useState<string | null>(null);
  const checkingProfileRef = useRef(false);
  const hasCheckedRef = useRef<string | null>(null); // Track which user we've checked

  // Check if profile exists for users without enabled claim
  useEffect(() => {
    // If user has enabled claim, userData will be available, so no need to check
    if (isEnabled || !user || !user.emailVerified) {
      if (userData !== null) {
        setProfileExists(true);
      } else {
        setProfileExists(null);
      }
      hasCheckedRef.current = null; // Reset when conditions change
      setMembershipStatusForUnenabled(null);
      return;
    }

    // If userData exists, profile definitely exists
    if (userData !== null) {
      setProfileExists(true);
      setMembershipStatusForUnenabled(null); // Clear unenabled status since we have userData
      hasCheckedRef.current = user.uid;
      return;
    }

    // Only check if we haven't checked for this user yet and aren't currently checking
    if (hasCheckedRef.current !== user.uid && !checkingProfileRef.current) {
      checkingProfileRef.current = true;
      const ref = queryRef(dataConnect, "CheckUserProfileExists", {});
      executeQuery(ref)
        .then((result) => {
          const profileData = (result.data as { user?: { membershipStatus?: string } | null })?.user;
          setProfileExists(profileData !== null && profileData !== undefined);
          // Store membership status for unenabled users so we can show appropriate message
          if (profileData?.membershipStatus) {
            setMembershipStatusForUnenabled(profileData.membershipStatus);
          } else {
            setMembershipStatusForUnenabled(null);
          }
          hasCheckedRef.current = user.uid; // Mark as checked for this user
        })
        .catch(() => {
          // If query fails, assume profile doesn't exist
          setProfileExists(false);
          setMembershipStatusForUnenabled(null);
          hasCheckedRef.current = user.uid; // Mark as checked even on error
        })
        .finally(() => {
          checkingProfileRef.current = false;
        });
    }
  }, [user, userData, isEnabled]);

  // Check if user needs to complete profile (email verified but no profile data)
  // Only show profile completion if we've confirmed the profile doesn't exist
  // Wait for profile check to complete (profileExists !== null) before deciding
  const needsProfileCompletion = user && user.emailVerified && !isEnabled && 
    profileExists === false && !checkingProfileRef.current;

  // If email is not verified, show email verification message
  if (emailNotVerified) {
    return (
      <Box sx={{ minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", backgroundColor: colors.background }}>
        <CssBaseline />
        <Header 
          user={user} 
          userData={userData} 
          onAccountClick={() => setView(ROUTES.ACCOUNT)}
          onProfileClick={() => setView(ROUTES.PROFILE)}
          onPermissionsClick={() => setView(ROUTES.PERMISSIONS)}
          onManageUsersClick={() => setView(ROUTES.MANAGE_USERS)}
        />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: "100%",
            pt: 12,
            pb: 4,
          }}
        >
          <Box 
            sx={{ 
              maxWidth: { sm: "600px" },
              mx: "auto",
              px: { xs: 3, sm: 4 },
            }}
          >
            <EmailVerificationMessage
              user={user}
              onVerified={async () => {
                // Trigger a re-check of email verification status
                setEmailCheckTrigger(prev => prev + 1);
              }}
              onBack={() => setView(ROUTES.HOME)}
            />
          </Box>
        </Box>
      </Box>
    );
  }

  // If user needs to complete profile, show profile completion
  if (needsProfileCompletion) {
    return (
      <Box sx={{ minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", backgroundColor: colors.background }}>
        <CssBaseline />
        <Header 
          user={user} 
          userData={userData} 
          onAccountClick={() => setView(ROUTES.ACCOUNT)}
          onProfileClick={() => setView(ROUTES.PROFILE)}
          onPermissionsClick={() => setView(ROUTES.PERMISSIONS)}
          onManageUsersClick={() => setView(ROUTES.MANAGE_USERS)}
        />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: "100%",
            pt: 12,
            pb: 4,
          }}
        >
          <Box 
            sx={{ 
              maxWidth: { sm: "600px" },
              mx: "auto",
              px: { xs: 3, sm: 4 },
            }}
          >
            <ProfileCompletion
              userEmail={user?.email || ""}
              onComplete={() => {
                // Refetch user data after profile completion
                if (refetch) {
                  refetch();
                }
              }}
              onBack={() => setView(ROUTES.HOME)}
            />
          </Box>
        </Box>
      </Box>
    );
  }

  // If user is authenticated but not enabled, show account status message
  // (Only reached if email is verified and profile is complete)
  if (user && !isEnabled) {
    return (
      <Box sx={{ minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", backgroundColor: colors.background }}>
        <CssBaseline />
        <Header 
          user={user} 
          userData={userData} 
          onAccountClick={() => setView(ROUTES.ACCOUNT)}
          onProfileClick={() => setView(ROUTES.PROFILE)}
          onPermissionsClick={() => setView(ROUTES.PERMISSIONS)}
          onManageUsersClick={() => setView(ROUTES.MANAGE_USERS)}
        />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: "100%",
            pt: 12,
            pb: 4,
          }}
        >
          <AccountStatusMessage 
          userData={userData || (membershipStatusForUnenabled ? {
            id: user.uid,
            firstName: "",
            lastName: "",
            email: user.email || "",
            serviceNumber: "",
            membershipStatus: membershipStatusForUnenabled as UserData["membershipStatus"],
            createdAt: "",
            updatedAt: "",
          } : null)} 
        />
        </Box>
      </Box>
    );
  }

  const handleCloseLogoutSnackbar = () => {
    setLogoutSuccess(false);
  };

  return (
    <Box sx={{ minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", backgroundColor: colors.background }}>
      <CssBaseline />
      <Snackbar
        open={logoutSuccess}
        autoHideDuration={6000}
        onClose={handleCloseLogoutSnackbar}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ mt: 10 }}
      >
        <Alert onClose={handleCloseLogoutSnackbar} severity="success" sx={{ width: "100%" }}>
          You have been successfully logged out.
        </Alert>
      </Snackbar>
      <Header 
        user={user} 
        userData={userData} 
        onAccountClick={() => setView("account")}
        onProfileClick={() => setView("profile")}
        onPermissionsClick={() => setView("permissions")}
        onManageUsersClick={() => setView("manageUsers")}
        onApproveUsersClick={() => setView(ROUTES.APPROVE_USERS)}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: "100%",
          pt: 12, // Padding top to account for fixed header
          pb: 4,
        }}
      >
        {view === "account" ? (
          <Box 
            sx={{ 
              maxWidth: { sm: "600px" },
              mx: "auto",
              px: { xs: 3, sm: 4 },
            }}
          >
            <AuthGate 
              userData={userData}
              onBack={() => setView(ROUTES.HOME)}
              onRegisterComplete={() => {
                // After registration, user will be signed in and need to verify email
                // The flow will handle this automatically
              }}
              onProfileComplete={() => {
                // After email verification, check if profile needs completion
                // This is handled by the needsProfileCompletion check above
              }}
            />
          </Box>
        ) : view === ROUTES.PROFILE ? (
          <Box 
            sx={{ 
              maxWidth: { sm: "600px" },
              mx: "auto",
              px: { xs: 3, sm: 4 },
            }}
          >
            {user && (
              <Profile 
                key={user.uid}
                userData={userData} 
                userEmail={user?.email || ""}
                onBack={() => setView(ROUTES.HOME)}
                onUpdate={handleProfileUpdate}
              />
            )}
          </Box>
        ) : view === ROUTES.PERMISSIONS ? (
          user ? (
            <Permissions onBack={() => setView("home")} />
          ) : (
            <Box 
              sx={{ 
                maxWidth: { sm: "600px" },
                mx: "auto",
                px: { xs: 3, sm: 4 },
              }}
            >
              <Typography variant="h4" sx={{ color: colors.titlePrimary, mb: 3 }}>
                Permissions
              </Typography>
              <Typography>Please log in to access permissions.</Typography>
              <Button variant="outlined" onClick={() => setView("home")} sx={{ mt: 2 }}>
                Back
              </Button>
            </Box>
          )
        ) : view === ROUTES.MANAGE_USERS ? (
          user ? (
            <ManageUsers onBack={() => setView("home")} />
          ) : (
            <Box 
              sx={{ 
                maxWidth: { sm: "600px" },
                mx: "auto",
                px: { xs: 3, sm: 4 },
              }}
            >
              <Typography variant="h4" sx={{ color: colors.titlePrimary, mb: 3 }}>
                Manage Users
              </Typography>
              <Typography>Please log in to access user management.</Typography>
              <Button variant="outlined" onClick={() => setView("home")} sx={{ mt: 2 }}>
                Back
              </Button>
            </Box>
          )
        ) : view === ROUTES.APPROVE_USERS ? (
          user ? (
            <ApproveUsers onBack={() => setView("home")} />
          ) : (
            <Box 
              sx={{ 
                maxWidth: { sm: "600px" },
                mx: "auto",
                px: { xs: 3, sm: 4 },
              }}
            >
              <Typography variant="h4" sx={{ color: colors.titlePrimary, mb: 3 }}>
                Approve Users
              </Typography>
              <Typography>Please log in to access user approval.</Typography>
              <Button variant="outlined" onClick={() => setView("home")} sx={{ mt: 2 }}>
                Back
              </Button>
            </Box>
          )
        ) : (
          <Box
            sx={{
              pl: { xs: 6, sm: 10, md: 15 },
              pr: { xs: 3, sm: 4 },
            }}
          >
            <HomePage />
          </Box>
        )}
      </Box>
    </Box>
  );
}