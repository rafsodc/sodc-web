import { Breadcrumbs, Link, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export interface NavigationBreadcrumbItem {
  label: string;
  to?: string;
  onClick?: () => void;
}

export interface NavigationBreadcrumbsProps {
  items: NavigationBreadcrumbItem[];
}

export default function NavigationBreadcrumbs({ items }: NavigationBreadcrumbsProps) {
  return (
    <Breadcrumbs
      aria-label="Breadcrumb"
      sx={{
        mb: 1,
        "& .MuiBreadcrumbs-li": {
          maxWidth: { xs: "8rem", sm: "none" },
        },
        "& .MuiBreadcrumbs-li:last-of-type .MuiTypography-root": {
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        },
      }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const key = `${item.label}-${index}`;

        if (isLast || (!item.to && !item.onClick)) {
          return (
            <Typography key={key} color="text.primary" variant="body2" noWrap>
              {item.label}
            </Typography>
          );
        }

        if (item.to) {
          return (
            <Link
              key={key}
              component={RouterLink}
              to={item.to}
              underline="hover"
              color="inherit"
              variant="body2"
              noWrap
            >
              {item.label}
            </Link>
          );
        }

        return (
          <Link
            key={key}
            component="button"
            type="button"
            onClick={item.onClick}
            underline="hover"
            color="inherit"
            variant="body2"
            sx={{
              border: 0,
              background: "none",
              cursor: "pointer",
              p: 0,
              font: "inherit",
              textAlign: "left",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}
