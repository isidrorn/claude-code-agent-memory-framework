// Disposable runtime state: sticky alerts and hook heartbeats.
// Lives in ${CLAUDE_PLUGIN_DATA} (kept across updates, deleted on uninstall). When that variable is
// absent (a hook run by hand, tests), it falls back to <storage>/.state/, which is gitignored.
// A failure stays visible at every session start until the same operation succeeds.
const fs = require('fs');
const os = require('os');
const path = require('path');

const today = () => new Date().toISOString().slice(0, 10);
const legacyDir = (root) => path.join(root, '.state');
// Never create the storage folder as a side effect: a later "mv old-store ~/.agent-memory" would
// then nest the store inside it. With no plugin data and no storage yet, use the OS temp folder.
const stateDir = (root) =>
  process.env.CLAUDE_PLUGIN_DATA || (fs.existsSync(root) ? legacyDir(root) : path.join(os.tmpdir(), 'agent-memory-state'));
const fileIn = (root, name) => path.join(stateDir(root), name);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function writeJson(file, value) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
  } catch {
    // State folder unwritable: nothing more we can do from a hook.
  }
}

// Alerts written to the fallback folder (by a hand-run hook, or before plugin data existed) are
// merged into plugin data on the next read, so the two locations never split.
function readAlerts(root) {
  const alerts = readJson(fileIn(root, 'alerts.json'));
  const legacy = path.join(legacyDir(root), 'alerts.json');
  if (process.env.CLAUDE_PLUGIN_DATA && fs.existsSync(legacy)) {
    const merged = { ...readJson(legacy), ...alerts };
    writeJson(fileIn(root, 'alerts.json'), merged);
    fs.rmSync(legacy, { force: true });
    return merged;
  }
  return alerts;
}

function setAlert(root, key, message) {
  const alerts = readAlerts(root);
  alerts[key] = { message, since: alerts[key] ? alerts[key].since : today(), last: today() };
  writeJson(fileIn(root, 'alerts.json'), alerts);
}

function clearAlert(root, key) {
  const alerts = readAlerts(root);
  if (key in alerts) {
    delete alerts[key];
    writeJson(fileIn(root, 'alerts.json'), alerts);
  }
}

// Heartbeat: when each hook last ran, so "never ran" is detectable (principle 9).
function beat(root, hook) {
  const beats = readJson(fileIn(root, 'heartbeat.json'));
  beats[hook] = new Date().toISOString();
  writeJson(fileIn(root, 'heartbeat.json'), beats);
}

const readBeats = (root) => readJson(fileIn(root, 'heartbeat.json'));

module.exports = { readAlerts, setAlert, clearAlert, beat, readBeats };
