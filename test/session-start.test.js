const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { note, writeFiles, sandbox, runHook } = require('./helpers');

test('prints alerts, then rules, then the capped index, then expired notes', () => {
  const index = '# Index\n' + Array.from({ length: 60 }, (_, i) => `- [n${i}](n${i}.md) — x`).join('\n');
  const sbx = sandbox({ mode: 'local-only', storageFiles: { 'MEMORY.md': index, 'old.md': note('old', { extra: '  expires: 2000-01-01\n' }) } });
  writeFiles(sbx.storage, { '.state/alerts.json': JSON.stringify({ backup: { message: 'push broke', since: '2026-01-01' } }) });

  const out = runHook('session-start.js', {}, sbx.env).stdout;
  const pos = (s) => out.indexOf(s);
  assert.ok(pos('push broke') >= 0 && pos('push broke') < pos('Memory practices'), 'alerts before rules');
  assert.ok(pos('Memory practices') < pos('Global memory index'), 'rules before index');
  assert.ok(out.includes('n48') && !out.includes('n49]'), 'index capped at 50 lines');
  assert.ok(out.includes('truncated: 11 more lines'));
  assert.ok(out.includes('past their "expires" date') && out.includes('old.md'));
});

test('unimplemented storage mode is reported, not thrown', () => {
  const sbx = sandbox();
  fs.writeFileSync(sbx.config, JSON.stringify({ storage: { path: sbx.storage, mode: 'remote-only' } }));
  const r = runHook('session-start.js', {}, sbx.env);
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('not implemented yet'));
});

test('failed pull leaves a sync alert and still prints the index', () => {
  const sbx = sandbox({ storageFiles: { 'MEMORY.md': '# Index\n- [a](a.md) — x\n' } });
  fs.rmSync(sbx.remote, { recursive: true, force: true });
  const out = runHook('session-start.js', {}, sbx.env).stdout;
  assert.ok(out.includes('sync with remote failed'));
  assert.ok(out.includes('- [a](a.md)'));
  assert.ok(fs.existsSync(path.join(sbx.storage, '.state', 'alerts.json')));
});
