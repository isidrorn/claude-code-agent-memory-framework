const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { note, writeFiles, sandbox, runHook } = require('./helpers');

const index = (...names) => `# Index\n\n${names.map((n) => `- [${n}](${n}.md) — hook`).join('\n')}\n`;

function lint(sbx, rel) {
  const out = runHook('memory-lint.js', { tool_input: { file_path: path.join(sbx.storage, rel) } }, sbx.env).stdout.trim();
  return out ? JSON.parse(out) : null;
}

// Our storage root, with the given files (relative paths) written into it.
function store(files) {
  const sbx = sandbox({ mode: 'local-only' });
  writeFiles(sbx.storage, files);
  return sbx;
}

test('valid folder with tags and expires passes silently', () => {
  const sbx = store({ 'MEMORY.md': index('a'), 'a.md': note('a', { extra: '  tags: [maven, lombok]\n  expires: 2030-01-01\n' }) });
  assert.strictEqual(lint(sbx, 'a.md'), null);
});

test('block-list tags as rewritten by Claude Code pass; bad items still block', () => {
  const ok = store({ 'MEMORY.md': index('a'), 'a.md': note('a', { extra: '  tags:\n    - plugin\n    - claude-code\n  originSessionId: x\n' }) });
  assert.strictEqual(lint(ok, 'a.md'), null);
  const bad = store({ 'MEMORY.md': index('a'), 'a.md': note('a', { extra: '  tags:\n    - Plugin Thing\n' }) });
  assert.match(JSON.stringify(lint(bad, 'a.md')), /metadata\.tags/);
});

test('missing type, bad tags, bad expires, dangling wikilink and orphan all block', () => {
  const sbx = store({
    'MEMORY.md': index('a'),
    'a.md': note('a', { extra: '  tags: Maven Lombok\n  expires: soon\n', body: 'See [[nope]].' }),
    'b.md': '---\nname: b\ndescription: no type\nmetadata:\n  tags: [x]\n---\n',
  });
  const r = lint(sbx, 'a.md');
  assert.strictEqual(r.decision, 'block');
  for (const needle of ['metadata.tags', 'metadata.expires', '[[nope]]', 'b.md: frontmatter missing "metadata.type"', 'b.md is active but not referenced']) {
    assert.ok(r.reason.includes(needle), `expected "${needle}" in:\n${r.reason}`);
  }
});

test('archived note still in the index only warns', () => {
  const sbx = store({ 'MEMORY.md': index('a'), 'a.md': note('a', { extra: '  status: archived\n' }) });
  const r = lint(sbx, 'a.md');
  assert.ok(r.systemMessage && r.systemMessage.includes('archived but still listed'));
});

test('absolute home path warns without blocking', () => {
  const sbx = store({ 'MEMORY.md': index('a'), 'a.md': note('a', { body: 'Config in C:\\Users\\someone\\x.json and ~/fine.' }) });
  const r = lint(sbx, 'a.md');
  assert.ok(!r.decision, 'not blocked');
  assert.match(r.systemMessage, /absolute home path/);
});

test('scope: global root and local projects/<name>/ are linted', () => {
  const bad = 'no frontmatter';
  const sbx = store({ 'MEMORY.md': index(), 'loose.md': bad, 'projects/p/MEMORY.md': index(), 'projects/p/loose.md': bad });
  assert.strictEqual(lint(sbx, 'loose.md').decision, 'block');
  assert.strictEqual(lint(sbx, 'projects/p/loose.md').decision, 'block');
});

test('scope: native copies, queue, other files and Claude Code built-in memory are never linted', () => {
  const bad = 'no frontmatter';
  const sbx = store({ 'projects/p/native/loose.md': bad, 'queue/loose.md': bad, 'docs/loose.md': bad });
  assert.strictEqual(lint(sbx, 'projects/p/native/loose.md'), null);
  assert.strictEqual(lint(sbx, 'queue/loose.md'), null);
  assert.strictEqual(lint(sbx, 'docs/loose.md'), null);
  const builtIn = path.join(sbx.claudeHome, 'projects', 'C--x', 'memory', 'loose.md');
  writeFiles(path.dirname(builtIn), { 'loose.md': bad });
  const out = runHook('memory-lint.js', { tool_input: { file_path: builtIn } }, sbx.env).stdout.trim();
  assert.strictEqual(out, '', 'built-in memory is Claude Code\'s, not ours');
});
