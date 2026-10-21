import { classifyAuthorizationFailure } from "../auth/authorizationFailure";
import { QueryClient } from "@tanstack/react-query";
import { isAuthenticationFailure } from "../auth/isAuthenticationFailure";
import { SessionChangedError } from "../appShell/sessionLifecycle";

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => !(error instanceof SessionChangedError) &&
          !classifyAuthorizationFailure(error) && !isAuthenticationFailure(error) && failureCount < 1,
        refetchOnWindowFocus: true,
        staleTime: 30_000,
      },
    },
  });
}
