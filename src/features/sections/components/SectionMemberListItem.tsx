import { Avatar, Stack, TableCell, TableRow, Tooltip, Typography } from "@mui/material";
import { Lock as LockIcon } from "@mui/icons-material";
import { getMembershipStatusLabel } from "../../../shared/utils/membershipStatusLabels";
import type { SectionMember } from "../utils/sectionHelpers";

export interface SectionMemberListItemProps {
  member: SectionMember;
  onSelect: (member: SectionMember) => void;
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function SectionMemberListItem({ member, onSelect }: SectionMemberListItemProps) {
  const fullName = `${member.firstName} ${member.lastName}`.trim();
  const clickable = member.sharesContactInfo;

  return (
    <TableRow
      hover={clickable}
      onClick={clickable ? () => onSelect(member) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(member);
              }
            }
          : undefined
      }
      sx={{ cursor: clickable ? "pointer" : "default" }}
    >
      <TableCell>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: "primary.main", width: 32, height: 32, fontSize: "0.875rem" }}>
            {initials(member.firstName, member.lastName)}
          </Avatar>
          <Typography variant="body2" fontWeight={600}>
            {fullName}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell>{member.rank || "—"}</TableCell>
      <TableCell>{getMembershipStatusLabel(member.membershipStatus)}</TableCell>
      <TableCell align="center">
        {!clickable && (
          <Tooltip title="This member has chosen not to share their contact details">
            <LockIcon titleAccess="Private" fontSize="small" sx={{ color: "text.secondary" }} />
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
}
