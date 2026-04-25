import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense, type ReactElement } from "react";
import { Box, Button, CssBaseline, Typography, Snackbar, Alert, CircularProgress } from "@mui/material";
import { onAuthStateChanged, reload, type User } from "firebase/auth";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { queryRef, executeQuery } from "firebase/data-connect";
import { auth, dataConnect } from "./config/firebase";
import { useUserData } from "./features/users/hooks/useUserData";
import type { UserData } from "./types";
import { useEnabledClaim } from "./features/users/hooks/useEnabledClaim";
import { useAdminClaim } from "./features/users/hooks/useAdminClaim";
import { ErrorBoundary } from "./shared/components/ErrorBoundary";
import Header from "./shared/components/Header";
import HomePage from "./shared/components/HomePage";
import AppSideNav from "./shared/components/AppSideNav";
import { PageHeaderAdminActionProvider } from "./shared/components/PageHeader";
import { buildNavigationLinks } from "./shared/navigation/buildNavigationLinks";
import { colors } from "./config/colors";
import { ROUTES } from "./constants";
import CheckoutStatusNotice from "./features/sections/components/CheckoutStatusNotice";
import { useGetSectionsForUser } from "@dataconnect/generated/react";

// Lazy load route components for code splitting
const AuthGate = lazy(() => import("./features/auth/components/AuthGate"));
const Profile = lazy(() => import("./features/profile/components/Profile"));
const ManageUsers = lazy(() => import("./features/admin/components/ManageUsers"));
const ApproveUsers = lazy(() => import("./features/admin/components/ApproveUsers"));
const UserGroups = lazy(() => import("./features/admin/components/UserGroups"));
const AuditLogs = lazy(() => import("./features/admin/components/AuditLogs"));
const ManageSections = lazy(() => import("./features/admin/components/ManageSections"));
const SectionsList = lazy(() => import("./features/sections/components/SectionsList"));
const SectionDetail = lazy(() => import("./features/sections/components/SectionDetail"));
const AccountStatusMessage = lazy(() => import("./features/users/components/AccountStatusMessage"));
const ProfileCompletion = lazy(() => import("./features/auth/components/ProfileCompletion"));
const EmailVerificationMessage = lazy(() => import("./features/auth/components/EmailVerificationMessage"));

// Loading fallback component
const LoadingFallback = () => (
  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px" }}>
    <CircularProgress />
  </Box>
);

function SectionDetailRoute() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  if (!sectionId) {
    return <Navigate to={ROUTES.SECTIONS} replace />;
  }

  const handleBack = () => {
    if (window.history.state?.idx > 0 || location.key !== "default") {
      navigate(-1);
      return;
    }
    navigate(ROUTES.SECTIONS, { replace: true });
  };

  return <SectionDetail sectionId={sectionId} onBack={handleBack} />;
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [emailCheckTrigger, setEmailCheckTrigger] = useState(0);
  const [logoutSuccess, setLogoutSuccess] = useState(false);
  const [checkoutQueryState, setCheckoutQueryState] = useState<{
    checkout: "success" | "cancel";
    orderId: string | null;
  } | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { userData, refetch } = useUserData(user);
  const isEnabled = useEnabledClaim(user);
  const isAdmin = useAdminClaim(user);
  const { data: userSectionsData } = useGetSectionsForUser(dataConnect, { enabled: !!user && isEnabled });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkout = params.get("checkout");
    if (checkout !== "success" && checkout !== "cancel") {
      return;
    }
    setCheckoutQueryState({
      checkout,
      orderId: params.get("orderId"),
    });
  }, [location.search]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const wasLoggedIn = user !== null;
      const isNowLoggedOut = u === null;
      
      setUser(u);
      setAuthInitialized(true);
      
      if (wasLoggedIn && isNowLoggedOut) {
        navigate(ROUTES.ACCOUNT);
        setEmailCheckTrigger(0);
        setLogoutSuccess(true);
      }
    });
    return () => unsub();
  }, [navigate, user]);

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

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

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

  const navigationLinks = useMemo(
    () => buildNavigationLinks({ isEnabled, isAdmin, sectionsData: userSectionsData }),
    [isAdmin, isEnabled, userSectionsData]
  );

  const pageHeaderAdminAction = useMemo(
    () => ({
      visible: Boolean(user && isEnabled && isAdmin),
      onClick: () => navigate(ROUTES.MANAGE_USERS),
    }),
    [isAdmin, isEnabled, navigate, user]
  );
  const selectedAdminSectionId =
    location.pathname === ROUTES.MANAGE_SECTIONS
      ? ((location.state as { managedSection?: { id?: string } } | null)?.managedSection?.id ?? null)
      : null;
  const selectedAdminUserGroupId =
    location.pathname === ROUTES.USER_GROUPS
      ? ((location.state as { expandedGroupId?: string } | null)?.expandedGroupId ?? null)
      : null;

  const header = (
    <Header
      user={user}
      userData={userData}
      onAccountClick={() => navigate(ROUTES.ACCOUNT)}
      onProfileClick={() => navigate(ROUTES.PROFILE)}
      onNavMenuOpen={user && isEnabled ? () => setMobileNavOpen(true) : undefined}
    />
  );

  if (!isOnline) {
    return (
      <Box sx={{ minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", backgroundColor: colors.background }}>
        <CssBaseline />
        {header}
        <Box component="main" sx={{ flexGrow: 1, width: "100%", pt: 12, pb: 4 }}>
          <Box sx={{ maxWidth: { sm: "700px" }, mx: "auto", px: { xs: 3, sm: 4 } }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Unable to connect. Check your internet connection and try again.
            </Alert>
            <Typography variant="body2" color="text.secondary">
              The app needs network access to load account and section data.
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  if (emailNotVerified) {
    return (
      <Box sx={{ minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", backgroundColor: colors.background }}>
        <CssBaseline />
        {header}
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
            <Suspense fallback={<LoadingFallback />}>
              <EmailVerificationMessage
                user={user}
                onVerified={async () => setEmailCheckTrigger((prev) => prev + 1)}
                onBack={() => navigate(ROUTES.HOME)}
              />
            </Suspense>
          </Box>
        </Box>
      </Box>
    );
  }

  if (needsProfileCompletion) {
    return (
      <Box sx={{ minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", backgroundColor: colors.background }}>
        <CssBaseline />
        {header}
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
            <Suspense fallback={<LoadingFallback />}>
              <ProfileCompletion
                userEmail={user?.email || ""}
                onComplete={() => refetch?.()}
                onBack={() => navigate(ROUTES.HOME)}
              />
            </Suspense>
          </Box>
        </Box>
      </Box>
    );
  }

  if (user && !isEnabled) {
    return (
      <Box sx={{ minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", backgroundColor: colors.background }}>
        <CssBaseline />
        {header}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: "100%",
            pt: 12,
            pb: 4,
          }}
        >
          <Suspense fallback={<LoadingFallback />}>
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
          </Suspense>
        </Box>
      </Box>
    );
  }

  const handleCloseLogoutSnackbar = () => {
    setLogoutSuccess(false);
  };

  const handleDismissCheckoutStatus = () => {
    const params = new URLSearchParams(location.search);
    params.delete("checkout");
    params.delete("orderId");
    const search = params.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ""}${location.hash}`, { replace: true });
    setCheckoutQueryState(null);
  };

  const navigateBackOr = (fallbackRoute: string) => {
    if (window.history.state?.idx > 0 || location.key !== "default") {
      navigate(-1);
      return;
    }
    navigate(fallbackRoute, { replace: true });
  };

  const renderAdminOnly = (title: string, element: ReactElement) => {
    if (!authInitialized) {
      return <LoadingFallback />;
    }
    if (user && isAdmin) {
      return element;
    }
    return (
      <Box sx={{ maxWidth: { sm: "600px" }, mx: "auto", px: { xs: 3, sm: 4 } }}>
        <Typography variant="h4" sx={{ color: colors.titlePrimary, mb: 3 }}>
          {title}
        </Typography>
        {!user ? (
          <Typography>Please log in to access this area.</Typography>
        ) : (
          <Alert severity="error" sx={{ mb: 2 }}>
            Access denied. Admin privileges required.
          </Alert>
        )}
        <Button variant="outlined" onClick={() => navigate(ROUTES.HOME)} sx={{ mt: 2 }}>
          Back
        </Button>
      </Box>
    );
  };

  const protectedRoute = (element: ReactElement) => {
    if (!authInitialized) {
      return <LoadingFallback />;
    }
    return user && isEnabled ? element : <Navigate to={ROUTES.ACCOUNT} replace />;
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
      {header}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: "100%",
          pt: 8,
          pb: 4,
          display: "flex",
        }}
      >
        {user && isEnabled ? (
          <AppSideNav
            sections={navigationLinks.sections}
            adminLinks={navigationLinks.admin}
            pathname={location.pathname}
            selectedAdminSectionId={selectedAdminSectionId}
            selectedAdminUserGroupId={selectedAdminUserGroupId}
            mobileOpen={mobileNavOpen}
            onMobileClose={() => setMobileNavOpen(false)}
          />
        ) : null}
        <Box
          sx={{
            flex: 1,
            px: { xs: 2, sm: 3 },
            pt: 2,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Box sx={{ width: "100%", maxWidth: "1200px" }}>
            <PageHeaderAdminActionProvider value={pageHeaderAdminAction}>
              {checkoutQueryState && (
                <Box
                  sx={{
                    maxWidth: { sm: "700px" },
                    mx: "auto",
                    px: { xs: 3, sm: 4 },
                  }}
                >
                  <CheckoutStatusNotice
                    checkoutState={checkoutQueryState.checkout}
                    orderId={checkoutQueryState.orderId}
                    onDismiss={handleDismissCheckoutStatus}
                  />
                </Box>
              )}
              <Routes>
                <Route path={ROUTES.HOME} element={<HomePage />} />
                <Route
                  path={ROUTES.ACCOUNT}
                  element={
                    <Box sx={{ maxWidth: { sm: "600px" }, mx: "auto", px: { xs: 3, sm: 4 } }}>
                      <Suspense fallback={<LoadingFallback />}>
                        <AuthGate userData={userData} onBack={() => navigateBackOr(ROUTES.HOME)} />
                      </Suspense>
                    </Box>
                  }
                />
                <Route
                  path={ROUTES.PROFILE}
                  element={
                    <Box sx={{ maxWidth: { sm: "600px" }, mx: "auto", px: { xs: 3, sm: 4 } }}>
                      {user ? (
                        <Suspense fallback={<LoadingFallback />}>
                          <Profile key={user.uid} userData={userData} userEmail={user?.email || ""} onBack={() => navigateBackOr(ROUTES.HOME)} onUpdate={handleProfileUpdate} />
                        </Suspense>
                      ) : (
                        <Navigate to={ROUTES.ACCOUNT} replace />
                      )}
                    </Box>
                  }
                />
                <Route path={ROUTES.PERMISSIONS} element={<Navigate to={ROUTES.MANAGE_USERS} replace />} />
                <Route path={ROUTES.MANAGE_USERS} element={renderAdminOnly("Manage Users", <Suspense fallback={<LoadingFallback />}><ManageUsers onBack={() => navigateBackOr(ROUTES.HOME)} /></Suspense>)} />
                <Route path={ROUTES.APPROVE_USERS} element={renderAdminOnly("Approve Users", <Suspense fallback={<LoadingFallback />}><ApproveUsers onBack={() => navigateBackOr(ROUTES.HOME)} /></Suspense>)} />
                <Route path={ROUTES.USER_GROUPS} element={renderAdminOnly("User Groups", <Suspense fallback={<LoadingFallback />}><UserGroups onBack={() => navigateBackOr(ROUTES.HOME)} /></Suspense>)} />
                <Route
                  path={ROUTES.AUDIT_LOGS}
                  element={renderAdminOnly(
                    "Audit Logs",
                    <ErrorBoundary title="Audit Logs" onBack={() => navigateBackOr(ROUTES.HOME)}>
                      <Suspense fallback={<LoadingFallback />}>
                        <AuditLogs onBack={() => navigateBackOr(ROUTES.HOME)} />
                      </Suspense>
                    </ErrorBoundary>
                  )}
                />
                <Route
                  path={ROUTES.MANAGE_SECTIONS}
                  element={renderAdminOnly(
                    "Manage Sections",
                    <ErrorBoundary title="Manage Sections" onBack={() => navigateBackOr(ROUTES.HOME)}>
                      <Suspense fallback={<LoadingFallback />}>
                        <ManageSections onBack={() => navigateBackOr(ROUTES.HOME)} />
                      </Suspense>
                    </ErrorBoundary>
                  )}
                />
                <Route
                  path={ROUTES.SECTIONS}
                  element={protectedRoute(
                      <Suspense fallback={<LoadingFallback />}>
                        <SectionsList onBack={() => navigateBackOr(ROUTES.HOME)} onSelectSection={(sectionId) => navigate(`/sections/${sectionId}`)} />
                      </Suspense>
                  )}
                />
                <Route
                  path={ROUTES.SECTION_DETAIL}
                  element={protectedRoute(<Suspense fallback={<LoadingFallback />}><SectionDetailRoute /></Suspense>)}
                />
                <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
              </Routes>
            </PageHeaderAdminActionProvider>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default function App() {
  return <AppContent />;
}