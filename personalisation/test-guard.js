'use strict';
var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var createGuard = require('./guard').createGuard;

var base = fs.mkdtempSync(path.join(os.tmpdir(), 'glasshouse-guard-'));
var count = 0;
function replace(file, text) {
  fs.writeFileSync(file + '.new', text);
  fs.renameSync(file + '.new', file);
}
function fixture(settings) {
  settings = settings || {};
  var root = path.join(base, String(++count)), target = path.join(root, 'tvweb');
  fs.mkdirSync(root); fs.mkdirSync(target);
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({
    patches: [{ file: 'home.html', patch: 'home.patch' }], assets: []
  }));
  ['apply.js', 'home.patch'].forEach(function (f) { fs.writeFileSync(path.join(root, f), 'fixture'); });
  ['tvweb.js', 'tvwebctl', 'home.html'].forEach(function (f) { fs.writeFileSync(path.join(target, f), 'stock'); });
  var applied = 0, restarted = 0, result = settings.result || 'applied';
  var g = createGuard({
    root: root, target: target,
    apply: function () {
      applied++;
      if (result === 'applied') replace(path.join(target, 'home.html'), 'custom');
      if (settings.installDuringApply) fs.mkdirSync(path.join(target, '.update'));
      return { state: result, changed: result === 'applied', message: result };
    },
    isRunning: function () { return settings.running === true; },
    restart: function () { restarted++; if (settings.failRestart) throw new Error('restart failed'); }
  });
  return {
    root: root, target: target, cycle: g.cycle,
    applied: function () { return applied; }, restarted: function () { return restarted; },
    result: function (r) { result = r; },
    status: function () { return JSON.parse(fs.readFileSync(path.join(root, 'status.json'))); },
    change: function () { replace(path.join(target, 'tvweb.js'), 'new release ' + count++); }
  };
}

try {
  var a = fixture({ running: true });
  assert.equal(a.cycle().state, 'settling');
  assert.equal(a.applied(), 0);
  a.change();
  assert.equal(a.cycle().state, 'settling', 'a changed release needs two stable samples again');
  assert.equal(a.cycle().state, 'applied');
  assert.equal(a.applied(), 1); assert.equal(a.restarted(), 1);
  var statusStat = fs.statSync(path.join(a.root, 'status.json'));
  for (var i = 0; i < 5; i++) assert.equal(a.cycle().state, 'unchanged');
  assert.equal(a.applied(), 1); assert.equal(a.restarted(), 1);
  assert.equal(fs.statSync(path.join(a.root, 'status.json')).ino, statusStat.ino, 'idle cycles do not write status');
  a.change(); a.cycle(); a.cycle();
  assert.equal(a.applied(), 2); assert.equal(a.restarted(), 2);

  ['.update', '.deploy', '.hbc-stage'].forEach(function (stage) {
    var b = fixture({ running: true });
    fs.mkdirSync(path.join(b.target, stage));
    assert.equal(b.cycle(true).state, 'busy');
    assert.equal(b.cycle().state, 'busy');
    assert.equal(b.applied(), 0); assert.equal(b.restarted(), 0);
    fs.rmdirSync(path.join(b.target, stage));
    assert.equal(b.cycle().state, 'settling');
    assert.equal(b.cycle().state, 'applied');
  });

  var c = fixture({ running: false });
  assert.equal(c.cycle(true).state, 'applied');
  assert.equal(c.restarted(), 0);
  assert.equal(c.status().restart, 'stopped', 'never start a deliberately stopped server');

  var d = fixture({ running: true, result: 'blocked' });
  d.cycle(); d.cycle(); d.cycle(); d.cycle(true);
  assert.equal(d.applied(), 1); assert.equal(d.restarted(), 0);
  assert.equal(d.status().state, 'blocked');
  fs.mkdirSync(path.join(d.target, '.update')); d.cycle();
  fs.rmdirSync(path.join(d.target, '.update')); d.cycle();
  assert.equal(d.status().state, 'blocked', 'an aborted installer does not leave status busy');
  d.change(); d.cycle(); d.cycle(); assert.equal(d.applied(), 2);

  var e = fixture({ running: true, result: 'busy' });
  e.cycle(); e.cycle(); assert.equal(e.applied(), 1);
  e.result('current'); e.cycle(); assert.equal(e.applied(), 2);
  e.cycle(); assert.equal(e.applied(), 2); assert.equal(e.restarted(), 0);

  var f = fixture({ running: true, failRestart: true });
  f.cycle(true); f.cycle(); f.cycle();
  assert.equal(f.restarted(), 1); assert.equal(f.status().restart, 'failed');
  assert.equal(f.status().restartError, 'restart failed');

  var h = fixture();
  fs.unlinkSync(path.join(h.target, 'tvweb.js'));
  assert.equal(h.cycle(true).state, 'waiting'); assert.equal(h.applied(), 0);

  var j = fixture({ running: true, installDuringApply: true });
  assert.equal(j.cycle(true).state, 'busy');
  assert.equal(j.restarted(), 0, 'never restart while an installer has just started');

  console.log('guard checks passed: stability, staging, no resurrection, single restart, conflicts, retries, idle writes');
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}
