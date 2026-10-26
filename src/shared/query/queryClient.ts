import { DataConnectReadSupersededError } from "./authoritativeDataConnect";
import { classifyAuthorizationFailure } from "../auth/authorizationFailure";
import { QueryClient, type DefaultError, type DefaultedQueryObserverOptions, type QueryKey, type QueryObserverOptions } from "@tanstack/react-query";
import { isAuthenticationFailure } from "../auth/isAuthenticationFailure";
import { runCapabilityOperation, runSessionRead, SessionChangedError } from "../appShell/sessionLifecycle";

class SessionQueryClient extends QueryClient {
  override defaultQueryOptions<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData,
    TQueryData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = never>(
    options: QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey, TPageParam> |
      DefaultedQueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
  ): DefaultedQueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey> {
    const result = super.defaultQueryOptions(options);
    // Already-defaulted options keep their wrapper. This covers generated React
    // hooks without editing generated source or changing mutation retry behavior.
    if (!options._defaulted && typeof result.queryFn === "function") {
      const queryFn = result.queryFn;
      result.queryFn = context => result.meta?.sessionBoundary === "capability"
        ? runCapabilityOperation(async () => queryFn(context))
        : runSessionRead(() => queryFn(context), undefined, context.signal);
    }
    return result;
  }
}

export function createAppQueryClient() {
  return new SessionQueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => !(error instanceof SessionChangedError) && !(error instanceof DataConnectReadSupersededError) &&
          !classifyAuthorizationFailure(error) && !isAuthenticationFailure(error) && failureCount < 1,
        refetchOnWindowFocus: true,
        staleTime: 30_000,
      },
    },
  });
}
