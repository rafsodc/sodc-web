import { useCallback, useEffect, useMemo, useRef } from "react";

export interface LatestRequestGuard {
  start: () => number;
  isCurrent: (token: number) => boolean;
  invalidate: () => void;
}

/**
 * Prevents an obsolete asynchronous request from committing state after a
 * newer request, explicit invalidation, or component unmount.
 *
 * Callers continue to own request execution and all data/loading/error state.
 */
export function useLatestRequestGuard(): LatestRequestGuard {
  const latestTokenRef = useRef(0);

  const start = useCallback(() => {
    latestTokenRef.current += 1;
    return latestTokenRef.current;
  }, []);

  const isCurrent = useCallback(
    (token: number) => latestTokenRef.current === token,
    [],
  );

  const invalidate = useCallback(() => {
    latestTokenRef.current += 1;
  }, []);

  useEffect(() => () => {
    invalidate();
  }, [invalidate]);

  return useMemo(
    () => ({ start, isCurrent, invalidate }),
    [start, isCurrent, invalidate],
  );
}
