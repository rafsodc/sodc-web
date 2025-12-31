import { Box, TextField, IconButton, Tooltip } from "@mui/material";
import { Refresh } from "@mui/icons-material";
import "./SearchBar.css";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onRefresh?: () => void;
  loading?: boolean;
  label?: string;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  onRefresh,
  loading = false,
  label = "Search by Email or Display Name",
  placeholder = "Enter search term...",
}: SearchBarProps) {
  return (
    <Box className="search-bar-container">
      <TextField
        label={label}
        variant="outlined"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="search-bar-input"
        size="small"
        placeholder={placeholder}
        fullWidth
      />
      {onRefresh && (
        <Tooltip title="Refresh">
          <IconButton onClick={onRefresh} disabled={loading} className="search-bar-refresh">
            <Refresh />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

