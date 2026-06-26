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
        "& .MuiBreadcrumbs-ol": {
          alignItems: "center",
        },
        "& .MuiBreadcrumbs-li": {
          maxWidth: { xs: "8rem", sm: "none" },
          display: "inline-flex",
          alignItems: "center",
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
            noWrap
            sx={(theme) => ({
              border: 0,
              background: "none",
              cursor: "pointer",
              p: 0,
              m: 0,
              minHeight: "unset",
              display: "inline-flex",
              alignItems: "center",
              verticalAlign: "middle",
              textAlign: "left",
              fontSize: theme.typography.body2.fontSize,
              lineHeight: theme.typography.body2.lineHeight,
              fontWeight: theme.typography.body2.fontWeight,
              letterSpacing: theme.typography.body2.letterSpacing,
              fontFamily: theme.typography.fontFamily,
            })}
          >
            {item.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}
