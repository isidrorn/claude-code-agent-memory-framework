const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { note, writeFiles, git, sandbox, runHook } = require('./helpers');

const slug = (p) => p.replace(/[^A-Za-z0-9]/g, '-');
const alerts = (sbx) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(sbx.storage, '.state', 'alerts.json'), 'utf8'));
  } catch {
    return {};
  }
};
const remoteFiles = (sbx) => git(sbx.base, ['--git-dir', sbx.remote, 'ls-tree', '-r', '--name-only', 'main']).split('\n');

function withProject(sbx, files) {
  const cwd = path.join(sbx.base, 'work', 'my-proj');
  fs.mkdirSync(cwd, { recursive: true });
  writeFiles(path.join(sbx.claudeHome, 'projects', slug(cwd), 'memory'), files);
  return cwd;
}

test('backs up project memory and uncommitted global notes, then pushes', () => {
  const sbx = sandbox();
  const cwd = withProject(sbx, { 'MEMORY.md': '# p\n', 'p.md': note('p') });
  writeFiles(sbx.storage, { 'g.md': note('g') }); // a global note nobody committed
  runHook('memory-backup.js', { cwd }, sbx.env);
  const files = remoteFiles(sbx);
  assert.ok(files.includes('projects/my-proj/p.md'), files.join(','));
  assert.ok(files.includes('g.md'), 'global note committed and pushed');
  assert.ok(!files.some((f) => f.startsWith('.state')), '.state stays out of git');
  assert.deepStrictEqual(alerts(sbx), {});
});

test('secret in project memory skips that copy and leaves an alert', () => {
  const sbx = sandbox();
  const cwd = withProject(sbx, { 'p.md': note('p', { body: 'api_key = abc123' }) });
  runHook('memory-backup.js', { cwd }, sbx.env);
  assert.ok(!fs.existsSync(path.join(sbx.storage, 'projects', 'my-proj')));
  assert.ok(alerts(sbx)['secret:my-proj']);
});

test('push failure is a sticky alert; next session start pushes and clears it', () => {
  const sbx = sandbox();
  const cwd = withProject(sbx, { 'p.md': note('p') });
  const moved = sbx.remote + '.away';
  fs.renameSync(sbx.remote, moved); // remote unreachable
  runHook('memory-backup.js', { cwd }, sbx.env);
  assert.ok(alerts(sbx).backup, 'backup alert set');
  assert.strictEqual(Number(git(sbx.storage, ['rev-list', '--count', 'HEAD']).trim()), 2, 'commit kept locally');

  const shown = runHook('session-start.js', {}, sbx.env).stdout;
  assert.ok(shown.includes('memory backup commit/push failed'), 'alert shown at next session start');

  fs.renameSync(moved, sbx.remote);
  runHook('session-start.js', {}, sbx.env); // sync retries the push
  assert.ok(remoteFiles(sbx).includes('projects/my-proj/p.md'), 'retried push landed');
  runHook('memory-backup.js', { cwd }, sbx.env);
  assert.ok(!alerts(sbx).backup, 'alert cleared after a successful backup');
});

test('local-only mode commits but never pushes', () => {
  const sbx = sandbox({ mode: 'local-only' });
  const cwd = withProject(sbx, { 'p.md': note('p') });
  runHook('memory-backup.js', { cwd }, sbx.env);
  assert.ok(!remoteFiles(sbx).includes('projects/my-proj/p.md'));
  assert.ok(git(sbx.storage, ['log', '--oneline']).includes('Backup: my-proj'));
});

const SID = '11111111-2222-4333-8444-555555555555'; // session that is ending, transcript on this machine
const OLD = '99999999-8888-4777-8666-555555555555'; // legacy ID with no transcript here

function provenanceSandbox() {
  const sbx = sandbox();
  fs.writeFileSync(sbx.config, JSON.stringify({ storage: { path: sbx.storage }, provenance: { machine: 'test-box' } }));
  return sbx;
}

test('session IDs never reach git: notes and commit carry machine/ref, ledger resolves locally', () => {
  const sbx = provenanceSandbox();
  const crlf = (s) => s.replace(/\n/g, '\r\n');
  const cwd = withProject(sbx, {
    'p.md': crlf(note('p', { extra: `  originSessionId: ${SID}\n` })),
    'q.md': note('q', { extra: `  originSessionId: ${OLD}\n` }),
  });
  writeFiles(path.join(sbx.claudeHome, 'projects', slug(cwd)), { [`${SID}.jsonl`]: '{}\n' });
  runHook('memory-backup.js', { cwd, session_id: SID }, sbx.env);

  const show = (f) => git(sbx.base, ['--git-dir', sbx.remote, 'show', `main:${f}`]);
  const ref = require('../lib/provenance').sessionRef(SID);
  const p = show('projects/my-proj/p.md');
  assert.ok(p.includes(`  origin: test-box/${ref}`), 'ID replaced in what was pushed');
  const local = fs.readFileSync(path.join(sbx.storage, 'projects', 'my-proj', 'p.md'), 'utf8');
  assert.ok(local.includes(`  origin: test-box/${ref}\r\n`), 'CRLF kept in the working copy');
  assert.ok(show('projects/my-proj/q.md').includes('origin: unknown/'), 'no transcript here: not claimed by this machine');
  assert.doesNotMatch(p + show('projects/my-proj/q.md'), /originSessionId|1111|9999/);
  assert.ok(git(sbx.base, ['--git-dir', sbx.remote, 'log', '-1', '--format=%B', 'main']).includes(`Session: test-box/${ref}`));

  const ledger = fs.readFileSync(path.join(sbx.storage, '.state', 'sessions.tsv'), 'utf8');
  assert.ok(ledger.includes(SID) && ledger.includes(OLD) && ledger.includes(`${SID}.jsonl`));
  assert.ok(!remoteFiles(sbx).some((f) => f.startsWith('.state')));

  const commits = () => git(sbx.storage, ['rev-list', '--count', 'HEAD']);
  const before = commits();
  runHook('memory-backup.js', { cwd, session_id: SID }, sbx.env); // cpSync brings raw IDs back; rewrite must be identical
  assert.strictEqual(commits(), before, 'second backup is a no-op');
});

test('a UUID in a gitignored file does not block the commit', () => {
  const sbx = provenanceSandbox();
  writeFiles(sbx.storage, { '.gitignore': '.state/\n.idea/\n', '.idea/workspace.xml': `<x id="${SID}"/>` });
  const cwd = withProject(sbx, { 'p.md': note('p') });
  runHook('memory-backup.js', { cwd }, sbx.env);
  assert.ok(!alerts(sbx)['session-id']);
  assert.ok(remoteFiles(sbx).includes('projects/my-proj/p.md'));
});

test('a UUID anywhere else in storage blocks the commit with an alert', () => {
  const sbx = provenanceSandbox();
  const cwd = withProject(sbx, { 'p.md': note('p', { body: `See session ${SID}.` }) });
  runHook('memory-backup.js', { cwd }, sbx.env);
  assert.ok(alerts(sbx)['session-id']);
  assert.ok(!remoteFiles(sbx).includes('projects/my-proj/p.md'));
});
