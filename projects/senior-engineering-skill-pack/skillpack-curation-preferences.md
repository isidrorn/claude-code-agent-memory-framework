---
name: skillpack-curation-preferences
description: "How to curate the senior-engineering-skill-pack — count, license, scope-flagging rules"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4f5cfdda-5f29-4dd9-82e2-82040ae32357
---

Curation rules for the senior-engineering-skill-pack, from user feedback (2026-07-20):

- **Skill count is NOT capped.** "~30" was a rough initial estimate, not a target. The right final
  number (could be 10 or 50) emerges from coverage + trigger quality, not from a quota. Don't defer
  or drop a good skill just to hit a number. (See global `reason-about-intent-not-literal`.)
- **License stance = pragmatic.** Copy anything useful; attribute it (keeps us clear of trouble).
  Public-repo material is fair to reuse — "if they wanted it protected they wouldn't push it public."
  Only avoid clearly/explicitly-protected content. Don't exclude a great skill on license purism.
- **Flag useful-but-out-of-scope finds** in `FINDINGS.md` at repo root (e.g. MCP servers, adjacent
  repos, workflow tooling). Don't let good discoveries evaporate just because they're out of scope.
- **Prefer Java/Spring-tailored** skills when a domain has a language-mismatched incumbent (user's
  stack — see global `user-java-spring-engineer`). A Java backend skill > a great Node one.
- **Essence over tooling:** script-heavy skills aren't discarded for being heavy — their reasoning
  is mined into prose in the customization round (see research/05-personalization-roadmap.md §3b).
