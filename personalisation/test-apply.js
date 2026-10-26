'use strict';

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var crypto = require('crypto');
var apply = require('./apply').apply;
var temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'glasshouse-apply-test-'));
var count = 0;
function hash(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
function write(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function patch(file, before, after) {
  var old = before.trimEnd().split('\n'), replacement = after.trimEnd().split('\n');
  return '--- a/' + file + '\n+++ b/' + file + '\n@@ -1,' + old.length + ' +1,' + replacement.length + ' @@\n' +
    old.map(function (line) { return '-' + line; }).concat(replacement.map(function (line) { return '+' + line; })).join('\n') + '\n';
}
function fixture() {
  var directory = path.join(temporary, String(++count)), root = path.join(directory, 'extension'), target = path.join(directory, 'tvweb');
  var manifest = { version: 1, patches: [], assets: [] };
  ['lib/first.js', 'lib/second.js', 'assets/home.html'].forEach(function (file, index) {
    var before = index === 2 ? '<html><script>var layout = "upstream";</script></html>\n' : '"use strict";\nvar value = "upstream-' + index + '";\n';
    var after = before.replace('upstream', 'custom');
    var patchFile = 'patches/' + index + '.patch';
    write(path.join(target, file), before);
    write(path.join(root, patchFile), patch(file, before, after));
    manifest.patches.push({ file: file, patch: patchFile });
  });
  fs.chmodSync(path.join(target, 'lib/first.js'), 493);
  var logo = '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n';
  write(path.join(root, 'files/logo.svg'), logo);
  manifest.assets.push({ file: 'assets/logo.svg', source: 'files/logo.svg', sha256: hash(logo) });
  write(path.join(root, 'manifest.json'), JSON.stringify(manifest));
  write(path.join(target, 'home.json'), '{"order":["netflix","amazon"]}\n');
  write(path.join(target, 'config.json'), '{"user":"untouched"}\n');
  return { root: root, target: target, manifest: manifest };
}
function check(name, callback) { callback(); console.log('ok - ' + name); }
function result(f, state, options) { var got = apply(f.root, f.target, options); assert.strictEqual(got.state, state, JSON.stringify(got)); return got; }
function contents(f) {
  return f.manifest.patches.map(function (spec) { return read(path.join(f.target, spec.file)); }).join('\n');
}

try {
  check('apply, preserve permissions and user configuration, then reverse-detect current', function () {
    var f = fixture(), home = read(path.join(f.target, 'home.json')), config = read(path.join(f.target, 'config.json'));
    assert.strictEqual(result(f, 'applied').changed, true);
    assert.ok(/custom/.test(contents(f)));
    assert.strictEqual(fs.statSync(path.join(f.target, 'lib/first.js')).mode & 511, 493);
    assert.strictEqual(read(path.join(f.target, 'home.json')), home);
    assert.strictEqual(read(path.join(f.target, 'config.json')), config);
    assert.ok(/upstream/.test(read(path.join(f.root, 'backups/latest/lib/first.js'))));
    assert.strictEqual(result(f, 'current').changed, false);
  });
  check('preserve upstream change outside patch and support mixed current/upstream files', function () {
    var f = fixture(), first = path.join(f.target, 'lib/first.js');
    write(first, '// New upstream fix\n' + read(first));
    var second = path.join(f.target, 'lib/second.js');
    write(second, read(second).replace('upstream', 'custom'));
    result(f, 'applied');
    assert.ok(read(first).indexOf('// New upstream fix\n') === 0);
    result(f, 'current');
  });
  check('conflict fails before any installed write', function () {
    var f = fixture(), second = path.join(f.target, 'lib/second.js');
    write(second, read(second).replace('upstream', 'changed-in-update'));
    var before = contents(f);
    result(f, 'blocked');
    assert.strictEqual(contents(f), before);
    assert.ok(!fs.existsSync(path.join(f.target, 'assets/logo.svg')));
  });
  check('reject changed context that patch could accept with fuzz', function () {
    var f = fixture(), spec = f.manifest.patches[0];
    write(path.join(f.root, spec.patch), '--- a/' + spec.file + '\n+++ b/' + spec.file + '\n@@ -1,2 +1,2 @@\n "use strict";\n-var value = "upstream-0";\n+var value = "custom-0";\n');
    write(path.join(f.target, spec.file), '"changed context";\nvar value = "upstream-0";\n');
    result(f, 'blocked');
  });
  check('reject ambiguous hunk without touching target', function () {
    var f = fixture(), file = path.join(f.target, 'lib/first.js');
    write(file, read(file) + read(file));
    result(f, 'blocked');
  });
  check('asset collision and corrupted bundle are blocked before writes', function () {
    var f = fixture(), before = contents(f);
    write(path.join(f.target, 'assets/logo.svg'), 'upstream asset');
    result(f, 'blocked');
    assert.strictEqual(contents(f), before);
    fs.unlinkSync(path.join(f.target, 'assets/logo.svg'));
    write(path.join(f.root, 'files/logo.svg'), 'corrupted');
    result(f, 'blocked');
    assert.strictEqual(contents(f), before);
  });
  check('JavaScript and HTML script syntax are validated before writes', function () {
    [0, 2].forEach(function (index) {
      var f = fixture(), spec = f.manifest.patches[index], before = read(path.join(f.target, spec.file));
      write(path.join(f.root, spec.patch), patch(spec.file, before, index === 0 ? 'function {\n' : '<script>function {</script>\n'));
      result(f, 'blocked');
      assert.strictEqual(read(path.join(f.target, spec.file)), before);
    });
  });
  check('installation concurrency detected, including files already customised', function () {
    var f = fixture(), first = path.join(f.target, 'lib/first.js');
    write(first, read(first).replace('upstream', 'custom'));
    var secondBefore = read(path.join(f.target, 'lib/second.js'));
    result(f, 'busy', { beforeCommit: function () { write(first, '/* concurrent update */\n'); } });
    assert.strictEqual(read(path.join(f.target, 'lib/second.js')), secondBefore);
  });
  check('write failure rolls back completed writes', function () {
    var f = fixture(), before = contents(f);
    result(f, 'blocked', { beforeWrite: function (_, index) { if (index === 2) throw new Error('simulated I/O failure'); } });
    assert.strictEqual(contents(f), before);
    assert.ok(!fs.existsSync(path.join(f.target, 'assets/logo.svg')));
  });
  check('missing installation, missing upstream files and unsafe paths are blocked', function () {
    var f = fixture();
    assert.strictEqual(apply(f.root, path.join(f.target, 'absent')).state, 'blocked');
    fs.unlinkSync(path.join(f.target, 'lib/second.js'));
    result(f, 'blocked');
    f = fixture();
    f.manifest.assets[0].file = '../escape.svg';
    write(path.join(f.root, 'manifest.json'), JSON.stringify(f.manifest));
    result(f, 'blocked');
    f = fixture();
    fs.renameSync(path.join(f.target, 'lib'), path.join(f.target, 'real-lib'));
    fs.symlinkSync('real-lib', path.join(f.target, 'lib'));
    result(f, 'blocked');
  });
  check('live lock is busy, dead process and abandoned incomplete locks recover', function () {
    var f = fixture(), directory = path.join(f.root, 'apply.lock');
    write(path.join(directory, 'owner.json'), JSON.stringify({ pid: process.pid }));
    result(f, 'busy');
    write(path.join(directory, 'owner.json'), JSON.stringify({ pid: 2147483647 }));
    result(f, 'applied');
    fs.mkdirSync(directory);
    var old = new Date(Date.now() - 120000);
    fs.utimesSync(directory, old, old);
    result(f, 'current');
    assert.ok(!fs.existsSync(directory));
  });
  check('process identity distinguishes reused PIDs across boots and within one boot', function () {
    var originalRead = fs.readFileSync, boot = 'boot-current', started = '200';
    fs.readFileSync = function (file) {
      if (file === '/proc/sys/kernel/random/boot_id') return boot + '\n';
      if (file === '/proc/' + process.pid + '/stat') {
        var fields = Array(20).fill('0'); fields[0] = 'S'; fields[19] = started;
        return process.pid + ' (node with spaces) ' + fields.join(' ') + '\n';
      }
      return originalRead.apply(fs, arguments);
    };
    try {
      var f = fixture(), owner = path.join(f.root, 'apply.lock/owner.json');
      write(owner, JSON.stringify({ pid: process.pid, identity: boot + ':' + started }));
      result(f, 'busy');
      write(owner, JSON.stringify({ pid: process.pid, identity: 'previous-boot:' + started }));
      result(f, 'applied', { beforeCommit: function () {
        assert.strictEqual(JSON.parse(read(owner)).identity, boot + ':' + started, 'new lock records boot and start time');
      } });
      write(owner, JSON.stringify({ pid: process.pid, identity: boot + ':100' }));
      result(f, 'current');
    } finally { fs.readFileSync = originalRead; }
  });

  var actualManifest = path.join(__dirname, 'manifest.json');
  assert.ok(fs.existsSync(actualManifest), 'generate the public bundle before testing');
  {
    check('real bundle applies to stock, preserves added upstream code and reapply is idempotent', function () {
      var directory = path.join(temporary, 'real'), root = path.join(directory, 'extension'), target = path.join(directory, 'tvweb');
      ['manifest.json', 'patches', 'files'].forEach(function (name) { fs.cpSync(path.join(__dirname, name), path.join(root, name), { recursive: true }); });
      var manifest = JSON.parse(read(actualManifest));
      manifest.patches.forEach(function (spec) {
        var stock = fs.readFileSync(path.join(__dirname, 'base', spec.file));
        assert.strictEqual(hash(stock), spec.baseSha256, 'stock fixture must match the pinned upstream file');
        write(path.join(target, spec.file), stock);
      });
      var f = { root: root, target: target, manifest: manifest };
      var preserved = path.join(target, 'lib/home.js');
      fs.appendFileSync(preserved, '\n// An unrelated future upstream fix remains intact.\n');
      result(f, 'applied');
      assert.ok(/unrelated future upstream fix/.test(read(preserved)));
      manifest.patches.forEach(function (spec) {
        var installed = read(path.join(target, spec.file));
        if (spec.file === 'lib/home.js') installed = installed.replace(/\n\/\/ An unrelated future upstream fix remains intact\.\n$/, '');
        assert.strictEqual(hash(installed), spec.customSha256, 'applied patch must reconstruct the exact public source: ' + spec.file);
      });
      result(f, 'current');
      manifest.patches.forEach(function (spec) {
        write(path.join(target, spec.file), fs.readFileSync(path.join(__dirname, '../glasshouse/server', spec.file)));
      });
      result(f, 'current');
    });
  }
  console.log('All personalisation apply tests passed.');
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
