const { validateAdminArgs } = require('firebase-admin/data-connect');

const AdminSafetyStatus = {
  BOOTSTRAP: "BOOTSTRAP",
  READY: "READY",
  RECOVERY_REQUIRED: "RECOVERY_REQUIRED",
}
exports.AdminSafetyStatus = AdminSafetyStatus;

const MembershipStatus = {
  PENDING: "PENDING",
  REGULAR: "REGULAR",
  RESERVE: "RESERVE",
  CIVIL_SERVICE: "CIVIL_SERVICE",
  INDUSTRY: "INDUSTRY",
  RETIRED: "RETIRED",
  RESIGNED: "RESIGNED",
  LOST: "LOST",
  DECEASED: "DECEASED",
}
exports.MembershipStatus = MembershipStatus;

const SecurityActorKind = {
  ADMIN: "ADMIN",
  SELF: "SELF",
  SELF_VERIFICATION: "SELF_VERIFICATION",
  OPERATOR: "OPERATOR",
  DRIFT: "DRIFT",
}
exports.SecurityActorKind = SecurityActorKind;

const SecuritySyncStatus = {
  PENDING: "PENDING",
  READY: "READY",
  SUPERSEDED: "SUPERSEDED",
}
exports.SecuritySyncStatus = SecuritySyncStatus;

const connectorConfig = {
  connector: 'authorization-service',
  serviceId: 'sodc-web-service',
  location: 'europe-west2'
};
exports.connectorConfig = connectorConfig;

function getUserSecurityState(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetUserSecurityState', inputVars, inputOpts);
}
exports.getUserSecurityState = getUserSecurityState;

function getSecurityTransition(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetSecurityTransition', inputVars, inputOpts);
}
exports.getSecurityTransition = getSecurityTransition;

function listPendingSecurityTransitions(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListPendingSecurityTransitions', inputVars, inputOpts);
}
exports.listPendingSecurityTransitions = listPendingSecurityTransitions;

function initializeUserSecurityState(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('InitializeUserSecurityState', inputVars, inputOpts);
}
exports.initializeUserSecurityState = initializeUserSecurityState;

function initializePendingEmailHold(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('InitializePendingEmailHold', inputVars, inputOpts);
}
exports.initializePendingEmailHold = initializePendingEmailHold;

function beginSecurityTransition(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('BeginSecurityTransition', inputVars, inputOpts);
}
exports.beginSecurityTransition = beginSecurityTransition;

function recordSecurityNoop(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordSecurityNoop', inputVars, inputOpts);
}
exports.recordSecurityNoop = recordSecurityNoop;

function completeSecurityTransition(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CompleteSecurityTransition', inputVars, inputOpts);
}
exports.completeSecurityTransition = completeSecurityTransition;

function recordSecuritySynchronizationFailure(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordSecuritySynchronizationFailure', inputVars, inputOpts);
}
exports.recordSecuritySynchronizationFailure = recordSecuritySynchronizationFailure;

function supersedeSecurityTransition(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SupersedeSecurityTransition', inputVars, inputOpts);
}
exports.supersedeSecurityTransition = supersedeSecurityTransition;

function listSecurityStatesForReconciliation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListSecurityStatesForReconciliation', inputVars, inputOpts);
}
exports.listSecurityStatesForReconciliation = listSecurityStatesForReconciliation;

function getAdminSafetyControl(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAdminSafetyControl', undefined, inputOpts);
}
exports.getAdminSafetyControl = getAdminSafetyControl;

function listReadyAdministrators(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListReadyAdministrators', undefined, inputOpts);
}
exports.listReadyAdministrators = listReadyAdministrators;

function createAdminSafetyControl(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateAdminSafetyControl', inputVars, inputOpts);
}
exports.createAdminSafetyControl = createAdminSafetyControl;

function activateAdminSafetyControl(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ActivateAdminSafetyControl', inputVars, inputOpts);
}
exports.activateAdminSafetyControl = activateAdminSafetyControl;

function confirmPotentialLostWithAdminSafety(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ConfirmPotentialLostWithAdminSafety', inputVars, inputOpts);
}
exports.confirmPotentialLostWithAdminSafety = confirmPotentialLostWithAdminSafety;

function getAdminSafetyAudit(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetAdminSafetyAudit', inputVars, inputOpts);
}
exports.getAdminSafetyAudit = getAdminSafetyAudit;

function reconcileAdminSafetyControl(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ReconcileAdminSafetyControl', inputVars, inputOpts);
}
exports.reconcileAdminSafetyControl = reconcileAdminSafetyControl;

