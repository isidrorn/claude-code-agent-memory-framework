// Test helpers: isolated temp folders, a fake Claude home, and running a hook with JSON on stdin.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const HOOKS = path.join(__dirname, '..', 'hooks');

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `agent-memory-${prefix}-`));
}

function note(name, { type = 'reference', extra = '', body = 'Fact.' } = {}) {
  return `---\nname: ${name}\ndescription: test note ${name}\nmetadata:\n  type: ${type}\n${extra}---\n\n${body}\n`;
}

function writeFiles(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
}

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
};

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...GIT_ENV } }).trim();

// A sandbox: fake Claude home, a bare "remote" and a storage clone, wired through a config file.
function sandbox({ mode = 'local+remote', storageFiles = {} } = {}) {
  const base = tmpDir('sbx');
  const claudeHome = path.join(base, 'claude');
  const remote = path.join(base, 'remote.git');
  const storage = path.join(base, 'storage');
  fs.mkdirSync(claudeHome, { recursive: true });
  git(base, ['init', '-q', '--bare', '-b', 'main', remote]);
  git(base, ['clone', '-q', remote, storage]);
  writeFiles(storage, { README: 'storage\n', ...storageFiles }); // no .gitignore: persist() must add it
  git(storage, ['add', '-A']);
  git(storage, ['commit', '-q', '-m', 'init']);
  git(storage, ['push', '-q', '-u', 'origin', 'main']);
  const config = path.join(base, 'config.json');
  fs.writeFileSync(config, JSON.stringify({ storage: { path: storage, mode } }));
  const env = { ...process.env, ...GIT_ENV, CLAUDE_CONFIG_DIR: claudeHome, AGENT_MEMORY_CONFIG: config };
  return { base, claudeHome, remote, storage, config, env };
}

function runHook(name, input, env) {
  const r = spawnSync(process.execPath, [path.join(HOOKS, name)], { input: JSON.stringify(input), env, encoding: 'utf8' });
  return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

module.exports = { tmpDir, note, writeFiles, git, sandbox, runHook };
