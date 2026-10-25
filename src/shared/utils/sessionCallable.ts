import { httpsCallable as firebaseHttpsCallable, type Functions, type HttpsCallableOptions } from "firebase/functions";
import { runCapabilityOperation, runSessionOperation, runSessionRead } from "../appShell/sessionLifecycle";

const PUBLIC_CAPABILITIES = new Set(["getOrganiserGuestTicket", "updateOrganiserGuestDietary", "createOrganiserGuestCheckout", "requestPasswordReset"]);
// Capture at invocation (not callable creation). Old completions cannot launch
// another authenticated request or redirect after the document has retired.
export function httpsCallable<Request = unknown, Response = unknown>(functions: Functions, name: string, options?: HttpsCallableOptions) {
  const callable = options ? firebaseHttpsCallable<Request, Response>(functions, name, options) : firebaseHttpsCallable<Request, Response>(functions, name);
  return (...args: [data?: Request]) => (PUBLIC_CAPABILITIES.has(name) ? runCapabilityOperation : /^(get|list|search)/.test(name) ? runSessionRead : runSessionOperation)(() => callable(...args));
}
