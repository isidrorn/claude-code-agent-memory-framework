## Memory practices (agent-memory plugin)

Two memory indexes are in context: Claude Code's per-project `MEMORY.md` (loaded by Claude Code
for the open repo) and the global `MEMORY.md` printed below (loaded by this plugin in every
project). Global notes live in the folder named in the index heading.

**Lookup.** Scan both indexes before substantive work. Open a full memory file only when its
index line matches the task. The index is a filter, not a reading list.

**Global vs. project.** Ask: "would this fact still be useful in a different project?"
- Global: a lesson tied to a technology, library, tool or their interaction, a personal
  preference or habit, a cross-repo rule. Example: "Lombok's annotation processor silently
  no-ops under JDK 26".
- Project: tied to this repo's code, build state, history or layout. Example: "this repo has no
  Maven wrapper".
A discovery often splits: the tech lesson goes global; the repo-specific application stays in the
project and points to the global file by filename (plain text, not a `[[wikilink]]`).

**Format.** One fact per file. Kebab-case, topic-first filename, no dates or verbs
(`build-env-jdk21-maven.md`). Frontmatter: `name` (= filename), `description` (one line),
`metadata.type` (user | feedback | project | reference), optional `metadata.tags`
(`[maven, lombok, jdk]`: lowercase tool and technology names, the words that would appear in a
request or a command), optional `metadata.expires: YYYY-MM-DD` for anything time-bound. Add one
index line per file. A linter checks all of this after every edit and blocks violations.

**Sensitive data.** Strip session IDs, absolute paths containing a username, credentials and
client or employer specifics before writing.

**Staleness.** A status, deadline or "pending" statement is a hypothesis once time has passed.
Cheap-check it (does the file, branch or tool still exist?) before acting on it, and update or
archive the note in the same session if it drifted.

**Session diaries.** Summaries from other tools (e.g. remember's now/today/recent) are history,
not facts: don't cite them as current state without checking, and turn a lasting lesson into a
memory note here instead of relying on the diary.

**Compaction.** When an index passes ~15 lines or a file ~80 lines, archive, split or merge
before adding more. Archive = `metadata.status: archived` + drop the index line, keep the file.
Delete only notes that were wrong or fully absorbed elsewhere.

**Don't save** what is derivable from code, git history or the repo's own docs, or what is
already in either index (update that file instead).
