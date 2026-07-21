---
name: skillpack-continuation
description: Where to resume the senior-engineering-skill-pack — read repo PROJECT-STATUS.md first
metadata: 
  node_type: memory
  type: project
  originSessionId: 4f5cfdda-5f29-4dd9-82e2-82040ae32357
---

When resuming work on the **senior-engineering-skill-pack**, read **`PROJECT-STATUS.md`** at the repo
root FIRST — it's the durable source of truth for current state, locked decisions, next steps, and
operational gotchas (it stays current; this memory is just the pointer).

Fast facts (verify before trusting — snapshots go stale):
- Pack is a Claude Code plugin marketplace; **~61 skills** as of end of round 2 (2026-07-20), all
  pushed to `main`. Java/Spring-heavy by design.
- Source repo clones live in an **ephemeral session scratchpad, not the repo** — re-clone from the
  URLs+SHAs in `ATTRIBUTION.md` to add/modify skills.
- Verify changes with `claude plugin validate .` + a throwaway `CLAUDE_CONFIG_DIR` install +
  `claude plugin details` (see PROJECT-STATUS.md). No `gh` CLI — use the GitHub REST API for metadata.
- Open gaps: Security lane, Cloud-native/K8s *design*. See [[skillpack-curation-preferences]] for the
  governing rules.
