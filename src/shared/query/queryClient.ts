import { QueryClient } from "@tanstack/react-query";
import { isAuthenticationFailure } from "../auth/isAuthenticationFailure";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Authentication failures are recovered centrally after one coordinated token
      // refresh. Retrying them here would repeat the stale-token request first.
      retry: (failureCount, error) =>
        !isAuthenticationFailure(error) && failureCount < 1,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  },
});
