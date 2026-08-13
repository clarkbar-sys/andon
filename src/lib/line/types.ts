import type { ForgeKind } from '../forge';

export type WorkerType = 'human' | 'agent';

/** When the cord goes up. v1 stations are all human, so arrival is a stop. */
export type CordRule = 'on-arrival' | 'on-stuck' | 'never';

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
  window: string;
  show: string[];
}

export interface Line {
  name: string;
  /** owner/name of the repo this belt runs on. */
  repo: string;
  forge: ForgeKind;
  stations: Station[];
  score: ScoreConfig;
}

export class LineConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LineConfigError';
  }
}
