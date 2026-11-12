# Roadmap

Ordered by which memory failures cost most. Each phase ships and is verified on its own.

| Phase | What | Status |
|---|---|---|
| 0 | Clean-up: commit stray notes, archive stale ones, check competitors (agentcairn) | Done 2026-11-12 |
| 1 | One-page `docs/design.md`: failure-mode table, principles. Shrink `memory-framework-ideas.md` to a backlog | Next |
| 2 | Plugin packaging + separate private storage + sticky alerts + Node hooks | Done 2026-11-12. Switch-over on the author's machine pending |
| 3a | `/harvest`: Claude proposes at most 3 memories from the conversation, you approve | Planned |
| 3b | Automatic `/harvest` trigger from a `Stop` hook (corrections, "remember", rejections) | Only if 3a is used weekly with at least a third approved |
| 4 | `/hygiene`: re-check notes against reality, stamp `last_verified` / `confidence`, propose archives | Planned |

**Deferred until there is a measured need:**
- Tag-based loading, triggered by your message or by the command Claude is about to run. Waits
  for ~25 global notes.
- Subfolders. Waits for ~40 notes.
- `remote-only` storage and non-git providers.
- Vector search.

**Branding:** "agent-memory" is a working name. Decide before publishing.
