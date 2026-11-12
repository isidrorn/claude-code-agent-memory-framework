# Roadmap

Ordered by which memory failures cost most. Each phase ships and is verified on its own.

| Phase | What | Status |
|---|---|---|
| 0 | Clean-up: commit stray notes, archive stale ones, check competitors (agentcairn) | Done 2026-11-12 |
| 1 | One-page `docs/design.md`: failure-mode table, principles. Shrink `memory-framework-ideas.md` to a backlog | Next |
| 2 | Plugin packaging + separate private storage + sticky alerts + Node hooks | Code and tests done 2026-11-12 (PR #1). Install + switch-over on the author's machine pending |
| 3a | `/harvest`: Claude proposes at most 3 memories from the conversation, you approve | Planned |
| 3b | Automatic `/harvest` trigger from a `Stop` hook (corrections, "remember", rejections) | Only if 3a is used weekly with at least a third approved |
| 4 | `/hygiene`: re-check notes against reality, stamp `last_verified` / `confidence`, propose archives | Planned |

**Deferred until there is a measured need:**
- Tag-based loading, triggered by your message or by the command Claude is about to run. Waits
  for ~25 global notes.
- Subfolders. Waits for ~40 notes.
- `remote-only` storage and non-git providers.
- Vector search.
- Hook-run evidence: each hook writes its last run time to `.state/`, and session start warns when
  the backup hasn't run in N days (idea from remember's `/remember:doctor`). Waits for a missed backup.
- Hand-off note: one overwritten "where I left off" file shown at the next session start. Waits
  until remember's `/remember` handoff proves not enough.
- `gitleaks` scan in the backup hook when it is installed, behind the regex secret check. Waits
  for a secret the regex misses.
- Encrypted store (`git-remote-gcrypt`) so GitHub only sees ciphertext. Waits until the store
  holds raw session content or client data.

**Related tools:** [remember](https://github.com/Digital-Process-Tools/claude-remember)
(installed for personal use) keeps automatic session diaries: what you did and where you stopped.
It complements this project rather than competing with it. It stays local: `~/.remember` must
never become a git repo, because remember then commits and pushes on its own, with no setting to
stop it.

**Branding:** "agent-memory" is a working name. Decide before publishing.
