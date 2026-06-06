import { useState } from "react";
import { Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { getMembershipStatusLabel } from "../../../shared/utils/membershipStatusLabels";
import type { SectionMember } from "../utils/sectionHelpers";

export interface SectionMemberCardProps {
  member: SectionMember;
}

export default function SectionMemberCard({ member }: SectionMemberCardProps) {
  const [showEmail, setShowEmail] = useState(false);
  const fullName = `${member.firstName} ${member.lastName}`.trim();

  return (
    <Card variant="outlined" component="li" sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} flexWrap="wrap">
          <Typography variant="subtitle1" component="h3" fontWeight={600}>
            {fullName}
          </Typography>
          <Chip label={getMembershipStatusLabel(member.membershipStatus)} size="small" />
        </Stack>
        {showEmail ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, wordBreak: "break-word" }}>
            {member.email}
          </Typography>
        ) : null}
        <Button
          size="small"
          variant="text"
          onClick={() => setShowEmail((visible) => !visible)}
          aria-expanded={showEmail}
          sx={{ mt: 0.5, px: 0, minWidth: 0 }}
        >
          {showEmail ? "Hide email" : "Show email"}
        </Button>
      </CardContent>
    </Card>
  );
}
