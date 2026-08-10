import { useEffect, useState, useCallback, useMemo, lazy, Suspense, type ReactElement } from "react";
import { Box, Button, Typography, Snackbar, Alert, CircularProgress } from "@mui/material";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { dataConnect } from "./config/firebase";
import { useUserData } from "./features/users/hooks/useUserData";
import type { UserData } from "./types";
import { useEnabledClaim } from "./features/users/hooks/useEnabledClaim";
import { useAdminClaim } from "./features/users/hooks/useAdminClaim";
import { ErrorBoundary } from "./shared/components/ErrorBoundary";
import Header from "./shared/components/Header";
import AppSideNav from "./shared/components/AppSideNav";
import MobileNavigationMenu from "./shared/components/MobileNavigationMenu";
import { buildNavigationLinks } from "./shared/navigation/buildNavigationLinks";
import { ROUTES } from "./constants";
import CheckoutStatusNotice from "./features/sections/components/CheckoutStatusNotice";
import { useGetSectionsForUser } from "@dataconnect/generated/react";
import {
  isCheckoutReturnSearch,
  navigateBackOr as navigateBackOrHelper,
} from "./shared/appShell/appRoutingHelpers";
import { getSectionReturnTo, sectionDetailLocationState } from "./shared/navigation/sectionNavigationState";
import { useAppAuthSession } from "./shared/appShell/useAppAuthSession";
import { useCheckoutQueryState } from "./shared/appShell/useCheckoutQueryState";
import { useOnlineStatus } from "./shared/appShell/useOnlineStatus";
import { useUnenabledProfileCheck } from "./shared/appShell/useUnenabledProfileCheck";
import { accountSignInPath, safeReturnTo } from "./shared/navigation/authReturnTo";
import { isProfileReviewDue } from "./features/profile/utils/profileReviewDue";
import SiteFooter from "./shared/components/SiteFooter";
import CookieBanner from "./shared/components/CookieBanner";
import CookieSettingsDialog from "./shared/components/CookieSettingsDialog";

// Lazy load route components for code splitting
const AuthGate = lazy(() => import("./features/auth/components/AuthGate"));
const Profile = lazy(() => import("./features/profile/components/Profile"));
const ManageUsers = lazy(() => import("./features/admin/components/ManageUsers"));
const ApproveUsers = lazy(() => import("./features/admin/components/ApproveUsers"));
const UserGroups = lazy(() => import("./features/admin/components/UserGroups"));
const AuditLogs = lazy(() => import("./features/admin/components/AuditLogs"));
const ManageSections = lazy(() => import("./features/admin/components/ManageSections"));
const SectionAdminPage = lazy(() => import("./features/admin/components/SectionAdminPage"));
const PaymentReconciliationDashboard = lazy(() => import("./features/admin/components/PaymentReconciliationDashboard"));
const EmailTemplateSyncPage = lazy(() => import("./features/admin/components/EmailTemplateSyncPage"));
const EmailDeliverySettingsPage = lazy(() => import("./features/admin/components/EmailDeliverySettingsPage"));
const SectionsList = lazy(() => import("./features/sections/components/SectionsList"));
const SectionDetail = lazy(() => import("./features/sections/components/SectionDetail"));
const MyPayments = lazy(() => import("./features/sections/components/MyPayments"));
const MyBookings = lazy(() => import("./features/sections/components/MyBookings"));
const AccountStatusMessage = lazy(() => import("./features/users/components/AccountStatusMessage"));
const ProfileCompletion = lazy(() => import("./features/auth/components/ProfileCompletion"));
const EmailVerificationMessage = lazy(() => import("./features/auth/components/EmailVerificationMessage"));
const MemberWelcomePage = lazy(() => import("./features/welcome/components/MemberWelcomePage"));
const PublicHomePage = lazy(() => import("./features/welcome/components/PublicHomePage"));
const AccountSettingsPage = lazy(() => import("./features/account/components/AccountSettingsPage"));
const RegisterPage = lazy(() => import("./features/auth/components/RegisterPage"));
const OnboardingShell = lazy(() => import("./features/auth/components/OnboardingShell"));
const UnsubscribeConfirmedPage = lazy(() => import("./features/account/components/UnsubscribeConfirmedPage"));
const SectionFileDownloadPage = lazy(() => import("./features/sections/components/SectionFileDownloadPage"));
const PasswordResetRequestPage = lazy(() => import("./features/auth/components/PasswordResetRequestPage"));
const AuthActionPage = lazy(() => import("./features/auth/components/AuthActionPage"));
const ProfileReviewDialog = lazy(
  () => import("./features/profile/components/ProfileReviewDialog"),
);

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
    navigateBackOrHelper(getSectionReturnTo(location.state), location, navigate);
  };

  return <SectionDetail sectionId={sectionId} onBack={handleBack} />;
}

function SectionFileRoute() {
  const { sectionId, fileId } = useParams<{ sectionId: string; fileId: string }>();
  if (!sectionId || !fileId) {
    return <Navigate to={ROUTES.SECTIONS} replace />;
  }
  return <SectionFileDownloadPage sectionId={sectionId} fileId={fileId} />;
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const handleLoggedOut = useCallback(() => {
    navigate(ROUTES.ACCOUNT);
  }, [navigate]);
  const {
    user,
    authInitialized,
    logoutSuccess,
    setLogoutSuccess,
    triggerEmailCheck,
  } = useAppAuthSession(handleLoggedOut);
  const { checkoutQueryState, dismissCheckoutStatus } = useCheckoutQueryState(location, navigate);
  const isOnline = useOnlineStatus();
  const [mobileNavAnchorEl, setMobileNavAnchorEl] = useState<HTMLElement | null>(null);
  const [profileReviewCompletedForUid, setProfileReviewCompletedForUid] = useState<string | null>(
    null,
  );
  const [profileReviewSaved, setProfileReviewSaved] = useState(false);
  const { isEnabled, isEnabledClaimResolved } = useEnabledClaim(user);
  const checkoutReturn = isCheckoutReturnSearch(location.search);
  const authReturnTo = safeReturnTo(location.search);
  const isPublicAuthAction = location.pathname === ROUTES.AUTH_ACTION;
  const isAdmin = useAdminClaim(user);
  const { userData, loading: userDataLoading, refetch } = useUserData(user, isEnabled);
  const {
    membershipStatusForUnenabled,
    needsProfileCompletion,
  } = useUnenabledProfileCheck(
    user,
    userData,
    isEnabled
  );
  const { data: userSectionsData } = useGetSectionsForUser(dataConnect, { enabled: !!user && isEnabled });

  useEffect(() => {
    setMobileNavAnchorEl(null);
  }, [location.pathname]);

  const handleProfileUpdate = useCallback(() => {
    // Refetch user data after profile update
    return refetch?.();
  }, [refetch]);

  const handleProfileReviewed = useCallback(async () => {
    if (!user) return;
    setProfileReviewCompletedForUid(user.uid);
    await refetch?.();
    setProfileReviewSaved(true);
  }, [refetch, user]);

  // Check if email is verified
  const emailNotVerified = user && !user.emailVerified;
  const showProfileReview = Boolean(
    user &&
      user.emailVerified &&
      isEnabled &&
      userData &&
      !userDataLoading &&
      !isPublicAuthAction &&
      profileReviewCompletedForUid !== user.uid &&
      isProfileReviewDue(userData.profileReviewedAt),
  );

  const navigationLinks = useMemo(
    () => buildNavigationLinks({ isEnabled, isAdmin, sectionsData: userSectionsData }),
    [isAdmin, isEnabled, userSectionsData]
  );

  const header = (
    <>
      <Header
        user={user}
        userData={userData}
        onAccountClick={() => navigate(ROUTES.ACCOUNT)}
        onProfileClick={() => navigate(ROUTES.PROFILE)}
        onAccountSettingsClick={() => navigate(ROUTES.ACCOUNT_SETTINGS)}
        onMyBookingsClick={() => navigate(ROUTES.MY_BOOKINGS)}
        onMyPaymentsClick={() => navigate(ROUTES.MY_PAYMENTS)}
        onJoinClick={() => navigate(ROUTES.REGISTER)}
        onLogoClick={() => navigate(ROUTES.HOME)}
        onNavMenuOpen={setMobileNavAnchorEl}
      />
      <MobileNavigationMenu
        anchorEl={mobileNavAnchorEl}
        onClose={() => setMobileNavAnchorEl(null)}
        sections={navigationLinks.sections}
        adminLinks={navigationLinks.admin}
        pathname={location.pathname}
      />
    </>
  );

  if (!isOnline) {
    return (
      <Box sx={{ flexGrow: 1, width: "100%", display: "flex", flexDirection: "column", backgroundColor: "background.default" }}>
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

  if (emailNotVerified && !isPublicAuthAction) {
    return (
      <Box sx={{ flexGrow: 1, width: "100%", display: "flex", flexDirection: "column", backgroundColor: "background.default" }}>
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
              <OnboardingShell activeStep="verify">
                <EmailVerificationMessage
                  user={user}
                  onVerified={async () => triggerEmailCheck()}
                />
              </OnboardingShell>
            </Suspense>
          </Box>
        </Box>
      </Box>
    );
  }

  if (
    checkoutReturn &&
    (!authInitialized || (user && !isEnabledClaimResolved))
  ) {
    return (
      <Box sx={{ flexGrow: 1, width: "100%", display: "flex", flexDirection: "column", backgroundColor: "background.default" }}>
        {header}
        <Box component="main" sx={{ flexGrow: 1, width: "100%", pt: 12, pb: 4 }}>
          <LoadingFallback />
        </Box>
      </Box>
    );
  }

  if (user && !isEnabledClaimResolved && !isPublicAuthAction) {
    return (
      <Box sx={{ flexGrow: 1, width: "100%", display: "flex", flexDirection: "column", backgroundColor: "background.default" }}>
        {header}
        <Box component="main" sx={{ flexGrow: 1, width: "100%", pt: 12, pb: 4 }}>
          <LoadingFallback />
        </Box>
      </Box>
    );
  }

  if (
    user &&
    needsProfileCompletion &&
    location.pathname !== ROUTES.PROFILE_COMPLETION &&
    !isPublicAuthAction
  ) {
    return (
      <Box sx={{ flexGrow: 1, width: "100%", display: "flex", flexDirection: "column", backgroundColor: "background.default" }}>
        {header}
        <Navigate to={ROUTES.PROFILE_COMPLETION} replace />
      </Box>
    );
  }

  if (user && !isEnabled && !needsProfileCompletion && !isPublicAuthAction) {
    const inactiveUserData =
      userData ||
      (membershipStatusForUnenabled
        ? {
            id: user.uid,
            firstName: "",
            lastName: "",
            email: user.email || "",
            serviceNumber: "",
            membershipStatus: membershipStatusForUnenabled as UserData["membershipStatus"],
            createdAt: "",
            updatedAt: "",
          }
        : null);
    const showApprovalStep = inactiveUserData?.membershipStatus === "PENDING";

    return (
      <Box sx={{ flexGrow: 1, width: "100%", display: "flex", flexDirection: "column", backgroundColor: "background.default" }}>
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
          <Box sx={{ maxWidth: { sm: "640px" }, mx: "auto", px: { xs: 3, sm: 4 } }}>
            <Suspense fallback={<LoadingFallback />}>
              {showApprovalStep ? (
                <OnboardingShell activeStep="approval">
                  <AccountStatusMessage userData={inactiveUserData} />
                </OnboardingShell>
              ) : (
                <AccountStatusMessage userData={inactiveUserData} />
              )}
            </Suspense>
          </Box>
        </Box>
      </Box>
    );
  }

  const handleCloseLogoutSnackbar = () => {
    setLogoutSuccess(false);
  };

  const navigateBackOr = (fallbackRoute: string) => {
    navigateBackOrHelper(fallbackRoute, location, navigate);
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
        <Typography variant="h4" sx={{ color: "primary.light", mb: 3 }}>
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
    if (user && !isEnabledClaimResolved) {
      return <LoadingFallback />;
    }
    if (user && isEnabled) {
      return element;
    }
    if (checkoutReturn) {
      return <Navigate to={{ pathname: ROUTES.ACCOUNT, search: location.search }} replace />;
    }
    return (
      <Navigate
        to={accountSignInPath(`${location.pathname}${location.search}${location.hash}`)}
        replace
      />
    );
  };

  return (
    <Box sx={{ flexGrow: 1, width: "100%", display: "flex", flexDirection: "column", backgroundColor: "background.default" }}>
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
      <Snackbar
        open={profileReviewSaved}
        autoHideDuration={6000}
        onClose={() => setProfileReviewSaved(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ mt: 10 }}
      >
        <Alert
          onClose={() => setProfileReviewSaved(false)}
          severity="success"
          sx={{ width: "100%" }}
        >
          Your profile has been saved.
        </Alert>
      </Snackbar>
      {header}
      {showProfileReview && userData && user && (
        <Suspense fallback={null}>
          <ProfileReviewDialog
            userData={userData}
            userEmail={user.email || ""}
            onReviewed={handleProfileReviewed}
          />
        </Suspense>
      )}
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
                    onDismiss={dismissCheckoutStatus}
                  />
                </Box>
              )}
              <ErrorBoundary
                title="Page unavailable"
                resetKey={`${location.key}:${location.pathname}${location.search}`}
                onBack={() => navigateBackOr(ROUTES.HOME)}
                onHome={() => navigate(ROUTES.HOME)}
              >
                <Routes>
                <Route
                  path={ROUTES.HOME}
                  element={
                    user && isEnabled ? (
                      <Suspense fallback={<LoadingFallback />}>
                        <MemberWelcomePage
                          userData={userData}
                          userEmail={user.email}
                          sectionsData={userSectionsData}
                        />
                      </Suspense>
                    ) : (
                      <Suspense fallback={<LoadingFallback />}>
                        <PublicHomePage
                          onJoinClick={() => navigate(ROUTES.REGISTER)}
                          onLogInClick={() => navigate(ROUTES.ACCOUNT)}
                        />
                      </Suspense>
                    )
                  }
                />
                <Route
                  path={ROUTES.REGISTER}
                  element={
                    <Box sx={{ maxWidth: { sm: "640px" }, mx: "auto", px: { xs: 3, sm: 4 } }}>
                      {user ? (
                        <Navigate to={ROUTES.HOME} replace />
                      ) : (
                        <Suspense fallback={<LoadingFallback />}>
                          <RegisterPage />
                        </Suspense>
                      )}
                    </Box>
                  }
                />
                <Route
                  path={ROUTES.PROFILE_COMPLETION}
                  element={
                    <Box sx={{ maxWidth: { sm: "640px" }, mx: "auto", px: { xs: 3, sm: 4 } }}>
                      {user && needsProfileCompletion ? (
                        <Suspense fallback={<LoadingFallback />}>
                          <OnboardingShell activeStep="profile">
                            <ProfileCompletion
                              userEmail={user.email || ""}
                              onComplete={() => refetch?.()}
                            />
                          </OnboardingShell>
                        </Suspense>
                      ) : user && isEnabled ? (
                        <Navigate to={ROUTES.HOME} replace />
                      ) : (
                        <Navigate to={ROUTES.ACCOUNT} replace />
                      )}
                    </Box>
                  }
                />
                <Route
                  path={ROUTES.PASSWORD_RESET_REQUEST}
                  element={
                    <Box sx={{ maxWidth: { sm: "600px" }, mx: "auto", px: { xs: 3, sm: 4 } }}>
                      <Suspense fallback={<LoadingFallback />}>
                        <PasswordResetRequestPage />
                      </Suspense>
                    </Box>
                  }
                />
                <Route
                  path={ROUTES.AUTH_ACTION}
                  element={
                    <Box sx={{ maxWidth: { sm: "600px" }, mx: "auto", px: { xs: 3, sm: 4 } }}>
                      <Suspense fallback={<LoadingFallback />}>
                        <AuthActionPage />
                      </Suspense>
                    </Box>
                  }
                />
                <Route
                  path={ROUTES.ACCOUNT}
                  element={
                    user && isEnabled ? (
                      checkoutReturn ? (
                        <Navigate to={{ pathname: ROUTES.MY_PAYMENTS, search: location.search }} replace />
                      ) : authReturnTo ? (
                        <Navigate to={authReturnTo} replace />
                      ) : (
                        <Navigate to={ROUTES.HOME} replace />
                      )
                    ) : (
                      <Box sx={{ maxWidth: { sm: "600px" }, mx: "auto", px: { xs: 3, sm: 4 } }}>
                        <Suspense fallback={<LoadingFallback />}>
                          <AuthGate userData={userData} />
                        </Suspense>
                      </Box>
                    )
                  }
                />
                <Route
                  path={ROUTES.PROFILE}
                  element={
                    <Box sx={{ maxWidth: { sm: "600px" }, mx: "auto", px: { xs: 3, sm: 4 } }}>
                      {user ? (
                        <Suspense fallback={<LoadingFallback />}>
                          <Profile
                            key={user.uid}
                            userData={userData}
                            userDataLoading={userDataLoading}
                            userEmail={user?.email || ""}
                            onBack={() => navigateBackOr(ROUTES.HOME)}
                            onUpdate={handleProfileUpdate}
                          />
                        </Suspense>
                      ) : (
                        <Navigate to={ROUTES.ACCOUNT} replace />
                      )}
                    </Box>
                  }
                />
                <Route
                  path={ROUTES.ACCOUNT_SETTINGS}
                  element={
                    <Box sx={{ maxWidth: { sm: "600px" }, mx: "auto", px: { xs: 3, sm: 4 } }}>
                      {user && isEnabled ? (
                        <Suspense fallback={<LoadingFallback />}>
                          <AccountSettingsPage
                            key={user.uid}
                            user={user}
                            userData={userData}
                            userDataLoading={userDataLoading}
                            isAdmin={isAdmin}
                            onBack={() => navigateBackOr(ROUTES.HOME)}
                            onUserDataUpdate={handleProfileUpdate}
                          />
                        </Suspense>
                      ) : user ? (
                        <Navigate to={ROUTES.HOME} replace />
                      ) : (
                        <Navigate to={ROUTES.ACCOUNT} replace />
                      )}
                    </Box>
                  }
                />
                <Route path={ROUTES.PERMISSIONS} element={<Navigate to={ROUTES.MANAGE_USERS} replace />} />
                <Route path={ROUTES.MANAGE_USERS} element={renderAdminOnly("Manage Users", <Suspense fallback={<LoadingFallback />}><ManageUsers onBack={() => navigateBackOr(ROUTES.HOME)} onCurrentUserUpdate={handleProfileUpdate} /></Suspense>)} />
                <Route path={ROUTES.APPROVE_USERS} element={renderAdminOnly("Approve Users", <Suspense fallback={<LoadingFallback />}><ApproveUsers onBack={() => navigateBackOr(ROUTES.HOME)} /></Suspense>)} />
                <Route path={ROUTES.USER_GROUPS} element={renderAdminOnly("User Groups", <Suspense fallback={<LoadingFallback />}><UserGroups onBack={() => navigateBackOr(ROUTES.HOME)} /></Suspense>)} />
                <Route
                  path={ROUTES.AUDIT_LOGS}
                  element={renderAdminOnly(
                    "Audit Logs",
                    <Suspense fallback={<LoadingFallback />}>
                      <AuditLogs onBack={() => navigateBackOr(ROUTES.HOME)} />
                    </Suspense>
                  )}
                />
                <Route
                  path={ROUTES.PAYMENT_RECONCILIATION}
                  element={renderAdminOnly(
                    "Payment Reconciliation",
                    <Suspense fallback={<LoadingFallback />}>
                      <PaymentReconciliationDashboard onBack={() => navigateBackOr(ROUTES.HOME)} />
                    </Suspense>
                  )}
                />
                <Route
                  path={ROUTES.EMAIL_TEMPLATES}
                  element={renderAdminOnly(
                    "Email Templates",
                    <Suspense fallback={<LoadingFallback />}>
                      <EmailTemplateSyncPage onBack={() => navigateBackOr(ROUTES.HOME)} />
                    </Suspense>
                  )}
                />
                <Route
                  path={ROUTES.EMAIL_DELIVERY}
                  element={renderAdminOnly(
                    "Email Delivery",
                    <Suspense fallback={<LoadingFallback />}>
                      <EmailDeliverySettingsPage onBack={() => navigateBackOr(ROUTES.HOME)} />
                    </Suspense>
                  )}
                />
                <Route
                  path={ROUTES.SECTION_ADMIN}
                  element={protectedRoute(
                    <Suspense fallback={<LoadingFallback />}>
                      <SectionAdminPage />
                    </Suspense>
                  )}
                />
                <Route
                  path={ROUTES.MANAGE_SECTIONS}
                  element={renderAdminOnly(
                    "Manage Sections",
                    <Suspense fallback={<LoadingFallback />}>
                      <ManageSections onBack={() => navigateBackOr(ROUTES.HOME)} />
                    </Suspense>
                  )}
                />
                <Route
                  path={ROUTES.MY_BOOKINGS}
                  element={protectedRoute(
                    <Suspense fallback={<LoadingFallback />}>
                      <MyBookings onBack={() => navigateBackOr(ROUTES.HOME)} />
                    </Suspense>
                  )}
                />
                <Route
                  path={ROUTES.MY_PAYMENTS}
                  element={protectedRoute(
                    <Suspense fallback={<LoadingFallback />}>
                      <MyPayments onBack={() => navigateBackOr(ROUTES.HOME)} />
                    </Suspense>
                  )}
                />
                <Route
                  path={ROUTES.SECTIONS}
                  element={protectedRoute(
                      <Suspense fallback={<LoadingFallback />}>
                        <SectionsList
                          onBack={() => navigateBackOr(ROUTES.HOME)}
                          onSelectSection={(sectionId) =>
                            navigate(`/sections/${sectionId}`, {
                              state: sectionDetailLocationState(ROUTES.SECTIONS),
                            })
                          }
                        />
                      </Suspense>
                  )}
                />
                <Route
                  path={ROUTES.SECTION_DETAIL}
                  element={protectedRoute(<Suspense fallback={<LoadingFallback />}><SectionDetailRoute /></Suspense>)}
                />
                <Route
                  path={ROUTES.SECTION_FILE}
                  element={protectedRoute(<Suspense fallback={<LoadingFallback />}><SectionFileRoute /></Suspense>)}
                />
                <Route
                  path={ROUTES.UNSUBSCRIBE_CONFIRMED}
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <UnsubscribeConfirmedPage />
                    </Suspense>
                  }
                />
                <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
                </Routes>
              </ErrorBoundary>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <ErrorBoundary
      title="SODC is temporarily unavailable"
      resetKey={`${location.key}:${location.pathname}${location.search}`}
      variant="page"
      onHome={() => navigate(ROUTES.HOME)}
    >
      <>
        <Box
          data-testid="app-shell"
          sx={{
            minHeight: "100dvh",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "background.default",
          }}
        >
          <AppContent />
          <SiteFooter />
        </Box>
        <CookieBanner />
        <CookieSettingsDialog />
      </>
    </ErrorBoundary>
  );
}
