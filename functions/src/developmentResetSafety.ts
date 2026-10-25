import { getAdminSafetyControl, listSecurityStatesForReconciliation } from "./securityRepository";

export async function assertFreshDevelopmentReset(): Promise<void> {
  const [control, states] = await Promise.all([getAdminSafetyControl(), listSecurityStatesForReconciliation({limit: 1, offset: 0})]);
  if (control.data.adminSafetyControl || states.data.userSecurityStates.length) {
    throw new Error("Online reset is forbidden after current-security bootstrap. Use an isolated fresh project or the reviewed offline reset procedure.");
  }
}
