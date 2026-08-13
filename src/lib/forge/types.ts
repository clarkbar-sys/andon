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

export type IssueState = 'open' | 'closed';

/** An issue on the belt. Station position is a label, so labels come along. */
export interface Issue {
  number: number;
  title: string;
  body: string;
  state: IssueState;
  labels: string[];
  author: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface PullRequest {
  number: number;
  title: string;
  body: string;
  state: IssueState;
  merged: boolean;
  mergedAt: string | null;
  author: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  /** Issues this PR closes, from `closes #N` keywords in its title and body. */
  closes: number[];
}

/**
 * An issue that fell off the end of the belt. `closedBy` is the merged PR that
 * closed it — null means it went to the compost bin and scores nothing.
 */
export interface ClosedIssue {
  issue: Issue;
  closedBy: PullRequest | null;
}

/** Last rate-limit budget the forge reported. Null until a request has run. */
export interface RateLimit {
  limit: number | null;
  remaining: number | null;
  /** Epoch ms when the window resets. */
  resetAt: number | null;
}

export interface ListIssuesOptions {
  /** Defaults to open — the belt only carries live work. */
  state?: IssueState | 'all';
  /** ISO timestamp; only issues updated at or after it. */
  since?: string;
}

export interface ListPullRequestsOptions {
  state?: IssueState | 'all';
}

/**
 * Everything Andon is allowed to know about a forge. GitHub and Forgejo both
 * sit behind this; nothing above it may reach for a forge-specific primitive.
 *
 * Shaped by what the belt needs (SCOPE.md decision 2) and sized to Forgejo's
 * API, which is the narrower of the two.
 */
export interface ForgeClient {
  readonly kind: ForgeKind;
  /** Who the token belongs to. Also how we validate a token before storing it. */
  getIdentity(): Promise<ForgeIdentity>;
  /** UTF-8 file contents, or null when the path does not exist on `ref`. */
  getFileText(repo: RepoRef, path: string, ref?: string): Promise<string | null>;
  /** Human-facing URL, for "open this in the forge" links. */
  webUrl(repo: RepoRef, path?: string): string;

  /** Issues only — pull requests are never on the belt. */
  listIssues(repo: RepoRef, options?: ListIssuesOptions): Promise<Issue[]>;
  /** Moving an issue between stations is two calls; the forge has no swap. */
  addLabel(repo: RepoRef, issue: number, label: string): Promise<void>;
  removeLabel(repo: RepoRef, issue: number, label: string): Promise<void>;
  /** A station's voice: classification notes, scoping output, review nudges. */
  commentOnIssue(repo: RepoRef, issue: number, body: string): Promise<void>;
  commentOnPullRequest(repo: RepoRef, pull: number, body: string): Promise<void>;

  listPullRequests(repo: RepoRef, options?: ListPullRequestsOptions): Promise<PullRequest[]>;
  /** Merge state for one PR — `merged` is what scoring turns on. */
  getPullRequest(repo: RepoRef, pull: number): Promise<PullRequest>;
  /** PRs whose closing keywords name this issue, open or not. */
  listPullRequestsClosing(repo: RepoRef, issue: number): Promise<PullRequest[]>;
  /** Issues closed since `since`, each paired with the PR that closed it. */
  listClosedIssues(repo: RepoRef, since?: string): Promise<ClosedIssue[]>;

  /** What the forge said about the polling budget on the last request. */
  rateLimit(): RateLimit | null;
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
