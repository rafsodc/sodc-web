import { Typography } from "@mui/material";
import { colors } from "../../config/colors";

export default function HomePage() {
  return (
    <>
      <Typography
        variant="h1"
        component="h1"
        sx={{
          fontSize: { xs: "2.5rem", sm: "3.5rem", md: "4.5rem" },
          color: colors.titlePrimary,
          mt: 5,
          mb: 2,
          fontWeight: 400,
        }}
      >
        Royal Air Force | <strong>SODC</strong>
      </Typography>
      <Typography
        variant="h2"
        component="h2"
        sx={{
          color: colors.titleSecondary,
          mb: 5,
          fontSize: { xs: "1.5rem", sm: "2rem", md: "2.5rem" },
          fontWeight: 400,
        }}
      >
        Signal Officers' Dinner Club
      </Typography>
    </>
  );
}

