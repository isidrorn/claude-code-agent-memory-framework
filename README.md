# Claude Code agent memory framework — global tier

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

The mechanism that makes the global tier actually reach every session lives **outside this repo**,
directly on the machine at `~/.claude/`:
- `~/.claude/CLAUDE.md` — the full "Memory Practices" rules (naming, staleness, compaction,
  global-vs-project boundary). Auto-loaded into every Claude Code session on this machine.
- `~/.claude/settings.json` — a `SessionStart` hook that injects this repo's `MEMORY.md` into
  every session (capped at 50 lines, so growth here can't silently bloat every session's context),
  and a `PostToolUse` hook that lints memory-file edits.
- `~/.claude/scripts/memory-lint.js` + `~/.claude/memory-lint.config.json` — the linter the
  `PostToolUse` hook runs (see `docs/memory-framework-ideas.md` for the full design rationale).

None of those three are version-controlled here (yet) — this repo currently backs up the
*knowledge*, not the *mechanism*. Ask if you want the mechanism bundled too, for setting this up
on a new machine in one step.

## Structure

```
MEMORY.md                                    index — one line per memory file, always injected
<topic>.md                                   individual memory files (see schema below)
docs/
  memory-framework-ideas.md                  design backlog: what's built, what's next, why
```

## Memory file schema

Each memory file (not `MEMORY.md` or `README.md`) has YAML frontmatter:

```yaml
---
name: topic-first-kebab-case-slug   # must match the filename
description: "one-line summary, used for relevance matching"
metadata:
  node_type: memory
  type: project                      # user | feedback | project | reference
  originSessionId: <session that wrote it>
  modified: <date>
  status: archived                   # optional; only valid value, means "kept for history, not indexed"
---

Body: the fact/rule, usually with **Why:** and **How to apply:** lines.
```

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
