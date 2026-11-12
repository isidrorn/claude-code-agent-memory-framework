// Sticky alerts: a failure stays visible at every session start until the same operation succeeds.
// Stored in <storage>/.state/alerts.json, which must stay out of git (.state/ is gitignored).
const fs = require('fs');
const path = require('path');

const today = () => new Date().toISOString().slice(0, 10);
const alertsFile = (root) => path.join(root, '.state', 'alerts.json');

function readAlerts(root) {
  try {
    return JSON.parse(fs.readFileSync(alertsFile(root), 'utf8'));
  } catch {
    return {};
  }
}

function writeAlerts(root, alerts) {
  try {
    fs.mkdirSync(path.dirname(alertsFile(root)), { recursive: true });
    fs.writeFileSync(alertsFile(root), JSON.stringify(alerts, null, 2));
  } catch {
    // Storage folder unwritable: nothing more we can do from a hook.
  }
}

function setAlert(root, key, message) {
  const alerts = readAlerts(root);
  alerts[key] = { message, since: alerts[key] ? alerts[key].since : today(), last: today() };
  writeAlerts(root, alerts);
}

function clearAlert(root, key) {
  const alerts = readAlerts(root);
  if (key in alerts) {
    delete alerts[key];
    writeAlerts(root, alerts);
  }
}

module.exports = { readAlerts, setAlert, clearAlert };
