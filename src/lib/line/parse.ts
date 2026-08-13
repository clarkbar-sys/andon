import { parse as parseToml } from 'smol-toml';
import { parseRepoRef, type ForgeKind } from '../forge';
import {
  LineConfigError,
  type CordRule,
  type Line,
  type ScoreConfig,
  type ScoreStat,
  type ScoreWindow,
  type Station,
  type WorkerType,
} from './types';

const WORKERS: WorkerType[] = ['human', 'agent'];
const CORDS: CordRule[] = ['on-arrival', 'on-stuck', 'never'];
const FORGES: ForgeKind[] = ['github', 'forgejo'];
const WINDOWS: ScoreWindow[] = ['day', 'week', 'month', 'all'];
const STATS: ScoreStat[] = ['total', 'window', 'transit-time'];

// The vocabulary above is what the format understands; these are what v1 can
// actually run. Agent workers and inverted cord rules are named now so landing
// them is a code change, not a config-format change (SCOPE decisions 7 and 8).
const V1_WORKERS: WorkerType[] = ['human'];
const V1_CORDS: CordRule[] = ['on-arrival'];

/** Station position lives in `station:<id>` labels — the prefix is the contract. */
export const STATION_LABEL_PREFIX = 'station:';

// Ids become labels and, later, URL fragments.
const STATION_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const DOC_KEYS = ['belt', 'station', 'score'];
const BELT_KEYS = ['name', 'repo', 'forge'];
const STATION_KEYS = ['id', 'name', 'worker', 'label', 'does', 'cord'];
const SCORE_KEYS = ['window', 'show'];

const DEFAULT_SCORE: ScoreConfig = { window: 'week', show: ['total', 'window', 'transit-time'] };

/**
 * Parses `andon.toml` into the line. Throws LineConfigError listing everything
 * wrong with it — a config that is nearly right should say so all at once.
 */
export function parseLine(toml: string): Line {
  let root: unknown;
  try {
    root = parseToml(toml);
  } catch (error) {
    throw new LineConfigError(`andon.toml is not valid TOML: ${(error as Error).message}`);
  }

  if (!isTable(root)) {
    throw new LineConfigError('andon.toml has no line in it — expected [belt] and at least one [[station]].');
  }
  if (!isTable(root.belt)) {
    throw new LineConfigError('[belt] is missing or is not a table.');
  }
  const rows = root.station;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new LineConfigError('andon.toml needs at least one [[station]].');
  }

  const found: string[] = [];
  unknownKeys(root, DOC_KEYS, 'andon.toml', found);

  const belt = parseBelt(root.belt, found);
  const stations = rows
    .map((row, index) => parseStation(row, index, found))
    .filter((station): station is Station => station !== null);
  checkStationsAreDistinct(stations, found);
  const score = parseScore(root.score, found);

  if (found.length > 0) throw new LineConfigError(found);
  return { ...belt, stations, score };
}

function parseBelt(table: Record<string, unknown>, found: string[]): Omit<Line, 'stations' | 'score'> {
  unknownKeys(table, BELT_KEYS, '[belt]', found);

  const repo = requiredString(table.repo, '[belt].repo', found);
  if (repo !== undefined) {
    try {
      parseRepoRef(repo);
    } catch {
      found.push(`[belt].repo must be "owner/name" — got "${repo}".`);
    }
  }

  return {
    name: optionalString(table.name, '[belt].name', found) ?? 'The line',
    repo: repo ?? '',
    forge: choose(optionalString(table.forge, '[belt].forge', found) ?? 'github', FORGES, FORGES, '[belt].forge', 'github', found),
  };
}

function parseStation(row: unknown, index: number, found: string[]): Station | null {
  const where = `[[station]] #${index + 1}`;
  if (!isTable(row)) {
    found.push(`${where} is not a table.`);
    return null;
  }
  unknownKeys(row, STATION_KEYS, where, found);

  // Everything else on a station is named after its id, so a station without
  // one cannot be checked any further.
  const id = requiredString(row.id, `${where} id`, found);
  if (id === undefined) return null;
  if (!STATION_ID.test(id)) {
    found.push(`${where} id "${id}" must be lower-case letters, digits and dashes — it is the ${STATION_LABEL_PREFIX}<id> label.`);
  }

  const label = optionalString(row.label, `${where} label`, found) ?? `${STATION_LABEL_PREFIX}${id}`;
  if (!label.startsWith(STATION_LABEL_PREFIX) || label === STATION_LABEL_PREFIX) {
    found.push(`${where} label "${label}" must start with "${STATION_LABEL_PREFIX}" — that prefix is how Andon reads position off an issue.`);
  }

  return {
    id,
    name: optionalString(row.name, `${where} name`, found) ?? id,
    worker: choose(optionalString(row.worker, `${where} worker`, found) ?? 'human', WORKERS, V1_WORKERS, `${where} worker`, 'human', found),
    label,
    does: optionalString(row.does, `${where} does`, found) ?? '',
    cord: choose(optionalString(row.cord, `${where} cord`, found) ?? 'on-arrival', CORDS, V1_CORDS, `${where} cord`, 'on-arrival', found),
  };
}

function checkStationsAreDistinct(stations: Station[], found: string[]): void {
  const ids = new Set<string>();
  const labels = new Map<string, string>();
  for (const station of stations) {
    if (ids.has(station.id)) {
      // The default label is derived from the id, so a duplicate id would
      // otherwise be reported twice.
      found.push(`Duplicate station id "${station.id}" — ids must be unique.`);
      continue;
    }
    ids.add(station.id);

    const owner = labels.get(station.label);
    if (owner !== undefined) {
      found.push(`Stations "${owner}" and "${station.id}" share the label "${station.label}" — an issue would be in two places at once.`);
    } else {
      labels.set(station.label, station.id);
    }
  }
}

function parseScore(value: unknown, found: string[]): ScoreConfig {
  if (value === undefined) return DEFAULT_SCORE;
  if (!isTable(value)) {
    found.push('[score] is not a table.');
    return DEFAULT_SCORE;
  }
  unknownKeys(value, SCORE_KEYS, '[score]', found);

  const window = optionalString(value.window, '[score].window', found) ?? DEFAULT_SCORE.window;
  const show = value.show;
  if (show !== undefined && !Array.isArray(show)) {
    found.push('[score].show must be an array of stat names.');
  }

  return {
    window: choose(window, WINDOWS, WINDOWS, '[score].window', DEFAULT_SCORE.window, found),
    show: Array.isArray(show)
      ? show
          .map((entry, i) => {
            const stat = requiredString(entry, `[score].show[${i}]`, found);
            return stat === undefined ? undefined : choose(stat, STATS, STATS, `[score].show[${i}]`, undefined, found);
          })
          .filter((stat): stat is ScoreStat => stat !== undefined)
      : DEFAULT_SCORE.show,
  };
}

function isTable(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownKeys(table: Record<string, unknown>, known: string[], where: string, found: string[]): void {
  for (const key of Object.keys(table)) {
    if (!known.includes(key)) {
      found.push(`${where} has an unknown key "${key}" — known keys are ${known.join(', ')}.`);
    }
  }
}

function requiredString(value: unknown, where: string, found: string[]): string | undefined {
  const parsed = optionalString(value, where, found);
  if (parsed === undefined || parsed === '') {
    if (typeof value !== 'string' && value !== undefined) return undefined; // already reported as a type error
    found.push(`${where} is required.`);
    return undefined;
  }
  return parsed;
}

function optionalString(value: unknown, where: string, found: string[]): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    found.push(`${where} must be a string.`);
    return undefined;
  }
  return value;
}

/**
 * Reads one value out of a closed vocabulary. `supported` narrows `known` to
 * what this version runs, so "not a thing" and "not yet" read differently.
 */
function choose<T extends string, F extends T | undefined>(
  value: string,
  known: T[],
  supported: T[],
  where: string,
  fallback: F,
  found: string[],
): T | F {
  if (!(known as string[]).includes(value)) {
    found.push(`${where} must be one of ${known.join(', ')} — got "${value}".`);
    return fallback;
  }
  if (!(supported as string[]).includes(value)) {
    found.push(`${where} = "${value}" is not supported yet — v1 runs ${supported.join(', ')}.`);
    return fallback;
  }
  return value as T;
}
