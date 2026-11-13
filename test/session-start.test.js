const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { note, writeFiles, git, sandbox, runHook } = require('./helpers');

const alertsOf = (sbx) => JSON.parse(fs.readFileSync(path.join(sbx.pluginData, 'alerts.json'), 'utf8'));

test('prints alerts, then rules, then the capped global index, then expired notes', () => {
  const index = '# Index\n' + Array.from({ length: 60 }, (_, i) => `- [n${i}](n${i}.md) — x`).join('\n');
  const sbx = sandbox({ mode: 'local-only', storageFiles: { 'MEMORY.md': index, 'old.md': note('old', { extra: '  expires: 2000-01-01\n' }) } });
  writeFiles(sbx.pluginData, { 'alerts.json': JSON.stringify({ backup: { message: 'push broke', since: '2026-01-01' } }) });

  const out = runHook('session-start.js', {}, sbx.env).stdout;
  const pos = (s) => out.indexOf(s);
  assert.ok(pos('push broke') >= 0 && pos('push broke') < pos('Memory practices'), 'alerts before rules');
  assert.ok(pos('Memory practices') < pos('Global memory index'), 'rules before index');
  assert.ok(out.includes('n48') && !out.includes('n49]'), 'index capped at 50 lines');
  assert.ok(out.includes('truncated: 11 more lines'));
  assert.ok(out.includes('past their "expires" date') && out.includes('old.md'));
});

test('prints the local index of the current project, named after the main repo even from a subfolder', () => {
  const sbx = sandbox({ mode: 'local-only', storageFiles: { 'MEMORY.md': '# G\n', 'projects/my-proj/MEMORY.md': '# L\n- [l](l.md) — local note\n' } });
  const repo = path.join(sbx.base, 'work', 'my-proj');
  fs.mkdirSync(path.join(repo, 'sub'), { recursive: true });
  git(repo, ['init', '-q']);
  const out = runHook('session-start.js', { cwd: path.join(repo, 'sub') }, sbx.env).stdout;
  assert.ok(out.includes('Local memory index (project: my-proj'), out);
  assert.ok(out.includes('- [l](l.md) — local note'));
});

test('unimplemented storage mode is reported, not thrown', () => {
  const sbx = sandbox();
  fs.writeFileSync(sbx.config, JSON.stringify({ storage: { path: sbx.storage, mode: 'remote-only' } }));
  const r = runHook('session-start.js', {}, sbx.env);
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('not implemented yet'));
});

test('failed pull leaves a sync alert in plugin data and still prints the index', () => {
  const sbx = sandbox({ storageFiles: { 'MEMORY.md': '# Index\n- [a](a.md) — x\n' } });
  fs.rmSync(sbx.remote, { recursive: true, force: true });
  const out = runHook('session-start.js', {}, sbx.env).stdout;
  assert.ok(out.includes('sync with remote failed'));
  assert.ok(out.includes('- [a](a.md)'));
  assert.ok(alertsOf(sbx).sync);
  assert.ok(!fs.existsSync(path.join(sbx.storage, '.state', 'alerts.json')), 'alerts no longer in storage');
});

test('alerts written to the old .state/ location are merged into plugin data', () => {
  const sbx = sandbox({ mode: 'local-only' });
  writeFiles(sbx.storage, { '.state/alerts.json': JSON.stringify({ old: { message: 'from a hand-run hook', since: '2026-01-01' } }) });
  const out = runHook('session-start.js', {}, sbx.env).stdout;
  assert.ok(out.includes('from a hand-run hook'));
  assert.ok(alertsOf(sbx).old && !fs.existsSync(path.join(sbx.storage, '.state', 'alerts.json')));
});

test('missing storage folder alerts and points at the legacy folder; nothing is created', () => {
  const sbx = sandbox({ mode: 'local-only' });
  fs.rmSync(sbx.storage, { recursive: true, force: true });
  const legacy = path.join(sbx.base, 'home', '.claude', 'memory');
  fs.mkdirSync(legacy, { recursive: true });
  git(legacy, ['init', '-q']);
  const env = { ...sbx.env, USERPROFILE: path.join(sbx.base, 'home'), HOME: path.join(sbx.base, 'home') };
  const out = runHook('session-start.js', {}, env).stdout;
  assert.match(out, /not found, but your notes are still at .*memory: move that folder/);
  assert.ok(!fs.existsSync(sbx.storage), 'hook does not create the storage folder');
});

test('storage outside a .agent-memory folder alerts that the linter cannot see it', () => {
  const sbx = sandbox({ mode: 'local-only' });
  const other = path.join(sbx.base, 'notes');
  fs.mkdirSync(other);
  fs.writeFileSync(sbx.config, JSON.stringify({ storage: { path: other, mode: 'local-only' } }));
  assert.match(runHook('session-start.js', {}, sbx.env).stdout, /memory linter never runs on it/);
});

test('a backup that has not run for staleDays raises an alert; a recent one clears it', () => {
  const sbx = sandbox({ mode: 'local-only' });
  const old = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
  writeFiles(sbx.pluginData, { 'heartbeat.json': JSON.stringify({ firstSeen: old, 'memory-backup': old }) });
  assert.match(runHook('session-start.js', {}, sbx.env).stdout, /backup has not run for 10 days/);
  writeFiles(sbx.pluginData, { 'heartbeat.json': JSON.stringify({ firstSeen: old, 'memory-backup': new Date().toISOString() }) });
  assert.doesNotMatch(runHook('session-start.js', {}, sbx.env).stdout, /backup has not run/);
});

test('without CLAUDE_PLUGIN_DATA (hook run by hand), a missing storage folder is still not created', () => {
  const sbx = sandbox({ mode: 'local-only' });
  fs.rmSync(sbx.storage, { recursive: true, force: true });
  const env = { ...sbx.env };
  delete env.CLAUDE_PLUGIN_DATA;
  const out = runHook('session-start.js', {}, env).stdout;
  assert.match(out, /not found/);
  assert.ok(!fs.existsSync(sbx.storage), 'fallback state must not create the storage folder');
});
