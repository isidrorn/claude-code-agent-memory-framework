#!/usr/bin/env bash
# Eval scaffold: seed an empty two-layer memory store inside the eval workspace and point the
# plugin at it. Refuses to run outside an eval temp home, so it never touches a real store.
# Each case keeps its own copy: claude plugin eval rejects scaffold paths outside the case folder.
set -euo pipefail
case "$HOME" in
  *claude-eval-*) ;;
  *) echo "seed-store: HOME=$HOME is not an eval temp home, refusing" >&2; exit 1 ;;
esac

# The store lives in the workspace: the eval child may only write there.
cwd="$(pwd -W 2>/dev/null || pwd)" # Git Bash: C:/... form, which Node resolves correctly
store="$cwd/.agent-memory"
project="$(basename "$cwd")" # the hooks name a non-git folder after itself
mkdir -p "$store/projects/$project"
printf '# Global memory index\n' > "$store/MEMORY.md"
printf '# Local memory index\n' > "$store/projects/$project/MEMORY.md"
git -C "$store" init -q
git -C "$store" config user.name eval
git -C "$store" config user.email eval@example.invalid

# The scaffold gets no CLAUDE_CONFIG_DIR; the run's config dir sits next to its home.
config_dir="${CLAUDE_CONFIG_DIR:-$HOME/../config}"
mkdir -p "$config_dir/agent-memory"
printf '{ "storage": { "path": "%s", "mode": "local-only" } }\n' "$store" > "$config_dir/agent-memory/config.json"
