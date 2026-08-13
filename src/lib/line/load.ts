import { ForgeError, parseRepoRef, type ForgeClient } from '../forge';
import { readJson, store as defaultStore, writeJson, type Store } from '../storage';
import { parseLine } from './parse';
import { LineConfigError, type Line } from './types';

export const LINE_CONFIG_PATH = 'andon.toml';

const CACHE_KEY = 'andon.line-cache';

interface CachedLine {
  repo: string;
  toml: string;
  fetchedAt: number;
}

export interface LineLoad {
  line: Line;
  source: 'forge' | 'cache';
  fetchedAt: number;
  /** Why the cached copy is being shown, when it is. */
  staleReason?: string;
}

/**
 * Reads the line from the forge, falling back to the last good copy when the
 * network is gone — the belt should still render on a train.
 */
export async function loadLine(client: ForgeClient, repoSlug: string, store: Store = defaultStore): Promise<LineLoad> {
  const repo = parseRepoRef(repoSlug);
  const cached = readJson<CachedLine>(store, CACHE_KEY);
  const fallback = cached?.repo === repoSlug ? cached : null;

  try {
    const toml = await client.getFileText(repo, LINE_CONFIG_PATH);
    if (toml === null) {
      throw new LineConfigError(`No ${LINE_CONFIG_PATH} at the root of ${repoSlug} — that file is the line.`);
    }
    const line = parseLine(toml);
    const fetchedAt = Date.now();
    writeJson(store, CACHE_KEY, { repo: repoSlug, toml, fetchedAt } satisfies CachedLine);
    return { line, source: 'forge', fetchedAt };
  } catch (error) {
    if (fallback && error instanceof ForgeError && error.kind === 'offline') {
      return {
        line: parseLine(fallback.toml),
        source: 'cache',
        fetchedAt: fallback.fetchedAt,
        staleReason: 'Forge unreachable — showing the last line Andon saw.',
      };
    }
    throw error;
  }
}

export function clearLineCache(store: Store = defaultStore): void {
  store.remove(CACHE_KEY);
}
