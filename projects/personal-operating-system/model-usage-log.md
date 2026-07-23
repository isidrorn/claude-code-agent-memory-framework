---
name: model-usage-log
description: "Which Claude model/effort handled which kind of work on this project — source of truth also mirrored in README.md's AI Collaboration Log"
metadata: 
  node_type: memory
  type: project
  originSessionId: b81ca169-4d94-4161-a981-8b3b7f0ebe40
  modified: 2026-07-23T19:06:35.776Z
---

Mirrored in `README.md` under "AI Collaboration Log" (public-facing copy); this file is the
source of truth to update first when the roster of models/roles changes.

| Model | Effort | Role |
|---|---|---|
| Sonnet 5 (`claude-sonnet-5`) | reasoning effort 80 | Primary agent for the whole project: read the spec, drafted and is executing the phased doc-delivery plan, authors every `docs/*.md` file, handles git operations and memory upkeep. |
| Opus, via the `advisor` tool | not exposed to the calling agent — inferred "Opus-tier" from the tool's own description as "a stronger reviewer model," not a confirmed version number | Second-opinion review before committing to the delivery plan: recommended the explicit coverage-map/traceability table, a shared-vocabulary pass across docs, and writing the 100+ test cases (doc 12) last so they conform to a stabilized taxonomy. Not used for authoring doc content directly. |

No Explore/Plan subagents were used — documentation-only task, no existing code to search.

**Why this is worth remembering:** the user explicitly asked for this to be tracked in both
memory and the README, for transparency on which model did what. Not derivable from git history
(commits don't record which model/effort authored them).

**How to apply:** update both this file and `README.md`'s AI Collaboration Log together whenever
the model/effort roster changes (e.g. a different model takes over primary authoring, or another
tool backed by a different model gets used).
