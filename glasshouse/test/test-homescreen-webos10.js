/**
 * test/test-homescreen-webos10.js - on webOS 10 LG's Home screen parts are
 * switched off with an overlay holding a changed home.xml, only once the
 * experimental switch is on, and put back after a restart of the TV
 *
 * Strict ES5: runs on node 0.12.
 */
var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var childProcess = require('child_process');

console.log('Running test-homescreen-webos10.js ...');

// home.xml as a C2 on 10.3.1 and a B4 on 10.3.2 have it (#612).
var LG = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<home version="2.0">',
  '\t<layout windowType="overlay" pageType="none" pageCount="1" defaultPage="0">',
  '\t\t<page pageBodyType="container">',
  '\t\t\t<item id="margin" itemWidth="3840" itemHeight="45" focusType="none"/>',
  '\t\t\t<item id="container" hasChildren="true" itemWidth="3840" itemHeight="900" focusType="scope">',
  '\t\t\t\t<item id="globalline" itemWidth="300" itemHeight="900" focusType="scope" autoFocus="false"/>',
  '\t\t\t\t<item id="herobanner" itemWidth="3492" itemHeight="900" focusType="scope" autoFocus="false"/>',
  '\t\t\t</item>',
  '\t\t\t<item id="margin" itemWidth="3840" itemHeight="74" focusType="none"/>',
  '\t\t\t<item id="qcardList" itemWidth="3840" itemHeight="180" focusType="scope" autoFocus="false"/>',
  '\t\t\t<item id="margin" itemWidth="3840" itemHeight="72" focusType="none"/>',
  '\t\t\t<item id="appList" itemWidth="3840" itemHeight="248" focusType="scope" autoFocus="true"/>',
  '\t\t\t<item id="margin" itemWidth="3840" itemHeight="48" focusType="none"/>',
  '\t\t\t<item id="recommendedShelf" itemWidth="3798" itemHeight="531" focusType="scope" autoFocus="false"/>',
  '\t\t\t<item id="quickGuide" itemX="0" itemY="0" itemWidth="0" itemHeight="0" focusType="none"/>',
  '\t\t</page>',
  '\t</layout>',
  '</home>'
].join('\n');

var root = path.join(os.tmpdir(), 'gh-home10-' + process.pid);
var assets = path.join(root, 'assets');
var state = path.join(root, 'state');
[root, assets, state].forEach(function (d) { fs.mkdirSync(d); });
fs.writeFileSync(path.join(assets, 'home.xml'), LG);
var mounts = path.join(root, 'mounts');
var filesystems = path.join(root, 'filesystems');
fs.writeFileSync(mounts, '');
fs.writeFileSync(filesystems, 'nodev\ttmpfs\nnodev\toverlay\n');
// The home app as a C2 on 10.3.1 runs it, an older name, and another Flutter app.
var proc = path.join(root, 'proc');
fs.mkdirSync(proc);
[['100', '/usr/bin/flutter-client\0-i\0com.webos.app.home\0'],
 ['101', 'com.webos.app.home\0'],
 ['102', '/usr/bin/flutter-client\0-i\0com.webos.app.screensaver\0'],
 ['103', '/bin/sh\0-c\0echo -i com.webos.app.home\0'],
 ['self', '']].forEach(function (p) {
  fs.mkdirSync(path.join(proc, p[0]));
  fs.writeFileSync(path.join(proc, p[0], 'cmdline'), p[1]);
});
var killed = [];
var killFails = false;
process.kill = function (pid, sig) {
  if (killFails) { var e = new Error('kill EPERM'); e.code = 'EPERM'; throw e; }
  killed.push(pid + ' ' + sig);
};

// Shell commands recorded, not run; a mount marks the folder mounted.
var runs = [];
childProcess.execFile = function (file, args, opts, cb) {
  var rec = { cmd: args[1], stdin: '' };
  runs.push(rec);
  // Mounting starts by unmounting whatever was there, so the mount decides.
  if (/mount -t overlay/.test(rec.cmd)) fs.writeFileSync(mounts, 'overlay ' + assets + ' overlay rw 0 0\n');
  else if (/^umount /.test(rec.cmd)) fs.writeFileSync(mounts, '');
  process.nextTick(function () { cb(null, '', ''); });
  return { stdin: { end: function (s) { rec.stdin = String(s || ''); } } };
};

var home10 = require('../server/lib/homescreen-webos10');
var config = {};
function setup(version) {
  home10.init({ luna: function (u, p, cb) { process.nextTick(function () { cb({ returnValue: true, appId: 'com.webos.app.hdmi1' }); }); },
                config: config, webosVersion: version, assetsDir: assets, stateDir: state,
                overlayDir: path.join(root, 'overlay'), mountsFile: mounts, procDir: proc, filesystemsFile: filesystems,
                checkpointDirs: [path.join(root, 'cp')] });
}
function checked(fn) {
  return function (arg) {
    try { fn(arg); } catch (e) {
      console.error('  ✗ ' + e.message);
      process.exit(1);
    }
  };
}

// Rows are stacked from their heights: whatever is hidden, the rows add up to
// LG's total and the apps row keeps its distance from the bottom.
function rows(xml) {
  var depth = 0, list = [];
  xml.split('\n').forEach(function (l) {
    if (/<\/item>/.test(l)) { depth--; return; }
    var m = /<item id="(\w+)"[^>]*itemHeight="(\d+)"/.exec(l);
    if (m && depth === 0) list.push({ id: m[1], h: Number(m[2]) });
    if (/hasChildren="true"/.test(l)) depth++;
  });
  return list;
}
function belowApps(list) {
  var after = false, sum = 0;
  list.forEach(function (r) { if (after) sum += r.h; if (r.id === 'appList') after = true; });
  return sum;
}
function total(list) { return list.reduce(function (a, r) { return a + r.h; }, 0); }
var lgRows = rows(LG);
[['quickCards'], ['recommended'], ['quickCards', 'recommended'], ['sideIcons', 'quickCards', 'recommended']].forEach(function (hidden) {
  var xml = home10.buildLayout(LG, hidden);
  var r = rows(xml);
  assert.strictEqual(total(r), total(lgRows), hidden.join('+') + ': same total height');
  var lgBelow = belowApps(lgRows) - (hidden.indexOf('recommended') !== -1 ? 531 : 0);
  assert.strictEqual(belowApps(r), lgBelow, hidden.join('+') + ': apps row stays at the bottom');
  var banner = /<item id="herobanner"[^>]*itemHeight="(\d+)"/.exec(xml)[1];
  var box = /<item id="container"[^>]*itemHeight="(\d+)"/.exec(xml)[1];
  assert.strictEqual(banner, box, 'banner fills the taller container');
  var side = /<item id="globalline"[^>]*itemHeight="(\d+)"/.exec(xml)[1];
  assert.strictEqual(side, hidden.indexOf('sideIcons') !== -1 ? '0' : box, 'side buttons grow with it unless hidden');
});
var both = home10.buildLayout(LG, ['quickCards', 'recommended']);
assert.ok(/id="container"[^>]*itemHeight="1685"/.test(both), '900 + 74 + 180 + 531');
assert.deepEqual(rows(both).map(function (r) { return r.id; }), ['margin', 'container', 'margin', 'appList', 'margin', 'quickGuide']);
console.log('  ✓ the banner takes the height of hidden rows, so the apps row stays at the bottom');

setup('9.2.2');
assert.strictEqual(home10.supported(), false, 'webOS 9 has its own module');
setup('11.2.0');
assert.strictEqual(home10.supported(), false, 'webOS 11 is not offered yet');
setup('10.3.1');
assert.strictEqual(home10.supported(), true);
console.log('  ✓ offered on webOS 10 only, where the layout is the one recognised');

home10.setPart('quickCards', false, checked(function (refused) {
  assert.strictEqual(refused.ok, false, 'not before the experimental switch is on');
  assert.strictEqual(runs.length, 0);
  config.allowHomeLayout = true;
  console.log('  ✓ nothing changes until the experimental switch is on');

  home10.setPart('quickCards', false, checked(function (r) {
    assert.strictEqual(r.ok, true);
    var mount = runs.filter(function (x) { return /mount -t overlay/.test(x.cmd); })[0];
    assert.ok(mount.cmd.indexOf('lowerdir=' + assets) !== -1, 'LG\'s folder underneath');
    assert.ok(mount.stdin.indexOf('qcardList') === -1 && mount.stdin.indexOf('recommendedShelf') !== -1);
    assert.deepEqual(killed, ['100 SIGTERM', '101 SIGTERM'], 'the home app under either name, no other Flutter app or shell');
    assert.ok(!runs.some(function (x) { return /pkill|pidof/.test(x.cmd); }));
    assert.strictEqual(fs.readFileSync(path.join(state, 'home-webos10-lg.xml'), 'utf8'), LG, 'LG\'s copy kept');
    console.log('  ✓ hiding a part mounts LG\'s layout without it over the folder, and restarts the home app found by its arguments');

    home10.setPart('sideIcons', false, checked(function () {
      var xml = runs.filter(function (x) { return /mount -t overlay/.test(x.cmd); }).pop().stdin.split('\n');
      var side = xml.filter(function (l) { return l.indexOf('globalline') !== -1; })[0];
      assert.ok(/itemWidth="0"/.test(side) && /itemHeight="0"/.test(side), 'shrunk, not removed');
      var at = function (id) { for (var i = 0; i < xml.length; i++) if (xml[i].indexOf('id="' + id + '"') !== -1) return i; return -1; };
      assert.ok(at('globalline') === at('herobanner') + 1, 'after the banner');
      assert.ok(at('qcardList') === -1, 'still hidden, read from LG\'s copy while mounted');
      console.log('  ✓ the side buttons are shrunk to nothing after the banner, and LG\'s copy is used while mounted');

      // A restart of the TV: the mount is gone, and the server's start puts it back.
      fs.writeFileSync(mounts, '');
      var before = runs.length;
      home10.reapply(checked(function () {
        assert.ok(runs.slice(before).some(function (x) { return /mount -t overlay/.test(x.cmd); }), 'mounted again');
        before = runs.length;
        home10.reapply(checked(function () {
          assert.strictEqual(runs.length, before, 'nothing while still mounted, as after a server restart');
          console.log('  ✓ after a restart of the TV the layout is put back, and not twice');

          killFails = true;
          home10.setPart('recommended', false, checked(function (failed) {
          assert.strictEqual(failed.ok, false, 'a home app that could not be restarted is reported');
          assert.ok(/restart/.test(failed.error));
          killFails = false;
          console.log('  ✓ a failed restart of the home app is reported');
          killed = [];
          home10.restore(checked(function (back) {
            assert.strictEqual(back.changed, true);
            assert.strictEqual(killed.length, 2, 'restarted after putting LG\'s layout back too');
            assert.ok(runs.slice(before).some(function (x) { return /^umount /.test(x.cmd); }));
            assert.deepEqual(home10.parts().map(function (p) { return p.shown; }), [true, true, true]);
            console.log('  ✓ putting LG\'s Home screen back unmounts it and forgets the choices');
            console.log('ALL test-homescreen-webos10.js assertions passed!\n');
          }));
          }));
        }));
      }));
    }));
  }));
}));
