import { createForgejoClient } from './forgejo';
import { createGitHubClient } from './github';
import type { ForgeClient, ForgeConfig } from './types';

export * from './types';
export { createGitHubClient } from './github';
export { createForgejoClient } from './forgejo';

export function createForgeClient(config: ForgeConfig): ForgeClient {
  if (config.kind === 'forgejo') {
    if (!config.instanceUrl) {
      throw new Error('Forgejo needs an instance URL — there is no default host.');
    }
    return createForgejoClient({ token: config.token, instanceUrl: config.instanceUrl });
  }
  return createGitHubClient({ token: config.token, instanceUrl: config.instanceUrl });
}
