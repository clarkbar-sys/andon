import { afterEach, describe, expect, it, vi } from 'vitest';
import { createForgeClient, ForgeError, formatRepoRef, parseRepoRef } from './index';

interface Call {
  url: string;
  headers: Record<string, string>;
}

function stubFetch(handler: (call: Call) => Response): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const call = { url: String(url), headers: (init.headers ?? {}) as Record<string, string> };
    calls.push(call);
    return handler(call);
  });
  return calls;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const base64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

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

describe('github adapter', () => {
  it('reads a file from api.github.com with a bearer token', async () => {
    const calls = stubFetch(() => json({ content: base64('name = "line"'), encoding: 'base64' }));
    const client = createForgeClient({ kind: 'github', token: 'ghp_x' });

    const text = await client.getFileText({ owner: 'clarkbar-sys', name: 'andon' }, 'andon.toml');

    expect(text).toBe('name = "line"');
    expect(calls[0].url).toBe('https://api.github.com/repos/clarkbar-sys/andon/contents/andon.toml');
    expect(calls[0].headers.Authorization).toBe('Bearer ghp_x');
  });

  it('decodes the line-wrapped base64 GitHub actually returns', async () => {
    const wrapped = base64('a'.repeat(200)).replace(/(.{60})/g, '$1\n');
    stubFetch(() => json({ content: wrapped, encoding: 'base64' }));
    const client = createForgeClient({ kind: 'github', token: 't' });

    expect(await client.getFileText({ owner: 'o', name: 'r' }, 'f.toml')).toBe('a'.repeat(200));
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
    const client = createForgeClient({ kind: 'github', token: 'bad' });

    expect(await client.getFileText({ owner: 'o', name: 'r' }, 'nope.toml')).toBeNull();
    await expect(client.getIdentity()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('reports an unreachable forge as offline', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    const client = createForgeClient({ kind: 'github', token: 't' });

    await expect(client.getIdentity()).rejects.toBeInstanceOf(ForgeError);
    await expect(client.getIdentity()).rejects.toMatchObject({ kind: 'offline' });
  });
});

describe('forgejo adapter', () => {
  it('reads through /api/v1 with a token-scheme header', async () => {
    const calls = stubFetch(() => json({ content: base64('ok'), encoding: 'base64' }));
    const client = createForgeClient({ kind: 'forgejo', token: 'fj', instanceUrl: 'https://codeberg.org/' });

    const text = await client.getFileText({ owner: 'o', name: 'r' }, 'andon.toml');

    expect(text).toBe('ok');
    expect(calls[0].url).toBe('https://codeberg.org/api/v1/repos/o/r/contents/andon.toml');
    expect(calls[0].headers.Authorization).toBe('token fj');
  });

  it('refuses to guess an instance URL', () => {
    expect(() => createForgeClient({ kind: 'forgejo', token: 'fj' })).toThrow(/instance URL/);
  });
});
