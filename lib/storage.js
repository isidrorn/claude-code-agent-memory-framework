// Storage provider: markdown files, optionally in git, optionally synced with a remote.
// Hooks only use open(cfg).{root, sync, persist, status}; a new provider would implement the same four.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MODES = ['local-only', 'local+remote', 'remote-only'];

function git(root, args, timeout = 15000) {
  return execFileSync('git', args, { cwd: root, timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function isRepo(root) {
  try {
    return fs.existsSync(root) && git(root, ['rev-parse', '--is-inside-work-tree'], 5000) === 'true';
  } catch {
    return false;
  }
}

function aheadCount(root) {
  try {
    return Number(git(root, ['rev-list', '--count', '@{u}..HEAD'], 5000));
  } catch {
    return 0; // no upstream configured yet
  }
}

function open(cfg) {
  const s = cfg.storage;
  if (!MODES.includes(s.mode)) throw new Error(`unknown storage mode "${s.mode}" (use ${MODES.join(', ')})`);
  if (s.mode === 'remote-only') throw new Error('storage mode "remote-only" is not implemented yet; use local+remote');
  if (s.provider !== 'git-markdown') throw new Error(`unknown storage provider "${s.provider}"`);
  const root = s.path;
  const remote = s.mode === 'local+remote';

  function push() {
    if (aheadCount(root) > 0) git(root, ['push', '-q', s.remote, `HEAD:${s.branch}`], s.syncTimeoutMs * 3);
  }

  return {
    root,

    // Bring local up to date and send anything a previous session failed to push.
    // Fast-forward only: a silent bad merge of notes is worse than a visible alert.
    sync() {
      if (!remote || !isRepo(root)) return;
      git(root, ['pull', '--ff-only', '-q', s.remote, s.branch], s.syncTimeoutMs);
      push();
    },

    // Commit everything that changed (global notes and project backups); push when remote mode.
    // Returns true when a commit was made.
    persist(message) {
      if (!isRepo(root)) return false;
      git(root, ['add', '-A']);
      let committed = false;
      try {
        git(root, ['diff', '--cached', '--quiet']);
      } catch {
        git(root, ['commit', '-q', '-m', message]);
        committed = true;
      }
      if (remote) push();
      return committed;
    },

    status() {
      if (!isRepo(root)) return { root, mode: s.mode, git: false };
      return { root, mode: s.mode, git: true, ahead: aheadCount(root) };
    },
  };
}

// First line of a git/exec error, for alerts.
function errorLine(err) {
  const text = String((err && (err.stderr || err.message)) || err);
  return text.split(/\r?\n/).find((l) => l.trim()) || 'unknown error';
}

module.exports = { open, errorLine };
