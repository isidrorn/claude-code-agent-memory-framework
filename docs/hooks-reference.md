# Hooks reference

These are the plugin's hooks, declared in `.claude-plugin/plugin.json`. Each runs
`node "${CLAUDE_PLUGIN_ROOT}/hooks/<script>"`. Every script exits 0 even when something fails
inside it: a bug in the plumbing must never look like an intentional block, and it must never
stop a session from starting or ending. Failures surface as **sticky alerts** instead (below).
No hook ever writes to `CLAUDE.md` or to Claude Code's built-in memory.

## Session start: `session-start.js`

**Fires** once when a session opens, in every project.

1. **Sync** (`local+remote` only):
   - `git pull --ff-only` within `syncTimeoutMs` (default 5 s), then push every local commit
     the remote lacks: ones a previous session failed to push, and ones you made by hand in the
     storage folder. Running the hook by hand pushes too.
   - It never auto-merges. A non-fast-forward or an unreachable remote sets the `sync` alert,
     and the session continues on the local copy.
2. **Health checks**, each a sticky alert:
   - `storage-missing`: the storage folder doesn't exist. If the pre-0.2.0 folder
     `~/.claude/memory` is still there, the alert says to move it. The hook never creates the
     folder.
   - `lint-filter`: the storage path isn't inside a `.agent-memory` folder, so the linter's
     `if` filters can't match it.
   - `backup-stale`: the session-end backup hasn't run for `backup.staleDays` (default 7).
3. **Print, in order** (stdout becomes session context):
   - unresolved alerts;
   - `rules/memory-practices.md`;
   - the global `MEMORY.md`;
   - the current project's local `projects/<name>/MEMORY.md`, if any. Both indexes are capped
     at `injection.maxIndexLines` (default 50), with a truncation notice.
   - a line listing active notes whose `metadata.expires` has passed.

`<name>` is the main repository's folder name, so worktrees and subfolders map to the same
project; outside git it is the folder name. A misconfigured storage, such as an unknown mode or
`remote-only`, is reported in the output instead of failing.

## After Write/Edit: `memory-lint.js`

**Fires** only for `.md` files under a `.agent-memory` folder. Two `if` filters in `plugin.json`
handle this: `Write(//**/.agent-memory/**/*.md)` and `Edit(//**/.agent-memory/**/*.md)`. Claude
Code starts no process for any other edit. Verified live on Windows paths, including the case
that an `Edit(...)` filter does **not** match Write calls, so both are needed.

Inside, it lints only our own layers: the storage root (global) and `projects/<name>/` (local).
`projects/<name>/native/`, `queue/` and every other subfolder are skipped. It validates the
**whole folder**.

**Errors** return `{"decision":"block","reason":...}`, which feeds the reason back to Claude so it
fixes the problem in the same turn:
- missing frontmatter, `name`, `description` or `metadata.type`;
- an invalid `type`, `status`, `tags` or `expires` format;
- duplicate names;
- a `[[wikilink]]` that doesn't resolve within the folder;
- an index entry pointing at a missing file;
- an active note missing from the index.

**Warnings** return `systemMessage` only:
- an index longer than `lint.maxIndexLines` (default 15);
- an index line longer than `maxIndexLineChars`;
- a note longer than `maxFileLines`;
- an archived note still indexed;
- a name that doesn't match the filename;
- an absolute home path containing a username.

## Session end: `memory-backup.js`

**Fires** once per real session end. This means exit, `/clear`, resuming elsewhere, or
compaction. It does **not** fire once per answer; that is what the `Stop` event does.

1. If the storage folder doesn't exist, it stops. Session start reports that.
2. If `backup.projectTier` is on and the session's `cwd` is not inside Claude Code's home, it
   copies Claude Code's built-in memory `<claude home>/projects/<slug>/memory/` **read-only**
   into `<storage>/projects/<name>/native/`. Nothing is ever copied back.
3. **Secret guard:** a pattern match for private-key headers, AWS keys, `api_key=`/`password=`
   and GitHub tokens.
   - A hit in the built-in memory skips that copy and sets an alert.
   - A hit anywhere in storage skips the commit and sets an alert.
   - It is a second layer behind the sensitive-data rule, not a real secret scanner.
4. **Provenance:** `originSessionId:` lines become `origin: <machine>/<ref>`, and the commit gets
   a `Session: <machine>/<ref>` line. Any other UUID-shaped string blocks the commit with an
   alert.
5. **Commit** everything that changed in storage (`git add -A`; `.state/` is gitignored), and
   push in `local+remote` mode. A failure sets the `backup` alert. The commit stays local and is
   pushed by the next session start's sync. This matters because Claude Code may kill a
   session-end hook before a slow push finishes.

An unexpected crash sets the `backup-crash` alert instead of failing silently.

## Sticky alerts and heartbeat

Both live in `${CLAUDE_PLUGIN_DATA}` (`~/.claude/plugins/data/agent-memory-agent-memory/`). That
folder is kept across updates and deleted on uninstall, which is fine for disposable state. A
hook run by hand doesn't get that variable, so it falls back to `<storage>/.state/`. The next
session start merges those alerts back.

- `alerts.json` maps a key to `{message, since, last}`. An alert is set on failure and cleared
  only when the same operation later succeeds. It is printed at every session start until then.
  Keys: `sync`, `backup`, `backup-crash`, `backup-stale`, `storage-missing`, `lint-filter`,
  `session-id`, `secret:global`, `secret:<project>`.
- `heartbeat.json` records when each hook last ran, plus `firstSeen`. This is how "the backup
  never ran" becomes visible.

The provenance ledger is not disposable, so it stays in `<storage>/.state/sessions.tsv`: local
to the machine and never committed.

## Verified Claude Code behaviors this relies on

- `Stop` fires once per assistant turn; `SessionEnd` fires once per session. Using `Stop` for
  backup would commit on every answer.
- Hook commands run as trusted, pre-configured automation and bypass the interactive permission
  classifier. A hook's `git push` needs no permission rule.
- The `Stop` hook payload includes `transcript_path` and `last_assistant_message`, which the
  Phase 4 capture flow needs.
- Hook `if` filters match Windows paths with the `//**/` anchor, and `Edit(...)` filters don't
  match Write calls (checked 2026-11-13 with a headless run).
