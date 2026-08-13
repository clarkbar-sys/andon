import { createRestForgeClient, trimTrailingSlash, type Rest } from './rest';
import { ForgeError, formatRepoRef, type ForgeClient, type RepoRef } from './types';

export interface ForgejoOptions {
  token: string;
  /** Instance root, e.g. https://codeberg.org. Forgejo has no public default. */
  instanceUrl: string;
}

interface RawLabel {
  id: number;
  name: string;
}

export function createForgejoClient({ token, instanceUrl }: ForgejoOptions): ForgeClient {
  const root = trimTrailingSlash(instanceUrl);
  const labelIds = new Map<string, Map<string, number>>();

  /**
   * Forgejo addresses labels by id, not name. Ids are stable per repo, so the
   * lookup is cached and only re-read when a name misses — which is what a
   * label created after the app loaded looks like.
   */
  async function labelRef(rest: Rest, repo: RepoRef, label: string): Promise<number> {
    const slug = formatRepoRef(repo);
    const cached = labelIds.get(slug)?.get(label);
    if (cached !== undefined) return cached;

    const labels = await rest.list<RawLabel>(
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/labels`,
    );
    const fresh = new Map(labels.map((entry) => [entry.name, entry.id]));
    labelIds.set(slug, fresh);

    const id = fresh.get(label);
    if (id === undefined) {
      // Unlike GitHub, Forgejo will not conjure a label on first use.
      throw new ForgeError('not-found', `No label "${label}" on ${slug} — create it on the instance first.`);
    }
    return id;
  }

  return createRestForgeClient({
    kind: 'forgejo',
    apiUrl: `${root}/api/v1`,
    webUrl: root,
    token,
    authHeader: (t) => `token ${t}`,
    accept: 'application/json',
    recentFirst: { sort: 'recentupdate' },
    labelRef,
  });
}
