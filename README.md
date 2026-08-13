# andon 🏭

Gamified pull-request workflow. Issues ride a conveyor belt through stations;
when a station needs a human, the andon cord is pulled. Score = issues closed
by merged PRs.

See `docs/SCOPE.md` for the v1 scope, `docs/LINE-CONFIG.md` for the `andon.toml`
schema, and `andon.toml` for the line this repo runs.

## Running it

Andon is a Vite + Svelte PWA with no backend: it talks to the forge directly
with a token you paste in, stored on your device.

```sh
npm install
npm run dev      # http://localhost:5173/andon/
npm run check    # svelte-check
npm test         # vitest
npm run build    # dist/, ready for a static host
```

On first load, clock in with:

- **Forge** — GitHub or Forgejo/Gitea
- **Instance URL** — required for Forgejo, optional for GitHub Enterprise
- **Repo** — `owner/name`; its root `andon.toml` is the line
- **Access token** — read access to the repo's contents and issues, plus write
  access to issues and pull requests once stations start moving work

### Forgejo setup

The PWA calls the API straight from the browser, so a self-hosted Forgejo has
to allow cross-origin requests from wherever Andon is served. In `app.ini`:

```ini
[cors]
ENABLED = true
ALLOW_DOMAIN = https://<owner>.github.io, http://localhost:5173
METHODS = GET,POST,DELETE
HEADERS = Content-Type,Authorization
```

Without this, every request fails in the browser before it reaches Forgejo —
the console shows a CORS error while `curl` against the same instance works.

Two behaviours differ from GitHub and are worth knowing before you build a
line on Forgejo:

- **Labels must already exist.** GitHub creates a label on first use; Forgejo
  does not, so create every `station:<id>` label on the repo up front or the
  first move fails with "No label … create it on the instance first."
- **Tokens are scoped per instance.** Generate one under *Settings →
  Applications* with `read:repository` plus `write:issue`.

#### Verifying an instance

The unit tests mock the network, so they prove the adapter's shape and not
that a real Forgejo agrees with it. `npm run test:forgejo` runs the same
operations against a live instance instead, and prints what it found — issue
counts, the labels in play, which closed issues scored:

```sh
ANDON_FORGEJO_URL=https://forge.example \
ANDON_FORGEJO_TOKEN=... \
ANDON_FORGEJO_REPO=owner/name \
ANDON_FORGEJO_ISSUE=1 \
npm run test:forgejo
```

`ANDON_FORGEJO_URL`, `_TOKEN` and `_REPO` run the read-only checks.
`ANDON_FORGEJO_ISSUE` adds the mutation checks, which apply and remove
`station:triage` (override with `ANDON_FORGEJO_LABEL`) and post one comment
on that issue — point it at a scratch issue. Set none of them and the whole
file skips, which is why `npm test` stays hermetic.

**The `[cors]` block is the one thing this cannot check**, since Node has no
same-origin policy to fall foul of. Verify it in the browser: `npm run dev`,
clock in against the instance, and watch for a CORS error in the console.

The build is served from a sub-path (`/andon/` for GitHub Pages project sites).
Override it with `ANDON_BASE=/ npm run build` for a root deploy.

### Hosting

Pages serves the `gh-pages` branch: set repo **Settings → Pages → Deploy from a
branch → `gh-pages` / `(root)`** once, and the workflows keep it stocked.

- `deploy.yml` — every push to `main` rebuilds the site into the branch root,
  live at `https://<owner>.github.io/andon/`.
- `pr-preview.yml` — every PR gets its own build under
  `/andon/pr-preview/pr-<n>/`, linked from a single comment on the PR that is
  edited in place on each push and removed when the PR closes. Previews are
  skipped for forks, which get a read-only token.

Both call `.github/scripts/publish-pages.sh`, which retries against the branch
tip so a deploy and a preview publishing at once cannot clobber each other.

### Layout

```
src/lib/forge/       forge-client interface + GitHub and Forgejo adapters
src/lib/line/        andon.toml parsing, loading, offline cache
src/lib/components/  belt, stations, lamps, HUD
scripts/             icon generation (npm run icons)
```

## License

Copyright (C) 2026 the Andon contributors.

Andon is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation, either version 2 of the License, or (at your option) any later
version.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

The full license text is in [`COPYING`](COPYING). SPDX identifier:
`GPL-2.0-or-later`.
