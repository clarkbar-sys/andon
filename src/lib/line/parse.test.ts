import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLine } from './parse';
import { LineConfigError } from './types';

const REPO_CONFIG = readFileSync(new URL('../../../andon.toml', import.meta.url), 'utf8');

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
    expect(line.score.show).toContain('transit-time');
  });

  it('fills in the defaults a terse station leaves out', () => {
    const line = parseLine('[belt]\nrepo = "a/b"\n\n[[station]]\nid = "triage"\n');
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

  it('rejects a line with no stations', () => {
    expect(() => parseLine('[belt]\nrepo = "a/b"\n')).toThrow(LineConfigError);
  });

  it('rejects a missing repo', () => {
    expect(() => parseLine('[belt]\nname = "x"\n\n[[station]]\nid = "triage"\n')).toThrow(/\[belt\]\.repo is required/);
  });

  it('rejects duplicate station ids', () => {
    const toml = '[belt]\nrepo = "a/b"\n\n[[station]]\nid = "triage"\n\n[[station]]\nid = "triage"\n';
    expect(() => parseLine(toml)).toThrow(/Duplicate station id/);
  });

  it('rejects an unknown worker type', () => {
    const toml = '[belt]\nrepo = "a/b"\n\n[[station]]\nid = "triage"\nworker = "robot"\n';
    expect(() => parseLine(toml)).toThrow(/worker must be one of human, agent/);
  });

  it('accepts agent workers and non-arrival cords, which v1 does not use yet', () => {
    const toml = '[belt]\nrepo = "a/b"\n\n[[station]]\nid = "triage"\nworker = "agent"\ncord = "on-stuck"\n';
    expect(parseLine(toml).stations[0]).toMatchObject({ worker: 'agent', cord: 'on-stuck' });
  });

  it('explains malformed TOML instead of leaking the parser error', () => {
    expect(() => parseLine('[belt\n')).toThrow(/andon\.toml is not valid TOML/);
  });
});
