import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import { getMembershipStatusLabel } from "../../../shared/utils/membershipStatusLabels";
import type { SectionMember } from "../utils/sectionHelpers";

interface ContactDetailsDialogProps {
  member: SectionMember | null;
  onClose: () => void;
}

/** Shown when a member card is clicked. Only ever rendered for members with sharesContactInfo
 * true — SectionMemberCard doesn't wire up onSelect for opted-out members at all. See #273. */
export default function ContactDetailsDialog({ member, onClose }: ContactDetailsDialogProps) {
  const fullName = member ? `${member.firstName} ${member.lastName}`.trim() : "";
  const displayName = member?.rank ? `${member.rank} ${fullName}` : fullName;

  return (
    <Dialog open={!!member} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Contact details</DialogTitle>
      <DialogContent>
        {member && (
          <Box sx={{ pt: 0.5 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {displayName}
            </Typography>
            <Chip label={getMembershipStatusLabel(member.membershipStatus)} size="small" sx={{ mt: 1, mb: 1.5 }} />
            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>
              {member.email}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
