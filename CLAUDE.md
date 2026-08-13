# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Andon gamifies the pull-request workflow: issues ride a conveyor belt through
stations defined in `andon.toml`; when a station needs a human, the andon cord
is pulled. Score = issues closed by merged PRs. See `docs/SCOPE.md` for the
full v1 scope and design decisions — read it before making architectural
choices, it is the source of truth for intent.

The v1 slice is an installable PWA with no backend, talking directly to the
forge API with a token.

## Stack and commands

Vite + TypeScript + Svelte 5 (runes), `vite-plugin-pwa` for the manifest and
service worker, `smol-toml` for `andon.toml`. Deployed to GitHub Pages from
`main`, so the build carries a `/andon/` base path (`ANDON_BASE` overrides it).

```sh
npm run dev      # http://localhost:5173/andon/
npm run check    # svelte-check — must be clean
npm test         # vitest
npm run build
```

Where things live: `src/lib/forge/` (forge-client interface + adapters),
`src/lib/line/` (config parse/load/cache), `src/lib/components/` (belt,
stations, lamps, HUD).

## Architecture principles (from docs/SCOPE.md)

- **The forge is the source of truth.** Andon owns no workflow state it cannot
  reconstruct from labels, comments, and PR linkage. Station position lives in
  `station:<id>` labels, not in Andon.
- **Forge access goes through a thin forge-client interface** with GitHub and
  Forgejo adapters. Forgejo is first-class, not an afterthought — avoid
  GitHub-only primitives (e.g. Projects v2).
- **The line is versioned config** (`andon.toml` at the repo root). Changing
  the workflow means changing that file, not code.
- **"Cord pulled" is its own event**, not inferred from "issue is at a
  station" — the semantics invert when agent workers land, so keep the two
  concepts separate in any model or type you write.
- **Game vibe is mandatory.** Animated belt, boxes, lights — this is a game,
  not a kanban board with rounded corners.

## Working preferences

- **Never watch CI.** Do not subscribe to PR activity, monitor checks, or poll
  CI status.
- **Comments explain why, not what.** Keep them short; skip comments that
  restate the code.
- **Prefer reusable components.** When building UI or forge logic, factor
  shared pieces (e.g. the forge-client adapters, belt/station rendering) so
  they can be reused rather than duplicated per feature or per forge.

## Issue conventions

Issues are labeled with the model tier their complexity dictates:
`model:sonnet` (mechanical, well-specified), `model:opus` (moderate design
judgement), `model:fable` (open-ended design or architecture).
