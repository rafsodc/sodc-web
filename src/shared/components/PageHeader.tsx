import { Box, Button, Typography } from "@mui/material";
import "./PageHeader.css";

interface PageHeaderProps {
  title: string;
  onBack: () => void;
}

export default function PageHeader({ title, onBack }: PageHeaderProps) {
  return (
    <Box className="page-header">
      <Typography variant="h4" className="page-header-title">
        {title}
      </Typography>
      <Button variant="outlined" onClick={onBack}>
        Back
      </Button>
    </Box>
  );
}

