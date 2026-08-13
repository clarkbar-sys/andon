import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLine } from './parse';
import { LineConfigError } from './types';

const REPO_CONFIG = readFileSync(new URL('../../../andon.toml', import.meta.url), 'utf8');

const BELT = '[belt]\nrepo = "a/b"\n\n';
const station = (body: string) => `${BELT}[[station]]\n${body}\n`;

/** The problems a bad line reported, or [] when it parsed. */
function problemsIn(toml: string): string[] {
  try {
    parseLine(toml);
    return [];
  } catch (error) {
    if (error instanceof LineConfigError) return error.problems;
    throw error;
  }
}

describe('parseLine', () => {
  it('parses the line this repo actually runs', () => {
    const line = parseLine(REPO_CONFIG);
    expect(line.repo).toBe('clarkbar-sys/andon');
    expect(line.forge).toBe('github');
    expect(line.stations.map((s) => s.id)).toEqual(['triage', 'scope', 'build', 'review']);
    expect(line.stations[0]).toMatchObject({
      name: 'Triage',
      worker: 'human',
      label: 'station:triage',
      cord: 'on-arrival',
    });
    expect(line.score).toEqual({ window: 'week', show: ['total', 'window', 'transit-time'] });
  });

  it('fills in the defaults a terse station leaves out', () => {
    const line = parseLine(station('id = "triage"'));
    expect(line.name).toBe('The line');
    expect(line.stations[0]).toEqual({
      id: 'triage',
      name: 'triage',
      worker: 'human',
      label: 'station:triage',
      does: '',
      cord: 'on-arrival',
    });
    expect(line.score).toEqual({ window: 'week', show: ['total', 'window', 'transit-time'] });
  });

  it('explains malformed TOML instead of leaking the parser error', () => {
    expect(() => parseLine('[belt\n')).toThrow(/andon\.toml is not valid TOML/);
  });

  it('rejects a line with no stations', () => {
    expect(() => parseLine(BELT)).toThrow(/at least one \[\[station\]\]/);
  });

  it('rejects a missing or malformed repo', () => {
    expect(problemsIn('[belt]\nname = "x"\n\n[[station]]\nid = "a"\n')).toContain('[belt].repo is required.');
    expect(problemsIn('[belt]\nrepo = "nope"\n\n[[station]]\nid = "a"\n')).toContainEqual(
      expect.stringMatching(/\[belt\]\.repo must be "owner\/name"/),
    );
  });

  it('rejects a station with no id', () => {
    expect(problemsIn(station('name = "Triage"'))).toContainEqual(expect.stringMatching(/id is required/));
  });

  it('rejects an id that cannot become a label', () => {
    expect(problemsIn(station('id = "Triage Now"'))).toContainEqual(
      expect.stringMatching(/must be lower-case letters, digits and dashes/),
    );
  });

  it('rejects duplicate station ids', () => {
    const toml = `${BELT}[[station]]\nid = "triage"\n\n[[station]]\nid = "triage"\n`;
    expect(problemsIn(toml)).toContainEqual(expect.stringMatching(/Duplicate station id/));
  });

  it('rejects two stations sharing a label', () => {
    const toml = `${BELT}[[station]]\nid = "triage"\n\n[[station]]\nid = "scope"\nlabel = "station:triage"\n`;
    expect(problemsIn(toml)).toContainEqual(expect.stringMatching(/share the label "station:triage"/));
  });

  it('requires labels to follow the station: convention', () => {
    expect(problemsIn(station('id = "triage"\nlabel = "needs-triage"'))).toContainEqual(
      expect.stringMatching(/must start with "station:"/),
    );
    expect(problemsIn(station('id = "triage"\nlabel = "station:"'))).toContainEqual(
      expect.stringMatching(/must start with "station:"/),
    );
    expect(parseLine(station('id = "triage"\nlabel = "station:needs-triage"')).stations[0].label).toBe(
      'station:needs-triage',
    );
  });

  it('rejects an unknown worker type', () => {
    expect(problemsIn(station('id = "a"\nworker = "robot"'))).toContainEqual(
      expect.stringMatching(/worker must be one of human, agent/),
    );
  });

  it('rejects agent workers and non-arrival cords, which v1 cannot run yet', () => {
    expect(problemsIn(station('id = "a"\nworker = "agent"'))).toContainEqual(
      expect.stringMatching(/worker = "agent" is not supported yet — v1 runs human/),
    );
    expect(problemsIn(station('id = "a"\ncord = "on-stuck"'))).toContainEqual(
      expect.stringMatching(/cord = "on-stuck" is not supported yet — v1 runs on-arrival/),
    );
  });

  it('rejects a typo instead of silently defaulting the field it meant', () => {
    expect(problemsIn(station('id = "a"\nchord = "on-arrival"'))).toContainEqual(
      expect.stringMatching(/unknown key "chord"/),
    );
    expect(problemsIn('[belt]\nrepo = "a/b"\nforge = "github"\nrepoo = "x"\n\n[[station]]\nid = "a"\n')).toContainEqual(
      expect.stringMatching(/\[belt\] has an unknown key "repoo"/),
    );
  });

  it('rejects wrong types without pretending the value was missing', () => {
    const problems = problemsIn(station('id = "a"\nname = 7'));
    expect(problems).toEqual(['[[station]] #1 name must be a string.']);
  });

  it('rejects unknown score stats and windows', () => {
    const toml = `${station('id = "a"')}\n[score]\nwindow = "fortnight"\nshow = ["total", "vibes"]\n`;
    const problems = problemsIn(toml);
    expect(problems).toContainEqual(expect.stringMatching(/\[score\]\.window must be one of day, week, month, all/));
    expect(problems).toContainEqual(expect.stringMatching(/\[score\]\.show\[1\] must be one of/));
  });

  it('reports every fault at once so one edit fixes the line', () => {
    const toml = '[belt]\nforge = "gitlab"\n\n[[station]]\nid = "a"\nworker = "agent"\n\n[[station]]\nid = "a"\n';
    const error = (() => {
      try {
        parseLine(toml);
      } catch (thrown) {
        return thrown as LineConfigError;
      }
      throw new Error('expected a LineConfigError');
    })();

    expect(error).toBeInstanceOf(LineConfigError);
    expect(error.problems).toHaveLength(4); // repo, forge, worker, duplicate id
    expect(error.message).toContain('[belt].repo is required.');
  });
});
