import { parse as parseToml } from 'smol-toml';
import type { ForgeKind } from '../forge';
import { LineConfigError, type CordRule, type Line, type ScoreConfig, type Station, type WorkerType } from './types';

const WORKERS: WorkerType[] = ['human', 'agent'];
const CORDS: CordRule[] = ['on-arrival', 'on-stuck', 'never'];
const FORGES: ForgeKind[] = ['github', 'forgejo'];

const DEFAULT_SCORE: ScoreConfig = { window: 'week', show: ['total', 'window', 'transit-time'] };

/** Parses `andon.toml` into the line. Throws LineConfigError with a fixable message. */
export function parseLine(toml: string): Line {
  let root: unknown;
  try {
    root = parseToml(toml);
  } catch (error) {
    throw new LineConfigError(`andon.toml is not valid TOML: ${(error as Error).message}`);
  }

  const doc = asTable(root, 'andon.toml');
  const belt = asTable(doc.belt, '[belt]');
  const stationRows = doc.station;
  if (!Array.isArray(stationRows) || stationRows.length === 0) {
    throw new LineConfigError('andon.toml needs at least one [[station]].');
  }

  const stations = stationRows.map((row, index) => parseStation(row, index));
  const seen = new Set<string>();
  for (const station of stations) {
    if (seen.has(station.id)) {
      throw new LineConfigError(`Duplicate station id "${station.id}" — ids must be unique.`);
    }
    seen.add(station.id);
  }

  return {
    name: optionalString(belt.name, '[belt].name') ?? 'The line',
    repo: requiredString(belt.repo, '[belt].repo'),
    forge: oneOf(optionalString(belt.forge, '[belt].forge') ?? 'github', FORGES, '[belt].forge'),
    stations,
    score: parseScore(doc.score),
  };
}

function parseStation(row: unknown, index: number): Station {
  const where = `[[station]] #${index + 1}`;
  const table = asTable(row, where);
  const id = requiredString(table.id, `${where} id`);
  return {
    id,
    name: optionalString(table.name, `${where} name`) ?? id,
    worker: oneOf(optionalString(table.worker, `${where} worker`) ?? 'human', WORKERS, `${where} worker`),
    label: optionalString(table.label, `${where} label`) ?? `station:${id}`,
    does: optionalString(table.does, `${where} does`) ?? '',
    cord: oneOf(optionalString(table.cord, `${where} cord`) ?? 'on-arrival', CORDS, `${where} cord`),
  };
}

function parseScore(value: unknown): ScoreConfig {
  if (value === undefined) return DEFAULT_SCORE;
  const table = asTable(value, '[score]');
  const show = table.show;
  return {
    window: optionalString(table.window, '[score].window') ?? DEFAULT_SCORE.window,
    show: Array.isArray(show) ? show.map((entry, i) => requiredString(entry, `[score].show[${i}]`)) : DEFAULT_SCORE.show,
  };
}

function asTable(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new LineConfigError(`${where} is missing or is not a table.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, where: string): string {
  const parsed = optionalString(value, where);
  if (parsed === undefined || parsed === '') {
    throw new LineConfigError(`${where} is required.`);
  }
  return parsed;
}

function optionalString(value: unknown, where: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new LineConfigError(`${where} must be a string.`);
  }
  return value;
}

function oneOf<T extends string>(value: string, allowed: T[], where: string): T {
  if (!(allowed as string[]).includes(value)) {
    throw new LineConfigError(`${where} must be one of ${allowed.join(', ')} — got "${value}".`);
  }
  return value as T;
}
