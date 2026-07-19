#!/usr/bin/env bash
# SessionEnd hook: back up the active project's memory/ folder into the
# global memory repo, under projects/<project-name>/, and push.
# Fires once per session end (not per-turn, not per-edit) -- see
# ~/.claude/memory/docs/memory-framework-ideas.md for why SessionEnd was
# chosen over Stop (Stop fires once per assistant turn -- far too often).
set -u

cwd="$(pwd -W 2>/dev/null || pwd)"
home="$HOME"
home_win="$(cd "$home" && pwd -W 2>/dev/null || printf '%s' "$home")"

# Don't back up the framework's own repo onto itself.
case "$cwd" in
  "$home_win"/.claude*) exit 0 ;;
esac

project_name="$(basename "$cwd")"
sanitized="$(printf '%s' "$cwd" | sed 's/:/-/g; s/[\\\/]/-/g')"
src="$home/.claude/projects/$sanitized/memory"

[ -d "$src" ] || exit 0

repo="$home/.claude/memory"
dest="$repo/projects/$project_name"

# Guardrail: skip the push (don't silently swallow it -- warn instead) if
# anything in the source looks like a secret. Cheap pattern match, not a
# real secret scanner -- a second layer behind the CLAUDE.md sensitive-data
# rule, not a replacement for it.
if grep -RIlqE '(-----BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|(api|secret)[_-]?key[[:space:]]*[:=]|password[[:space:]]*[:=])' "$src" 2>/dev/null; then
  echo "{\"systemMessage\":\"Memory backup for $project_name skipped -- possible secret pattern found in its memory folder. Not pushed; review manually.\"}"
  exit 0
fi

mkdir -p "$dest"
cp -r "$src"/. "$dest"/ 2>/dev/null

cd "$repo" || exit 0
git add "projects/$project_name" >/dev/null 2>&1

if ! git diff --cached --quiet 2>/dev/null; then
  if ! git commit -q -m "Backup: $project_name memory ($(date -u +%Y-%m-%dT%H:%M:%SZ))" >/dev/null 2>&1; then
    echo "{\"systemMessage\":\"Memory backup for $project_name: git commit failed (check git user.name/user.email are configured) -- not pushed.\"}"
    exit 0
  fi
  if git push -q origin main >/dev/null 2>&1; then
    echo "{\"systemMessage\":\"Backed up $project_name memory to claude-code-agent-memory-framework.\"}"
  else
    echo "{\"systemMessage\":\"Backed up $project_name memory locally (commit ok) but push failed -- offline or auth issue? Will retry next session end.\"}"
  fi
fi
exit 0
