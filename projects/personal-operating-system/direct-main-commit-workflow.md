---
name: direct-main-commit-workflow
description: "Work directly in the main checkout and push straight to origin/main, no worktree or feature-branch isolation, for this repo"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b81ca169-4d94-4161-a981-8b3b7f0ebe40
  modified: 2026-07-22T16:30:00.439Z
---

For this repo, don't use a git worktree or feature branch — work directly in the main checkout
(`C:\dev\git\personal-operating-system`) on `main`, and commit + push every file as soon as it's
finished.

**Why:** user said "we dont need worktrees here for now, do it all in main," after I mistakenly
wrote new docs into the main checkout while assigned to a worktree for the session (the two paths
looked similar and a broad file search matched the main checkout first). The user also separately
asked to commit and push every file made so they can review progress from another device — direct
pushes to `main` serve that, since this is solo, early-stage discovery work with no need for
branch isolation yet.

**How to apply:** if a future session is assigned a worktree for this repo, prefer redirecting
work to the main checkout instead (confirm with the user if unsure which one is current). Commit
and push each finished file to `origin/main` directly rather than batching into a branch or PR.
