# agent-memory (working name)

A Claude Code plugin that gives Claude a **curated, enforced, two-tier memory**.

Claude Code already keeps notes per project. This plugin adds the parts it lacks:

- **A global tier.** Lessons that matter in every project ("Lombok breaks on JDK 26", "you prefer
  a short plan before bulk edits") live in one folder and load in every session, whichever repo
  is open.
- **Enforcement instead of hope.** A linter runs after every memory edit. It blocks malformed
  notes, dangling links and unindexed files, so Claude has to fix them on the spot.
- **Storage kept apart from the code.** Notes live in their own folder or repo, which can be
  private. They are synced with git and backed up at the end of every session. A failure stays
  visible until it is fixed.

The bet behind it: memory should be **small, deliberate and trustworthy**. Claude proposes what
to remember and you approve it. Everything is plain markdown you can read and diff. There is no
database or background service.

## Install

```
/plugin marketplace add isidrorn/claude-code-agent-memory-framework
/plugin install agent-memory@agent-memory
```

Requirements: Node.js 20+ and git on `PATH`.

## Storage

By default, global notes live in `~/.claude/memory` (mode `local+remote`):
- Session start pulls the latest notes (fast-forward only, 5 s timeout) and pushes anything a
  previous session failed to push.
- Session end copies the open project's Claude Code memory into `projects/<name>/`, commits
  everything that changed, and pushes.

For backup and multi-machine sync, make that folder a clone of a **private** repo:

```
git clone https://github.com/<you>/<your-memory-repo>.git ~/.claude/memory
```

To change any of this, create `~/.claude/agent-memory/config.json`. Every key is optional;
missing keys use the defaults shown:

```json
{
  "storage": { "provider": "git-markdown", "mode": "local+remote", "path": "~/.claude/memory",
               "remote": "origin", "branch": "main", "syncTimeoutMs": 5000 },
  "backup": { "projectTier": true },
  "injection": { "maxIndexLines": 50 },
  "lint": { "maxIndexLines": 20, "maxFileLines": 100, "maxIndexLineChars": 150 }
}
```

Storage modes:
- `local-only`: commits locally if the folder is a git repo, and never pushes.
- `local+remote`: the default described above.
- `remote-only`: planned, not implemented.

Inside the storage folder:
- Root `*.md` files are memories.
- Other markdown goes in a subfolder, such as `docs/`.
- `.state/` holds runtime alerts and must be gitignored.

## Memory format

```markdown
---
name: lombok-jdk-version-requirement      # = filename
description: Lombok needs JDK 21 here; newer JDKs break it silently
metadata:
  type: reference                          # user | feedback | project | reference
  tags: [lombok, jdk, maven]               # optional: tool/tech names
  expires: 2027-01-01                      # optional: for time-bound facts
  status: archived                         # optional: kept for history, removed from the index
---

The fact, then **Why:** and **How to apply:**.
```

Each folder has a `MEMORY.md` index with one line per active note. The full rules Claude follows
are in [`rules/memory-practices.md`](rules/memory-practices.md), which is printed at every session
start.

## What runs when

See [`docs/hooks-reference.md`](docs/hooks-reference.md).

| Event | Script | Does |
|---|---|---|
| Session start | `hooks/session-start.js` | Sync storage, then print alerts, rules, global index (capped) and expired notes |
| After Write/Edit | `hooks/memory-lint.js` | Lint the touched memory folder; block on schema violations |
| Session end | `hooks/memory-backup.js` | Copy project memory into storage, scan for secrets, commit, push |

## Development

```
npm test
```

Tests use Node's built-in runner, with no dependencies. They run against temporary folders and a
local bare git remote, never your real storage.

Design notes and backlog: [`docs/memory-framework-ideas.md`](docs/memory-framework-ideas.md).
