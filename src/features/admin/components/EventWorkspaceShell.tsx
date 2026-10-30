import { useId, useState, type ReactNode } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import {
  CalendarMonthOutlined,
  HistoryOutlined,
  IosShareOutlined,
  LocationOnOutlined,
  OpenInNewOutlined,
} from "@mui/icons-material";
import {
  eventManagementPath,
  memberEventPath,
  sectionManagementPath,
  sectionPath,
  type EventManagementTask,
} from "../../../shared/navigation/sectionRoutes";
import {
  formatSectionEventDate,
  formatSectionEventTime,
} from "../../../shared/utils/sectionEventDisplay";
import type { EventRow } from "./sectionEventsManagerTypes";

export interface EventWorkspaceShellProps {
  event: EventRow;
  sectionId: string;
  sectionName: string;
  selectedTask: EventManagementTask;
  pendingCount?: number;
  children: ReactNode;
}

const workspaceTabs = [
  { task: "overview", label: "Overview" },
  { task: "details", label: "Event details" },
  { task: "attendees", label: "Tickets & attendees" },
  { task: "approvals", label: "Approvals" },
  { task: "communications", label: "Communications" },
  { task: "payments", label: "Payments" },
] as const;
type WorkspaceTask = (typeof workspaceTabs)[number]["task"];

function workspaceTask(task: EventManagementTask): WorkspaceTask | false {
  if (["tickets", "attendees", "removed", "guests"].includes(task)) return "attendees";
  if (["announcement", "communications"].includes(task)) return "communications";
  if (task === "activity") return false;
  return workspaceTabs.find((tab) => tab.task === task)?.task ?? "overview";
}

function bookingWindowStatus(event: EventRow): {
  label: string;
  color: "default" | "success" | "warning";
} {
  const opens = new Date(event.bookingStartDateTime).getTime();
  const closes = new Date(event.bookingEndDateTime).getTime();
  if (!Number.isFinite(opens) || !Number.isFinite(closes) || closes < opens) {
    return { label: "Booking dates unavailable", color: "default" };
  }
  if (Date.now() < opens) return { label: "Bookings not yet open", color: "warning" };
  if (Date.now() > closes) return { label: "Bookings closed", color: "default" };
  return { label: "Bookings open", color: "success" };
}

/** The task is URL controlled; all navigation remains a normal, shareable link. */
export default function EventWorkspaceShell({
  event,
  sectionId,
  sectionName,
  selectedTask,
  pendingCount,
  children,
}: EventWorkspaceShellProps) {
  const narrow = useMediaQuery("(max-width:600px)");
  const navigate = useNavigate();
  const id = useId();
  const selected = workspaceTask(selectedTask);
  const panelId = `${id}-panel`;
  const sectionLabelId = `${id}-section-label`;
  const activityId = `${id}-activity`;
  const selectedLabel = selected === false ? "Activity" : workspaceTabs.find((tab) => tab.task === selected)?.label;
  const [shareFeedback, setShareFeedback] = useState("");
  const [manualShareUrl, setManualShareUrl] = useState<string | null>(null);
  const status = bookingWindowStatus(event);
  const approvalsLabel =
    pendingCount === undefined ? "Approvals" : `Approvals (${pendingCount})`;

  const share = async () => {
    // Includes the active task, filters, editor and fragment rather than a root URL.
    const url = window.location.href;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setShareFeedback("Page link copied.");
    } catch {
      setShareFeedback("Copy the page link from the dialog.");
      setManualShareUrl(url);
    }
  };

  return (
    <Box sx={{ minWidth: 0 }}>
      <Paper variant="outlined" sx={{ overflow: "hidden", mb: 3 }}>
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Breadcrumbs aria-label="Event breadcrumbs" sx={{ mb: 2, fontSize: "0.8rem" }}>
            <Link component={RouterLink} to="/sections" color="inherit">Sections</Link>
            <Link component={RouterLink} to={sectionPath(sectionId)} color="inherit">{sectionName}</Link>
            <Link component={RouterLink} to={sectionManagementPath(sectionId, "events")} color="inherit">Events</Link>
            <Typography component="span" fontSize="inherit" color="text.primary">Manage event</Typography>
          </Breadcrumbs>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
                <Typography variant="overline" color="text.secondary">Manage event</Typography>
                <Chip size="small" variant="outlined" label={status.label} color={status.color} />
              </Stack>
              <Typography variant="h4" component="h1" sx={{ overflowWrap: "anywhere", mb: 1, fontSize: { xs: "1.5rem", sm: "2.125rem" } }}>
                {event.title}
              </Typography>
              <Stack direction="row" gap={2} flexWrap="wrap" color="text.secondary">
                <Stack direction="row" gap={0.75} alignItems="flex-start">
                  <CalendarMonthOutlined fontSize="small" aria-hidden="true" />
                  <Typography variant="body2">
                    {formatSectionEventDate(event.startDateTime, event.endDateTime)}
                    {" · "}{formatSectionEventTime(event.startDateTime, event.endDateTime)}
                  </Typography>
                </Stack>
                {event.location?.trim() && (
                  <Stack direction="row" gap={0.75} alignItems="flex-start">
                    <LocationOnOutlined fontSize="small" aria-hidden="true" />
                    <Typography variant="body2">{event.location.trim()}</Typography>
                  </Stack>
                )}
              </Stack>
            </Box>
            <Stack direction="row" gap={1} alignItems="flex-start" flexWrap="wrap" sx={{ flexShrink: 0 }}>
              <Button component={RouterLink} to={memberEventPath(sectionId, event.id)} size="small" startIcon={<OpenInNewOutlined />}>
                View event
              </Button>
              <Button size="small" onClick={() => void share()} startIcon={<IosShareOutlined />}>Share</Button>
              <Button
                id={activityId}
                component={RouterLink}
                to={eventManagementPath(sectionId, event.id, "activity")}
                size="small"
                startIcon={<HistoryOutlined />}
                aria-current={selectedTask === "activity" ? "page" : undefined}
                aria-controls={selectedTask === "activity" ? panelId : undefined}
                variant={selectedTask === "activity" ? "outlined" : "text"}
              >
                Activity
              </Button>
            </Stack>
          </Stack>
          <Box role="status" aria-live="polite" sx={{ color: "text.secondary", fontSize: "0.875rem", mt: shareFeedback ? 1 : 0 }}>
            {shareFeedback}
          </Box>
        </Box>
        {narrow ? (
          <FormControl size="small" fullWidth sx={{ px: 2, pb: 2 }}>
            <InputLabel id={sectionLabelId} sx={{ left: 16 }}>Event section</InputLabel>
            <Select
              labelId={sectionLabelId}
              id={`${id}-section`}
              label="Event section"
              value={selected || "activity"}
              onChange={(change) => navigate(eventManagementPath(sectionId, event.id, change.target.value as EventManagementTask))}
              inputProps={{ "aria-controls": panelId }}
            >
              {workspaceTabs.map((tab) => (
                <MenuItem key={tab.task} value={tab.task}>{tab.task === "approvals" ? approvalsLabel : tab.label}</MenuItem>
              ))}
              {selected === false && <MenuItem value="activity">Activity</MenuItem>}
            </Select>
          </FormControl>
        ) : (
          <Tabs
            value={selected}
            aria-label="Event sections"
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            textColor="secondary"
            indicatorColor="secondary"
            sx={{ px: 1, borderTop: 1, borderColor: "divider" }}
          >
            {workspaceTabs.map((tab) => (
              <Tab
                key={tab.task}
                value={tab.task}
                label={tab.task === "approvals" ? approvalsLabel : tab.label}
                id={`${id}-tab-${tab.task}`}
                aria-controls={panelId}
                component={RouterLink}
                to={eventManagementPath(sectionId, event.id, tab.task)}
                sx={{ textTransform: "none", minHeight: 52 }}
              />
            ))}
          </Tabs>
        )}
      </Paper>
      <Box
        role={selected === false ? "region" : "tabpanel"}
        id={panelId}
        aria-labelledby={narrow ? undefined : selected === false ? activityId : `${id}-tab-${selected}`}
        aria-label={narrow ? selectedLabel : undefined}
        tabIndex={0}
        sx={{ minWidth: 0, outlineOffset: 4 }}
      >
        {children}
      </Box>
      <Dialog open={manualShareUrl !== null} onClose={() => setManualShareUrl(null)} fullWidth maxWidth="sm">
        <DialogTitle>Copy page link</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>Your browser could not copy the link automatically. Select and copy this complete page address.</DialogContentText>
          <TextField
            label="Page link"
            value={manualShareUrl ?? ""}
            fullWidth
            autoFocus
            onFocus={(focus) => focus.target.select()}
            slotProps={{ input: { readOnly: true } }}
          />
        </DialogContent>
        <DialogActions><Button onClick={() => setManualShareUrl(null)}>Done</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
