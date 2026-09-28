import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { TicketAudience } from "@dataconnect/generated";
import {
  getTicketCategoryLabel,
  TICKET_CATEGORY_LABEL,
  ORGANISER_GUEST,
  type ManagedTicketAudience,
} from "../../../../shared/utils/ticketAudienceLabels";
import type { TicketTypeRow } from "../sectionEventsManagerTypes";

interface TicketTypeDialogSurfaceProps {
  open: boolean;
  organiserOnly?: boolean;
  active?: boolean;
  onActiveChange?: (value: boolean) => void;
  error?: string | null;
  editingTicketType: TicketTypeRow | null;
  title: string;
  description: string;
  price: string;
  sortOrder: string;
  audience: ManagedTicketAudience;
  includesDinner: boolean;
  includesSymposium: boolean;
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
  onAudienceChange: (value: ManagedTicketAudience) => void;
  onIncludesDinnerChange: (value: boolean) => void;
  onIncludesSymposiumChange: (value: boolean) => void;
  onAccessGroupChange: (value: { id: string; name: string } | null) => void;
}
export function TicketTypeDialogSurface({
  open,
  organiserOnly = false,
  active = true,
  onActiveChange,
  error,
  editingTicketType,
  title,
  description,
  price,
  sortOrder,
  audience,
  includesDinner,
  includesSymposium,
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
  onIncludesDinnerChange,
  onIncludesSymposiumChange,
  onAccessGroupChange,
}: TicketTypeDialogSurfaceProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {editingTicketType ? "Edit ticket type" : "Add ticket type"}
      </DialogTitle>
      <DialogContent>
        <TextField
          label="Title"
          fullWidth
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          margin="dense"
          required
        />
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
          <InputLabel id="ticket-audience-label">
            {TICKET_CATEGORY_LABEL}
          </InputLabel>
          <Select
            labelId="ticket-audience-label"
            label={TICKET_CATEGORY_LABEL}
            value={audience}
            disabled={
              organiserOnly || editingTicketType?.audience === ORGANISER_GUEST
            }
            onChange={(event) =>
              onAudienceChange(event.target.value as ManagedTicketAudience)
            }
          >
            <MenuItem disabled={organiserOnly} value={TicketAudience.MEMBER}>
              {getTicketCategoryLabel(TicketAudience.MEMBER)}
            </MenuItem>
            <MenuItem disabled={organiserOnly} value={TicketAudience.GUEST}>
              {getTicketCategoryLabel(TicketAudience.GUEST)}
            </MenuItem>
            <MenuItem
              disabled={Boolean(
                editingTicketType &&
                editingTicketType.audience !== ORGANISER_GUEST,
              )}
              value={ORGANISER_GUEST}
            >
              {getTicketCategoryLabel(ORGANISER_GUEST)}
            </MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Checkbox
              checked={includesDinner}
              onChange={(event) => onIncludesDinnerChange(event.target.checked)}
            />
          }
          label="Dinner"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={includesSymposium}
              onChange={(event) =>
                onIncludesSymposiumChange(event.target.checked)
              }
            />
          }
          label="Symposium"
        />
        {audience === ORGANISER_GUEST ? (
          <>
            <Alert severity="info" sx={{ mt: 2 }}>
              Allocated by event organisers only. Unavailable in member booking;
              no access group is required. Existing reservations retain their
              price and attendance options.
            </Alert>
            {editingTicketType && onActiveChange && (
              <FormControlLabel
                label="Available for new allocations"
                control={
                  <Checkbox
                    checked={active}
                    onChange={(_, value) => onActiveChange(value)}
                  />
                }
              />
            )}
          </>
        ) : (
          <Autocomplete
            options={userGroups}
            getOptionLabel={(option) => option.name}
            value={accessGroup}
            onChange={(_, value) => onAccessGroupChange(value)}
            loading={loadingUserGroups}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Access group"
                required
                margin="dense"
              />
            )}
            sx={{ mt: 1 }}
          />
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={
            submitting ||
            !title.trim() ||
            (audience !== ORGANISER_GUEST && !accessGroup)
          }
        >
          {submitting ? <CircularProgress size={20} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
