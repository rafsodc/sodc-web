import { useEffect, useState, useCallback } from "react";
import { Box, Button, CssBaseline, Typography } from "@mui/material";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "./config/firebase";
import { useUserData } from "./hooks/useUserData";
import AuthGate from "./components/AuthGate";
import Header from "./components/Header";
import HomePage from "./components/HomePage";
import Profile from "./components/Profile";
import Permissions from "./components/Permissions";
import ManageUsers from "./components/ManageUsers";
import { colors } from "./config/colors";

type View = "home" | "account" | "profile" | "permissions" | "manageUsers";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [user, setUser] = useState<User | null>(null);
  const { userData, refetch } = useUserData(user);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  const handleProfileUpdate = useCallback(() => {
    // Refetch user data after profile update
    if (refetch) {
      refetch();
    }
  }, [refetch]);

  return (
    <Box sx={{ minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", backgroundColor: colors.background }}>
      <CssBaseline />
      <Header 
        user={user} 
        userData={userData} 
        onAccountClick={() => setView("account")}
        onProfileClick={() => setView("profile")}
        onPermissionsClick={() => setView("permissions")}
        onManageUsersClick={() => setView("manageUsers")}
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
            <AuthGate onBack={() => setView("home")} />
          </Box>
        ) : view === "profile" ? (
          <Box 
            sx={{ 
              maxWidth: { sm: "600px" },
              mx: "auto",
              px: { xs: 3, sm: 4 },
            }}
          >
            <Profile 
              userData={userData} 
              userEmail={user?.email || ""}
              onBack={() => setView("home")}
              onUpdate={handleProfileUpdate}
            />
          </Box>
        ) : view === "permissions" ? (
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
        ) : view === "manageUsers" ? (
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