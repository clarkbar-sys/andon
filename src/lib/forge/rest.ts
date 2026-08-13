import { parseClosingRefs } from './linkage';
import {
  ForgeError,
  type ClosedIssue,
  type ForgeClient,
  type ForgeIdentity,
  type ForgeKind,
  type Issue,
  type ListIssuesOptions,
  type ListPullRequestsOptions,
  type PullRequest,
  type RateLimit,
  type RepoRef,
} from './types';

/** Both forges cap page size at 100 and both understand `page`. */
const PAGE_SIZE = 100;
/** A belt is one repo; 1000 items is far past where the game stops being fun. */
const MAX_PAGES = 10;

export type QueryParams = Record<string, string | number | undefined>;

export interface RestInit {
  method?: string;
  body?: unknown;
  params?: QueryParams;
}

/** The slice of the transport a forge spec needs to answer its own questions. */
export interface Rest {
  json<T>(path: string, init?: RestInit): Promise<T>;
  list<T>(path: string, params?: QueryParams): Promise<T[]>;
}

/**
 * GitHub and Forgejo expose the same REST shapes for everything v1 needs
 * (`/user`, `/contents`, `/issues`, `/pulls`, `/labels`), so the adapters
 * differ only in these fields.
 */
export interface RestForgeSpec {
  kind: ForgeKind;
  /** Root of the REST API, no trailing slash. */
  apiUrl: string;
  /** Root of the web UI, no trailing slash. */
  webUrl: string;
  token: string;
  authHeader(token: string): string;
  accept: string;
  extraHeaders?: Record<string, string>;
  /** Query params that order a list newest-updated-first. */
  recentFirst: QueryParams;
  /**
   * How the forge names a label in label URLs and bodies. GitHub takes the
   * name; Forgejo takes the numeric id, so it has to look one up.
   */
  labelRef?(rest: Rest, repo: RepoRef, label: string): Promise<string | number>;
}

interface ContentsResponse {
  content?: string;
  encoding?: string;
}

interface UserResponse {
  login?: string;
  username?: string;
  avatar_url?: string;
  html_url?: string;
}

interface RawUser {
  login?: string;
  username?: string;
}

interface RawIssue {
  number: number;
  title?: string;
  body?: string | null;
  state?: string;
  labels?: ({ name?: string } | string)[] | null;
  user?: RawUser | null;
  html_url?: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string | null;
  /** Set on GitHub and Forgejo alike when the "issue" is really a PR. */
  pull_request?: unknown;
}

interface RawPullRequest extends RawIssue {
  merged?: boolean;
  merged_at?: string | null;
}

export function createRestForgeClient(spec: RestForgeSpec): ForgeClient {
  const headers = {
    Accept: spec.accept,
    Authorization: spec.authHeader(spec.token),
    ...spec.extraHeaders,
  };

  let lastRateLimit: RateLimit | null = null;

  async function request(path: string, init: RestInit = {}): Promise<Response> {
    const url = `${spec.apiUrl}${path}${queryString(init.params)}`;
    const body = init.body === undefined ? undefined : JSON.stringify(init.body);
    try {
      const res = await fetch(url, {
        method: init.method ?? 'GET',
        headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
        body,
      });
      lastRateLimit = readRateLimit(res) ?? lastRateLimit;
      return res;
    } catch {
      throw new ForgeError('offline', `Could not reach ${spec.apiUrl}`);
    }
  }

  function fail(res: Response, what: string): ForgeError {
    if (res.status === 401) return new ForgeError('unauthorized', 'Token rejected by the forge.', 401);
    if (res.status === 429) return new ForgeError('rate-limited', 'Forge rate limit exhausted.', 429);
    if (res.status === 403) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (remaining === '0') return new ForgeError('rate-limited', 'Forge rate limit exhausted.', 403);
      return new ForgeError('forbidden', `Token lacks access to ${what}.`, 403);
    }
    if (res.status === 404) return new ForgeError('not-found', `${what} not found.`, 404);
    return new ForgeError('unknown', `Forge returned ${res.status} for ${what}.`, res.status);
  }

  async function json<T>(path: string, init?: RestInit): Promise<T> {
    const res = await request(path, init);
    if (!res.ok) throw fail(res, path);
    return (await res.json()) as T;
  }

  async function send(path: string, init: RestInit, what: string): Promise<Response> {
    const res = await request(path, init);
    if (!res.ok) throw fail(res, what);
    return res;
  }

  /** Page walking rather than Link-header following: same result, no URL trust. */
  async function list<T>(path: string, params: QueryParams = {}): Promise<T[]> {
    const items: T[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      // GitHub reads per_page, Forgejo reads limit; neither minds the other.
      const batch = await json<T[]>(path, {
        params: { ...params, page, per_page: PAGE_SIZE, limit: PAGE_SIZE },
      });
      if (!Array.isArray(batch)) throw new ForgeError('unknown', `${path} did not return a list.`);
      items.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
    return items;
  }

  const rest: Rest = { json, list };

  function repoPath(repo: RepoRef, suffix = ''): string {
    return `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}${suffix}`;
  }

  async function labelRef(repo: RepoRef, label: string): Promise<string> {
    const ref = spec.labelRef ? await spec.labelRef(rest, repo, label) : label;
    return encodeURIComponent(String(ref));
  }

  async function labelBodyRef(repo: RepoRef, label: string): Promise<string | number> {
    return spec.labelRef ? await spec.labelRef(rest, repo, label) : label;
  }

  function toIssue(raw: RawIssue, repo: RepoRef): Issue {
    return {
      number: raw.number,
      title: raw.title ?? '',
      body: raw.body ?? '',
      state: raw.state === 'closed' ? 'closed' : 'open',
      labels: (raw.labels ?? [])
        .map((label) => (typeof label === 'string' ? label : (label?.name ?? '')))
        .filter(Boolean),
      author: raw.user?.login ?? raw.user?.username ?? '',
      url: raw.html_url ?? `${spec.webUrl}/${repo.owner}/${repo.name}/issues/${raw.number}`,
      createdAt: raw.created_at ?? '',
      updatedAt: raw.updated_at ?? raw.created_at ?? '',
      closedAt: raw.closed_at ?? null,
    };
  }

  function toPullRequest(raw: RawPullRequest, repo: RepoRef): PullRequest {
    const issue = toIssue(raw, repo);
    return {
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      merged: raw.merged === true || typeof raw.merged_at === 'string',
      mergedAt: raw.merged_at ?? null,
      author: issue.author,
      url: issue.url,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      closes: parseClosingRefs(raw.title, raw.body),
    };
  }

  async function listIssues(repo: RepoRef, options: ListIssuesOptions = {}): Promise<Issue[]> {
    const raw = await list<RawIssue>(repoPath(repo, '/issues'), {
      state: options.state ?? 'open',
      // Forgejo filters PRs out server-side; GitHub ignores it, so filter here too.
      type: 'issues',
      since: options.since,
      ...spec.recentFirst,
    });
    return raw.filter((item) => item.pull_request == null).map((item) => toIssue(item, repo));
  }

  async function listPullRequests(
    repo: RepoRef,
    options: ListPullRequestsOptions = {},
  ): Promise<PullRequest[]> {
    const raw = await list<RawPullRequest>(repoPath(repo, '/pulls'), {
      state: options.state ?? 'all',
      ...spec.recentFirst,
    });
    return raw.map((item) => toPullRequest(item, repo));
  }

  return {
    kind: spec.kind,

    async getIdentity(): Promise<ForgeIdentity> {
      const body = await json<UserResponse>('/user');
      const login = body.login ?? body.username;
      if (!login) throw new ForgeError('unknown', 'Forge returned a user with no login.');
      return { login, avatarUrl: body.avatar_url, profileUrl: body.html_url };
    },

    async getFileText(repo: RepoRef, path: string, ref?: string): Promise<string | null> {
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      const res = await request(repoPath(repo, `/contents/${encodedPath}`), {
        params: { ref },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw fail(res, `${repo.owner}/${repo.name}:${path}`);
      const body = (await res.json()) as ContentsResponse;
      if (typeof body.content !== 'string') {
        throw new ForgeError('unknown', `${path} is not a file.`);
      }
      if (body.encoding && body.encoding !== 'base64') {
        throw new ForgeError('unknown', `Unsupported content encoding "${body.encoding}".`);
      }
      return decodeBase64Utf8(body.content);
    },

    webUrl(repo: RepoRef, path?: string): string {
      const root = `${spec.webUrl}/${repo.owner}/${repo.name}`;
      return path ? `${root}/blob/HEAD/${path}` : root;
    },

    listIssues,

    async addLabel(repo: RepoRef, issue: number, label: string): Promise<void> {
      await send(
        repoPath(repo, `/issues/${issue}/labels`),
        { method: 'POST', body: { labels: [await labelBodyRef(repo, label)] } },
        `label ${label} on #${issue}`,
      );
    },

    async removeLabel(repo: RepoRef, issue: number, label: string): Promise<void> {
      const res = await request(repoPath(repo, `/issues/${issue}/labels/${await labelRef(repo, label)}`), {
        method: 'DELETE',
      });
      // The label already being gone is the state we wanted, not a failure.
      if (res.ok || res.status === 404) return;
      throw fail(res, `label ${label} on #${issue}`);
    },

    async commentOnIssue(repo: RepoRef, issue: number, body: string): Promise<void> {
      await send(
        repoPath(repo, `/issues/${issue}/comments`),
        { method: 'POST', body: { body } },
        `comment on #${issue}`,
      );
    },

    // Both forges number PRs in the issue sequence and serve their conversation
    // from the issue endpoint; the split exists for callers, not for the API.
    async commentOnPullRequest(repo: RepoRef, pull: number, body: string): Promise<void> {
      await send(
        repoPath(repo, `/issues/${pull}/comments`),
        { method: 'POST', body: { body } },
        `comment on PR #${pull}`,
      );
    },

    listPullRequests,

    async getPullRequest(repo: RepoRef, pull: number): Promise<PullRequest> {
      return toPullRequest(await json<RawPullRequest>(repoPath(repo, `/pulls/${pull}`)), repo);
    },

    async listPullRequestsClosing(repo: RepoRef, issue: number): Promise<PullRequest[]> {
      const pulls = await listPullRequests(repo, { state: 'all' });
      return pulls.filter((pull) => pull.closes.includes(issue));
    },

    async listClosedIssues(repo: RepoRef, since?: string): Promise<ClosedIssue[]> {
      const [issues, pulls] = await Promise.all([
        listIssues(repo, { state: 'closed', since }),
        listPullRequests(repo, { state: 'closed' }),
      ]);
      const closers = closersByIssue(pulls);
      return issues
        .map((issue) => ({ issue, closedBy: closers.get(issue.number) ?? null }))
        .sort(byClosedAtDesc);
    },

    rateLimit: () => lastRateLimit,
  };
}

/** A merged PR outranks an abandoned one — only the merge scores. */
function closersByIssue(pulls: PullRequest[]): Map<number, PullRequest> {
  const closers = new Map<number, PullRequest>();
  for (const pull of pulls) {
    for (const issue of pull.closes) {
      const held = closers.get(issue);
      if (!held || (pull.merged && !held.merged)) closers.set(issue, pull);
    }
  }
  return closers;
}

function byClosedAtDesc(a: ClosedIssue, b: ClosedIssue): number {
  return (b.issue.closedAt ?? '').localeCompare(a.issue.closedAt ?? '');
}

function queryString(params?: QueryParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

function readRateLimit(res: Response): RateLimit | null {
  const limit = numberHeader(res, 'x-ratelimit-limit');
  const remaining = numberHeader(res, 'x-ratelimit-remaining');
  const reset = numberHeader(res, 'x-ratelimit-reset');
  if (limit === null && remaining === null && reset === null) return null;
  return { limit, remaining, resetAt: reset === null ? null : reset * 1000 };
}

function numberHeader(res: Response, name: string): number | null {
  const raw = res.headers.get(name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Forge contents APIs return base64 with hard line breaks; atob rejects those. */
export function decodeBase64Utf8(encoded: string): string {
  const bytes = Uint8Array.from(atob(encoded.replace(/\s/g, '')), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
