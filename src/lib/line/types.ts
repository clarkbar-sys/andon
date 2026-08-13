import type { ForgeKind } from '../forge';

export type WorkerType = 'human' | 'agent';

/** When the cord goes up. v1 stations are all human, so arrival is a stop. */
export type CordRule = 'on-arrival' | 'on-stuck' | 'never';

export type ScoreWindow = 'day' | 'week' | 'month' | 'all';

export type ScoreStat = 'total' | 'window' | 'transit-time';

export interface Station {
  id: string;
  name: string;
  worker: WorkerType;
  /** The forge label that puts an issue at this station. */
  label: string;
  does: string;
  cord: CordRule;
}

export interface ScoreConfig {
  window: ScoreWindow;
  show: ScoreStat[];
}

export interface Line {
  name: string;
  /** owner/name of the repo this belt runs on. */
  repo: string;
  forge: ForgeKind;
  stations: Station[];
  score: ScoreConfig;
}

/**
 * A line Andon refuses to run. `problems` holds every fault found in one pass,
 * so a broken config is fixed in one edit rather than one error at a time.
 */
export class LineConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[] | string) {
    const list = typeof problems === 'string' ? [problems] : problems;
    super(list.join(' '));
    this.name = 'LineConfigError';
    this.problems = list;
  }
}
