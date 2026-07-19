# Bootstrapping this framework on a new machine

These four files are copies of the live mechanism (normally at `~/.claude/` directly). To set up
on a new machine:

1. **`CLAUDE.md`** → copy to `~/.claude/CLAUDE.md`. If a global `CLAUDE.md` already exists there,
   merge the "Memory Practices" section in rather than overwriting the whole file.
2. **`memory-lint.js`** → copy to `~/.claude/scripts/memory-lint.js` (create the `scripts/`
   folder if it doesn't exist). Requires Node.js on PATH.
3. **`memory-lint.config.json`** → copy to `~/.claude/memory-lint.config.json`.
4. **`settings.hooks.json`** → merge its `hooks.SessionStart` and `hooks.PostToolUse` arrays into
   `~/.claude/settings.json`'s own `hooks` object. Don't overwrite `settings.json` wholesale — it
   holds unrelated personal settings (model, theme, notifications, etc.) that aren't part of this
   framework and shouldn't come from this repo.
5. Clone (or re-point) this repo itself to `~/.claude/memory/` on the new machine, so the
   `SessionStart` hook (which reads `~/.claude/memory/MEMORY.md`) and the linter (which expects a
   folder literally named `memory`) have something to point at.
6. Open `/hooks` once (or restart Claude Code) — the settings watcher may not pick up a first-time
   `hooks` key addition to an existing `settings.json` without a manual reload.

## Keeping these in sync

These are **copies**, not symlinks (Windows symlinks need Developer Mode/admin rights, which felt
like more fragility than this was worth). Whenever the live files at `~/.claude/CLAUDE.md`,
`~/.claude/scripts/memory-lint.js`, or `~/.claude/memory-lint.config.json` change, re-copy them
here (and re-extract the `hooks` object from `~/.claude/settings.json` into
`settings.hooks.json`) before the next push — otherwise this bundle silently drifts from what's
actually running. There's no automated drift check yet (see `docs/memory-framework-ideas.md` for
the idea of adding one).
