import { beforeAll, describe, expect, it } from 'vitest';
import { createForgejoClient } from './forgejo';
import { ForgeError, parseRepoRef, type ForgeClient, type RepoRef } from './types';

/**
 * Live verification against a real Forgejo instance — the half of #12 that
 * mocked tests cannot cover. Skipped unless the environment names an instance,
 * so `npm test` stays hermetic.
 *
 *   ANDON_FORGEJO_URL=https://forge.example \
 *   ANDON_FORGEJO_TOKEN=... \
 *   ANDON_FORGEJO_REPO=owner/name \
 *   ANDON_FORGEJO_ISSUE=1 \
 *   npm run test:forgejo
 *
 * Without ANDON_FORGEJO_ISSUE only read operations run. With it, the mutation
 * checks apply and remove a label on that issue and post one comment to it —
 * point it at a scratch issue.
 */
const url = process.env.ANDON_FORGEJO_URL;
const token = process.env.ANDON_FORGEJO_TOKEN;
const slug = process.env.ANDON_FORGEJO_REPO;
const scratch = Number(process.env.ANDON_FORGEJO_ISSUE ?? '');
const stationLabel = process.env.ANDON_FORGEJO_LABEL ?? 'station:triage';

const configured = Boolean(url && token && slug);
const writable = configured && Number.isSafeInteger(scratch) && scratch > 0;

/** What a human running this actually wants: a readout, not just green ticks. */
function report(what: string, detail: unknown): void {
  console.log(`  · ${what}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

describe.skipIf(!configured)('forgejo, live', () => {
  let client: ForgeClient;
  let repo: RepoRef;

  beforeAll(() => {
    client = createForgejoClient({ token: token!, instanceUrl: url! });
    repo = parseRepoRef(slug!);
  });

  it('authenticates and names the token holder', { timeout: 30_000 }, async () => {
    const identity = await client.getIdentity();

    expect(identity.login).toBeTruthy();
    report('signed in as', identity.login);
  });

  it('reads andon.toml, and reports a missing path as null', { timeout: 30_000 }, async () => {
    const missing = await client.getFileText(repo, 'no-such-file.toml');
    expect(missing).toBeNull();

    const toml = await client.getFileText(repo, 'andon.toml');
    report('andon.toml', toml === null ? 'absent — the line lives elsewhere' : `${toml.length} bytes`);
  });

  it('lists issues without letting pull requests onto the belt', { timeout: 30_000 }, async () => {
    const [issues, pulls] = await Promise.all([
      client.listIssues(repo),
      client.listPullRequests(repo, { state: 'open' }),
    ]);
    const pullNumbers = new Set(pulls.map((pull) => pull.number));

    expect(issues.every((issue) => !pullNumbers.has(issue.number))).toBe(true);
    expect(issues.every((issue) => issue.state === 'open')).toBe(true);
    report('open issues', issues.length);
    report('labels seen', [...new Set(issues.flatMap((issue) => issue.labels))]);
  });

  it('reads merge state and closing links off pull requests', { timeout: 30_000 }, async () => {
    const pulls = await client.listPullRequests(repo, { state: 'closed' });
    for (const pull of pulls) {
      // A merge timestamp with no merged flag would make scoring lie.
      if (pull.mergedAt !== null) expect(pull.merged).toBe(true);
    }

    const linking = pulls.filter((pull) => pull.closes.length > 0);
    report('closed PRs', pulls.length);
    report('with `closes #N`', linking.map((pull) => `#${pull.number} → ${pull.closes.join(', ')}`));

    if (pulls.length > 0) {
      const one = await client.getPullRequest(repo, pulls[0].number);
      expect(one.number).toBe(pulls[0].number);
      expect(one.merged).toBe(pulls[0].merged);
    }
  });

  it('pairs closed issues with the PR that closed them', { timeout: 30_000 }, async () => {
    const closed = await client.listClosedIssues(repo);

    for (const entry of closed) {
      if (entry.closedBy) expect(entry.closedBy.closes).toContain(entry.issue.number);
    }
    const scored = closed.filter((entry) => entry.closedBy?.merged);
    report('closed issues', closed.length);
    report('scoring (closed by a merged PR)', scored.map((entry) => `#${entry.issue.number}`));
    report('compost (closed with no merged PR)', closed.length - scored.length);
  });

  it('refuses a label the instance does not have', { timeout: 30_000 }, async () => {
    const absent = 'andon-live-check-no-such-label';

    await expect(client.addLabel(repo, scratch || 1, absent)).rejects.toBeInstanceOf(ForgeError);
    await expect(client.addLabel(repo, scratch || 1, absent)).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('reports the polling budget, if the instance enforces one', { timeout: 30_000 }, async () => {
    await client.listIssues(repo);

    // Forgejo only sends these headers when rate limiting is switched on.
    report('rate limit', client.rateLimit() ?? 'not reported by this instance');
  });

  describe.skipIf(!writable)('mutations', () => {
    it('moves a station label by name and puts it back', { timeout: 30_000 }, async () => {
      const before = (await client.listIssues(repo, { state: 'all' })).find(
        (issue) => issue.number === scratch,
      );
      expect(before, `issue #${scratch} not found in ${slug}`).toBeDefined();
      const held = before!.labels.includes(stationLabel);

      await client.addLabel(repo, scratch, stationLabel);
      const applied = await client.listIssues(repo, { state: 'all' });
      expect(applied.find((issue) => issue.number === scratch)?.labels).toContain(stationLabel);

      await client.removeLabel(repo, scratch, stationLabel);
      // Removing a label that is already gone must stay a no-op, not a 404.
      await client.removeLabel(repo, scratch, stationLabel);

      if (held) await client.addLabel(repo, scratch, stationLabel);
      report('label move', `${stationLabel} applied and removed on #${scratch}`);
    });

    it('speaks as a station', { timeout: 30_000 }, async () => {
      await client.commentOnIssue(repo, scratch, 'Andon live check — the forge client can comment.');
      report('comment', `posted on #${scratch}`);
    });
  });
});
