export type ForgeKind = 'github' | 'forgejo';

export interface RepoRef {
  owner: string;
  name: string;
}

export interface ForgeIdentity {
  login: string;
  avatarUrl?: string;
  profileUrl?: string;
}

export type ForgeErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'rate-limited'
  | 'offline'
  | 'unknown';

export class ForgeError extends Error {
  constructor(
    readonly kind: ForgeErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ForgeError';
  }
}

/**
 * Everything Andon is allowed to know about a forge. GitHub and Forgejo both
 * sit behind this; nothing above it may reach for a forge-specific primitive.
 */
export interface ForgeClient {
  readonly kind: ForgeKind;
  /** Who the token belongs to. Also how we validate a token before storing it. */
  getIdentity(): Promise<ForgeIdentity>;
  /** UTF-8 file contents, or null when the path does not exist on `ref`. */
  getFileText(repo: RepoRef, path: string, ref?: string): Promise<string | null>;
  /** Human-facing URL, for "open this in the forge" links. */
  webUrl(repo: RepoRef, path?: string): string;
}

export interface ForgeConfig {
  kind: ForgeKind;
  token: string;
  /** Instance root for self-hosted forges, e.g. https://codeberg.org. */
  instanceUrl?: string;
}

export function parseRepoRef(slug: string): RepoRef {
  const parts = slug.trim().replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Expected a repo as "owner/name", got "${slug}"`);
  }
  return { owner: parts[0], name: parts[1] };
}

export function formatRepoRef(repo: RepoRef): string {
  return `${repo.owner}/${repo.name}`;
}
