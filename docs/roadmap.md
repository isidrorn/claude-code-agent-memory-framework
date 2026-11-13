# Roadmap

Phases are ordered by which memory failures cost the most. Each phase ships and is verified on
its own. Decision IDs (DR…) refer to [design.md](design.md). Ideas without a phase are in the
[backlog](memory-framework-ideas.md).

| Phase | What | Status |
|---|---|---|
| 0 | Clean-up: commit stray notes, archive stale ones, check competitors (agentcairn) | Done 2026-11-12 |
| 1 | Design review and `docs/design.md`. Shrink the ideas file to a backlog | Done 2026-11-13 |
| 2 | Plugin packaging, private storage, sticky alerts, Node hooks, provenance without session IDs | Done 2026-11-12 (PRs #1, #2). Live check of the automatic session-end backup pending |
| 2b | **Layout and hardening.** Move `~/.claude/memory` to `~/.agent-memory`, keeping the backup repo remote; runtime state goes to `${CLAUDE_PLUGIN_DATA}` (DR13). Lifecycle registry, replacing the `origin:` line rewrite (DR14). Heartbeat and alerts (DR8). No `CLAUDE.md` footprint, plus a one-time clean-up of the old Memory Practices section (DR9). Auto-restore (DR10). Linter `if` filter (DR11). Home-path warning (DR12). Hygiene: delete `~/.claude/scripts/` leftovers; align lint `maxIndexLines` (20) with the rule text (~15) | Next |
| 3 | **Live checks before building the flow:** what a hook sees of your multiple-choice answer (DR7); how to detect an interactive session (DR3) | Planned |
| 4 | **Capture flow:** in-session triage from the `Stop` hook, drafts, `queue/`, approval token, `/review` (DR1–DR7). Replaces the old `/harvest` and automatic-trigger phases | Planned |
| 5 | **Confidence and ranking** for `/review` (DR5). `/review` also re-checks trusted notes against reality, which absorbs the old `/hygiene` | Discuss first |

**Related tools:** [remember](https://github.com/Digital-Process-Tools/claude-remember)
(installed for personal use) keeps automatic session diaries: what you did and where you stopped.
It complements this project rather than competing with it. It stays local: `~/.remember` must
never become a git repo, because remember then commits and pushes on its own, with no setting to
stop it.

**Branding:** "agent-memory" is a working name, and it also names the `~/.agent-memory` folder.
Decide before publishing.
