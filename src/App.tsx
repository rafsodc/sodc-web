import { useEffect, useState } from "react";
import { Box, CssBaseline } from "@mui/material";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "./config/firebase";
import AuthGate from "./components/AuthGate";
import Header from "./components/Header";
import HomePage from "./components/HomePage";
import { colors } from "./config/colors";

export default function App() {
  const [showAccount, setShowAccount] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", backgroundColor: colors.background }}>
      <CssBaseline />
      <Header user={user} onAccountClick={() => setShowAccount(true)} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: "100%",
          pt: 12, // Padding top to account for fixed header
          pb: 4,
        }}
      >
        {showAccount ? (
          <Box 
            sx={{ 
              maxWidth: { sm: "600px" },
              mx: "auto",
              px: { xs: 3, sm: 4 },
            }}
          >
            <AuthGate onBack={() => setShowAccount(false)} />
          </Box>
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