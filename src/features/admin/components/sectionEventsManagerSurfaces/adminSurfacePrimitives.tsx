import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Paper,
  Table,
  TableContainer,
} from "@mui/material";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import type { ReactNode } from "react";

export function AdminAccordion({
  title,
  defaultExpanded = false,
  children,
}: {
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      sx={{
        mb: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "12px !important",
        boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
        overflow: "hidden",
        "&:before": {
          display: "none",
        },
        "&:focus, &:focus-visible, &:focus-within": {
          outline: "none",
          boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
        },
      }}
    >
      <AccordionSummary
        disableRipple
        expandIcon={<ExpandMoreIcon />}
        sx={{
          bgcolor: "background.paper",
          minHeight: 58,
          px: 2.5,
          transition: "background-color 150ms ease",
          outline: "none",
          boxShadow: "none",
          "&:hover": {
            bgcolor: "grey.50",
          },
          "&:focus, &:focus-visible, &:active": {
            outline: "none",
            boxShadow: "none",
          },
          "&.Mui-focusVisible": {
            bgcolor: "background.paper",
            outline: "none",
            boxShadow: "none",
          },
          "& .MuiTouchRipple-root": {
            display: "none",
          },
          "&.Mui-expanded": {
            borderBottom: "1px solid",
            borderColor: "divider",
            minHeight: 58,
          },
          "& .MuiAccordionSummary-content": {
            alignItems: "center",
            my: 1.5,
          },
          "& .MuiAccordionSummary-expandIconWrapper": {
            color: "text.secondary",
          },
        }}
      >
        <Box sx={{ fontWeight: 700, color: "text.primary", letterSpacing: "0.01em" }}>{title}</Box>
      </AccordionSummary>
      <AccordionDetails sx={{ bgcolor: "grey.50", p: 2.5 }}>{children}</AccordionDetails>
    </Accordion>
  );
}
export function AdminTable({ children, minWidth = 650 }: { children: ReactNode; minWidth?: number }) {
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{
        width: "100%",
        maxWidth: "100%",
        borderColor: "divider",
        borderRadius: 2,
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
        overflowX: "auto",
      }}
    >
      <Table
        size="small"
        sx={{
          minWidth,
          "& .MuiTableCell-head": {
            bgcolor: "grey.50",
            color: "text.secondary",
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          },
          "& .MuiTableCell-body": {
            borderBottomColor: "divider",
            py: 1.25,
          },
          "& .MuiTableBody-root .MuiTableRow-root:hover": {
            bgcolor: "action.hover",
          },
          "& .MuiTableRow-root:last-of-type .MuiTableCell-body": {
            borderBottom: 0,
          },
        }}
      >
        {children}
      </Table>
    </TableContainer>
  );
}
