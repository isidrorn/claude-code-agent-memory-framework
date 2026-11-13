## Memory practices (agent-memory plugin)

This plugin keeps two layers of notes in its own folder, named in the index headings below:
**global** (the folder root, useful in every project) and **local** (`projects/<name>/`, useful
in one project). Claude Code's built-in memory (`~/.claude/projects/<p>/memory/`) is separate
and belongs to Claude Code: it works as usual, and this plugin only reads it. Never edit
`projects/<name>/native/`; those are read-only copies of it.

**Lookup.** Scan the global and local indexes (and Claude Code's own) before substantive work.
Open a full note only when its index line matches the task. The index is a filter, not a
reading list.

**Global vs. local.** Ask: "would this fact still be useful in a different project?"
- Global: a lesson tied to a technology, library, tool or their interaction, a personal
  preference or habit, a cross-repo rule. Example: "Lombok's annotation processor silently
  no-ops under JDK 26".
- Local: tied to this repo's code, build state, history or layout. Example: "this repo has no
  Maven wrapper".
A discovery often splits: the tech lesson goes global; the repo-specific application goes local
and points to the global note by filename (plain text, not a `[[wikilink]]`, which only resolves
within one folder).

**Format.** One fact per file, stated as tersely as the fact allows. Kebab-case, topic-first
filename, no dates or verbs (`build-env-jdk21-maven.md`). Frontmatter: `name` (= filename),
`description` (one line), `metadata.type` (user | feedback | project | reference), optional
`metadata.tags` (`[maven, lombok, jdk]`: lowercase tool and technology names, the words that
would appear in a request or a command), optional `metadata.expires: YYYY-MM-DD` for anything
time-bound. Body: the fact, then **Why:** and **How to apply:**. Add the index line to that
layer's `MEMORY.md` *before* writing the note. A linter checks all of this and blocks violations.

**Sensitive data.** The folder is pushed to a private repo, but treat it as shareable: strip
session IDs, absolute paths containing a username (write `~/...`), credentials and client or
employer specifics. When in doubt, leave it out.

**Staleness.** A status, deadline or "pending" statement is a hypothesis once time has passed.
Cheap-check it (does the file, branch or tool still exist?) before acting on it, and update or
archive the note in the same session if it drifted.

**Session diaries.** Summaries from other tools (e.g. remember's now/today/recent) are history,
not facts: don't cite them as current state without checking, and turn a lasting lesson into a
note here instead of relying on the diary.

**Compaction.** When an index passes ~15 lines or a note ~80 lines, archive, split or merge
before adding more.
- Archive: `metadata.status: archived`, drop the index line, keep the file.
- Merge: fold the surviving content into the more active note, add "Absorbed [[old-note]] on
  <date>.", then archive the old one.
- Delete only notes that were wrong or fully absorbed elsewhere.

**Don't save** what is derivable from code, git history or the repo's own docs, or what is
already in either layer (update that note instead; a duplicate within one layer means merge).
