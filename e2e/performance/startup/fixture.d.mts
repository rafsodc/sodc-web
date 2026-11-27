import type { BrowserContext } from '@playwright/test';

export const fixture: Readonly<{
  uid: string;
  email: string;
  sectionId: string;
  eventId: string;
  groupId: string;
  ticketId: string;
  sectionName: string;
  eventTitle: string;
  apiKey: string;
  projectId: string;
  guestToken: string;
}>;

export interface SyntheticTransportEntry {
  method: string;
  origin: string;
  path: string;
  operation: string | null;
  reason?: string;
}

export interface SyntheticTransportLedger {
  synthetic: SyntheticTransportEntry[];
  blocked: SyntheticTransportEntry[];
}

export function installSyntheticTransport(
  context: BrowserContext,
  localOrigin: string,
  ledger: SyntheticTransportLedger,
  options?: {
    journey?: 'member' | 'admin' | 'public' | 'guest' | 'register' | 'reset';
    deployment?: 'measurement' | 'recovery';
  },
): Promise<void>;
