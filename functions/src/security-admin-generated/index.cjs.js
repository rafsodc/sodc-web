const { validateAdminArgs } = require('firebase-admin/data-connect');

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

function beginSecurityTransition(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('BeginSecurityTransition', inputVars, inputOpts);
}
exports.beginSecurityTransition = beginSecurityTransition;

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

