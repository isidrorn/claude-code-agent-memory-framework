# Hooks reference

These are the plugin's three hooks, declared in `.claude-plugin/plugin.json`. Each runs
`node "${CLAUDE_PLUGIN_ROOT}/hooks/<script>"`. Every script exits 0 even when something fails
inside it: a bug in the plumbing must never look like an intentional block, and it must never
stop a session from starting or ending. Failures surface as **sticky alerts** instead (below).

## Session start: `session-start.js`

**Fires** once when a session opens, in every project.

1. **Sync** (`local+remote` only):
   - `git pull --ff-only` within `syncTimeoutMs` (default 5 s), then push any commits a previous
     session failed to push.
   - It never auto-merges. A non-fast-forward or an unreachable remote sets the `sync` alert,
     and the session continues on the local copy.
2. **Print, in order** (stdout becomes session context):
   - unresolved alerts;
   - `rules/memory-practices.md`;
   - the global `MEMORY.md`, capped at `injection.maxIndexLines` (default 50) with a truncation
     notice;
   - a line listing active notes whose `metadata.expires` has passed.

A misconfigured storage, such as an unknown mode or `remote-only`, is reported in the output
instead of failing.

## After Write/Edit: `memory-lint.js`

**Fires** after every successful `Write` or `Edit`. It does nothing unless the file is a `.md` in
a folder named `memory` (any project's built-in memory) or in the configured storage folder.

It validates the **whole folder**.

**Errors** return `{"decision":"block","reason":...}`, which feeds the reason back to Claude so it
fixes the problem in the same turn:
- missing frontmatter, `name`, `description` or `metadata.type`;
- an invalid `type`, `status`, `tags` or `expires` format;
- duplicate names;
- a `[[wikilink]]` that doesn't resolve within the folder;
- an index entry pointing at a missing file;
- an active note missing from the index.

**Warnings** return `systemMessage` only:
- an index longer than `lint.maxIndexLines`;
- an index line longer than `maxIndexLineChars`;
- a note longer than `maxFileLines`;
- an archived note still indexed;
- a name that doesn't match the filename.

**Cost:** one Node process per Write/Edit, about 0.1 s on Windows. If that becomes noticeable, a
shell pre-filter is the known fix.

## Session end: `memory-backup.js`

**Fires** once per real session end. This means exit, `/clear`, resuming elsewhere, or
compaction. It does **not** fire once per answer; that is what the `Stop` event does.

1. If `backup.projectTier` is on and the session's `cwd` is not inside Claude Code's home, it
   copies `<claude home>/projects/<slug>/memory/` to `<storage>/projects/<basename(cwd)>/`.
   `<slug>` is the cwd with every non-alphanumeric character replaced by `-`, which matches
   Claude Code's own folder naming.
2. **Secret guard:** a pattern match for private-key headers, AWS keys, `api_key=`/`password=`
   and GitHub tokens.
   - A hit in a project folder skips that copy and sets an alert.
   - A hit in a global note skips the commit entirely and sets an alert.
   - It is a second layer behind the sensitive-data rule, not a real secret scanner.
3. **Commit** everything that changed in storage (`git add -A`; `.state/` is gitignored), and
   push in `local+remote` mode. A failure sets the `backup` alert. The commit stays local and is
   pushed by the next session start's sync. This matters because Claude Code may kill a
   session-end hook before a slow push finishes.

## Sticky alerts

`<storage>/.state/alerts.json` maps a key to `{message, since, last}`. An alert is set on failure
and cleared only when the same operation later succeeds. It is printed at every session start
until then. Keys: `sync`, `backup`, `secret:global`, `secret:<project>`.

## Verified Claude Code behaviors this relies on

- `Stop` fires once per assistant turn; `SessionEnd` fires once per session. Using `Stop` for
  backup would commit on every answer.
- Hook commands run as trusted, pre-configured automation and bypass the interactive permission
  classifier. A hook's `git push` needs no permission rule.
- The `Stop` hook payload includes `transcript_path` and `last_assistant_message`. The planned
  `/harvest` auto-trigger needs this.
