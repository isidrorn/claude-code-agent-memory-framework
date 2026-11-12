// Loads the plugin config: built-in defaults, overridden per section by the user's config file.
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULTS = {
  storage: {
    provider: 'git-markdown',
    mode: 'local+remote', // local-only | local+remote | remote-only (not implemented yet)
    path: '~/.claude/memory',
    remote: 'origin',
    branch: 'main',
    syncTimeoutMs: 5000,
  },
  backup: { projectTier: true },
  injection: { maxIndexLines: 50 },
  lint: { maxIndexLines: 20, maxFileLines: 100, maxIndexLineChars: 150 },
};

function expandHome(p) {
  return p === '~' || p.startsWith('~/') || p.startsWith('~\\') ? path.join(os.homedir(), p.slice(1)) : p;
}

// Claude Code's own home (honours CLAUDE_CONFIG_DIR, which Claude Code itself supports).
function claudeHome() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function configPath() {
  return process.env.AGENT_MEMORY_CONFIG || path.join(claudeHome(), 'agent-memory', 'config.json');
}

function loadConfig() {
  let user = {};
  try {
    user = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    // Missing or unreadable config: defaults apply.
  }
  const cfg = {};
  for (const section of Object.keys(DEFAULTS)) {
    cfg[section] = { ...DEFAULTS[section], ...(user[section] || {}) };
  }
  cfg.storage.path = path.resolve(expandHome(cfg.storage.path));
  return cfg;
}

module.exports = { loadConfig, claudeHome, configPath, DEFAULTS };
