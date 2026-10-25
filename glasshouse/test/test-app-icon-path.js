/**
 * test/test-app-icon-path.js - an app's icon is only ever a file inside its
 * own folder, whatever its appinfo.json names, since the icon server hands
 * icons to the LAN without a token
 *
 * Strict ES5: runs on node 0.10.
 */
var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var apps = require('../server/lib/apps');

console.log('Running test-app-icon-path.js ...');

var root = path.join(os.tmpdir(), 'gh-icon-path-' + process.pid);
var appDir = path.join(root, 'com.example.app');
var secret = path.join(root, 'config.json');
fs.mkdirSync(root);
fs.mkdirSync(appDir);
fs.writeFileSync(path.join(appDir, 'icon.png'), 'png');
fs.writeFileSync(secret, '{"mqtt":{"password":"x"}}');
fs.mkdirSync(path.join(appDir, 'assets'));
fs.symlinkSync(secret, path.join(appDir, 'assets', 'link.png'));

function cleanup() {
  [path.join(appDir, 'assets', 'link.png'), path.join(appDir, 'icon.png'), secret].forEach(function (f) {
    try { fs.unlinkSync(f); } catch (e) {}
  });
  [path.join(appDir, 'assets'), appDir, root].forEach(function (d) { try { fs.rmdirSync(d); } catch (e) {} });
}

try {
  var inside = fs.realpathSync(path.join(appDir, 'icon.png'));
  assert.strictEqual(apps.firstFileInside(appDir, [path.join(appDir, 'icon.png')]), inside);
  console.log('  ✓ an icon in the app\'s folder is found');

  assert.strictEqual(apps.firstFileInside(appDir, [path.join(appDir, '..', 'config.json')]), null);
  console.log('  ✓ an icon path that climbs out of the app\'s folder is refused');

  assert.strictEqual(apps.firstFileInside(appDir, [path.join(appDir, 'assets', 'link.png')]), null);
  console.log('  ✓ a symlink pointing out of the app\'s folder is refused');

  assert.strictEqual(apps.firstFileInside(appDir, [path.join(appDir, 'assets'), path.join(appDir, '..', 'config.json'),
    path.join(appDir, 'icon.png')]), inside, 'the first acceptable one');
  assert.strictEqual(apps.firstFileInside(appDir + '-missing', [path.join(appDir, 'icon.png')]), null);
  console.log('  ✓ a folder is no icon, refused paths are passed over, and a missing app folder has none');
} finally {
  cleanup();
}
console.log('ALL test-app-icon-path.js assertions passed!\n');
