# Bootstrapping this framework on a new machine

These files are copies of the live mechanism (normally at `~/.claude/` directly). To set up on a
new machine:

1. **`CLAUDE.md`** → copy to `~/.claude/CLAUDE.md`. If a global `CLAUDE.md` already exists there,
   merge the "Memory Practices" section in rather than overwriting the whole file.
2. **`memory-lint.js`** and **`memory-backup.sh`** → copy to `~/.claude/scripts/` (create the
   folder if it doesn't exist). `memory-lint.js` requires Node.js on PATH; `memory-backup.sh`
   requires a bash-capable shell (git-bash on Windows) and uses `pwd -W` to get a Windows-style
   path on Windows — see the comment at the top of the script if adapting for macOS/Linux, where
   that flag doesn't exist and isn't needed (paths are already in the one form there).
3. **`memory-lint.config.json`** → copy to `~/.claude/memory-lint.config.json`.
4. **`settings.hooks.json`** → merge its `hooks.SessionStart`, `hooks.PostToolUse`, and
   `hooks.SessionEnd` arrays into `~/.claude/settings.json`'s own `hooks` object. Don't overwrite
   `settings.json` wholesale — it holds unrelated personal settings (model, theme, notifications,
   etc.) that aren't part of this framework and shouldn't come from this repo.
5. **`settings.permissions.json`** → optional. Only needed if you plan to manually test
   `memory-backup.sh` by invoking it directly through Claude's Bash tool during a conversation —
   the auto-mode classifier gates interactive tool calls (including ones that shell out to `git
   push`), but does NOT gate hook execution itself (hooks run as trusted, pre-configured
   automation once written into `settings.json` — confirmed via Claude Code's own hooks
   documentation). So this permission rule exists purely to reduce friction during manual
   testing/debugging, not because the `SessionEnd` hook needs it to function.
6. Clone (or re-point) this repo itself to `~/.claude/memory/` on the new machine, so the
   `SessionStart` hook (which reads `~/.claude/memory/MEMORY.md`), the linter, and the backup
   script (which pushes here) all have something to point at.
7. Open `/hooks` once (or restart Claude Code) — the settings watcher may not pick up a first-time
   `hooks` key addition to an existing `settings.json` without a manual reload.

## What `memory-backup.sh` does

A `SessionEnd` hook (fires once per true session end — closing/exiting, `/clear`, `/resume`ing
elsewhere, or compaction; **not** per turn, which is what the `Stop` event fires on and why this
uses `SessionEnd` instead) that copies the *currently active project's* memory folder into
`projects/<project-name>/` in this repo and pushes. Scope is deliberately just the active project
each time, not a sweep of every project on the machine — see `docs/memory-framework-ideas.md` for
the full rationale, including a cheap secret-pattern guardrail that skips the push (with a
warning, not a silent failure) if anything in that project's memory looks like a credential.

**⚠️ Reminder (this repo is public):** anything backed up here becomes world-readable. The
guardrail catches obvious secret patterns, not everything — the real backstop is the sensitive-
data rule in `CLAUDE.md` applied *before* something gets written to memory in the first place. As
of now, the backup location is hardcoded to this repo; a configurable destination (e.g. a private
repo, or a user-chosen path) is a planned improvement, not yet built.

## Keeping these in sync

These are **copies**, not symlinks (Windows symlinks need Developer Mode/admin rights, which felt
like more fragility than this was worth). Whenever the live files at `~/.claude/CLAUDE.md`,
`~/.claude/scripts/memory-lint.js`, `~/.claude/scripts/memory-backup.sh`, or
`~/.claude/memory-lint.config.json` change, re-copy them here (and re-extract `hooks`/
`permissions` from `~/.claude/settings.json`) before the next push — otherwise this bundle
silently drifts from what's actually running. There's no automated drift check yet (see
`docs/memory-framework-ideas.md` for the idea of adding one).
