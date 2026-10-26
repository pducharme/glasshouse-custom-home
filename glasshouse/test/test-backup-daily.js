/**
 * test/test-backup-daily.js - Daily backups kept on the TV
 */

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var backup = require('../server/lib/backup');

console.log('Running test-backup-daily.js ...');

var dir = path.join(os.tmpdir(), 'gh-backups-' + process.pid);
var DAY_MS = 86400000;

function rmrf(p) {
  try {
    fs.readdirSync(p).forEach(function (f) { fs.unlinkSync(path.join(p, f)); });
    fs.rmdirSync(p);
  } catch (e) {}
}

function setup(daily, wall) {
  rmrf(dir);
  var clock = { wall: wall };
  var config = { backup: { daily: daily }, history: { enabled: true } };
  backup.init({
    config: config,
    dailyDir: dir,
    pendingFile: path.join(dir, 'restore-apps.json'),
    now: function () { return clock.wall; },
    about: function () { return { model: 'OLED65C5ELB', version: '0.96.0' }; },
    lgSettings: {
      collect: function (sections, cb) {
        cb({ ok: true, rows: [{ id: 'soundMode', section: 'sound', type: 'choice', value: 'standard' }] });
      }
    }
  });
  return { clock: clock, config: config };
}

var T = Date.UTC(2026, 9, 15, 9, 0);

(function testOnePerDay() {
  var tv = setup(true, T);
  backup.dailyCheck(function (name) {
    assert.strictEqual(name, 'glasshouse-backup-2026-10-15.json');
  });
  var kept = JSON.parse(backup.readSaved('glasshouse-backup-2026-10-15.json'));
  assert.strictEqual(kept.format, 'glasshouse-backup');
  assert.deepEqual(kept.lg, { soundMode: 'standard' });
  assert.deepEqual(kept.glasshouse.backup, { daily: true }, 'the switch is in the backup');
  assert.strictEqual(fs.statSync(path.join(dir, 'glasshouse-backup-2026-10-15.json')).mode & parseInt('777', 8), parseInt('600', 8));

  tv.clock.wall += 3 * 3600000;
  backup.dailyCheck(function (name) { assert.strictEqual(name, null, 'one a day'); });
  tv.clock.wall = T + DAY_MS;
  backup.dailyCheck(function (name) { assert.strictEqual(name, 'glasshouse-backup-2026-10-16.json'); });
  assert.deepEqual(backup.saved().map(function (s) { return s.date; }), ['2026-10-16', '2026-10-15'], 'newest first');
  console.log('  ✓ one backup a day, named by its date');
})();

(function testKeepsSeven() {
  var tv = setup(true, T);
  for (var i = 0; i < 10; i++) {
    backup.dailyCheck();
    tv.clock.wall += DAY_MS;
  }
  var dates = backup.saved().map(function (s) { return s.date; });
  assert.strictEqual(dates.length, backup.KEEP_DAILY);
  assert.strictEqual(dates[0], '2026-10-24');
  assert.strictEqual(dates[6], '2026-10-18');
  console.log('  ✓ the last 7 are kept');
})();

(function testOffAndUnsetClock() {
  setup(false, T);
  backup.dailyCheck(function (name) { assert.strictEqual(name, null, 'off'); });
  setup(true, Date.UTC(1970, 0, 2));
  backup.dailyCheck(function (name) { assert.strictEqual(name, null, 'the clock is not set'); });
  assert.deepEqual(backup.saved(), []);
  console.log('  ✓ nothing is saved while off or before the clock is set');
})();

(function testReadSavedNames() {
  setup(true, T);
  backup.dailyCheck();
  assert.strictEqual(backup.readSaved('../config.json'), null);
  assert.strictEqual(backup.readSaved('glasshouse-backup-2026-10-15.json.tmp'), null);
  assert.strictEqual(backup.readSaved('glasshouse-backup-2026-10-14.json'), null, 'not kept');
  assert.ok(backup.readSaved('glasshouse-backup-2026-10-15.json'));
  console.log('  ✓ only a kept backup can be read, by its own name');
})();

(function testSwitch() {
  var tv = setup(false, T);
  backup.setDaily(true, function () {
    assert.strictEqual(tv.config.backup.daily, true);
    assert.deepEqual(backup.dailyStatus().saved.map(function (s) { return s.date; }), ['2026-10-15'], 'made at once');
  });
  backup.setDaily(false, function () {
    assert.strictEqual(backup.dailyStatus().enabled, false);
    assert.strictEqual(backup.dailyStatus().saved.length, 1, 'kept when switched off');
  });
  backup.stopDaily();
  console.log('  ✓ switching it on saves today\'s at once, and switching it off keeps those saved');
})();

rmrf(dir);
console.log('test-backup-daily.js passed');
