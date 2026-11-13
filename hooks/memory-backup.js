#!/usr/bin/env node
// SessionEnd: copy the active project's Claude Code built-in memory, read-only, into
// <storage>/projects/<name>/native/, then commit everything that changed in storage and push.
// It never writes to Claude Code's folders (principle 6).
// A failed push stays as a sticky alert and is retried by the next session's sync.
const fs = require('fs');
const path = require('path');
const { loadConfig, claudeHome } = require('../lib/config');
const { open, errorLine } = require('../lib/storage');
const { setAlert, clearAlert, beat } = require('../lib/state');
const { projectName } = require('../lib/project');
const { readLedger, writeLedger, record, scrubOrigins, firstUuid } = require('../lib/provenance');

// Cheap pattern match, not a real secret scanner: a second layer behind the sensitive-data rule.
const SECRET_RE = /(-----BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|(api|secret)[_-]?key\s*[:=]|password\s*[:=]|gh[pousr]_[A-Za-z0-9]{20,})/i;

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

function mdFiles(dir, recursive) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && recursive && !e.name.startsWith('.')) out = out.concat(mdFiles(p, true));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const firstSecret = (files) => files.find((f) => SECRET_RE.test(fs.readFileSync(f, 'utf8')));

// Claude Code names a project's folder after its path with every non-alphanumeric char turned into "-".
const projectSlug = (cwd) => cwd.replace(/[^A-Za-z0-9]/g, '-');

function main() {
  const input = readStdin();
  const cwd = path.resolve(input.cwd || process.cwd());
  const cfg = loadConfig();
  const store = open(cfg);
  const root = store.root;
  // Never create the storage folder from a hook: session start alerts when it is missing.
  if (!fs.existsSync(root)) return;
  beat(root, 'memory-backup');
  clearAlert(root, 'backup-crash');
  const home = path.resolve(claudeHome());
  const inClaudeHome = (cwd + path.sep).toLowerCase().startsWith((home + path.sep).toLowerCase());
  const project = projectName(cwd);

  if (cfg.backup.projectTier && !inClaudeHome) {
    const src = path.join(home, 'projects', projectSlug(cwd), 'memory');
    if (fs.existsSync(src)) {
      const hit = firstSecret(mdFiles(src, true));
      if (hit) {
        setAlert(root, `secret:${project}`, `backup of ${project} memory skipped: possible secret in ${path.basename(hit)}; review it`);
      } else {
        clearAlert(root, `secret:${project}`);
        // Read-only copy of Claude Code's built-in memory; our local layer is projects/<name>/ itself.
        fs.cpSync(src, path.join(root, 'projects', project, 'native'), { recursive: true });
      }
    }
  }

  const globalHit = firstSecret(mdFiles(root, true)); // global, local layers, queue and native copies
  if (globalHit) {
    setAlert(root, 'secret:global', `memory commit skipped: possible secret in ${path.relative(root, globalHit)}; review it`);
    return;
  }
  clearAlert(root, 'secret:global');

  // Session IDs stay on this machine: notes and commits carry "<machine>/<ref>", .state/sessions.tsv resolves it.
  // shortcut: "Session:" names the session that ends, which may also commit global edits from a parallel session; per-file attribution if that matters.
  const rows = readLedger(root);
  scrubOrigins(root, cfg, home, rows);
  const trailer = input.session_id ? `\n\nSession: ${record(rows, cfg, home, input.session_id, { here: true })}` : '';
  writeLedger(root, rows);
  const uuidHit = firstUuid(root);
  if (uuidHit) {
    setAlert(root, 'session-id', `memory commit skipped: session-ID-like UUID in ${path.relative(root, uuidHit)}; remove it`);
    return;
  }
  clearAlert(root, 'session-id');

  try {
    store.persist(`Backup: ${inClaudeHome ? 'global' : project} memory (${new Date().toISOString().slice(0, 19)}Z)${trailer}`);
    clearAlert(root, 'backup');
  } catch (err) {
    setAlert(root, 'backup', `memory backup commit/push failed: ${errorLine(err)}`);
  }
}

try {
  main();
} catch (err) {
  // Never block session end, but never fail silently either (principle 9).
  try {
    setAlert(loadConfig().storage.path, 'backup-crash', `memory backup crashed: ${errorLine(err)}`);
  } catch {
    // Config itself unreadable: session start reports that.
  }
}
