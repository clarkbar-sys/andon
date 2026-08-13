import { afterEach, describe, expect, it, vi } from 'vitest';
import { createForgeClient, ForgeError, formatRepoRef, parseClosingRefs, parseRepoRef } from './index';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function stubFetch(handler: (call: Call) => Response): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const call: Call = {
      url: String(url),
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    return handler(call);
  });
  return calls;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const base64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

const repo = { owner: 'clarkbar-sys', name: 'andon' };

const github = (token = 't') => createForgeClient({ kind: 'github', token });
const forgejo = () =>
  createForgeClient({ kind: 'forgejo', token: 'fj', instanceUrl: 'https://forge.example/' });

const rawIssue = (over: Record<string, unknown> = {}) => ({
  number: 7,
  title: 'Belt jitters at 60fps',
  body: 'the boxes stutter',
  state: 'open',
  labels: [{ name: 'station:build' }, { name: 'model:sonnet' }],
  user: { login: 'josh' },
  html_url: 'https://github.com/clarkbar-sys/andon/issues/7',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-02T00:00:00Z',
  closed_at: null,
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe('repo refs', () => {
  it('round-trips owner/name', () => {
    expect(formatRepoRef(parseRepoRef(' clarkbar-sys/andon '))).toBe('clarkbar-sys/andon');
  });

  it('rejects anything that is not owner/name', () => {
    expect(() => parseRepoRef('andon')).toThrow(/owner\/name/);
    expect(() => parseRepoRef('a/b/c')).toThrow(/owner\/name/);
  });
});

describe('closing-keyword linkage', () => {
  it('reads every keyword both forges honour', () => {
    expect(parseClosingRefs('Closes #1, fixes #2 and resolved: #3')).toEqual([1, 2, 3]);
    expect(parseClosingRefs('close #4', 'Fixed #4')).toEqual([4]);
  });

  it('ignores plain mentions and other repos', () => {
    expect(parseClosingRefs('see #9, part of #10')).toEqual([]);
    expect(parseClosingRefs('closes other/repo#11')).toEqual([]);
  });
});

describe('github adapter', () => {
  it('reads a file from api.github.com with a bearer token', async () => {
    const calls = stubFetch(() => json({ content: base64('name = "line"'), encoding: 'base64' }));

    const text = await github('ghp_x').getFileText(repo, 'andon.toml');

    expect(text).toBe('name = "line"');
    expect(calls[0].url).toBe('https://api.github.com/repos/clarkbar-sys/andon/contents/andon.toml');
    expect(calls[0].headers.Authorization).toBe('Bearer ghp_x');
  });

  it('decodes the line-wrapped base64 GitHub actually returns', async () => {
    const wrapped = base64('a'.repeat(200)).replace(/(.{60})/g, '$1\n');
    stubFetch(() => json({ content: wrapped, encoding: 'base64' }));

    expect(await github().getFileText({ owner: 'o', name: 'r' }, 'f.toml')).toBe('a'.repeat(200));
  });

  it('targets the v3 API path on Enterprise', async () => {
    const calls = stubFetch(() => json({ login: 'josh' }));
    const client = createForgeClient({ kind: 'github', token: 't', instanceUrl: 'https://github.acme.com/' });

    await client.getIdentity();

    expect(calls[0].url).toBe('https://github.acme.com/api/v3/user');
    expect(client.webUrl({ owner: 'o', name: 'r' })).toBe('https://github.acme.com/o/r');
  });

  it('returns null for a missing file but throws for a rejected token', async () => {
    stubFetch((call) => (call.url.includes('/contents/') ? json({}, 404) : json({}, 401)));
    const client = github('bad');

    expect(await client.getFileText({ owner: 'o', name: 'r' }, 'nope.toml')).toBeNull();
    await expect(client.getIdentity()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('reports an unreachable forge as offline', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(github().getIdentity()).rejects.toBeInstanceOf(ForgeError);
    await expect(github().getIdentity()).rejects.toMatchObject({ kind: 'offline' });
  });

  it('lists open issues with their labels and leaves pull requests off the belt', async () => {
    const calls = stubFetch(() =>
      json([rawIssue(), rawIssue({ number: 8, pull_request: { url: 'x' } })]),
    );

    const issues = await github().listIssues(repo);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      number: 7,
      labels: ['station:build', 'model:sonnet'],
      author: 'josh',
      state: 'open',
    });
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe('/repos/clarkbar-sys/andon/issues');
    expect(url.searchParams.get('state')).toBe('open');
    expect(url.searchParams.get('per_page')).toBe('100');
  });

  it('pages until a short page arrives', async () => {
    const page = (start: number) =>
      Array.from({ length: 100 }, (_, i) => rawIssue({ number: start + i }));
    const calls = stubFetch((call) =>
      new URL(call.url).searchParams.get('page') === '1' ? json(page(1)) : json(page(101).slice(0, 3)),
    );

    expect(await github().listIssues(repo)).toHaveLength(103);
    expect(calls).toHaveLength(2);
  });

  it('moves a station label by name and treats a missing label as already removed', async () => {
    const calls = stubFetch((call) => (call.method === 'DELETE' ? json({}, 404) : json([])));
    const client = github();

    await client.addLabel(repo, 7, 'station:review');
    await client.removeLabel(repo, 7, 'station:build');

    expect(calls[0]).toMatchObject({
      url: 'https://api.github.com/repos/clarkbar-sys/andon/issues/7/labels',
      method: 'POST',
      body: { labels: ['station:review'] },
    });
    expect(calls[1]).toMatchObject({
      url: 'https://api.github.com/repos/clarkbar-sys/andon/issues/7/labels/station%3Abuild',
      method: 'DELETE',
    });
  });

  it('posts issue and PR comments through the shared conversation endpoint', async () => {
    const calls = stubFetch(() => json({ id: 1 }, 201));
    const client = github();

    await client.commentOnIssue(repo, 7, 'moved to review');
    await client.commentOnPullRequest(repo, 9, 'nudge');

    expect(calls[0]).toMatchObject({
      url: 'https://api.github.com/repos/clarkbar-sys/andon/issues/7/comments',
      method: 'POST',
      body: { body: 'moved to review' },
    });
    expect(calls[1].url).toBe('https://api.github.com/repos/clarkbar-sys/andon/issues/9/comments');
  });

  it('reads merge state and closing links off a pull request', async () => {
    stubFetch(() =>
      json(
        rawIssue({
          number: 9,
          title: 'Fix the jitter',
          body: 'Fixes #7 and closes #8.',
          state: 'closed',
          merged: true,
          merged_at: '2026-08-03T00:00:00Z',
        }),
      ),
    );

    const pull = await github().getPullRequest(repo, 9);

    expect(pull).toMatchObject({ number: 9, merged: true, closes: [7, 8] });
  });

  it('finds the pull requests that promise to close an issue', async () => {
    stubFetch(() =>
      json([
        rawIssue({ number: 9, body: 'Fixes #7' }),
        rawIssue({ number: 10, body: 'refs #7' }),
      ]),
    );

    const pulls = await github().listPullRequestsClosing(repo, 7);

    expect(pulls.map((p) => p.number)).toEqual([9]);
  });

  it('pairs closed issues with the merged PR that scored them', async () => {
    stubFetch((call) =>
      call.url.includes('/pulls')
        ? json([
            rawIssue({ number: 20, body: 'Closes #7', merged_at: '2026-08-03T00:00:00Z' }),
            rawIssue({ number: 21, body: 'Closes #7' }),
          ])
        : json([
            rawIssue({ number: 7, state: 'closed', closed_at: '2026-08-03T00:00:00Z' }),
            rawIssue({ number: 8, state: 'closed', closed_at: '2026-08-04T00:00:00Z' }),
          ]),
    );

    const closed = await github().listClosedIssues(repo, '2026-08-01T00:00:00Z');

    // Newest first, and the abandoned PR never outranks the merged one.
    expect(closed.map((c) => c.issue.number)).toEqual([8, 7]);
    expect(closed[0].closedBy).toBeNull();
    expect(closed[1].closedBy).toMatchObject({ number: 20, merged: true });
  });

  it('remembers the polling budget the forge reported', async () => {
    stubFetch(() =>
      json({ login: 'josh' }, 200, {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4987',
        'x-ratelimit-reset': '1786000000',
      }),
    );
    const client = github();

    expect(client.rateLimit()).toBeNull();
    await client.getIdentity();

    expect(client.rateLimit()).toEqual({ limit: 5000, remaining: 4987, resetAt: 1786000000000 });
  });

  it('calls an exhausted budget rate-limited, not forbidden', async () => {
    stubFetch(() => json({}, 403, { 'x-ratelimit-remaining': '0' }));

    await expect(github().listIssues(repo)).rejects.toMatchObject({ kind: 'rate-limited' });
  });
});

describe('forgejo adapter', () => {
  it('reads through /api/v1 with a token-scheme header', async () => {
    const calls = stubFetch(() => json({ content: base64('ok'), encoding: 'base64' }));

    const text = await forgejo().getFileText({ owner: 'o', name: 'r' }, 'andon.toml');

    expect(text).toBe('ok');
    expect(calls[0].url).toBe('https://forge.example/api/v1/repos/o/r/contents/andon.toml');
    expect(calls[0].headers.Authorization).toBe('token fj');
  });

  it('refuses to guess an instance URL', () => {
    expect(() => createForgeClient({ kind: 'forgejo', token: 'fj' })).toThrow(/instance URL/);
  });

  it('sorts lists the way Forgejo spells it', async () => {
    const calls = stubFetch(() => json([]));

    await forgejo().listIssues(repo);

    const url = new URL(calls[0].url);
    expect(url.searchParams.get('sort')).toBe('recentupdate');
    expect(url.searchParams.get('type')).toBe('issues');
    expect(url.searchParams.get('limit')).toBe('100');
  });

  it('resolves label names to ids once and reuses them', async () => {
    const calls = stubFetch((call) =>
      call.url.includes('/labels?') || call.url.endsWith('/labels')
        ? call.method === 'GET'
          ? json([{ id: 42, name: 'station:review' }, { id: 43, name: 'station:build' }])
          : json([])
        : json([]),
    );
    const client = forgejo();

    await client.addLabel(repo, 7, 'station:review');
    await client.removeLabel(repo, 7, 'station:build');

    expect(calls[0].url).toContain('/repos/clarkbar-sys/andon/labels');
    expect(calls[1]).toMatchObject({ method: 'POST', body: { labels: [42] } });
    expect(calls[2]).toMatchObject({
      url: 'https://forge.example/api/v1/repos/clarkbar-sys/andon/issues/7/labels/43',
      method: 'DELETE',
    });
    // One lookup covered both mutations.
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(1);
  });

  it('says so plainly when the instance has no such label', async () => {
    stubFetch(() => json([{ id: 1, name: 'bug' }]));

    await expect(forgejo().addLabel(repo, 7, 'station:review')).rejects.toMatchObject({
      kind: 'not-found',
    });
  });
});
