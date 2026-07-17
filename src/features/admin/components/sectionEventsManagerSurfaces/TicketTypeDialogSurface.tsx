import {
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { TicketAudience } from "@dataconnect/generated";
import { getTicketCategoryLabel, TICKET_CATEGORY_LABEL } from "../../../../shared/utils/ticketAudienceLabels";
import type { TicketTypeRow } from "../sectionEventsManagerTypes";

interface TicketTypeDialogSurfaceProps {
  open: boolean;
  editingTicketType: TicketTypeRow | null;
  title: string;
  description: string;
  price: string;
  sortOrder: string;
  audience: TicketAudience;
  accessGroup: { id: string; name: string } | null;
  userGroups: Array<{ id: string; name: string }>;
  loadingUserGroups: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onSortOrderChange: (value: string) => void;
  onAudienceChange: (value: TicketAudience) => void;
  onAccessGroupChange: (value: { id: string; name: string } | null) => void;
}
export function TicketTypeDialogSurface({
  open,
  editingTicketType,
  title,
  description,
  price,
  sortOrder,
  audience,
  accessGroup,
  userGroups,
  loadingUserGroups,
  submitting,
  onClose,
  onSubmit,
  onTitleChange,
  onDescriptionChange,
  onPriceChange,
  onSortOrderChange,
  onAudienceChange,
  onAccessGroupChange,
}: TicketTypeDialogSurfaceProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editingTicketType ? "Edit ticket type" : "Add ticket type"}</DialogTitle>
      <DialogContent>
        <TextField label="Title" fullWidth value={title} onChange={(event) => onTitleChange(event.target.value)} margin="dense" required />
        <TextField
          label="Description"
          fullWidth
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          margin="dense"
          multiline
        />
        <TextField
          label="Price"
          type="number"
          fullWidth
          value={price}
          onChange={(event) => onPriceChange(event.target.value)}
          margin="dense"
          inputProps={{ min: 0, step: 0.01 }}
        />
        <TextField
          label="Sort order"
          type="number"
          fullWidth
          value={sortOrder}
          onChange={(event) => onSortOrderChange(event.target.value)}
          margin="dense"
        />
        <FormControl fullWidth margin="dense" sx={{ mt: 1 }}>
          <InputLabel id="ticket-audience-label">{TICKET_CATEGORY_LABEL}</InputLabel>
          <Select
            labelId="ticket-audience-label"
            label={TICKET_CATEGORY_LABEL}
            value={audience}
            onChange={(event) => onAudienceChange(event.target.value as TicketAudience)}
          >
            <MenuItem value={TicketAudience.MEMBER}>{getTicketCategoryLabel(TicketAudience.MEMBER)}</MenuItem>
            <MenuItem value={TicketAudience.GUEST}>{getTicketCategoryLabel(TicketAudience.GUEST)}</MenuItem>
          </Select>
        </FormControl>
        <Autocomplete
          options={userGroups}
          getOptionLabel={(option) => option.name}
          value={accessGroup}
          onChange={(_, value) => onAccessGroupChange(value)}
          loading={loadingUserGroups}
          renderInput={(params) => <TextField {...params} label="Access group" required margin="dense" />}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} disabled={submitting || !title.trim() || !accessGroup}>
          {submitting ? <CircularProgress size={20} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
