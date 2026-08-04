import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  changeNotifyReplyToDefault,
  confirmNotifyReplyToVerification,
  createNotifyReplyToAddress,
  getNotifyReplyToAdminConfiguration,
  sendNotifyReplyToVerificationTest,
  setNotifyTemplateReplyToOverride,
  updateNotifyReplyToAddress,
  updateNotifyReplyToAvailability,
  type NotifyReplyToAddress,
  type NotifyReplyToAdminConfiguration,
} from "../../../shared/utils/firebaseFunctions/notifyReplyToConfiguration";
import { reportError, toAdminUserFacingError } from "../../../shared/errors";

const STATUS_LABELS = {
  UNVERIFIED: "Unverified",
  PROVIDER_ACCEPTED: "Test accepted",
  VERIFIED: "Verified",
} as const;

export default function NotifyReplyToSettings() {
  const [configuration, setConfiguration] = useState<NotifyReplyToAdminConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<NotifyReplyToAddress | null>(null);
  const [displayLabel, setDisplayLabel] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [notifyUuid, setNotifyUuid] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setConfiguration(await getNotifyReplyToAdminConfiguration());
    } catch (caught) {
      reportError("admin.notify-reply-to.load", caught);
      setError(toAdminUserFacingError(caught, "email-configuration").message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const usableAddresses = useMemo(
    () => configuration?.addresses.filter((address) =>
      address.enabled && address.verificationStatus === "VERIFIED") ?? [],
    [configuration],
  );

  const run = async (
    label: string,
    action: () => Promise<NotifyReplyToAdminConfiguration>,
  ) => {
    setSaving(true);
    setError(null);
    try {
      setConfiguration(await action());
    } catch (caught) {
      reportError(`admin.notify-reply-to.${label}`, caught);
      setError(toAdminUserFacingError(caught, "email-configuration").message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setEditing(null);
    setDisplayLabel("");
    setEmailAddress("");
    setNotifyUuid("");
  };

  const beginEdit = (address: NotifyReplyToAddress) => {
    setEditing(address);
    setDisplayLabel(address.displayLabel);
    setEmailAddress(address.emailAddress);
    setNotifyUuid(address.notifyUuid);
  };

  const saveAddress = async () => {
    await run(editing ? "update" : "create", () => editing
      ? updateNotifyReplyToAddress({
        addressId: editing.id,
        expectedVersion: editing.version,
        displayLabel,
        emailAddress,
        notifyUuid,
      })
      : createNotifyReplyToAddress({ displayLabel, emailAddress, notifyUuid }));
    resetForm();
  };

  return (
    <Stack spacing={3}>
      <Divider />
      <Box>
        <Typography variant="h5">Reply-to addresses</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Manage the addresses recipients see when they reply. API keys remain deployment secrets;
          only provider reply-to identifiers are stored here.
        </Typography>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>}
      {configuration && !loading && (
        <>
          <Alert severity="info">
            {configuration.configuration.defaultAddressId
              ? "A verified site-wide default is configured."
              : configuration.environmentFallbackConfigured
                ? "No database default is set; the deployment environment fallback is active."
                : "No site-wide default is set; GOV.UK Notify's service default will be used."}
          </Alert>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6">{editing ? "Edit reply-to address" : "Add reply-to address"}</Typography>
            {editing && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Editing resets verification and disables the address. Move the system default first.
              </Alert>
            )}
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField label="Display label" value={displayLabel} onChange={(event) => setDisplayLabel(event.target.value)} />
              <TextField label="Email address" type="email" value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} />
              <TextField label="GOV.UK Notify reply-to UUID" value={notifyUuid} onChange={(event) => setNotifyUuid(event.target.value)} />
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  disabled={saving || !displayLabel.trim() || !emailAddress.trim() || !notifyUuid.trim()}
                  onClick={() => void saveAddress()}
                >
                  {editing ? "Save and reverify" : "Add address"}
                </Button>
                {editing && <Button onClick={resetForm} disabled={saving}>Cancel</Button>}
              </Stack>
            </Stack>
          </Paper>

          <Stack spacing={2}>
            {configuration.addresses.length === 0 && (
              <Typography color="text.secondary">No reply-to addresses have been added.</Typography>
            )}
            {configuration.addresses.map((address) => {
              const isDefault = configuration.configuration.defaultAddressId === address.id;
              return (
                <Paper key={address.id} variant="outlined" sx={{ p: 3 }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="h6">{address.displayLabel}</Typography>
                        <Chip size="small" label={STATUS_LABELS[address.verificationStatus]} color={address.verificationStatus === "VERIFIED" ? "success" : "default"} />
                        {address.enabled && <Chip size="small" label="Enabled" color="primary" />}
                        {isDefault && <Chip size="small" label="System default" />}
                        {address.announcementSelectable && <Chip size="small" label="Announcements" />}
                      </Stack>
                      <Typography>{address.emailAddress}</Typography>
                      <Typography variant="body2" color="text.secondary">Notify UUID: {address.notifyUuid}</Typography>
                      {address.providerAcceptedAt && (
                        <Typography variant="caption" color="text.secondary">
                          Test accepted {new Date(address.providerAcceptedAt).toLocaleString()}
                          {address.verificationMode ? ` in ${address.verificationMode.replace("_", " ")} mode` : ""}.
                        </Typography>
                      )}
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" alignContent="flex-start">
                      <Button size="small" onClick={() => beginEdit(address)} disabled={saving || isDefault}>Edit</Button>
                      {address.verificationStatus !== "VERIFIED" && (
                        <Button size="small" disabled={saving} onClick={() => void run("test", () => sendNotifyReplyToVerificationTest({
                          addressId: address.id, expectedVersion: address.version,
                        }))}>Send test</Button>
                      )}
                      {address.verificationStatus === "PROVIDER_ACCEPTED" && (
                        <Button size="small" variant="outlined" disabled={saving} onClick={() => void run("confirm", () => confirmNotifyReplyToVerification({
                          addressId: address.id, expectedVersion: address.version,
                        }))}>Confirm Reply-To</Button>
                      )}
                      {address.verificationStatus === "VERIFIED" && (
                        <Button size="small" disabled={saving} onClick={() => void run("availability", () => updateNotifyReplyToAvailability({
                          addressId: address.id,
                          expectedVersion: address.version,
                          expectedConfigurationVersion: configuration.configuration.version,
                          enabled: !address.enabled,
                          announcementSelectable: address.enabled ? false : address.announcementSelectable,
                          clearDefault: isDefault && address.enabled,
                        }))}>{address.enabled ? "Disable" : "Enable"}</Button>
                      )}
                      {address.enabled && (
                        <Button size="small" disabled={saving} onClick={() => void run("announcement", () => updateNotifyReplyToAvailability({
                          addressId: address.id,
                          expectedVersion: address.version,
                          expectedConfigurationVersion: configuration.configuration.version,
                          enabled: true,
                          announcementSelectable: !address.announcementSelectable,
                        }))}>{address.announcementSelectable ? "Remove from announcements" : "Allow for announcements"}</Button>
                      )}
                      {address.enabled && !isDefault && (
                        <Button size="small" disabled={saving} onClick={() => void run("default", () => changeNotifyReplyToDefault({
                          addressId: address.id,
                          expectedVersion: configuration.configuration.version,
                        }))}>Make default</Button>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>

          {configuration.configuration.defaultAddressId && (
            <Button
              color="warning"
              disabled={saving}
              onClick={() => void run("clear-default", () => changeNotifyReplyToDefault({
                clearDefault: true,
                expectedVersion: configuration.configuration.version,
              }))}
            >
              Clear system default
            </Button>
          )}

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6">Automated email overrides</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Leave a template on the system default unless replies need to go elsewhere.
            </Typography>
            <Stack spacing={2}>
              {configuration.templateKeys.map((templateKey) => {
                const override = configuration.templateOverrides.find((row) => row.templateKey === templateKey);
                return (
                  <FormControl key={templateKey} fullWidth size="small">
                    <InputLabel id={`reply-to-${templateKey}`}>{templateKey}</InputLabel>
                    <Select
                      labelId={`reply-to-${templateKey}`}
                      label={templateKey}
                      value={override?.addressId ?? ""}
                      disabled={saving}
                      onChange={(event) => void run("template-override", () => setNotifyTemplateReplyToOverride({
                        templateKey,
                        addressId: event.target.value || undefined,
                      }))}
                    >
                      <MenuItem value="">System default</MenuItem>
                      {usableAddresses.map((address) => (
                        <MenuItem key={address.id} value={address.id}>
                          {address.displayLabel} — {address.emailAddress}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                );
              })}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Recent reply-to changes</Typography>
            {configuration.audits.length === 0
              ? <Typography color="text.secondary">No changes recorded.</Typography>
              : configuration.audits.map((audit) => (
                <Box key={audit.id} sx={{ py: 1.5, borderTop: 1, borderColor: "divider" }}>
                  <Typography>{audit.action.replaceAll("_", " ")}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(audit.changedAt).toLocaleString()} · {audit.changedBy}
                    {audit.templateKey ? ` · ${audit.templateKey}` : ""}
                  </Typography>
                  {audit.reason && <Typography variant="body2">{audit.reason}</Typography>}
                </Box>
              ))}
          </Paper>
        </>
      )}
    </Stack>
  );
}
