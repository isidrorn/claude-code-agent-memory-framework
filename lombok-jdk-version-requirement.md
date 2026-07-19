---
name: lombok-jdk-version-requirement
description: "Lombok's annotation processor silently no-ops under JDK 26 / GraalVM 25 on this machine — needs JDK 21"
metadata:
  node_type: memory
  type: project
  modified: 2026-07-19
---

On this machine, Lombok's annotation processor (`@Getter`, `@Builder`, `@Slf4j`'s `log` field,
etc.) silently generates nothing under GraalVM 25 or OpenJDK 26 — no error, just a wall of
unrelated "cannot find symbol" compile errors. JDK 21 is the only JDK here confirmed to work.

**Why:** confirmed empirically on doodle-code-challenge (originating project), but the JDK/Lombok
incompatibility is a toolchain fact, not a project fact — any Lombok project built on this machine
hits the same thing.

**How to apply:** before building any Lombok project here, point `JAVA_HOME`/`PATH` at JDK 21:
```bash
export JAVA_HOME="$HOME/.jdks/graalvm-ce-21.0.2"
export PATH="/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.1.1/plugins/maven/lib/maven3/bin:$JAVA_HOME/bin:$PATH"
```
(the Maven path is IntelliJ's bundled Maven3 — swap it for a project with its own wrapper).
