import { Avatar, Card, CardActionArea, CardContent, Stack, Tooltip, Typography } from "@mui/material";
import { Lock as LockIcon } from "@mui/icons-material";
import { getMembershipStatusLabel } from "../../../shared/utils/membershipStatusLabels";
import type { SectionMember } from "../utils/sectionHelpers";

export interface SectionMemberCardProps {
  member: SectionMember;
  onSelect: (member: SectionMember) => void;
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function SectionMemberCard({ member, onSelect }: SectionMemberCardProps) {
  const fullName = `${member.firstName} ${member.lastName}`.trim();

  const header = (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Avatar sx={{ bgcolor: "primary.main" }}>{initials(member.firstName, member.lastName)}</Avatar>
      <Stack sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle1" component="h3" fontWeight={600} sx={{ wordBreak: "break-word" }}>
          {fullName}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-word" }}>
          {member.rank || " "}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          Membership: {getMembershipStatusLabel(member.membershipStatus)}
        </Typography>
      </Stack>
    </Stack>
  );

  // CardContent's bottom padding depends on it being the last child, which differs between the
  // two branches below (the padlock is a trailing sibling in the private case) — pin it explicitly
  // so both variants render at the same height.
  const cardContentSx = { "&:last-child": { pb: 2 } };

  if (!member.sharesContactInfo) {
    return (
      <Card variant="outlined" component="li" sx={{ height: "100%", position: "relative" }}>
        <CardContent sx={cardContentSx}>{header}</CardContent>
        <Tooltip title="This member has chosen not to share their contact details">
          <LockIcon
            titleAccess="Private"
            fontSize="small"
            sx={{ position: "absolute", top: 12, right: 12, color: "text.secondary" }}
          />
        </Tooltip>
      </Card>
    );
  }

  return (
    <Card variant="outlined" component="li" sx={{ height: "100%" }}>
      <CardActionArea onClick={() => onSelect(member)} sx={{ height: "100%" }}>
        <CardContent sx={cardContentSx}>{header}</CardContent>
      </CardActionArea>
    </Card>
  );
}
