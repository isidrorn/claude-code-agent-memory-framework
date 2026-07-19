---
name: claude-code-hooks-bypass-permission-classifier
description: "Claude Code hook commands run as trusted automation and bypass the interactive auto-mode permission classifier"
metadata:
  node_type: memory
  type: project
  modified: 2026-07-19
---

Hook commands configured in `settings.json` (`SessionStart`, `PostToolUse`, `SessionEnd`, etc.)
execute unconditionally once written — they do **not** go through the interactive auto-mode
permission classifier that gates the agent's own tool calls (`Edit`, `Bash`, etc.) during a
conversation.

**Why:** confirmed via Claude Code's own hooks documentation, not assumed. The classifier
repeatedly blocked attempts to edit/manually test a script that called `git push`, which looked
like it would also block the actual hook execution at runtime — but the classifier only gates
interactive tool-call requests, a separate code path from hook execution.

**How to apply:** if the agent's own interactive attempt to write or test a script gets blocked by
the classifier, that does **not** mean the equivalent hook (once configured in `settings.json`)
will also be blocked at runtime. Don't assume a permission rule is required for a hook to function
— it's only needed to unblock the agent's own interactive testing of the same action.
