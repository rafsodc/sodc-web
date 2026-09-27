import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { listPotentialLostMembers, confirmPotentialLostMember, type PotentialLostMember } from "../../../shared/utils/firebaseFunctions/potentialLost";
import { getMembershipStatusLabel } from "../../../shared/utils/membershipStatusLabels";
import PaginationDisplay from "../../../shared/components/PaginationDisplay";
import SearchBar from "../../../shared/components/SearchBar";

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "Not recorded";
}
export default function PotentialLostMembers() {
  const [members, setMembers] = useState<PotentialLostMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<PotentialLostMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setMembers((await listPotentialLostMembers()).members); }
    catch { setError("We could not load members for review. Please try again."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const confirm = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await confirmPotentialLostMember(selected);
      setMessage(`${selected.firstName} ${selected.lastName} has been marked as Lost.`);
      setSelected(null);
      await refresh();
    } catch {
      setSelected(null);
      setError("The change could not be confirmed. Refresh the list and review the member again; their details may have changed.");
    } finally { setSaving(false); }
  };
  const filtered = members.filter((member) => `${member.firstName} ${member.lastName} ${member.email}`.toLowerCase().includes(search.trim().toLowerCase()));
  const totalPages = Math.ceil(filtered.length / 25);
  const currentPage = Math.min(page, Math.max(totalPages, 1));
  return (
    <Box>
      <Typography component="h2" variant="h6">Potential lost members</Typography>
      <Typography sx={{ mb: 2 }}>Review members with no sign-in for over three years or three consecutive email bounces. Being listed here does not change their membership or access. Members leave this list when their qualifying reasons clear.</Typography>
      <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} onRefresh={refresh} loading={loading || saving} label="Find a member" />
      {message && <Alert severity="success" onClose={() => setMessage(null)}>{message}</Alert>}
      {error && <Alert severity="error" action={<Button color="inherit" disabled={saving} onClick={() => void refresh()}>Retry</Button>}>{error}</Alert>}
      {loading ? <CircularProgress aria-label="Loading potential lost members" /> : !error && filtered.length === 0 ? <Alert severity="info">No members require review{search ? " matching this search" : ""}.</Alert> : !error ? (
        <>
          <TableContainer>
            <Table aria-label="Potential lost members">
              <TableHead><TableRow><TableCell>Member</TableCell><TableCell>Membership</TableCell><TableCell>Reason</TableCell><TableCell>Last sign-in</TableCell><TableCell>Email bounces</TableCell><TableCell>Action</TableCell></TableRow></TableHead>
              <TableBody>{filtered.slice((currentPage - 1) * 25, currentPage * 25).map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.firstName} {member.lastName}<Typography variant="body2">{member.email}</Typography></TableCell>
                  <TableCell>{getMembershipStatusLabel(member.membershipStatus)}</TableCell>
                  <TableCell>{member.reasons.map((reason) => reason === "INACTIVE" ? "No sign-in for over three years" : "Repeated email bounces").join("; ")}</TableCell>
                  <TableCell>{member.lastSignInTime ? date(member.lastSignInTime) : `Never signed in — account created ${date(member.inactivitySince)}`}</TableCell>
                  <TableCell>{member.emailBounceCount}{member.emailLastBounceAt && <Typography variant="body2">Last bounce: {date(member.emailLastBounceAt)}</Typography>}</TableCell>
                  <TableCell><Button disabled={!member.canConfirm || saving} onClick={() => setSelected(member)}>Mark as Lost</Button>{member.blockedReason && <Typography variant="body2">{member.blockedReason}</Typography>}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </TableContainer>
          <PaginationDisplay page={currentPage} totalPages={totalPages} onChange={setPage} />
        </>
      ) : null}
      <Dialog open={Boolean(selected)} onClose={() => { if (!saving) setSelected(null); }} aria-labelledby="confirm-lost-title">
        <DialogTitle id="confirm-lost-title">Mark member as Lost?</DialogTitle>
        <DialogContent>This changes {selected?.firstName} {selected?.lastName}’s membership to Lost and removes their member access. Confirm only after reviewing their circumstances.</DialogContent>
        <DialogActions><Button disabled={saving} onClick={() => setSelected(null)}>Cancel</Button><Button disabled={saving} color="error" onClick={() => void confirm()}>{saving ? "Saving…" : "Confirm Lost"}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
