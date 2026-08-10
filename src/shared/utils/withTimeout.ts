export class OperationTimeoutError extends Error {
  readonly code = "operation-timeout";
  readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number) {
    super(message);
    this.name = "OperationTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new OperationTimeoutError(message, timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  });
}
