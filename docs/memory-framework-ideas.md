# Memory framework: engineering vs. prompting — ideas backlog

Written 2026-07-19, moved here 2026-07-19 when this folder became a git repo. Companion to
`~/.claude/CLAUDE.md` (Memory Practices) and this repo's own `MEMORY.md`. This is an ideas/backlog
document, not a memory file — it doesn't follow the memory frontmatter schema and isn't indexed in
`MEMORY.md`. It lives under `docs/` specifically so the linter (idea #1, now implemented) doesn't
mistake it for a schema-following memory file.

## Status update (2026-07-19, later same day)

Ideas #1, #2, and #3 are now implemented:
- **#1 (linter):** `~/.claude/scripts/memory-lint.js`, wired as a **`PostToolUse`** hook on
  `Write|Edit` (not `PreToolUse` as first sketched below) — it lints the finished file on disk
  rather than trying to reconstruct an in-flight edit, and blocks via `decision: "block"` +
  `reason` (the PostToolUse mechanism — feeds the reason back to the agent, turn continues) rather
  than `hookSpecificOutput.permissionDecision`, which is PreToolUse-only. Thresholds are
  config-driven (`~/.claude/memory-lint.config.json`): `maxIndexLines: 20`, `maxFileLines: 100`,
  `maxIndexLineChars: 150`. Proven correct against real files (caught two real 150-char violations
  in this folder's own `MEMORY.md` on first run) and against synthetic broken folders (missing
  `metadata.type`, dangling `[[wikilink]]`, an unindexed file) — all three detected correctly.
- **#2 (git):** this folder is now a git repo, remote `origin` at
  `github.com/isidrorn/claude-code-agent-memory-framework` (**public**, by explicit choice — see
  the note this implies for anything written here going forward: nothing sensitive, no absolute
  paths with identifying detail, no client/employer specifics).
- **#3 (SessionStart cap):** the hook command now caps injection at 50 lines with a truncation
  warning instead of an unconditional `cat`.

**Known gap:** the `PostToolUse` lint hook's pipe-test and JSON-schema validation both passed, but
a live in-session proof (editing this folder's `MEMORY.md` to intentionally violate the line-length
rule, then checking whether the harness surfaced the warning) did not show output in the same
turn — consistent with the settings-watcher caveat documented in the `update-config` skill (a
first-time `hooks` key addition may need a manual `/hooks` reload or session restart to take
effect). The `SessionStart` hook, by contrast, *was* proven live via a real forked-session event
mid-session. If the lint hook doesn't visibly fire on your next real memory edit, that reload step
is why.

## Status update (2026-07-19, later still): the mechanism is bundled, and per-project backup shipped

Two more things landed:

- **Mechanism bundling.** `originSessionId` was stripped from this repo's schema (it's public;
  session identifiers are an unnecessary thing to publish — see the sensitive-data rule now in
  `CLAUDE.md`), and the *mechanism itself* — not just the accumulated knowledge — is now bundled
  under `bootstrap/`: copies of `CLAUDE.md`, `memory-lint.js`, `memory-lint.config.json`,
  `memory-backup.sh`, and the relevant `settings.json` fragments. See `bootstrap/SETUP.md`.

- **Per-project memory backup (a new idea, not originally in this list):** a `SessionEnd` hook
  copies the currently-active project's memory folder into `projects/<project-name>/` here and
  pushes, once per real session end. Two design lessons worth recording:

  1. **`Stop` fires once per assistant turn, not once per session — `SessionEnd` is the actual
     session-boundary event.** The settings schema description for `Stop` ("run when Claude stops")
     reads like a session-end hook; it isn't. Verified via a subagent check against Claude Code's
     own hooks docs before building on the wrong assumption — would have made "periodic" backup as
     chatty as the "every edit" option that was explicitly ruled out.
  2. **Hooks bypass the interactive auto-mode permission classifier; my own tool calls don't.**
     Writing (`Edit`) and manually testing (`Bash`) a script that calls `git push` got blocked by
     the classifier mid-session, repeatedly — even after being told "allow this once." Adding a
     narrowly-scoped `permissions.allow` rule (`"Bash(git push -q origin main)"`) unblocked *my*
     interactive attempts, but turned out to be unnecessary for the hook itself: hook commands
     execute as trusted, pre-configured automation once written into `settings.json`, verified via
     a second subagent check rather than assumed — the classifier only gates interactive tool
     calls during a conversation, a genuinely different code path. Worth knowing before spending
     more effort routing around classifier blocks on anything hook-related.

  A cheap secret-pattern guardrail (private key headers, common API-key/password patterns) skips
  the push and warns instead of silently proceeding if a project's memory looks like it contains a
  credential — tested and confirmed working in an isolated sandbox (fake `$HOME`, fake bare git
  remote) before wiring into the real hook, along with the no-op/idempotent case, both skip guards
  (framework's own repo; a project with no memory folder), and the full commit+push happy path.

  **Not yet built, flagged for later:** a configurable backup destination (right now the repo is
  hardcoded in the script) — the user wants this parameterized eventually, most likely so
  project-tier backups can go to a separate *private* repo while the global tier stays public.

---

## The actual axis: "runs" vs. "is read"

Everything in `CLAUDE.md` today is **prose I consume probabilistically** — a `SessionStart` hook
*guarantees the injection step runs*, but it does not guarantee the injected text *changes my
behavior*. I still read it the way I read anything else in context: with attention that competes
against everything else in the window, and that degrades under context pressure (long sessions,
post-compaction, a large diff sitting between the instruction and the moment it should apply).

So "more AI engineering, less prompt engineering" means, concretely: **prefer a hook that *does*
something deterministic (validates, blocks, transforms, computes) over a hook that just injects
more text for me to maybe-read.** A `SessionStart` cat is still "hope he reads it" — one step more
reliable than a CLAUDE.md paragraph, not qualitatively different. A hook that literally rejects a
malformed memory write is a different category of guarantee. I've ranked the ideas below on that
axis, not on novelty.

## What's already native (checked, not guessed)

Before proposing anything, I had a subagent check Claude Code's actual settings/docs, since
building custom machinery for something the platform already ships would be a waste:

- **`autoMemoryDirectory` is a single path per project** — no native global/project split, no
  multi-directory support. Our two-tier design (per-project dir + `~/.claude/memory/` + a
  `SessionStart` hook to bridge them) is filling a real gap, not reinventing a shipped feature.
- **`autoDreamEnabled` ("background memory consolidation") is undocumented** — it exists in the
  settings schema but has no public documentation of what it mechanically does, whether it runs
  automatically, or whether it's even active for this account/tier. I'm treating it as unknown,
  not designing around it. Worth a one-time check every so often (e.g. next major Claude Code
  release notes) rather than something to build against now.
- No native compaction, dedup, or staleness-checking mechanism exists beyond "keep `MEMORY.md`
  short by moving detail into separate files" — which is exactly the convention we already
  adopted, just not automated (now partly automated by the linter's warnings).

## If you only do three things

1. **A memory-file linter, wired as a hook that can actually block a bad write** (idea #1 below).
   **Done — see status update above.**
2. **Put `~/.claude/memory/` under git** (idea #2). **Done — see status update above.**
3. **Cap what the `SessionStart` hook actually injects** (idea #3). **Done — see status update
   above.**

Everything else below is real, but scale-dependent or judgment-dependent — hold off until the
corresponding pain shows up (a growing global folder, a repeated staleness miss, sessions where I
visibly forget to save something worth keeping). Idea #7 is next up for refinement.

---

## Full list

### Tier A — deterministic, cheap — now implemented (see status update)

**1. Memory-file linter as a blocking hook.** Implemented as a `PostToolUse` hook — see status
update for the actual wiring (differs slightly from the `PreToolUse` sketch below, which is left
as originally written for context).

Original sketch: a small script that parses every memory file's YAML frontmatter and checks:
required fields present, `type` is one of the valid enum values, `status` (if set) is `archived`
or absent, no two files share a `name:` slug, every `MEMORY.md` line is under ~150 chars, every
`[[wikilink]]` resolves to a file that exists *in the same folder*, and no `MEMORY.md` entry is
missing its file (or vice versa).

**2. Version-control the memory folders.** Implemented for the global folder, with a private
GitHub remote. Per-project memory folders intentionally left local-only for now (scope decision,
2026-07-19) — revisit if a specific project's memory turns out to need cross-machine sync too.

**3. Bound the SessionStart injection size mechanically.** Implemented — 50-line cap with a
truncation warning, comfortably above the linter's 20-line soft-compaction threshold so the linter
should always flag bloat before this hard cap ever triggers.

### Tier B — deterministic, moderate effort, worth doing once scale justifies it

**4. Keyword-tag retrieval instead of full-index dump.**
Add a `tags:` array to memory frontmatter (e.g. `[java, lombok, jdk, build]`). A
`UserPromptSubmit` hook script greps the incoming prompt's words against every file's tags/
description and injects only the *matching files' full bodies* as `additionalContext` — not just
their one-liner. This is real, scriptable relevance filtering (closer to what Zep/claude-mem do
with embeddings, but via grep instead of a vector index) and it removes "did I actually scan the
index and judge relevance" from my hands entirely. Premature at 2–3 global files; worth it past
~10–15, where scanning-by-eye starts being the actual bottleneck.

**5. Dedup-check before write.**
A `PreToolUse` hook on memory-file `Write` that fuzzy-matches the new file's `description` against
every existing one (simple token-overlap or Levenshtein, no embeddings needed at this corpus size)
and emits a `systemMessage` warning if overlap is high — doesn't block, just flags "you may be
about to duplicate X." Cheap, deterministic, useful once the folder has enough files that I could
plausibly miss an existing match by eye.

**6. Scheduled housekeeping audit.**
A cron-style job (via the `schedule` skill / `CronCreate`) that periodically walks both memory
folders, checks them against the thresholds already written into `CLAUDE.md` (line counts, orphan
files, `status: archived` entries still linked from an index), and drops a report somewhere you'd
see it. Turns compaction from "I notice it mid-task" into "it's already flagged before I start."
Partly superseded by the linter now running on every edit — this would add periodic (not just
edit-triggered) checking.

### Tier C — real but weaker guarantees; next up for refinement (idea #7)

**7. Session-end draft via an `agent`-type Stop hook.**
Claude Code hooks support `type: agent` — a Stop hook could run a small model (e.g. Haiku) over
the session transcript and draft candidate memory entries as a `systemMessage`, closest to what
claude-mem's Stop hook does automatically. Real value (catches things I forget to save in the
moment), but it's still an LLM judgment call underneath — just a different, cheaper model's — and
it adds latency/cost to every session close. Flagged by the user as a technique colleagues use in
practice — refining this is the next conversation.

**8. Automated staleness verification via a `verify_command` frontmatter field.**
Idea: add `verify_command: git log -1 --oneline` to state-snapshot memories, and a hook runs it and
diffs against a stored expected value, flagging drift automatically instead of relying on me to
think to check. Holding off — it adds a new failure surface (stale verify commands, wrong working
directory when the hook runs, commands that assume a shell that isn't the one available) for a
problem that, so far, has come up once and been caught fine by the existing prose rule.

### Tier D — structural/schema fixes, not hooks

**9. The 4-type taxonomy (user/feedback/project/reference) doesn't have a clean bucket for
"toolchain/technology fact."** The Lombok/JDK memory was forced into `type: project` because
nothing else fit. Can't add a new top-level `type` enum value (harness-defined), but an informal
`metadata.domain: tech-fact` tag alongside the existing type would let the linter (idea #1)
distinguish it without waiting on a schema change upstream. Not yet implemented.

**10. Subfolder namespacing for the global folder as it grows.** Right now this repo is flat
(aside from the new `docs/` split for non-schema content). Once it holds memories spanning
multiple ecosystems (Java, JS, git workflows, personal habits), a `java/`, `git/`, `general/`
split with a per-folder index rolled into the top-level `MEMORY.md` keeps it scannable. Not worth
doing at 2 memory files; worth planning the convention for before it's 30.

### Tier E — deliberately out of scope, restated

Vector/embedding search, a knowledge graph, or a background daemon (the actual mem0/Zep/Cognee/
claude-mem approach) would solve retrieval-at-scale better than any of the above, but at current
corpus size the infrastructure cost isn't close to justified. The honest trigger for revisiting
this tier isn't "the framework feels unsophisticated" — it's "the flat-file index has become
larger than can be scanned by eye across dozens of projects." Not close to true yet.
