---
name: framework-dev-status
description: "Current build status of the agent-memory-framework itself and the exact next step to resume with"
metadata:
  node_type: memory
  type: project
  modified: 2026-07-19
---

Status snapshot of building this framework (the memory system you're reading right now), for
picking work back up in a fresh session — possibly opened in a different project entirely, which
is why this lives here rather than in doodle-code-challenge's project memory.

**Done and pushed** (deeper detail in `README.md`, `docs/hooks-reference.md`,
`docs/memory-framework-ideas.md` — this note is a pointer, not a duplicate):
- Two-tier memory (global here vs. per-project), `SessionStart` injection (capped, 50 lines),
  `PostToolUse` schema linter (blocking on real violations), `SessionEnd` per-project memory
  backup (new idea, guardrailed against secret patterns, scope = active project only).
- The mechanism itself (not just the knowledge) is bundled in `bootstrap/`, kept manually in sync
  (no automated drift check yet).
- Two Claude-Code-behavior lessons learned the hard way this session are now actual indexed
  memory files, not just prose in a doc: `claude-code-stop-vs-sessionend.md` and
  `claude-code-hooks-bypass-permission-classifier.md`.

**Idea #7 (agent-drafted session-end memory candidates) — blocker resolved, design specified,
build not yet started:**
The `transcript_path` claim is now confirmed empirically (a temporary `Stop` hook dumped its real
stdin payload) — see [[claude-code-stop-hook-payload]] for the full key set and the file
format it points to. `docs.claude-mem.ai` was also checked directly and confirms this is a real
production pattern, not a speculative design (see `docs/memory-framework-ideas.md` Tier E note,
2026-07-19). Both blockers idea #7 had are now cleared; next session can go straight to building
the hook rather than re-verifying.

Design as specified: an `agent`-type `Stop` hook, gated so it doesn't fire on every turn (e.g.
only past N turns or on a cheap heuristic), reads `last_assistant_message` for lightweight
per-turn signal and/or parses `transcript_path`'s `.jsonl` for full-session context, and drafts
candidate memory entries as a `systemMessage` for the user/agent to accept or discard — not an
auto-write, to keep the deliberate-curation property that's this framework's actual bet against
claude-mem's fully-automatic capture.

**Other open threads, lower priority:**
- Backup destination in `memory-backup.sh` is hardcoded to this repo; a configurable destination
  (e.g. a separate private repo for project-tier backups) is wanted eventually, not built.
- If the lint or backup hooks ever seem to silently not fire, the settings watcher may need a
  manual `/hooks` reload — this bit us once already with a first-time `hooks` key addition.
- `repo-priority-doodle-before-portfolio.md` (separate memory, not framework-related) is marked
  near-expiry — re-check whether doodle-code-challenge has actually shipped/been handed off, and
  archive it once it has.

**How to apply:** once the transcript_path check is done and idea #7 has an actual design (or is
built), update or archive this note rather than letting it sit stale — same rule as any other
state-snapshot memory.
