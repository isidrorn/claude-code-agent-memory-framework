# Global Claude Code conventions

Applies across all projects. Project-level `CLAUDE.md` files add repo-specific rules on top of
this; they don't replace it.

## Memory Practices

Two memory indexes exist per session: this machine's per-project `memory/MEMORY.md` (auto-loaded
by the harness for whichever repo is open) and the global `~/.claude/memory/MEMORY.md` (injected
by a `SessionStart` hook in `~/.claude/settings.json`, so it's present in every project's
sessions too). Both are already in context by the time a session starts — no extra read needed.

**Preflight lookup.** Scan both index lines before starting substantive work. Match each
one-liner against the task's keywords; open the full memory file only on a match. The one-liner
is a filter, not a table of contents — don't open a file just because it's listed.

**Naming.** Kebab-case, topic-first noun phrase (subject before modifier), one topic per file.
No dates, session IDs, or verbs like "update"/"fixed" in the filename — `build-env-jdk21-maven.md`,
not `2026-07-18-build-notes.md` or `fixed-build-issue.md`. Same rule for project and global
memory; the folder (project vs. `~/.claude/memory/`) already disambiguates scope.

**Global vs. project.** Ask "would this fact still be useful in a *different* project?" —
- **Global** (`~/.claude/memory/`): a lesson tied to a technology, framework, library, tool, or
  their interaction (a language/runtime quirk, a library gotcha, an infra pattern, a personal
  preference or habit, a cross-repo sequencing rule). It recurs wherever that tech shows up again,
  independent of which repo surfaced it first. Example: "Lombok's annotation processor silently
  no-ops under JDK 26" is global — true for any Lombok project on this machine, not a
  doodle-code-challenge fact.
- **Project** (that repo's own `memory/` folder): tied to *this* repo's code, build state, commit
  history, file layout, or current setup — a fact that wouldn't transfer if you opened a different
  project. Example: "this repo has no Maven wrapper checked in" is project-scoped.
A single discovery often splits into both: the underlying tech lesson goes global, the
repo-specific application of it (which exact commands, which exact files) stays project-scoped and
references the global file instead of re-explaining it.

**Sensitive data.** Before writing any memory, strip session IDs, absolute paths containing a
username, credentials, and client/employer specifics — treat `~/.claude/memory/` as potentially
public (it may be pushed to a public repo) and omit rather than include "just in case."

**Staleness (state-snapshot memories).** Any status/deadline/pending-item statement is a
hypothesis, not a fact, once time has passed. Cheap-check it before acting on it (`git log -1`,
does the file/branch/commit it names still exist, a quick grep for the "pending" item). If it
turns out resolved, update or archive the memory in the same session you discover the drift —
don't leave a stale "pending" statement for a future session to re-discover.

**Compaction.** When an index reaches ~15 lines, or a single memory file exceeds ~80 lines, or
covers more than one distinct topic — pause and archive/split/merge before adding more.
- *Archive* (default): the fact is still historically true but no longer active — set
  `metadata.status: archived` in frontmatter and drop the file's line from `MEMORY.md`. Leave the
  file on disk (keeps the `originSessionId` provenance trail, where present — omitted in
  `~/.claude/memory/` per the sensitive-data rule above).
- *Delete*: only when the memory was factually wrong, or fully absorbed into another file with
  nothing unique left.
- *Merge*: fold the surviving content into the more active file's body, note
  `Absorbed [[old-file]] on <date>.`, then archive the old one per above.

**Concise, single-fact files, no redundant context.** One lesson per file, stated as tersely as the
fact allows. Before writing, check whether the context is already available elsewhere and skip
restating it:
- Already derivable from code, git history, or a project's own `CLAUDE.md`/`conventions.md`? Don't
  save it at all (this already holds per the harness's own auto-memory rules — see below).
- Already stated in the *other* scope's memory (global fact backing a project-specific detail, or
  vice versa)? Point to it by filename in plain text instead of re-explaining it — cross-folder
  `[[wikilink]]` resolution between project and global memory is unverified, so use a plain
  reference there, not a wikilink.
- Already stated in another file in the *same* scope? That's a compaction signal (see below), not
  a reason to duplicate — merge instead.
