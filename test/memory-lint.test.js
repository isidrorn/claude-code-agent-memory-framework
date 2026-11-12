const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { tmpDir, note, writeFiles, sandbox, runHook } = require('./helpers');

const index = (...names) => `# Index\n\n${names.map((n) => `- [${n}](${n}.md) — hook`).join('\n')}\n`;

function lint(dir, file, env = process.env) {
  const out = runHook('memory-lint.js', { tool_input: { file_path: path.join(dir, file) } }, env).stdout.trim();
  return out ? JSON.parse(out) : null;
}

function memoryDir(files) {
  const dir = path.join(tmpDir('lint'), 'memory');
  writeFiles(dir, files);
  return dir;
}

test('valid folder with tags and expires passes silently', () => {
  const dir = memoryDir({ 'MEMORY.md': index('a'), 'a.md': note('a', { extra: '  tags: [maven, lombok]\n  expires: 2030-01-01\n' }) });
  assert.strictEqual(lint(dir, 'a.md'), null);
});

test('missing type, bad tags, bad expires, dangling wikilink and orphan all block', () => {
  const dir = memoryDir({
    'MEMORY.md': index('a'),
    'a.md': note('a', { extra: '  tags: Maven Lombok\n  expires: soon\n', body: 'See [[nope]].' }),
    'b.md': '---\nname: b\ndescription: no type\nmetadata:\n  tags: [x]\n---\n',
  });
  const r = lint(dir, 'a.md');
  assert.strictEqual(r.decision, 'block');
  for (const needle of ['metadata.tags', 'metadata.expires', '[[nope]]', 'b.md: frontmatter missing "metadata.type"', 'b.md is active but not referenced']) {
    assert.ok(r.reason.includes(needle), `expected "${needle}" in:\n${r.reason}`);
  }
});

test('archived note still in the index only warns', () => {
  const dir = memoryDir({ 'MEMORY.md': index('a'), 'a.md': note('a', { extra: '  status: archived\n' }) });
  const r = lint(dir, 'a.md');
  assert.ok(r.systemMessage && r.systemMessage.includes('archived but still listed'));
});

test('non-memory paths are ignored', () => {
  const dir = tmpDir('notmem');
  writeFiles(dir, { 'README.md': 'no frontmatter' });
  assert.strictEqual(lint(dir, 'README.md'), null);
});

test('configured storage folder is linted even when not named "memory"', () => {
  const sbx = sandbox({ storageFiles: { 'MEMORY.md': index(), 'loose.md': 'no frontmatter' } });
  const r = lint(sbx.storage, 'loose.md', sbx.env);
  assert.strictEqual(r.decision, 'block');
  assert.ok(r.reason.includes('no valid YAML frontmatter'));
});
