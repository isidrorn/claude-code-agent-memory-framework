# agent-memory (working name)

A Claude Code plugin that gives Claude a **curated, enforced, two-tier memory**.

Claude Code already keeps notes per project. This plugin adds the parts it lacks:

- **Global and local layers of its own.** Lessons that matter in every project ("Lombok breaks on
  JDK 26", "you prefer a short plan before bulk edits") load in every session; local notes load
  in their project. Claude Code's built-in memory keeps working untouched alongside them.
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

Your notes live in the agent-memory folder, `~/.agent-memory` by default. It sits outside
`~/.claude` and outside the plugin's own folders, so updating, uninstalling or reinstalling the
plugin never touches it. In the default mode, `local+remote`:
- Session start pulls the latest notes (fast-forward only, 5 s timeout) and pushes every local
  commit the remote lacks, including ones you made by hand in the storage folder.
- Session end copies the open project's Claude Code built-in memory, read-only, into
  `projects/<name>/native/`, commits everything that changed, and pushes.

The plugin never writes `CLAUDE.md` or Claude Code's built-in memory.

For backup and multi-machine sync, make that folder a clone of a **private** repo:

```
git clone https://github.com/<you>/<your-memory-repo>.git ~/.agent-memory
```

To change any of this, create `~/.claude/agent-memory/config.json`. Every key is optional;
missing keys use the defaults shown:

```json
{
  "storage": { "provider": "git-markdown", "mode": "local+remote", "path": "~/.agent-memory",
               "remote": "origin", "branch": "main", "syncTimeoutMs": 5000 },
  "backup": { "projectTier": true, "staleDays": 7 },
  "provenance": { "machine": "" },
  "injection": { "maxIndexLines": 50 },
  "lint": { "maxIndexLines": 15, "maxFileLines": 100, "maxIndexLineChars": 150 }
}
```

Storage modes:
- `local-only`: commits locally if the folder is a git repo, and never pushes.
- `local+remote`: the default described above.
- `remote-only`: planned, not implemented.

Keep the path inside a folder named `.agent-memory`. The linter hook is filtered on that name,
and session start alerts if it can't match.

Inside the storage folder:
- Root `*.md` files are **global** notes, loaded in every project.
- `projects/<name>/*.md` are **local** notes, loaded only in that project. `<name>` is the main
  repository's folder name.
- `projects/<name>/native/` holds the read-only copies of Claude Code's built-in memory.
- Other markdown goes in a subfolder, such as `docs/`.
- `.state/` holds the provenance ledger, local to the machine, and must be gitignored. Alerts
  and the hook heartbeat live in the plugin's data folder (`${CLAUDE_PLUGIN_DATA}`).

**Upgrading from 0.1.x:** the default moved from `~/.claude/memory`. Move the folder; git and
its remote come along:

```
mv ~/.claude/memory ~/.agent-memory
```

Then move each `projects/<name>/*` into `projects/<name>/native/` and commit. Those were
backups of built-in memory, not local notes. Session start alerts until the folder is moved,
and the next session start pushes your commit.

## Provenance

Session IDs and transcripts never leave the machine. On backup, Claude Code's `originSessionId:`
line becomes `origin: <machine>/<ref>`, and each backup commit gets a `Session: <machine>/<ref>`
line, so `git log --follow <note>` traces every step back to a session. `<ref>` is a hash of the
session ID. `<machine>` is `provenance.machine` from the config (set a readable name per machine),
or a short hostname hash if unset; it is `unknown` when the transcript isn't on this machine.
Resolve a ref on the machine that made it:

```
grep <ref> ~/.agent-memory/.state/sessions.tsv   # session ID, host, user, transcript path
```

The ledger lives only in `.state/`; if that folder is wiped, refs can no longer be resolved. Any
other UUID-shaped string in storage blocks the commit with an alert.

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
| Session start | `hooks/session-start.js` | Sync storage, run health checks, then print alerts, rules, global and local indexes (capped) and expired notes |
| After Write/Edit (only under `.agent-memory`) | `hooks/memory-lint.js` | Lint the touched layer; block on schema violations |
| Session end | `hooks/memory-backup.js` | Copy built-in memory read-only into storage, scan for secrets, commit, push |

## Development

```
npm test
```

Tests use Node's built-in runner, with no dependencies. They run against temporary folders and a
local bare git remote, never your real storage.

```
npm run validate   # claude plugin validate --strict: manifest and marketplace checks
npm run evals      # claude plugin eval: does Claude save notes in the right layer?
claude --plugin-dir .   # try the working copy without reinstalling
```

`--plugin-dir` loads this folder for one session and silently replaces the installed
`agent-memory`, so the hooks don't run twice. Run `/reload-plugins` after editing.

The evals (`evals/`) run real Claude sessions, so they cost money: about $0.10 per run, with 3
runs per case and a second run without the plugin for comparison. Each run gets a temporary
home, and its scaffold seeds an empty store inside that run's workspace, so your real storage is
never touched. On Windows, `bash` must resolve to Git Bash, not the WSL stub: run from Git Bash,
or put `C:\Program Files\Git\bin` first on `PATH`.

Design and decisions: [`docs/design.md`](docs/design.md). Order of work:
[`docs/roadmap.md`](docs/roadmap.md). Backlog: [`docs/memory-framework-ideas.md`](docs/memory-framework-ideas.md).
