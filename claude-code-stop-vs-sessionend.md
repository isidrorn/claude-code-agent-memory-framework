---
name: claude-code-stop-vs-sessionend
description: "Claude Code's Stop hook fires per assistant turn, not per session — use SessionEnd for true session-boundary automation"
metadata:
  node_type: memory
  type: project
  modified: 2026-07-19
---

Claude Code's `Stop` hook event fires once per assistant turn (every time the agent finishes
responding), not once per session. `SessionEnd` is the actual session-boundary event — fires once
when a session truly ends (close/exit, `/clear`, `/resume`ing elsewhere, or compaction).

**Why:** the settings schema's own one-line description for `Stop` ("run when Claude stops")
reads like a session-end hook, but isn't. Building a "once per session" automation on `Stop`
instead would fire far more often than intended — as chatty as a per-turn or per-edit trigger.

**How to apply:** for any hook meant to run once per session (backups, summaries, cleanup), use
`SessionEnd`, not `Stop`. Verify an event's actual cadence against Claude Code's own hooks
documentation before assuming it from the event name or a one-line schema description alone.
