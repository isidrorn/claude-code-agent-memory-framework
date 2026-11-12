#!/usr/bin/env node
// SessionStart: sync storage, then print (in order) open alerts, the memory rules, the global index
// (capped) and a one-line expiry notice. Stdout becomes session context. Never fails the session.
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../lib/config');
const { open, errorLine } = require('../lib/storage');
const { readAlerts, setAlert, clearAlert } = require('../lib/state');
const { parseFrontmatter } = require('../lib/frontmatter');

const RULES_FILE = path.join(__dirname, '..', 'rules', 'memory-practices.md');

function readOr(file, fallback) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return fallback;
  }
}

function expiredNotes(root, today) {
  let files = [];
  try {
    files = fs.readdirSync(root).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md' && f !== 'README.md');
  } catch {
    return [];
  }
  return files.filter((f) => {
    const fm = parseFrontmatter(readOr(path.join(root, f), ''));
    const meta = fm ? fm.metadata : {};
    return meta.expires && meta.status !== 'archived' && meta.expires < today;
  });
}

function main() {
  const cfg = loadConfig();
  const out = [];
  let root = cfg.storage.path;

  try {
    const store = open(cfg);
    root = store.root;
    try {
      store.sync();
      clearAlert(root, 'sync');
    } catch (err) {
      setAlert(root, 'sync', `sync with remote failed, working from the local copy: ${errorLine(err)}`);
    }
  } catch (err) {
    out.push(`[agent-memory] storage misconfigured: ${err.message}`);
  }

  const alerts = Object.values(readAlerts(root));
  if (alerts.length) {
    out.push('## Agent memory alerts (unresolved, tell the user)');
    for (const a of alerts) out.push(`- ${a.message} (since ${a.since})`);
    out.push('');
  }

  out.push(readOr(RULES_FILE, '').trim(), '');

  const indexFile = path.join(root, 'MEMORY.md');
  out.push(`## Global memory index (folder: ${root})`);
  const lines = readOr(indexFile, '(no global MEMORY.md yet)').trimEnd().split(/\r?\n/);
  const cap = cfg.injection.maxIndexLines;
  out.push(...lines.slice(0, cap));
  if (lines.length > cap) out.push(`... (truncated: ${lines.length - cap} more lines in ${indexFile} — run a compaction pass)`);

  const expired = expiredNotes(root, new Date().toISOString().slice(0, 10));
  if (expired.length) out.push('', `${expired.length} global memories are past their "expires" date and need review: ${expired.join(', ')}`);

  process.stdout.write(out.join('\n') + '\n');
}

try {
  main();
} catch (err) {
  process.stdout.write(`[agent-memory] session-start failed: ${err.message}\n`);
}
