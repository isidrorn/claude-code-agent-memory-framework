// Name of the project a session runs in, used for projects/<name>/ in storage.
// Uses the main repository's folder, so a git worktree or a subfolder maps to the same project;
// falls back to the folder name outside git.
const path = require('path');
const { execFileSync } = require('child_process');

function projectName(cwd) {
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    // <repo>/.git -> <repo>; a bare repo's common dir is the repo itself.
    return path.basename(path.basename(common) === '.git' ? path.dirname(common) : common);
  } catch {
    return path.basename(cwd);
  }
}

module.exports = { projectName };
