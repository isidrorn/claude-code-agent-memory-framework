---
name: repo-priority-doodle-before-portfolio
description: "Cross-repo sequencing rule: doodle-code-challenge take-home ships before old repo's portfolio pass resumes"
metadata:
  node_type: memory
  type: project
  modified: 2026-07-19
---

The old repo's (`spring-boot-http-query-verb-example`) portfolio pass must NOT be touched until
the doodle-code-challenge take-home ships. This holds regardless of which repo's session this is.

**Why:** doodle-code-challenge has a real audience and a hand-off deadline; the portfolio pass
has none.

**How to apply:** if asked to work in spring-boot-http-query-verb-example on the portfolio pass,
confirm with the user first — check whether doodle-code-challenge has shipped rather than
assuming.

**Status (near-expiry, re-check before trusting):** as of 2026-07-19, doodle-code-challenge is
finished and its `main` is fully pushed to `origin/main` (commit `4f272c2`), but the user says it
has NOT been formally handed off/submitted yet — the repo is being kept read-only for now, and
any further work on it goes through a new branch, not `main`. Once hand-off actually happens,
archive this memory (`metadata.status: archived`, drop its `MEMORY.md` line) — the rule is dead
the moment doodle-code-challenge ships.
