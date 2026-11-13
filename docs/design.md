# Design

What this plugin is for, the rules it follows, and the decisions behind it. Reviewed with the
user on 2026-11-12/13; decision IDs (DR…) match that review. Decisions tagged with a phase are
the target design, not yet built. How to install and configure what exists today is in the
[README](../README.md); the order of work is in the [roadmap](roadmap.md).

## Terms

- **Project repo**: the project you are working on.
- **Plugin code repo**: `claude-code-agent-memory-framework`, this repo.
- **Agent-memory folder**: your memory data on disk (default `~/.agent-memory/`).
- **Backup repo**: the private git remote the agent-memory folder pushes to.
- **Layers**:
  - **global**: useful in every project.
  - **local**: useful in one project.
  - **built-in**: Claude Code's own per-project notes in `~/.claude/projects/<project>/memory/`.
    Claude Code writes and loads them; for us they are read-only.
- **Hook**: a script Claude Code runs on an event. `SessionStart` runs when a session opens,
  `Stop` after each answer, `PostToolUse` / `PreToolUse` after or before a tool call, and
  `SessionEnd` when the session closes.
- **Note states**: **trusted** (you approved it), **draft** (saved, not yet reviewed),
  **queued** (you deferred deciding whether it is worth keeping), **archived** (kept for
  history, not loaded).

## Goals

- **G1. Global and local layers.** Lessons load in every session (global) or in their project
  (local).
- **G2. Enforcement over hope.** Scripts reject bad notes, instead of trusting Claude to follow
  written rules.
- **G3. Private storage apart from the code.** The code is public; your notes are not.
- **G4. Small, deliberate memory.** You decide what becomes trusted memory.
- **G5. Publishable.** Other people can install it with one command.

## Principles

1. **Two of our own layers.** A note is global if it would still be useful in a different
   project; otherwise it is local.
2. **Enforce what can be enforced.** In order of reliability: an automatic check, then a check
   against reality, then a choice you confirm, then a written rule.
3. **You decide what becomes trusted.** Claude may capture freely. Trust needs your click.
4. **Plain markdown in git.** Every note can be read, diffed and edited. No database.
5. **Check before building.** Claude Code behaviour we rely on is tested live, not assumed.
6. **Read built-in memory, never write it.** It is Claude Code's. We read it as an inbox and
   promote what is worth keeping into our layers. We accept the duplication this causes (a
   promoted note may exist in both) rather than risk breaking Claude Code.
7. **Fix the expensive failures first** (see the table below).
8. **Never trust an old note blindly.** If it names a file, a tool or a URL, check that it still
   exists before acting.
9. **Every automatic failure stays visible until fixed,** as an alert at each session start.
10. **Zero footprint in files we don't own.** The plugin never writes `CLAUDE.md`, nor anything
    in Claude Code's memory folders.
11. **Your memory belongs to you, not to the plugin.** Updating, uninstalling or reinstalling the
    plugin never touches your notes.

## Memory lifecycle (Phase 4)

```
 Claude spots something worth keeping (or you say "remember")
 Claude Code wrote a built-in note we haven't triaged yet (inbox)
                  │
   Stop hook: Claude asks one multiple-choice question,
   with the drafted note (and its layer) in a preview pane   (DR1, DR3)
   ├─ Save as is ───────────────► TRUSTED   (global or local)
   ├─ Save, review later ───────► DRAFT ──┐  loaded, marked unverified (DR2)
   ├─ Defer ────────────────────► QUEUED ─┤  not loaded (DR6)
   └─ Discard ──► never suggested again   │
                                          ▼
          /review, any time (DR4) ─── or re-offered after N answers / M minutes
                                          │
                       promote ► TRUSTED · edit · merge · discard · defer again
 TRUSTED ──(stale, superseded)──► ARCHIVED
```

- **DR1. In-session triage.** One question per candidate, so a good note costs one click. It
  covers new lessons and built-in notes alike (promotion). This replaces the earlier `/harvest`
  design, where Claude proposed at most 3 notes for you to approve.
- **DR2. Drafts are used before review, marked unverified.** Fresh lessons matter most right
  away. Claude checks a draft before relying on it (principle 8).
- **DR3. Asking happens in the `Stop` hook,** after an answer, when you are reading anyway. A new
  candidate is asked about at once; the queue is re-offered only after N answers or M minutes,
  with a cap per session and a loop guard (`stop_hook_active`). Background or headless sessions
  get no questions. Why not other hooks: `SessionEnd` cannot ask anything, and `UserPromptSubmit`
  would interrupt the task you just typed. `SessionStart` only shows the pending count.
- **DR4. `/review` on demand,** for drafts, the queue and untriaged built-in notes. It also
  absorbs the old `/hygiene` idea: re-checking trusted notes against reality.
- **DR5. Each draft records** `source` (`user-said`, `verified`, `inferred`) and `confidence`
  (`high`, `medium`, `low`). How the two rank notes in `/review` is still open.
- **DR6. Queued items live in `queue/` inside the agent-memory folder.** Synced like notes, but
  never loaded, linted or indexed.
- **DR7. Backstop: an approval token.** "Save as is" records an approval. An edit that sets a
  note's `status` to trusted, with no matching approval, makes a `PreToolUse` hook raise Claude
  Code's own approve/deny prompt (`permissionDecision: "ask"`). Nothing becomes trusted without
  your click, and you are never asked twice.
- **DR14. Lifecycle data lives in each note's frontmatter** (our notes only): `tags`, `expires`,
  `status`, `source`, `confidence`, `reviewed`, `origin`. One source of truth: the note shows its
  own state when Claude opens it, and `git log` on a note shows its whole story. Chosen over a
  separate registry, which could drift from the notes and become one hot file across machines.

## Failure modes and what covers them

| How memory fails | Cost | Covered by |
|---|---|---|
| A lesson is never saved | High | DR1/DR3: asked in session; built-in notes offered for promotion |
| A note goes stale | High | `expires` warning; `/review` re-checks (DR4) |
| A note is wrong | High | Drafts stay unverified until you review them (DR2); `/review` |
| A note exists but is not recalled | Low now | Whole index loaded; tag-based loading at ~25 global notes |
| Notes are lost | Medium | Git backup with sticky alerts; heartbeat (DR8) |
| Private data leaks | High | Private backup repo; secret and session-ID checks; home-path warning (DR12) |
| A note is malformed | Low | Linter, on our folders only |

## Enforcement map

- **Enforced by code:** note format, index and links (linter, our folders only); no secrets or
  session IDs in a commit (backup hook); trusted only with approval (DR7); failures surfaced as
  alerts (DR8).
- **Warned, not blocked:** absolute home paths in notes (DR12); size thresholds.
- **Still a written rule:** choosing the layer, writing good notes, checking drafts before
  relying on them.
- **Never enforced:** anything in Claude Code's built-in memory (principle 6).

## Data layout

| Home | Holds | Survives update | Survives uninstall |
|---|---|---|---|
| Install folder (`${CLAUDE_PLUGIN_ROOT}`) | Code, read-only | No: replaced each version | No |
| Plugin data (`${CLAUDE_PLUGIN_DATA}`) | Disposable state: heartbeat, approval tokens, alerts | Yes | No |
| Agent-memory folder (`~/.agent-memory/`) | Global notes; local notes in `projects/<name>/`; read-only copies of built-in notes in `projects/<name>/native/`; `queue/`; plus local-only `.state/` with the provenance ledger | Yes | Yes |
| Built-in memory (Claude Code's) | Claude Code's project notes | Yes | Yes. Not ours: read only |

- **DR13 (principle 11).** Claude Code's docs say not to keep state in the install folder, and
  the plugin data folder is deleted on uninstall. So durable knowledge lives only in the
  agent-memory folder, which is outside `~/.claude`.
- **DR9 (principle 10).** No `CLAUDE.md` changes, not even a pointer. The rules come only from
  the `SessionStart` hook. If that hook stops running, the DR8 heartbeat raises an alert.
- **Loading.** Session start injects the global index and the current project's local index.
  Claude Code still loads its built-in memory by itself, so some notes may load twice; that is
  accepted (principle 6).

## Storage, sync, provenance

- **Sync.** Session start pulls with fast-forward only, giving up after 5 seconds. Session end
  commits and pushes. A failure becomes an alert that stays until the operation succeeds.
- **DR10. Read-only copy of built-in memory.** Session end copies the project's
  built-in notes into `projects/<name>/native/`, so they survive a lost machine and can be
  promoted from anywhere. Nothing is ever copied back into Claude Code's folder.
- **Provenance.** Notes and commits carry `<machine>/<ref>`. The ref → session ID, host, user and
  transcript mapping stays on the machine that made it. Transcripts and raw session IDs never
  leave the machine.
- **DR8. Heartbeat.** Every hook records its last run, and unexpected errors become
  alerts. Session start raises an alert when the backup has not run for N days.
- **DR11. Linter cost.** Starting any process here costs 70–100 ms, so switching
  runtime would not help. Instead, the hook's `if` filters (`Write(//**/.agent-memory/**/*.md)`
  and `Edit(...)`, since an Edit filter doesn't match Write calls) stop Claude Code from starting
  it for other files. Session start alerts if storage is outside a `.agent-memory` folder.
- **DR12. Home-path warning.** The linter warns, without blocking, about absolute
  paths that contain a username.

## Open items

| Item | Blocks | Fallback | Decide by |
|---|---|---|---|
| Confidence/ranking system (DR5) | Only the order of `/review` | Show oldest first | Before Phase 5 |
| Can a hook see your answer to the multiple-choice question? (DR7) | The approval token | Always ask on trusted writes | Phase 3, before Phase 4 |
| How to detect an interactive session (DR3) | Skipping questions in background sessions | Env clues (`CLAUDE_JOB_DIR`, `CLAUDE_CODE_REMOTE`) | Phase 3, before Phase 4 |
| How to tell which built-in notes are already triaged | The promotion inbox | List them all in `/review` | Phase 4 |
| Our `config.json` vs native plugin options | Config location | Keep `config.json` (chosen for now: native options are deleted on uninstall) | When publishing |
| Branding (also names `.agent-memory`) | Publishing | Working name | Before publishing |
