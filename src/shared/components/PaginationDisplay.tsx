import { Stack, Pagination } from "@mui/material";

interface PaginationDisplayProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export default function PaginationDisplay({ page, totalPages, onChange }: PaginationDisplayProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <Stack spacing={2} sx={{ mt: 3, alignItems: "center" }}>
      <Pagination count={totalPages} page={page} onChange={(_, newPage) => onChange(newPage)} color="primary" />
    </Stack>
  );
}

