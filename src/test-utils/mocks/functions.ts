import { vi } from 'vitest';

/**
 * Firebase Functions mocks
 */
export const mockGetFunctions = vi.fn();
export const mockHttpsCallable = vi.fn();

export const createMockCallableResult = <T>(data: T) => ({
  data,
});

