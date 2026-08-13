import { createRestForgeClient, trimTrailingSlash } from './rest';
import type { ForgeClient } from './types';

export interface GitHubOptions {
  token: string;
  /** GitHub Enterprise root, e.g. https://github.acme.com. */
  instanceUrl?: string;
}

export function createGitHubClient({ token, instanceUrl }: GitHubOptions): ForgeClient {
  const enterprise = instanceUrl ? trimTrailingSlash(instanceUrl) : undefined;
  return createRestForgeClient({
    kind: 'github',
    apiUrl: enterprise ? `${enterprise}/api/v3` : 'https://api.github.com',
    webUrl: enterprise ?? 'https://github.com',
    token,
    authHeader: (t) => `Bearer ${t}`,
    accept: 'application/vnd.github+json',
    extraHeaders: { 'X-GitHub-Api-Version': '2022-11-28' },
    recentFirst: { sort: 'updated', direction: 'desc' },
    // GitHub's label endpoints take names, so the shared default is already right.
  });
}
