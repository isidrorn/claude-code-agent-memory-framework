#!/usr/bin/env node
// SessionStart: sync storage, then print (in order) open alerts, the memory rules, the global index,
// the current project's local index (both capped) and a one-line expiry notice.
// Stdout becomes session context. Never fails the session.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadConfig } = require('../lib/config');
const { open, errorLine } = require('../lib/storage');
const { readAlerts, setAlert, clearAlert, beat, readBeats } = require('../lib/state');
const { parseFrontmatter } = require('../lib/frontmatter');
const { projectName } = require('../lib/project');

const RULES_FILE = path.join(__dirname, '..', 'rules', 'memory-practices.md');
const LEGACY_STORAGE = path.join(os.homedir(), '.claude', 'memory'); // default before 0.2.0
const DAY_MS = 24 * 60 * 60 * 1000;

function readOr(file, fallback) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return fallback;
  }
}

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

function expiredNotes(dir, today) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md' && f !== 'README.md');
  } catch {
    return [];
  }
  return files.filter((f) => {
    const fm = parseFrontmatter(readOr(path.join(dir, f), ''));
    const meta = fm ? fm.metadata : {};
    return meta.expires && meta.status !== 'archived' && meta.expires < today;
  });
}

function printIndex(out, heading, indexFile, cap) {
  const text = readOr(indexFile, null);
  if (text === null) return false;
  const lines = text.trimEnd().split(/\r?\n/);
  out.push('', heading, ...lines.slice(0, cap));
  if (lines.length > cap) out.push(`... (truncated: ${lines.length - cap} more lines in ${indexFile}; run a compaction pass)`);
  return true;
}

// Checks whose failure would otherwise be silent (principle 9). Stored as sticky alerts.
function healthChecks(root, cfg) {
  const isGitRepo = (dir) => fs.existsSync(path.join(dir, '.git'));
  if (!fs.existsSync(root)) {
    const legacy = path.resolve(root) !== path.resolve(LEGACY_STORAGE) && isGitRepo(LEGACY_STORAGE);
    setAlert(root, 'storage-missing', legacy
      ? `storage folder ${root} not found, but your notes are still at ${LEGACY_STORAGE}: move that folder to ${root}`
      : `storage folder ${root} not found: clone your backup repo there, or create it`);
  } else {
    clearAlert(root, 'storage-missing');
  }

  // The linter hook only starts for paths under a ".agent-memory" folder (plugin.json "if" filters).
  if (!path.resolve(root).split(path.sep).includes('.agent-memory')) {
    setAlert(root, 'lint-filter', `storage path ${root} is not inside a ".agent-memory" folder, so the memory linter never runs on it`);
  } else {
    clearAlert(root, 'lint-filter');
  }

  const beats = readBeats(root);
  if (!beats.firstSeen) beat(root, 'firstSeen');
  const last = beats['memory-backup'] || beats.firstSeen;
  const days = last ? Math.floor((Date.now() - Date.parse(last)) / DAY_MS) : 0;
  if (days >= cfg.backup.staleDays) {
    setAlert(root, 'backup-stale', `the session-end backup has not run for ${days} days (last: ${beats['memory-backup'] || 'never'})`);
  } else {
    clearAlert(root, 'backup-stale');
  }
}

function main() {
  const input = readStdin();
  const cwd = path.resolve(input.cwd || process.cwd());
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
  beat(root, 'session-start');
  healthChecks(root, cfg);

  const alerts = Object.values(readAlerts(root));
  if (alerts.length) {
    out.push('## Agent memory alerts (unresolved, tell the user)');
    for (const a of alerts) out.push(`- ${a.message} (since ${a.since})`);
    out.push('');
  }

  out.push(readOr(RULES_FILE, '').trim());

  const cap = cfg.injection.maxIndexLines;
  if (!printIndex(out, `## Global memory index (folder: ${root})`, path.join(root, 'MEMORY.md'), cap)) {
    out.push('', `## Global memory index (folder: ${root})`, '(no global MEMORY.md yet)');
  }
  const project = projectName(cwd);
  const localDir = path.join(root, 'projects', project);
  printIndex(out, `## Local memory index (project: ${project}, folder: ${localDir})`, path.join(localDir, 'MEMORY.md'), cap);

  const today = new Date().toISOString().slice(0, 10);
  const expired = [...expiredNotes(root, today), ...expiredNotes(localDir, today).map((f) => `projects/${project}/${f}`)];
  if (expired.length) out.push('', `${expired.length} memories are past their "expires" date and need review: ${expired.join(', ')}`);

  process.stdout.write(out.join('\n') + '\n');
}

try {
  main();
} catch (err) {
  process.stdout.write(`[agent-memory] session-start failed: ${err.message}\n`);
}
