// Provenance without session IDs in git: notes and backup commits carry an opaque session ref plus a
// machine label; the ref -> session ID / user / transcript mapping stays in <storage>/.state/sessions.tsv,
// which never leaves the machine.
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
// [ \t]* (not \s*) so a CRLF file keeps its \r and the rewrite stays byte-stable.
const ORIGIN_LINE = /^([ \t]*)originSessionId:[ \t]*(\S+?)[ \t]*(\r?)$/gm;
const COLUMNS = ['ref', 'machine', 'sessionId', 'host', 'user', 'transcript', 'firstSeen'];

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sessionRef = (id) => sha(id).slice(0, 12);

function safeUser() {
  try {
    return os.userInfo().username;
  } catch {
    return '';
  }
}

// Configured label, else a short hostname hash (raw host and user names stay local).
const machineLabel = (cfg) => cfg.provenance.machine || `m-${sha(os.hostname()).slice(0, 8)}`;

// Files "git add -A" would stage: ignored files (.state/, .idea/) can't leak, so they're never scanned.
function walk(root) {
  try {
    return execFileSync('git', ['ls-files', '-z', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\0')
      .filter((f) => f && !f.startsWith('.state/')) // .state/ may not be gitignored yet; persist() adds it
      .map((f) => path.join(root, f));
  } catch {
    return []; // not a git repo: nothing gets committed
  }
}

const ledgerFile = (root) => path.join(root, '.state', 'sessions.tsv');

function readLedger(root) {
  const rows = new Map();
  try {
    for (const line of fs.readFileSync(ledgerFile(root), 'utf8').split(/\r?\n/).slice(1)) {
      if (!line) continue;
      const v = line.split('\t');
      rows.set(v[0], Object.fromEntries(COLUMNS.map((c, i) => [c, v[i] || ''])));
    }
  } catch {
    // No ledger yet.
  }
  return rows;
}

function writeLedger(root, rows) {
  fs.mkdirSync(path.dirname(ledgerFile(root)), { recursive: true });
  const lines = [COLUMNS.join('\t'), ...[...rows.values()].map((r) => COLUMNS.map((c) => r[c]).join('\t'))];
  fs.writeFileSync(ledgerFile(root), `${lines.join('\n')}\n`);
}

function findTranscript(claudeHome, id) {
  try {
    for (const dir of fs.readdirSync(path.join(claudeHome, 'projects'))) {
      const p = path.join(claudeHome, 'projects', dir, `${id}.jsonl`);
      if (fs.existsSync(p)) return p;
    }
  } catch {
    // No projects folder.
  }
  return '';
}

// Records a session in the local ledger (once per ref) and returns "<machine>/<ref>".
// A session whose transcript isn't on this machine is labelled "unknown", not this machine.
function record(rows, cfg, claudeHome, id, { here = false } = {}) {
  const ref = sessionRef(id);
  if (!rows.has(ref)) {
    const transcript = findTranscript(claudeHome, id);
    const local = here || Boolean(transcript);
    rows.set(ref, {
      ref,
      machine: local ? machineLabel(cfg) : 'unknown',
      sessionId: id,
      host: local ? os.hostname() : '',
      user: local ? safeUser() : '',
      transcript: transcript || 'not on this machine',
      firstSeen: new Date().toISOString().slice(0, 10),
    });
  }
  return `${rows.get(ref).machine}/${ref}`;
}

// Replaces every "originSessionId: <id>" in storage notes with "origin: <machine>/<ref>".
function scrubOrigins(root, cfg, claudeHome, rows) {
  for (const file of walk(root).filter((f) => f.endsWith('.md'))) {
    const text = fs.readFileSync(file, 'utf8');
    const next = text.replace(ORIGIN_LINE, (_, indent, id, cr) => `${indent}origin: ${record(rows, cfg, claudeHome, id)}${cr}`);
    if (next !== text) fs.writeFileSync(file, next);
  }
}

// First storage file still holding a UUID-shaped string (a session ID that must not be committed).
const firstUuid = (root) => walk(root).find((f) => UUID_RE.test(fs.readFileSync(f, 'utf8')));

module.exports = { readLedger, writeLedger, record, scrubOrigins, firstUuid, sessionRef, machineLabel };
