import { createRestForgeClient, trimTrailingSlash } from './rest';
import type { ForgeClient } from './types';

export interface ForgejoOptions {
  token: string;
  /** Instance root, e.g. https://codeberg.org. Forgejo has no public default. */
  instanceUrl: string;
}

export function createForgejoClient({ token, instanceUrl }: ForgejoOptions): ForgeClient {
  const root = trimTrailingSlash(instanceUrl);
  return createRestForgeClient({
    kind: 'forgejo',
    apiUrl: `${root}/api/v1`,
    webUrl: root,
    token,
    authHeader: (t) => `token ${t}`,
    accept: 'application/json',
  });
}
