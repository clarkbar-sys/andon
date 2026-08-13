#!/usr/bin/env bash
#
# Publishes a built site into the gh-pages branch: the live site at the root,
# PR previews under pr-preview/pr-<n>/. Pages only serves one branch, so the
# deploy and preview workflows both land here and race for the tip — hence the
# fetch-apply-push retry rather than a single push.
#
#   publish-pages.sh <dist-dir> [subdir]   publish a directory
#   publish-pages.sh --remove <subdir>     take a preview back down
set -euo pipefail

worktree="${RUNNER_TEMP:-/tmp}/gh-pages-worktree"
message="${PAGES_MESSAGE:-Publish site}"

if [ "${1:-}" = "--remove" ]; then
  mode=remove
  subdir="${2:?usage: publish-pages.sh --remove <subdir>}"
else
  mode=publish
  src="$(cd "${1:?usage: publish-pages.sh <dist-dir> [subdir]}" && pwd)"
  subdir="${2:-}"
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

stage() {
  rm -rf "$worktree"
  git worktree prune
  local start
  if git fetch --depth=1 origin gh-pages 2>/dev/null; then
    start=FETCH_HEAD
  else
    # First publish: an empty root commit to branch from.
    start="$(git commit-tree "$(git hash-object -t tree /dev/null)" -m 'Start gh-pages')"
  fi
  git worktree add --detach "$worktree" "$start" >/dev/null
}

apply() {
  if [ "$mode" = remove ]; then
    rm -rf "${worktree:?}/$subdir"
    rmdir "$(dirname "${worktree:?}/$subdir")" 2>/dev/null || true
  elif [ -n "$subdir" ]; then
    rm -rf "${worktree:?}/$subdir"
    mkdir -p "$worktree/$subdir"
    cp -R "$src/." "$worktree/$subdir/"
  else
    # Replace the site, but leave the open PRs' previews standing.
    find "$worktree" -mindepth 1 -maxdepth 1 ! -name .git ! -name pr-preview -exec rm -rf {} +
    cp -R "$src/." "$worktree/"
  fi
  touch "$worktree/.nojekyll"
}

for attempt in 1 2 3 4 5; do
  stage
  apply
  git -C "$worktree" add -A
  if git -C "$worktree" diff --cached --quiet; then
    echo "gh-pages is already up to date"
    exit 0
  fi
  git -C "$worktree" commit -q -m "$message"
  # Fully qualified: git will not create an unknown branch from a bare name.
  if git -C "$worktree" push -q origin HEAD:refs/heads/gh-pages; then
    echo "gh-pages updated: $mode ${subdir:-the site}"
    exit 0
  fi
  echo "gh-pages moved under us, retrying ($attempt)"
  sleep $((attempt * 3))
done

echo "could not publish to gh-pages after 5 attempts" >&2
exit 1
