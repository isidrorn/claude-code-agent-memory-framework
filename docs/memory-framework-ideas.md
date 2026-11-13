# Ideas backlog

Ideas not yet built, and ideas we rejected, one line each. Decided design: [design.md](design.md).
Order of work: [roadmap.md](roadmap.md). The July 2026 design log this file used to hold is in
git history.

## Not yet built (each waits for its trigger)

- **Tag-based loading.** Notes whose tags match words in your message (`UserPromptSubmit`), or
  the tool Claude is about to run (`PreToolUse` on Bash, e.g. `mvn` → the maven/lombok notes),
  are loaded in full. Trigger: ~25 global notes, or a note visibly missed.
- **Duplicate check before writing.** Compare a new note's description with existing ones and
  warn on high overlap, without blocking. Trigger: the first duplicate found in `/review`.
- **Scheduled audit.** A periodic run of the `/review` checks that leaves a report, not only when
  notes are edited. Trigger: `/review` turns out to be skipped for weeks.
- **Subfolders for global notes** (`java/`, `git/`, …), with one index. Trigger: ~40 notes.
- **A "technology fact" marker.** Claude Code's four note types have no bucket for toolchain
  facts. Tags may already cover this. Trigger: tags prove insufficient.
- **`gitleaks` in the backup hook,** when installed, behind the regex secret check. Trigger: a
  secret the regex misses.
- **Encrypted backup repo** (`git-remote-gcrypt`), so the remote only sees ciphertext. Trigger:
  the agent-memory folder holds raw session content or client data.
- **Hand-off note** ("where I left off"). Trigger: remember's `/remember` proves not enough.
- **Review in parallel.** Run `/review` in the foreground while background agents work; needs a
  queue lock. Trigger: the flow works and reviews feel like waiting time.
- **remote-only storage and non-git providers.** Trigger: a real need (a second machine, a
  different service).

## Rejected

- **`verify_command` on each note.** A shell command that re-checks a fact. It adds its own
  staleness (wrong directory, wrong shell); `/review` does the job instead.
- **Vector search, knowledge graph, background daemon** (the claude-mem / mem0 approach). It
  solves retrieval at a scale we don't have, and costs plain-markdown auditability. Revisit only
  if tag-based loading fails.
- **Fully automatic capture.** It contradicts principle 3, "you decide what becomes trusted".

## Things to re-check now and then

- **Claude Code's `autoDreamEnabled`** ("background memory consolidation") was undocumented in
  July 2026. If it ships documented, check whether it overlaps `/review`.
