/**
 * Closing keywords, spelled the same on GitHub and Forgejo/Gitea. A cross-repo
 * reference (`closes owner/repo#5`) deliberately does not match: one belt runs
 * one repo, so an issue elsewhere is not ours to score.
 */
const CLOSING_REF = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b\s*:?\s*#(\d+)/gi;

/** Issue numbers a PR promises to close, deduped and in ascending order. */
export function parseClosingRefs(...texts: (string | null | undefined)[]): number[] {
  const found = new Set<number>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(CLOSING_REF)) {
      const number = Number(match[1]);
      if (Number.isSafeInteger(number) && number > 0) found.add(number);
    }
  }
  return [...found].sort((a, b) => a - b);
}
