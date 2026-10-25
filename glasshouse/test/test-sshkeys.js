/**
 * test/test-sshkeys.js - The SSH keys that can log in as root
 */

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var sshkeys = require('../server/lib/sshkeys');

console.log('Running test-sshkeys.js ...');

var dir = path.join(os.tmpdir(), 'gh-ssh-' + process.pid);
var keyFile = path.join(dir, '.ssh', 'authorized_keys');
var shadow = path.join(dir, 'shadow');

// Made with ssh-keygen; the fingerprints are what ssh-keygen -l prints.
var ED = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHNWUlvIOI3rP9HRKBnPo43I42IfLCo105Go4U7x4Vef ed@test';
var ED_PRINT = 'SHA256:2zyRteKuXNx0xachsViK0oWVjR5mFrpcCEQwrjhb7mM';
var EC = 'ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBOjDvPcUSd/g8kmInR3WZYXM+kJHSfnV0P/dEmnHENV/V3qJ+vZCMTqAxgX6zJWMwyjIfJYAI0KPTECjGTuC22Y= ec@test';
var EC_PRINT = 'SHA256:slxSqMW+W9tmAUsZZPzeYNhCuxTcAQzSq3YbVP2ofsc';

function rmrf(p) {
  var st;
  try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) {
    fs.readdirSync(p).forEach(function (f) { rmrf(path.join(p, f)); });
    fs.rmdirSync(p);
  } else {
    fs.unlinkSync(p);
  }
}

// root's field in /etc/shadow: empty as webOS ships it, or the Homebrew Channel's "alpine".
function setup(rootField, keys) {
  rmrf(dir);
  fs.mkdirSync(dir);
  fs.writeFileSync(shadow, 'root:' + rootField + ':19000:0:99999:7:::\nnobody:*:19000::::::\n');
  if (keys !== null) {
    fs.mkdirSync(path.dirname(keyFile));
    fs.writeFileSync(keyFile, keys);
  }
  sshkeys.init({ file: keyFile, shadowFile: shadow, sshRunning: function (cb) { cb(true); } });
}

function status() {
  var out = null;
  sshkeys.status(function (r) { out = r; });
  return out;
}

(function testParse() {
  var k = sshkeys.parse(ED);
  assert.deepEqual(k, { type: 'ssh-ed25519', blob: ED.split(' ')[1], comment: 'ed@test', options: '' });
  assert.strictEqual(sshkeys.fingerprint(k.blob), ED_PRINT);
  assert.strictEqual(sshkeys.fingerprint(sshkeys.parse(EC).blob), EC_PRINT);
  var opt = sshkeys.parse('from="10.0.0.1, 10.0.0.2",no-pty ' + ED);
  assert.strictEqual(opt.options, 'from="10.0.0.1, 10.0.0.2",no-pty');
  assert.strictEqual(opt.comment, 'ed@test');
  assert.strictEqual(sshkeys.parse('# ' + ED), null, 'a comment');
  assert.strictEqual(sshkeys.parse('ssh-rsa ' + ED.split(' ')[1]), null, 'the blob names another type');
  assert.strictEqual(sshkeys.parse('ssh-ed25519 not-base64!'), null);
  console.log('  ✓ keys are read with their options and comment, and fingerprinted as ssh-keygen does');
})();

(function testStatus() {
  setup('', ED + '\n# a note\n\n' + EC + '\n');
  var s = status();
  assert.deepEqual(s.keys.map(function (k) { return k.fingerprint; }), [ED_PRINT, EC_PRINT]);
  assert.strictEqual(s.fileExists, true);
  assert.strictEqual(s.passwordNow, false);
  assert.strictEqual(s.passwordAfterReboot, false);

  setup('xGVw8H4GqkKg6', null);
  s = status();
  assert.strictEqual(s.fileExists, false);
  assert.strictEqual(s.passwordNow, true, 'the Homebrew Channel set alpine at boot');
  assert.strictEqual(s.passwordAfterReboot, true);
  console.log('  ✓ the keys, and whether the password works now and after the next boot');
})();

(function testAdd() {
  setup('xGVw8H4GqkKg6', null);
  var r;
  sshkeys.add(ED, function (x) { r = x; });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(fs.readFileSync(keyFile, 'utf8'), ED + '\n');
  assert.strictEqual(fs.statSync(keyFile).mode & parseInt('777', 8), parseInt('600', 8));
  assert.strictEqual(fs.statSync(path.dirname(keyFile)).mode & parseInt('777', 8), parseInt('700', 8));
  assert.strictEqual(r.passwordNow, true, 'until the next boot');
  assert.strictEqual(r.passwordAfterReboot, false);

  sshkeys.add('  ' + EC + '  ', function (x) { r = x; });
  assert.strictEqual(fs.readFileSync(keyFile, 'utf8'), ED + '\n' + EC + '\n');
  sshkeys.add(ED.replace('ed@test', 'other name'), function (x) { r = x; });
  assert.strictEqual(r.ok, false, 'the same key again');
  sshkeys.add('-----BEGIN OPENSSH PRIVATE KEY-----', function (x) { r = x; });
  assert.ok(/private key/.test(r.error));
  sshkeys.add(ED + '\n' + EC, function (x) { r = x; });
  assert.strictEqual(r.ok, false, 'one line only');
  sshkeys.add('hello', function (x) { r = x; });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(fs.readFileSync(keyFile, 'utf8'), ED + '\n' + EC + '\n', 'unchanged by those refused');
  console.log('  ✓ a public key is added to a file only root can read, and anything else is refused');
})();

(function testRemoveAndDelete() {
  setup('', '# kept\n' + ED + '\n' + EC + '\n');
  var r;
  sshkeys.remove(ED_PRINT, function (x) { r = x; });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(fs.readFileSync(keyFile, 'utf8'), '# kept\n' + EC + '\n', 'other lines kept');
  sshkeys.remove(ED_PRINT, function (x) { r = x; });
  assert.strictEqual(r.ok, false, 'already gone');
  sshkeys.remove(EC_PRINT, function (x) { r = x; });
  assert.strictEqual(r.fileExists, true, 'the last key leaves the file');
  assert.strictEqual(r.passwordAfterReboot, false);

  sshkeys.deleteFile(function (x) { r = x; });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(fs.existsSync(keyFile), false);
  assert.strictEqual(r.passwordNow, false, 'not until the next boot');
  assert.strictEqual(r.passwordAfterReboot, true);
  sshkeys.deleteFile(function (x) { r = x; });
  assert.strictEqual(r.ok, true, 'already gone is fine');
  console.log('  ✓ a key is removed by its fingerprint, and the file deleted so the password comes back at the next boot');
})();

rmrf(dir);
console.log('test-sshkeys.js passed');
