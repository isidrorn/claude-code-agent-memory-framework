---
name: taxonomy-consolidation-decisions
description: "Judgment calls behind the 15-type taxonomy and its 8 backends in docs/03-information-taxonomy.md, after 5 rounds of user review"
metadata: 
  node_type: memory
  type: project
  originSessionId: b81ca169-4d94-4161-a981-8b3b7f0ebe40
  modified: 2026-07-23T19:07:10.148Z
---

`docs/03-information-taxonomy.md` (v0.5) defines 15 canonical types across **8 backends**: 7
type-owning (Task, Project, Habit, Idea, Calendar, Knowledge, Reference) + 1 infrastructure-only
and explicitly speculative/deferred (Storage) — a significant expansion beyond the spec's literal
5-backend list, reached over several rounds of user review, not stated in `docs/initial-spec.md`:

- **ProjectBackend** (new): project-affiliated action items are **Project Task**, not a lifecycle
  state of Task — user's own MVP philosophy: project-linked work belongs in a project-management
  tool, distinguished from standalone Task by explicit/AI-inferred project affiliation.
- **HabitBackend** (new): Habit's data shape (streak/consistency tracking, "graduating" out of
  active tracking once absorbed) doesn't fit Task (complete-once) or Calendar (points/spans in
  time) — rejected the user's initial "fold into Calendar" idea on domain grounds (calendars
  reserve slots; habits track consistency), landed on a dedicated backend instead, which the user
  agreed was closer to what they meant.
- **IdeaBackend** (new): Idea split from Knowledge — user finds ideas one of their most scattered
  item types with no single home, and doesn't consider Idea conceptually part of Knowledge. Idea
  vs. Someday: kept separate (Someday = GTD-task-shaped/TaskBackend; Idea = no action implied even
  eventually).
- **NotificationBackend removed entirely**: was originally added as Reminder's owner, but this
  contradicted the spec's own Section 4 scope exclusion ("Notifications") and `00-philosophy.md`'s
  own Out-of-Scope list. Notification delivery is native to whichever backend/driver an item ends
  up in — not a POS concern at all.
- **StorageBackend kept, but explicitly marked speculative/deferred** — same out-of-scope tension
  as Notification (spec excludes "File synchronization"/"Document editing" too), but user chose to
  keep it as a placeholder rather than remove it.
- **Article lives in KnowledgeBackend**, identified by content, not by reading-intent — user
  pushback: "an article is an article regardless of what the user is going to do with it,"
  including being AI-ingested into Knowledge automatically, not just manually re-captured.
- **Knowledge vs. Reference**: kept separate. Test: would you explain it in your own words /
  reason from it (Knowledge) vs. always retrieve it verbatim (Reference) — same intent (context),
  different extent/actionability.
- **Task vs. Event**: an Event reserves a fixed slot where something *happens*; a Task's deadline
  is a soft completion boundary with flexible timing before it, not a reserved slot. Resolves an
  inconsistency the user caught where both "have a date" but route differently.
- **Lifecycle field scope**: corrected to include only POS-observable transitions (re-capture/
  reclassify paths), never an item's internal workflow inside its owning backend — user caught
  this as contradicting `01-domain-analysis.md`'s own boundary rules (POS doesn't mirror external
  item state post-routing).
- **"Reading Queue"/"Project Backlog"/"Shopping"/"Recurring"/"Habits"** (spec Section 9 shorthand)
  are the same concepts as Article/Project Task/Shopping Item/Recurring Task/Habit respectively.

**Deadline data preservation** (user note, applies going forward, not yet in any doc): since Task
may carry a deadline, `08-data-model.md` must include a date field for it — capture-time
information is enriched with metadata, never stripped. Applies broadly to any future data-model
work: extracted attributes (dates, entities, tags) must always be preserved even if not used for
routing.

**Why this is worth remembering:** none of this is derivable from `initial-spec.md` alone — it's
the product of 5 rounds of user review that meaningfully departed from and expanded the spec's
initial backend list.

**How to apply:** treat `docs/03-information-taxonomy.md` as the current source of truth; update
or archive this memory if the doc changes further.
