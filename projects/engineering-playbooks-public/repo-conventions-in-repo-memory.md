---
name: repo-conventions-in-repo-memory
description: "The canonical philosophy/workflow/trust-rule doc for this repo lives inside the repo itself, not in this auto-memory store"
metadata: 
  node_type: memory
  type: reference
  originSessionId: ad2323d7-8274-49ee-9c0a-ec738af94e25
  modified: 2026-07-21T23:17:11.781Z
---

At the user's explicit request, repo scope/philosophy, the evolution model, the filename
convention, and the Review Status trust rule (never check an approval box on the user's
behalf) are documented in `memory/repo-philosophy-and-workflow.md` inside the git working
tree itself (`C:\dev\git\engineering-playbooks-public\memory\`) — committed and pushed as
part of the repo's own content, distinct from this per-project auto-memory store.

Read that file (or its index at `memory/MEMORY.md` in the repo) for those conventions
before making changes to the repo's structure or content. This auto-memory store only
holds session-continuity facts that don't belong in the shipped repo (branch/PR state,
forward-looking intent) — see the sibling files in this directory.
