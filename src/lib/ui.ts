import type { CordRule, ScoreWindow, Station } from './line';

/** clear = humming, waiting = queue at the station, pulled = cord up (red). */
export type LampState = 'clear' | 'waiting' | 'pulled';

export const LAMP_WORDS: Record<LampState, string> = {
  clear: 'clear',
  waiting: 'waiting',
  pulled: 'cord pulled',
};

const CORD_WORDS: Record<CordRule, string> = {
  'on-arrival': 'cord on arrival',
  'on-stuck': 'cord when stuck',
  never: 'no cord',
};

export function cordWords(rule: CordRule): string {
  return CORD_WORDS[rule];
}

const WINDOW_WORDS: Record<ScoreWindow, string> = {
  day: 'today',
  week: 'week',
  month: 'month',
  all: 'all time',
};

export function scoreWindowWords(window: ScoreWindow): string {
  return WINDOW_WORDS[window];
}

/**
 * Cord state is its own event (SCOPE.md #8), not "an issue is here" — the shell
 * has no issue feed yet, so every station reads clear until that lands.
 */
export function lampFor(_station: Station): LampState {
  return 'clear';
}
