# `andon.toml` — the line

The line is versioned config, not app state (`SCOPE.md` decision 5). Andon
reads `andon.toml` from the **root of the target repo's default branch**, so
changing the workflow is a pull request against that file, reviewable like any
other change.

Andon renders this file; the forge (labels, comments, PR linkage) holds the
live state. A config Andon cannot run stops the line and says why — it never
renders a half-line or a blank screen.

## `[belt]`

| Key | Required | Default | Notes |
|---|---|---|---|
| `name` | no | `The line` | Shown in the HUD. |
| `repo` | **yes** | — | `owner/name`. One repo per belt (decision 6). |
| `forge` | no | `github` | `github` or `forgejo`. |

## `[[station]]`

One table per station, in belt order — first is the head of the line, last is
the end. At least one is required.

| Key | Required | Default | Notes |
|---|---|---|---|
| `id` | **yes** | — | Lower-case letters, digits and dashes. Unique. |
| `name` | no | the `id` | Shown on the station card. |
| `worker` | no | `human` | `human` or `agent`; v1 runs `human` only. |
| `label` | no | `station:<id>` | Must start with `station:`. Unique. |
| `does` | no | `""` | One line describing the station's job. |
| `cord` | no | `on-arrival` | `on-arrival`, `on-stuck` or `never`; v1 runs `on-arrival` only. |

An issue's position on the belt is the `station:` label it carries — that is
the whole state model (decision 1). Issues with no station label sit in the
inbox at the head of the belt.

`worker` and `cord` accept a wider vocabulary than v1 runs, and a config using
the rest is rejected with "not supported yet" rather than accepted and ignored.
The names exist now so agent workers land as a code change instead of a config
format change (decisions 7 and 8).

## `[score]`

| Key | Required | Default | Notes |
|---|---|---|---|
| `window` | no | `week` | `day`, `week`, `month` or `all`. |
| `show` | no | all three | Any of `total`, `window`, `transit-time`. |

An issue only scores when it is closed by a merged PR (decision 9).

## When the line is bad

`parseLine` reports **every** fault it finds in one pass, so a broken config is
fixed in one edit: missing or malformed `repo`, unknown keys (a typo'd `chord`
is an error, not a silently defaulted `cord`), ids that cannot become labels,
labels off the `station:` convention, duplicate ids or labels, values outside a
field's vocabulary, and values the format knows but v1 cannot run. Andon shows
the list on a stopped line with a link to the file in the forge.
