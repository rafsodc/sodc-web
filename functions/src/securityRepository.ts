import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getDataConnect } from "firebase-admin/data-connect";
import * as sdk from "@dataconnect/security-admin-generated";
export * from "@dataconnect/security-admin-generated";

/** Firebase Admin 13.10 omits connector ID from its cache key; isolate this connector. */
export function getAuthorizationDataConnect() {
  const name = "current-authorization-data-connect";
  const app = getApps().find(candidate => candidate.name === name) ?? initializeApp(getApp().options, name);
  return getDataConnect(sdk.connectorConfig, app);
}
export const getUserSecurityState = (variables: sdk.GetUserSecurityStateVariables) => sdk.getUserSecurityState(getAuthorizationDataConnect(), variables);
export const getSecurityTransition = (variables: sdk.GetSecurityTransitionVariables) => sdk.getSecurityTransition(getAuthorizationDataConnect(), variables);
export const listPendingSecurityTransitions = (variables: sdk.ListPendingSecurityTransitionsVariables) => sdk.listPendingSecurityTransitions(getAuthorizationDataConnect(), variables);
export const listSecurityStatesForReconciliation = (variables: sdk.ListSecurityStatesForReconciliationVariables) => sdk.listSecurityStatesForReconciliation(getAuthorizationDataConnect(), variables);
export const initializeUserSecurityState = (variables: sdk.InitializeUserSecurityStateVariables) => sdk.initializeUserSecurityState(getAuthorizationDataConnect(), variables);
export const beginSecurityTransition = (variables: sdk.BeginSecurityTransitionVariables) => sdk.beginSecurityTransition(getAuthorizationDataConnect(), variables);
export const completeSecurityTransition = (variables: sdk.CompleteSecurityTransitionVariables) => sdk.completeSecurityTransition(getAuthorizationDataConnect(), variables);
export const recordSecuritySynchronizationFailure = (variables: sdk.RecordSecuritySynchronizationFailureVariables) => sdk.recordSecuritySynchronizationFailure(getAuthorizationDataConnect(), variables);
export const supersedeSecurityTransition = (variables: sdk.SupersedeSecurityTransitionVariables) => sdk.supersedeSecurityTransition(getAuthorizationDataConnect(), variables);

export const getAdminSafetyControl = () => sdk.getAdminSafetyControl(getAuthorizationDataConnect());
export const listReadyAdministrators = () => sdk.listReadyAdministrators(getAuthorizationDataConnect());
export const recordSecurityNoop = (variables: sdk.RecordSecurityNoopVariables) => sdk.recordSecurityNoop(getAuthorizationDataConnect(), variables);
export const createAdminSafetyControl = (variables: sdk.CreateAdminSafetyControlVariables) => sdk.createAdminSafetyControl(getAuthorizationDataConnect(), variables);
export const activateAdminSafetyControl = (variables: sdk.ActivateAdminSafetyControlVariables) => sdk.activateAdminSafetyControl(getAuthorizationDataConnect(), variables);

export const confirmPotentialLostWithAdminSafety = (variables: sdk.ConfirmPotentialLostWithAdminSafetyVariables) => sdk.confirmPotentialLostWithAdminSafety(getAuthorizationDataConnect(), variables);

export const getAdminSafetyAudit = (variables: sdk.GetAdminSafetyAuditVariables) => sdk.getAdminSafetyAudit(getAuthorizationDataConnect(), variables);

export const reconcileAdminSafetyControl = (variables: sdk.ReconcileAdminSafetyControlVariables) => sdk.reconcileAdminSafetyControl(getAuthorizationDataConnect(), variables);
