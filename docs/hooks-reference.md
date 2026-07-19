# Hooks reference — events, firing conditions, scope, actions

Technical summary of every automated action in this framework, as of 2026-07-19. All three hooks
live in `~/.claude/settings.json` (user-level — applies to every project's sessions on this
machine), copies in `bootstrap/settings.hooks.json`. This doc complements the README (what the
framework *is*) and `docs/memory-framework-ideas.md` (design rationale/backlog) — this one is
purely the mechanics: what fires, when, on what, and what it does.

## Summary table

| Hook | Event | Matcher | Fires when | Scope of effect | Blocking? |
|---|---|---|---|---|---|
| Global index injection | `SessionStart` | — | once, at the start of every session, every project | reads `~/.claude/memory/MEMORY.md` only | no — informational |
| Memory lint | `PostToolUse` | `Write\|Edit` | after every successful Write/Edit, every project — but self-filters to near-zero cost unless the touched file is `*.md` inside a folder literally named `memory` | validates the whole memory folder the touched file lives in (global or any project's) | **yes**, for schema violations only |
| Project memory backup | `SessionEnd` | — | once per true session-end (close/exit, `/clear`, `/resume` elsewhere, compaction) — **not** per turn | copies the currently-active project's `memory/` folder into this repo's `projects/<name>/`, commits, pushes | no — never blocks session end; failures just report a message |

Design note behind the "fires when" column: `Stop` (a different, similarly-named event) fires
**once per assistant turn**, not once per session — verified against Claude Code's own hooks docs
before building anything, specifically because using the wrong event here would have made the
backup as chatty as "every edit," which was explicitly out of scope. `SessionEnd` is the actual
session-boundary event.

## 1. Global index injection (`SessionStart`)

```
f=~/.claude/memory/MEMORY.md; cap=50
if [ -f "$f" ]; then
  total=$(wc -l < "$f")
  if [ "$total" -gt "$cap" ]; then
    head -n "$cap" "$f"; echo
    echo "... (truncated: N more lines ... run a compaction pass ...)"
  else
    cat "$f"
  fi
fi; true
```

- **Fires:** at the start of every session, in every project — this is what makes the global
  memory tier reach sessions outside the repo it was written in, without the agent needing to
  remember to go read it.
- **Scope:** reads only `~/.claude/memory/MEMORY.md` (the global index) — never touches
  project-tier `MEMORY.md` files, which the harness's own built-in auto-memory system already
  injects per project.
- **Action:** prints the index (capped at 50 lines) as additional context. Above the cap, prints a
  truncation notice instead of silently growing every session's context — a hard backstop behind
  the linter's own 20-line soft-compaction warning (see below), so bloat gets caught well before
  this ceiling is ever hit.
- **Blocking:** never — pure information injection, `; true` guarantees exit 0 even if the file is
  missing.

## 2. Memory lint (`PostToolUse`, matcher `Write|Edit`)

```
input=$(cat)
case "$input" in
  *memory*.md*) printf "%s" "$input" | node ~/.claude/scripts/memory-lint.js 2>/dev/null ;;
esac
; true
```

- **Fires:** after every successful `Write` or `Edit` tool call, in **every** project on this
  machine (it's a user-level hook, not project-scoped). The `case` pre-filter is a cheap
  substring check on the raw hook-input text (pure bash, no process spawn) so a Node process only
  starts when the touched path plausibly involves a `memory` folder and a `.md` file — everything
  else exits in the bash layer, near-zero cost.
- **Scope:** `~/.claude/scripts/memory-lint.js` does the authoritative check —
  `path.basename(path.dirname(filePath)) === 'memory'`. This matches **both** the global folder
  (`~/.claude/memory/`) and any project's own memory folder
  (`~/.claude/projects/<project>/memory/`) — the same script and rules apply everywhere, not just
  to this repo. It validates the *whole folder* the touched file lives in, not just the one file
  that was edited (duplicate-name and orphan checks are folder-wide by nature).
- **Checks performed** (config in `~/.claude/memory-lint.config.json`):
  - Frontmatter present, `name`/`description` present, `metadata.type` ∈
    `{user, feedback, project, reference}`, `metadata.status` (if set) is `archived` — **errors**.
  - No two files share a `name:` slug — **error**.
  - Every `[[wikilink]]` resolves to a file in the *same* folder — **error** (this is what makes
    cross-folder wikilinks fail loudly instead of silently, since the convention is a plain-text
    pointer across folders, not a wikilink).
  - Every active (non-archived) file is referenced in that folder's `MEMORY.md`, and vice versa
    (no dangling index entries) — **error**.
  - `MEMORY.md` line length ≤ `maxIndexLineChars` (150) — **error**.
  - `MEMORY.md` entry count vs. `maxIndexLines` (20), and individual file length vs.
    `maxFileLines` (100) — **warnings** only (soft compaction nudges, not correctness issues).
  - `MEMORY.md` and `README.md` are exempt from the frontmatter requirement (so a plain repo
    README doesn't get mistaken for a broken memory file).
- **Blocking:** schema violations return `{"decision":"block","reason":"..."}` — a `PostToolUse`
  mechanism that feeds the reason back to the agent and lets the turn continue (the write already
  happened; this can't undo it, but it does force an immediate fix rather than letting the
  violation sit unnoticed). Soft-threshold breaches return `{"systemMessage":"..."}` only —
  informational, non-blocking.

## 3. Project memory backup (`SessionEnd`)

```
bash ~/.claude/scripts/memory-backup.sh 2>/dev/null; true
```

Full logic lives in `~/.claude/scripts/memory-backup.sh` (copy: `bootstrap/memory-backup.sh`).

- **Fires:** once per real session-end boundary — closing/exiting the session, `/clear`,
  `/resume`-ing a different session, or compaction. Not per turn, not per edit (both were
  explicitly considered and ruled out as too frequent/costly for this use case).
- **Scope:** exactly **one** project per firing — whichever project's directory was active in the
  session that just ended. Determined via `pwd -W` at hook-fire time (the Windows-style path form,
  which is what the harness's own project-memory-folder naming is derived from — plain `pwd` in
  git-bash gives a POSIX-style path that does *not* match, a real bug caught and fixed during
  testing). Not a sweep of every project on the machine.
- **Guards (all silent, exit 0, no action taken):**
  1. Active directory is under `~/.claude` itself → skip (don't back up the framework's own repo
     onto itself).
  2. That project has no `memory/` folder at all → skip.
- **Guardrail (warns instead of silently proceeding):** before committing, greps the source
  folder for common secret-shaped patterns (private-key headers, `api_key`/`secret_key ± =`,
  `password ± =`, AWS access-key-ID shape). A hit skips the commit/push entirely and emits a
  `systemMessage` explaining why — a second, cheap layer behind the sensitive-data rule in
  `CLAUDE.md`, not a replacement for it.
- **Action (happy path):** copies the active project's `memory/` folder into
  `~/.claude/memory/projects/<project-basename>/`, `git add`s just that subfolder, commits only if
  there's an actual diff (idempotent — a second run with no changes is a silent no-op), and pushes
  to `origin/main` of the public `claude-code-agent-memory-framework` repo.
- **Failure handling:** a failed `git commit` (e.g. missing git identity) reports a
  `systemMessage` and stops before attempting a push. A failed `git push` (offline, auth) reports
  a `systemMessage` but leaves the commit local — it isn't lost, just not yet synced; the next
  successful session-end backup will push it along with whatever's new.
- **Blocking:** never — nothing here can stop or delay the session from actually ending; `2>/dev/null; true` on the hook command guarantees this regardless of what happens inside the script.

## Related: the permission rule (not a hook)

`permissions.allow: ["Bash(git push -q origin main)"]` in `settings.json` — this does **not**
affect hook execution at all. Hooks run as trusted, pre-configured automation once written into
`settings.json` and bypass the interactive auto-mode permission classifier entirely (verified
against Claude Code's own documentation, not assumed). This rule exists solely to reduce friction
if `memory-backup.sh` needs to be **manually** re-tested by invoking it through an interactive
Bash tool call during a conversation — the classifier gates *that* path, not the hook's own
execution at session end.

## Execution environment notes

- All three hooks explicitly set `"shell": "bash"` — this machine is Windows, and the commands
  rely on bash-isms (`case`, `$(...)`, `[ -f ]`) that assume git-bash, not PowerShell.
- Every hook command ends in a construct that guarantees exit 0 (`; true`, or an `if` with no
  unhandled `else`) — a hook process exiting non-zero is treated as a hook *failure* by the
  harness, distinct from an intentional `decision: "block"` in its JSON output. These are kept
  deliberately separate: a bug in hook plumbing should never look identical to an intentional
  schema-violation block.
