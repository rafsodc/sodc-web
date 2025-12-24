import { useState } from "react";
import { Box, CssBaseline } from "@mui/material";
import AuthGate from "./components/AuthGate";
import Header from "./components/Header";
import HomePage from "./components/HomePage";
import { colors } from "./config/colors";

export default function App() {
  const [showAccount, setShowAccount] = useState(false);

  return (
    <Box sx={{ minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", backgroundColor: colors.background }}>
      <CssBaseline />
      <Header onAccountClick={() => setShowAccount(true)} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: "100%",
          pt: 12, // Padding top to account for fixed header
          pb: 4,
        }}
      >
        <Box
          sx={{
            pl: { xs: 6, sm: 10, md: 15 },
            pr: { xs: 3, sm: 4 },
          }}
        >
          {showAccount ? (
            <Box sx={{ maxWidth: { sm: "600px" } }}>
              <AuthGate onBack={() => setShowAccount(false)} />
            </Box>
          ) : (
            <HomePage />
          )}
        </Box>
      </Box>
    </Box>
  );
}