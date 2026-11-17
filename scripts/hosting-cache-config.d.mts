export interface HostingHeaderRule {
  source?: string;
  regex?: string;
  headers: Array<{ key: string; value: string }>;
}
export interface HostingConfig {
  public: string;
  headers?: HostingHeaderRule[];
  ignore?: string[];
  [key: string]: unknown;
}
export const IMMUTABLE_ASSET_CACHE_CONTROL: string;
export function makeImmutableHostingConfig(hosting: HostingConfig, assetPaths: string[], publicDirectory: string): HostingConfig;
export function createHostingSnapshot(repositoryRoot: string, expected: { environment: string; gitSha: string }): Promise<{
  directory: string;
  configPath: string;
  publicDirectory: string;
  assetPaths: string[];
  remove(): Promise<void>;
}>;
