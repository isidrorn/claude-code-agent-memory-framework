---
name: doodle-challenge-deadline
description: Take-home hand-off deadline (~2026-07-20) and delivery status
metadata: 
  node_type: memory
  type: project
  originSessionId: c4c805e6-9d94-4d48-a899-14154eb905f3
  modified: 2026-07-18T22:58:56.035Z
---

The doodle-code-challenge repo is the actual take-home deliverable, due to be handed off around
**2026-07-20** (user said "2 days" on 2026-07-18).

**Why:** the challenge has a real audience waiting; the portfolio pass has no deadline.
**How to apply:** prioritize submission polish here. Cross-repo sequencing rule now lives in
global memory: `repo-priority-doodle-before-portfolio.md` (applies regardless of which repo is
open). Build/toolchain setup now lives in global memory too: `lombok-jdk-version-requirement.md`.

Status as of 2026-07-18 (end of session): submission validated and delivery-ready at commit
4f272c2 — QUERY stripped, @RestController, per-slot durations on a validation-only time grid,
domain exceptions, POST /cancel, length caps + unique email (V3), CI workflow, docs
(conventions.md, requirements-mapping.md, decision logs v1–v8) all consistent; 127 tests green,
fresh-volume docker-compose verified. Verified 2026-07-19: `main` is pushed and even with
`origin/main` — git push is done. Still pending (user's side): confirm first CI run went green,
./demo.sh on a machine with jq, and the actual hand-off (repo is finished/read-only for now;
per-task changes go on a new branch, not `main`).
