import { describe, expect, it } from 'vitest';
import { ForgeError, type ForgeClient } from '../forge';
import { memoryStore } from '../storage';
import { loadLine } from './load';
import { LineConfigError } from './types';

const TOML = '[belt]\nrepo = "o/r"\n\n[[station]]\nid = "triage"\n';

/** Loading the line only ever reads a file; anything else here is a bug. */
const unused = () => {
  throw new Error('loadLine should not touch the rest of the forge');
};

function client(getFileText: ForgeClient['getFileText']): ForgeClient {
  return {
    kind: 'github',
    getIdentity: async () => ({ login: 'josh' }),
    getFileText,
    webUrl: (repo) => `https://github.com/${repo.owner}/${repo.name}`,
    listIssues: unused,
    addLabel: unused,
    removeLabel: unused,
    commentOnIssue: unused,
    commentOnPullRequest: unused,
    listPullRequests: unused,
    getPullRequest: unused,
    listPullRequestsClosing: unused,
    listClosedIssues: unused,
    rateLimit: () => null,
  };
}

describe('loadLine', () => {
  it('reads andon.toml from the forge and caches it', async () => {
    const store = memoryStore();
    const load = await loadLine(client(async () => TOML), 'o/r', store);

    expect(load.source).toBe('forge');
    expect(load.line.stations).toHaveLength(1);
    expect(store.read('andon.line-cache')).toContain('station');
  });

  it('falls back to the cached line when the forge is unreachable', async () => {
    const store = memoryStore();
    await loadLine(client(async () => TOML), 'o/r', store);

    const offline = client(async () => {
      throw new ForgeError('offline', 'no network');
    });
    const load = await loadLine(offline, 'o/r', store);

    expect(load.source).toBe('cache');
    expect(load.staleReason).toBeTruthy();
    expect(load.line.stations[0].id).toBe('triage');
  });

  it('does not serve another repo cached line', async () => {
    const store = memoryStore();
    await loadLine(client(async () => TOML), 'o/r', store);

    const offline = client(async () => {
      throw new ForgeError('offline', 'no network');
    });
    await expect(loadLine(offline, 'other/repo', store)).rejects.toMatchObject({ kind: 'offline' });
  });

  it('reports the outage rather than a cached line it can no longer run', async () => {
    const store = memoryStore();
    store.write(
      'andon.line-cache',
      JSON.stringify({ repo: 'o/r', toml: '[belt]\nrepo = "o/r"\n\n[[station]]\nid = "a"\nworker = "agent"\n', fetchedAt: 1 }),
    );

    const offline = client(async () => {
      throw new ForgeError('offline', 'no network');
    });
    await expect(loadLine(offline, 'o/r', store)).rejects.toMatchObject({ kind: 'offline' });
  });

  it('surfaces a broken line as a config error, not a blank belt', async () => {
    const broken = client(async () => '[belt]\nrepo = "o/r"\n');
    await expect(loadLine(broken, 'o/r', memoryStore())).rejects.toBeInstanceOf(LineConfigError);
  });

  it('does not cache a config it refused to parse', async () => {
    const store = memoryStore();
    await loadLine(client(async () => TOML), 'o/r', store);
    await expect(loadLine(client(async () => '[belt]\n'), 'o/r', store)).rejects.toBeInstanceOf(LineConfigError);
    expect(store.read('andon.line-cache')).toContain('triage');
  });

  it('says so when the repo has no andon.toml', async () => {
    await expect(loadLine(client(async () => null), 'o/r', memoryStore())).rejects.toThrow(/No andon\.toml/);
  });

  it('surfaces auth failures rather than hiding them behind the cache', async () => {
    const store = memoryStore();
    await loadLine(client(async () => TOML), 'o/r', store);

    const rejected = client(async () => {
      throw new ForgeError('unauthorized', 'token rejected', 401);
    });
    await expect(loadLine(rejected, 'o/r', store)).rejects.toMatchObject({ kind: 'unauthorized' });
  });
});
