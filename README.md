# claude-code-agent-memory-framework

Fancy name for a series of skills and hooks to improve CC memory and knowledge management, adding
global-storing and surgical context retrieval among agents.

This repo is the **global** tier of a two-tier memory system for Claude Code (the Anthropic CLI
coding agent), built up across working sessions in `doodle-code-challenge` and meant to apply to
*any* project on this machine, not just that one.

## What lives here vs. what lives elsewhere

Claude Code gives every project its own memory folder automatically
(`~/.claude/projects/<project>/memory/`), auto-loaded into that project's sessions. That's the
**project tier** — facts tied to one repo's code, build state, or history. It is *not* covered by
this repo; each project keeps its own.

This repo is the **global tier**: facts that hold regardless of which project is open — a
language/framework/tool quirk, an infra pattern, a personal habit or preference, a cross-repo
sequencing rule. The test applied before anything lands here: *"would this still be useful with a
different project open?"*

The mechanism that makes the global tier actually reach every session normally lives on the
machine directly, at `~/.claude/` — `CLAUDE.md` (the full "Memory Practices" rules), a
`SessionStart` hook + a `PostToolUse` lint hook in `settings.json`, and the linter script +
config they call. **This repo bundles copies of all of it**, under `bootstrap/`, so the whole
framework — not just the accumulated knowledge — is portable to a new machine, not only a backup
of what's been learned. See `bootstrap/SETUP.md` for install steps and the sync caveat (these are
copies, not symlinks — they can drift from the live files if not re-copied after an edit).

## Structure

```
MEMORY.md                                    index — one line per memory file, always injected
<topic>.md                                   individual memory files (see schema below)
docs/
  memory-framework-ideas.md                  design backlog: what's built, what's next, why
bootstrap/                                   the mechanism itself, portable to a new machine
  CLAUDE.md                                  copy of ~/.claude/CLAUDE.md
  memory-lint.js                             copy of ~/.claude/scripts/memory-lint.js
  memory-backup.sh                           copy of ~/.claude/scripts/memory-backup.sh
  memory-lint.config.json                    copy of ~/.claude/memory-lint.config.json
  settings.hooks.json                        the "hooks" fragment of ~/.claude/settings.json
  settings.permissions.json                  optional permission rule, see SETUP.md
  SETUP.md                                   install steps + how to keep the copies in sync
projects/                                    per-project memory BACKUPS (see below) — not
                                              reusable "global tier" knowledge, just a mirror
  <project-name>/                            copy of that project's own memory/ folder
```

## Per-project backups

A `SessionEnd` hook (fires once per true session end, not per turn) copies whichever project you
were actively working in — its own local `memory/` folder — into `projects/<project-name>/` here,
and pushes. This is a **backup/portability mechanism for project-tier memory**, distinct from the
global tier above: it's a mirror of what already exists locally, not curated reusable knowledge.
Scope is the currently active project only, each time — not a sweep of every project on the
machine. A cheap pattern-match guardrail skips the push (with a warning, not silently) if
anything in that project's memory looks like a credential (private key headers, common API-key/
password patterns) — a second layer behind the sensitive-data rule in `CLAUDE.md`, not a
replacement for it.

**⚠️ This repo is public, and per-project memory can be more specific than the global tier**
(deadlines, submission status, eventually client/employer specifics). Backing it up here was a
deliberate choice made with that tradeoff in mind — acceptable for now since this is a personal
machine and nothing here has been sensitive so far, but worth periodically re-checking as more
projects accumulate backups. **A configurable backup destination (e.g. a separate private repo)
is planned but not yet built** — see `docs/memory-framework-ideas.md`.

## Memory file schema

Each memory file (not `MEMORY.md` or `README.md`) has YAML frontmatter:

```yaml
---
name: topic-first-kebab-case-slug   # must match the filename
description: "one-line summary, used for relevance matching"
metadata:
  node_type: memory
  type: project                      # user | feedback | project | reference
  modified: <date>
  status: archived                   # optional; only valid value, means "kept for history, not indexed"
---

Body: the fact/rule, usually with **Why:** and **How to apply:** lines.
```

Note: the project-tier schema (in each repo's own local `memory/` folder) also carries an
`originSessionId` field for local provenance. It's deliberately omitted here — this repo is
public, and a session identifier is an unnecessary identifier to publish. See the sensitive-data
rule in `CLAUDE.md`.

Naming: kebab-case, topic-first (subject before modifier), one topic per file, no dates or verbs
in the filename. Cross-file references use `[[name]]` wikilinks — but only within this same
folder; a project-tier memory pointing at something here uses a plain-text filename reference
instead, since cross-folder wikilink resolution is unverified.

## Enforcement, not just convention

A `PostToolUse` hook lints every edit to a file in a folder literally named `memory` (this one, and
any project's): required frontmatter fields, valid `type`/`status` values, no duplicate `name`
slugs, no dangling `[[wikilink]]`s, no orphaned (unindexed, non-archived) files, `MEMORY.md` line
length and count against configurable soft caps. Schema violations block with a reason fed back to
the agent; threshold breaches surface as a warning only. See `docs/memory-framework-ideas.md` for
why this — a hook that can reject a bad write — is a meaningfully stronger guarantee than a rule
stated in `CLAUDE.md` that the agent is merely supposed to remember.
