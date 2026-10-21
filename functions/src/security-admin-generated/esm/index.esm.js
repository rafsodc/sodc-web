import { validateAdminArgs } from 'firebase-admin/data-connect';

export const MembershipStatus = {
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

export const SecuritySyncStatus = {
  PENDING: "PENDING",
  READY: "READY",
  SUPERSEDED: "SUPERSEDED",
}

export const connectorConfig = {
  connector: 'authorization-service',
  serviceId: 'sodc-web-service',
  location: 'europe-west2'
};

export function getUserSecurityState(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetUserSecurityState', inputVars, inputOpts);
}

export function getSecurityTransition(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetSecurityTransition', inputVars, inputOpts);
}

export function listPendingSecurityTransitions(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListPendingSecurityTransitions', inputVars, inputOpts);
}

export function initializeUserSecurityState(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('InitializeUserSecurityState', inputVars, inputOpts);
}

export function beginSecurityTransition(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('BeginSecurityTransition', inputVars, inputOpts);
}

export function completeSecurityTransition(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CompleteSecurityTransition', inputVars, inputOpts);
}

export function recordSecuritySynchronizationFailure(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordSecuritySynchronizationFailure', inputVars, inputOpts);
}

export function supersedeSecurityTransition(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SupersedeSecurityTransition', inputVars, inputOpts);
}

export function listSecurityStatesForReconciliation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListSecurityStatesForReconciliation', inputVars, inputOpts);
}

