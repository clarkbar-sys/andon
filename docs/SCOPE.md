# Andon — v1 Scope

> Named after the **andon cord**: the moment the line stops and a human gets pulled in.

Andon gamifies the pull-request workflow. GitHub/Forgejo issues ride a **conveyor belt**
through **stations** you define. When a station needs a human, the **cord is pulled** and
you get pinged. Your **score** is issues closed by a merged PR — closing an issue without
a PR scores nothing (it falls off the end of the belt into the compost bin).

This document is the scaffolding for v1, distilled from the founding design discussion.

## The metaphor → forge primitives

| Game concept | Forge primitive |
|---|---|
| Conveyor belt | The issue backlog, rendered as a moving line |
| Station | A pipeline stage an issue must pass through (triage → scope → build → review) |
| Issue position on belt | A label (`station:<id>`) — visible in the forge, survives Andon being down |
| Andon cord | A "human needed here" event, distinct from "issue is at station" |
| Score | Issues closed via merged PR (`closes #N` linkage) |

The forge is always the source of truth. Andon owns no workflow state it cannot
reconstruct from labels, comments, and PR linkage.

## Decisions (v1)

1. **Station state lives in labels** (`station:<id>`). Portable across GitHub and
   Forgejo, editable by other tools/agents, and Andon just renders truth.
2. **Forgejo is a first-class target.** Forgejo/Gitea has issues, labels, comments,
   PRs, and webhooks in a near-GitHub shape (no Projects v2 — another reason labels
   won). All forge access goes through a thin **forge client** interface with GitHub
   and Forgejo adapters.
3. **Stations act through comments.** A station can post issue comments and PR
   comments as it works (classification notes, scoping output, review nudges).
4. **No backend in v1.** The PWA talks straight to the forge API with a token.
   Notifications are local: an hourly "check the line" ping while the app is
   installed. (Platform honesty: periodic background wake works on Android/Chrome
   via Periodic Background Sync; iOS PWAs cannot self-wake, so iOS gets
   badge/notification on open. A push backend is a later, deliberate upgrade.)
5. **The line is a config file** — `andon.toml` at the repo root. Issues and PRs
   change the line; *we* define the line, in versioned config. TOML over Markdown
   because stations need structured fields (id, worker type, entry label, cord
   rules) and TOML keeps comments.
6. **Single repo per belt.** Multi-repo later, likely via query string
   (`?repo=owner/name`) — the config format takes a repo field now so this stays
   cheap.
7. **Every station is human in v1**, but a station's definition carries
   `worker = "human"` from day one. Agent support later is "add a worker type"
   plus a DAG/flowchart editor for agent prompts — an editor over the same config,
   not a new system.
8. **Cord semantics are future-proofed.** In v1 every arrival at a station pulls
   the cord (all stations are human). When agents arrive, the semantics invert:
   agents work silently and the cord goes up only when one is stuck — the actual
   Toyota meaning. "Cord pulled" is therefore modeled as its own event, not
   inferred from "issue present at station."
9. **Scoring:** total score, score this week, and average belt-transit time.
   Transit time is the stat that drops when automation lands.
10. **Game vibe is mandatory.** This is a game, not a kanban board with rounded
    corners. Animated belt, issues as boxes, cord-pull moment, lights. Mockup
    first (see the belt-view epic).

## Issue scoping convention

Issues are labeled with the model tier their complexity dictates:

- `model:sonnet` — well-specified, mechanical, low ambiguity
- `model:opus` — moderate design judgement, cross-cutting concerns
- `model:fable` — open-ended design, novel UI/UX, architectural decisions

## v1 slice

An installable PWA showing the belt: stations from `andon.toml`, issue cards
flowing through, andon lights, cord-pull notifications (hourly local ping),
score panel. All-human stations. One repo. GitHub adapter first, Forgejo adapter
close behind.

Out of scope for v1: push notification backend, agent workers, DAG editor,
multi-repo belts, sounds (stretch: lo-fi factory ambience 🎧).
