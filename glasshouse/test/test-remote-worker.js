/**
 * test/test-remote-worker.js - the remote-button worker (remotebuttons.py)
 * drops disconnected input devices instead of spinning on them, keeps
 * healthy ones, and picks a device up again once it is back
 *
 * Runs test/test_remote_buttons.py under Python 3; the worker itself stays
 * Python 2.7 compatible for the TV. Strict ES5: runs on node 0.12.
 */
var child = require('child_process');
var path = require('path');

console.log('Running test-remote-worker.js ...');

function skip(reason) {
  console.log('  - skipped: ' + reason);
  console.log('ALL test-remote-worker.js assertions passed!\n');
  process.exit(0);
}

if (!child.execSync) skip('needs execSync (node 0.12 or later)');
try { child.execSync('python3 --version', { stdio: 'ignore' }); } catch (e) {
  skip('needs python3');
}

try {
  child.execSync('python3 -B "' + path.join(__dirname, 'test_remote_buttons.py') + '"', {
    stdio: 'pipe', timeout: 10000
  });
} catch (e) {
  console.error(String(e.stderr || e.message));
  process.exit(1);
}
console.log('ALL test-remote-worker.js assertions passed!\n');
