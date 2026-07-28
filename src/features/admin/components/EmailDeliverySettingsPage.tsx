import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PageHeader from "../../../shared/components/PageHeader";
import type { GovNotifyDeliveryMode } from "../../../shared/utils/firebaseFunctions/announcements";
import {
  getGovNotifyDeliveryAdminConfiguration,
  updateGovNotifyDeliveryMode,
  type GovNotifyDeliveryAdminConfiguration,
} from "../../../shared/utils/firebaseFunctions/govNotifyDeliveryConfiguration";
import "../../../shared/components/PageContainer.css";

const MODES: GovNotifyDeliveryMode[] = ["SIMULATION", "TEAM_TEST", "LIVE"];
const RANK: Record<GovNotifyDeliveryMode, number> = {
  SIMULATION: 0,
  TEAM_TEST: 1,
  LIVE: 2,
};
const LABELS: Record<GovNotifyDeliveryMode, string> = {
  SIMULATION: "Simulation",
  TEAM_TEST: "Team test",
  LIVE: "Live",
};
const DESCRIPTIONS: Record<GovNotifyDeliveryMode, string> = {
  SIMULATION: "Notify accepts requests using its test key; no email is delivered.",
  TEAM_TEST: "Emails are delivered only to addresses on the Notify service team.",
  LIVE: "Emails may be delivered to every intended recipient.",
};

interface Props {
  onBack: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The operation could not be completed.";
}

export default function EmailDeliverySettingsPage({ onBack }: Props) {
  const [configuration, setConfiguration] =
    useState<GovNotifyDeliveryAdminConfiguration | null>(null);
  const [selectedMode, setSelectedMode] = useState<GovNotifyDeliveryMode>("SIMULATION");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getGovNotifyDeliveryAdminConfiguration();
      setConfiguration(result);
      setSelectedMode(result.runtimeMode);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const isMorePermissive = useMemo(
    () => configuration ? RANK[selectedMode] > RANK[configuration.runtimeMode] : false,
    [configuration, selectedMode],
  );
  const canSave = Boolean(
    configuration &&
    selectedMode !== configuration.runtimeMode &&
    reason.trim().length >= 5 &&
    RANK[selectedMode] <= RANK[configuration.deploymentCeiling],
  );

  const save = async () => {
    if (!configuration || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateGovNotifyDeliveryMode(
        selectedMode,
        configuration.version,
        reason.trim(),
      );
      setConfiguration(result);
      setSelectedMode(result.runtimeMode);
      setReason("");
      setConfirmOpen(false);
    } catch (saveError) {
      setError(errorMessage(saveError));
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box className="page-container">
      <PageHeader title="Email delivery" onBack={onBack} />
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Control the maximum delivery mode used by all GOV.UK Notify emails from this site.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>}

      {configuration && !loading && (
        <Stack spacing={3}>
          <Alert severity={configuration.effectiveSiteMode === "LIVE" ? "warning" : "info"}>
            Current effective site mode: <strong>{LABELS[configuration.effectiveSiteMode]}</strong>.
            The deployment ceiling is <strong>{LABELS[configuration.deploymentCeiling]}</strong>.
          </Alert>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <FormControl>
              <FormLabel id="email-delivery-mode-label">Site-wide delivery mode</FormLabel>
              <RadioGroup
                aria-labelledby="email-delivery-mode-label"
                value={selectedMode}
                onChange={(event) => setSelectedMode(event.target.value as GovNotifyDeliveryMode)}
              >
                {MODES.map((mode) => (
                  <FormControlLabel
                    key={mode}
                    value={mode}
                    disabled={RANK[mode] > RANK[configuration.deploymentCeiling]}
                    control={<Radio />}
                    label={
                      <Box sx={{ py: 0.5 }}>
                        <Typography fontWeight={600}>{LABELS[mode]}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {DESCRIPTIONS[mode]}
                          {RANK[mode] > RANK[configuration.deploymentCeiling]
                            ? " Disabled by the deployment ceiling."
                            : ""}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </RadioGroup>
            </FormControl>
            <TextField
              fullWidth
              label="Reason for change"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              inputProps={{ maxLength: 500 }}
              helperText="Required for the audit trail (at least 5 characters)."
              sx={{ mt: 2 }}
            />
            <Button
              variant="contained"
              disabled={!canSave || saving}
              onClick={() => isMorePermissive ? setConfirmOpen(true) : void save()}
              sx={{ mt: 2 }}
            >
              Save delivery mode
            </Button>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Recent changes</Typography>
            {configuration.audits.length === 0 ? (
              <Typography color="text.secondary">No delivery mode changes have been recorded.</Typography>
            ) : configuration.audits.map((audit) => (
              <Box key={audit.id} sx={{ py: 1.5, borderTop: 1, borderColor: "divider" }}>
                <Typography>
                  {LABELS[audit.previousMode]} → {LABELS[audit.newMode]}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(audit.changedAt).toLocaleString()} · {audit.changedBy}
                </Typography>
                <Typography variant="body2">{audit.reason}</Typography>
              </Box>
            ))}
          </Paper>
        </Stack>
      )}

      <Dialog open={confirmOpen} onClose={() => !saving && setConfirmOpen(false)}>
        <DialogTitle>Increase email delivery scope?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            Changing to {LABELS[selectedMode]} can deliver email to more recipients.
            Confirm that this is intentional.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={() => void save()} disabled={saving}>
            Confirm change
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
