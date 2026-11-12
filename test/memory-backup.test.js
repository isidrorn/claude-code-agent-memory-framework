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
