#!/usr/bin/env node
// SessionEnd: copy the active project's built-in memory folder into <storage>/projects/<name>/,
// then commit everything that changed in storage (global notes included) and push.
// A failed push stays as a sticky alert and is retried by the next session's sync.
const fs = require('fs');
const path = require('path');
const { loadConfig, claudeHome } = require('../lib/config');
const { open, errorLine } = require('../lib/storage');
const { setAlert, clearAlert } = require('../lib/state');

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
  const home = path.resolve(claudeHome());
  const inClaudeHome = (cwd + path.sep).toLowerCase().startsWith((home + path.sep).toLowerCase());
  const project = path.basename(cwd);

  if (cfg.backup.projectTier && !inClaudeHome) {
    const src = path.join(home, 'projects', projectSlug(cwd), 'memory');
    if (fs.existsSync(src)) {
      const hit = firstSecret(mdFiles(src, true));
      if (hit) {
        setAlert(root, `secret:${project}`, `backup of ${project} memory skipped: possible secret in ${path.basename(hit)}; review it`);
      } else {
        clearAlert(root, `secret:${project}`);
        fs.cpSync(src, path.join(root, 'projects', project), { recursive: true });
      }
    }
  }

  const globalHit = firstSecret(mdFiles(root, false));
  if (globalHit) {
    setAlert(root, 'secret:global', `memory commit skipped: possible secret in global note ${path.basename(globalHit)}; review it`);
    return;
  }
  clearAlert(root, 'secret:global');

  try {
    store.persist(`Backup: ${inClaudeHome ? 'global' : project} memory (${new Date().toISOString().slice(0, 19)}Z)`);
    clearAlert(root, 'backup');
  } catch (err) {
    setAlert(root, 'backup', `memory backup commit/push failed: ${errorLine(err)}`);
  }
}

try {
  main();
} catch (err) {
  // Never block session end; storage misconfiguration is reported by session-start.
}
