import { AppBar, Button, Toolbar, Typography } from "@mui/material";
import { Person } from "@mui/icons-material";
import { colors } from "../config/colors";

interface HeaderProps {
  onAccountClick: () => void;
}

export default function Header({ onAccountClick }: HeaderProps) {
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
        <Button 
          onClick={onAccountClick}
          startIcon={<Person />}
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
          Sign In
        </Button>
      </Toolbar>
    </AppBar>
  );
}

