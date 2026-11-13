# Design

What this plugin is for, the rules it follows, and the decisions behind it. Reviewed with the
user on 2026-11-12. Decision IDs (DR1…) match that review. How to install and configure it is in
the [README](../README.md), and the order of work is in the [roadmap](roadmap.md).

## Terms

- **Project repo**: the project you are working on.
- **Plugin code repo**: `claude-code-agent-memory-framework`, this repo.
- **Agent-memory folder**: your memory data on disk (default `~/.agent-memory/`).
- **Backup repo**: the private git remote the agent-memory folder pushes to.
- **Built-in memory**: Claude Code's own per-project notes in
  `~/.claude/projects/<project>/memory/`, which Claude Code writes and loads by itself.
- **Hook**: a script Claude Code runs on an event. `SessionStart` runs when a session opens,
  `Stop` after each answer, `PostToolUse` / `PreToolUse` after or before a tool call, and
  `SessionEnd` when the session closes.
- **Note states**: **trusted** (you approved it), **draft** (saved, not yet reviewed),
  **queued** (you deferred deciding whether it is worth keeping).

## Goals

- **G1. A global tier.** Lessons that matter in every project load in every session.
- **G2. Enforcement over hope.** Scripts reject bad notes, instead of trusting Claude to follow
  written rules.
- **G3. Private storage apart from the code.** The code is public; your notes are not.
- **G4. Small, deliberate memory.** You decide what becomes trusted memory.
- **G5. Publishable.** Other people can install it with one command.

## Principles

1. **Two tiers.** A note is global if it would still be useful in a different project;
   otherwise it is a project note.
2. **Enforce what can be enforced.** In order of reliability: an automatic check, then a check
   against reality, then a choice you confirm, then a written rule.
3. **You decide what becomes trusted.** Claude may capture freely. Trust needs your click.
4. **Plain markdown in git.** Every note can be read, diffed and edited. No database.
5. **Check before building.** Claude Code behaviour we rely on is tested live, not assumed.
6. **Sit on top of built-in memory, never replace it.** Same file format, so Anthropic's
   improvements keep working.
7. **Fix the expensive failures first** (see the table below).
8. **Never trust an old note blindly.** If it names a file, a tool or a URL, check that it still
   exists before acting.
9. **Every automatic failure stays visible until fixed,** as an alert at each session start.
10. **Zero footprint in files we don't own.** The plugin never writes `CLAUDE.md` and never adds
    its own fields to Claude Code's notes or `MEMORY.md`.
11. **Your memory belongs to you, not to the plugin.** Updating, uninstalling or reinstalling the
    plugin never touches your notes.

## Memory lifecycle

```
 Claude spots something worth keeping (or you say "remember")
                  │
   Stop hook: Claude asks one multiple-choice question,
   with the drafted note in a preview pane              (DR1, DR3)
   ├─ Save as is ───────────────► TRUSTED
   ├─ Save, review later ───────► DRAFT ──┐  loaded, marked unverified (DR2)
   ├─ Defer ────────────────────► QUEUED ─┤  not loaded (DR6)
   └─ Discard ──► never suggested again   │
                                          ▼
          /review, any time (DR4) ─── or re-offered after N answers / M minutes
                                          │
                       promote ► TRUSTED · edit · merge · discard · defer again
 TRUSTED ──(stale, superseded)──► ARCHIVED: kept for history, dropped from the index
```

- **DR1. In-session triage.** One question per candidate, so a good note costs one click. This
  replaces the earlier `/harvest` design, where Claude proposed at most 3 notes for you to
  approve.
- **DR2. Drafts are used before review, marked unverified.** Fresh lessons matter most right
  away. Claude checks a draft before relying on it (principle 8).
- **DR3. Asking happens in the `Stop` hook,** after an answer, when you are reading anyway. A new
  candidate is asked about at once; the queue is re-offered only after N answers or M minutes,
  with a cap per session and a loop guard (`stop_hook_active`). Background or headless sessions
  get no questions. Why not other hooks: `SessionEnd` cannot ask anything, and `UserPromptSubmit`
  would interrupt the task you just typed. `SessionStart` only shows the pending count.
- **DR4. `/review` on demand,** for drafts and the queue together. It also absorbs the old
  `/hygiene` idea: re-checking trusted notes against reality.
- **DR5. Each draft records** `source` (`user-said`, `verified`, `inferred`) and `confidence`
  (`high`, `medium`, `low`). How the two rank notes in `/review` is still open.
- **DR6. Queued items live in `queue/` inside the agent-memory folder.** Synced like notes, but
  never loaded, linted or indexed.
- **DR7. Backstop: an approval token.** "Save as is" records an approval. Marking a note trusted
  with no matching approval makes a `PreToolUse` hook raise Claude Code's own approve/deny prompt
  (`permissionDecision: "ask"`). Nothing becomes trusted without your click, and you are never
  asked twice.

## Failure modes and what covers them

| How memory fails | Cost | Covered by |
|---|---|---|
| A lesson is never saved | High | DR1/DR3: asked in session |
| A note goes stale | High | `expires` warning; `/review` re-checks (DR4) |
| A note is wrong | High | Drafts stay unverified until you review them (DR2); `/review` |
| A note exists but is not recalled | Low now | Whole index loaded; tag-based loading at ~25 global notes |
| Notes are lost | Medium | Git backup with sticky alerts; heartbeat (DR8); auto-restore (DR10) |
| A note is malformed | Low | Linter |
| Private data leaks | High | Private backup repo; secret and session-ID checks; home-path warning (DR12) |

## Enforcement map

- **Enforced by code:** note format, index and links (linter); registry and notes agree (DR14);
  no secrets or session IDs in a commit (backup hook); trusted only with approval (DR7);
  failures surfaced as alerts (DR8).
- **Warned, not blocked:** absolute home paths in notes (DR12); size thresholds.
- **Still a written rule:** choosing the tier, writing good notes, checking drafts before
  relying on them.

## Data layout

| Home | Holds | Survives update | Survives uninstall |
|---|---|---|---|
| Install folder (`${CLAUDE_PLUGIN_ROOT}`) | Code, read-only | No: replaced each version | No |
| Plugin data (`${CLAUDE_PLUGIN_DATA}`) | Disposable state: heartbeat, approval tokens, alerts | Yes | No |
| Agent-memory folder (`~/.agent-memory/`) | Global notes, `queue/`, `projects/` backups, lifecycle registry; plus local-only `.state/` with the provenance ledger | Yes | Yes |
| Built-in memory (Claude Code's) | Project notes, plain Claude Code format | Yes | Yes. Not ours: we only read it |

- **DR13 (principle 11).** Claude Code's docs say not to keep state in the install folder, and
  the plugin data folder is deleted on uninstall. So durable knowledge lives only in the
  agent-memory folder, which is outside `~/.claude`.
- **DR14. Lifecycle data lives in a registry** in the agent-memory folder, not in note
  frontmatter: draft or trusted, source, confidence, reviewed date, origin ref. Notes stay plain
  Claude Code format (principle 10), and session start lists the unverified drafts. *Wrong if*
  Claude forgets mid-session that a note it opened is a draft; then add one marker line to
  drafts only.
- **DR9 (principle 10).** No `CLAUDE.md` changes, not even a pointer. The rules come only from
  the `SessionStart` hook. If that hook stops running, the DR8 heartbeat raises an alert.

## Storage, sync, provenance, restore

- **Sync.** Session start pulls with fast-forward only, giving up after 5 seconds. Session end
  copies project memory into `projects/<name>/`, commits and pushes. A failure becomes an alert
  that stays until the operation succeeds.
- **Provenance.** Commits and the registry carry `<machine>/<ref>`. The ref → session ID, host,
  user and transcript mapping stays on the machine that made it. Transcripts and raw session
  IDs never leave the machine.
- **DR8. Every hook writes a heartbeat; unexpected errors become alerts.** Session start raises
  an alert when the backup has not run for N days.
- **DR10. Auto-restore.** If a project's built-in memory folder is empty and a backup exists,
  session start copies it back. It never overwrites.
- **DR11. Linter cost.** Starting any process here costs 70–100 ms, so switching runtime would
  not help. Instead, the hook's `if` filter (`Edit(//**/memory/*.md)`,
  `Edit(//**/.agent-memory/*.md)`) stops Claude Code from starting it for other files. A custom
  storage path needs its own filter.
- **DR12. Home-path warning.** The linter warns, without blocking, about absolute paths that
  contain a username.

## Open items

| Item | Blocks | Fallback | Decide by |
|---|---|---|---|
| Confidence/ranking system (DR5) | Only the order of `/review` | Show oldest first | Before Phase 5 |
| Can a hook see your answer to the multiple-choice question? (DR7) | The approval token | Always ask on trusted writes | Phase 3, before Phase 4 |
| How to detect an interactive session (DR3) | Skipping questions in background sessions | Env clues (`CLAUDE_JOB_DIR`, `CLAUDE_CODE_REMOTE`) | Phase 3, before Phase 4 |
| `//` anchoring and Windows paths in `if` (DR11) | Only the linter speed-up | Today's linter | Start of Phase 2b |
| Our `config.json` vs native plugin options | Config location | Keep `config.json` | Phase 2b |
| Branding (also names `.agent-memory`) | Publishing | Working name | Before publishing |
