---
name: claude-code-stop-hook-payload
description: "Claude Code's Stop hook stdin includes transcript_path (a real per-session .jsonl) and last_assistant_message directly — confirmed empirically, not from docs"
metadata:
  node_type: memory
  type: project
  modified: 2026-07-19
---

A `Stop`-type hook's stdin JSON includes a `transcript_path` field pointing to a real,
readable `.jsonl` file at `~/.claude/projects/<project-slug>/<session-id>.jsonl` — one JSON
record per line (message events with `parentUuid`/`isSidechain`/`attachment`, plus session
metadata records like `ai-title`, `mode`, `file-history-snapshot`). This was the one unconfirmed
claim [[framework-dev-status]] flagged as blocking idea #7 (agent-drafted session-end memory
candidates) — verified by wiring a temporary `Stop` hook (`cat > ~/.claude/stop-hook-debug.json`)
and inspecting the real payload, not by trusting a subagent's earlier doc research.

Full observed key set: `session_id`, `transcript_path`, `cwd`, `prompt_id`, `permission_mode`,
`effort.level`, `hook_event_name`, `stop_hook_active`, `last_assistant_message`,
`background_tasks`, `session_crons`.

**Bonus finding beyond what was being checked:** `last_assistant_message` is handed to the hook
directly as a string — no transcript read needed for a per-turn digest. `transcript_path` is only
necessary for something that needs the *whole* session's history (e.g. a real end-of-session
summary), not a single turn.

**Why:** de-risks building idea #7 — the mechanism it depends on is real, not speculative.

**How to apply:** an `agent`-type Stop hook for idea #7 can read `last_assistant_message` for
lightweight per-turn signal, or parse `transcript_path`'s `.jsonl` for full-session context. Don't
re-verify this from docs again; this was checked against the live payload directly.
