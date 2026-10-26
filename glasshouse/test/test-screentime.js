/**
 * test/test-screentime.js - Screen-time limits
 */

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var history = require('../server/lib/history');
var screentime = require('../server/lib/screentime');
var StateManager = require('../server/lib/state').StateManager;

console.log('Running test-screentime.js ...');

var root = path.join(os.tmpdir(), 'gh-screentime-' + process.pid);
// 20:50 on the TV, in CEST, is 18:50 UTC.
var T = Date.UTC(2026, 9, 14, 18, 50);

function rmrf(p) {
  try {
    fs.readdirSync(p).forEach(function (f) { fs.unlinkSync(path.join(p, f)); });
    fs.rmdirSync(p);
  } catch (e) {}
}

function setup(limits, historyOn) {
  rmrf(root);
  var clock = { wall: T, mono: 1000 };
  var state = new StateManager();
  var liveState = { state: state, startGroup: function () {}, stopGroup: function () {} };
  var settings = { enabled: true };
  for (var k in limits) settings[k] = limits[k];
  var config = { history: { enabled: historyOn !== false }, screenTime: settings, allowPower: true };
  var calls = [], toasts = [], waiting = [];
  history.init({
    config: config, dir: root, liveState: liveState,
    luna: function (uri, p, cb) {
      cb({ returnValue: true, utc: T / 1000, localtime: { year: 2026, month: 10, day: 14, hour: 20, minute: 50, second: 0 } });
    },
    now: function () { return clock.wall; },
    mono: function () { return clock.mono; }
  });
  history.start();
  var stOpts = {
    config: config, liveState: liveState, stateFile: path.join(root, 'screentime.json'),
    homeAppDir: os.tmpdir(),
    control: function (action, value, cb) {
      if (action === 'toast') toasts.push(value); else calls.push(value ? action + ':' + value : action);
      if (action === 'screenOff') state.update('power', 'screenOn', false);
      cb({ ok: true });
    },
    injectKey: function (code, cb) { calls.push('key:' + code); cb(true); },
    keyBack: 158,
    later: function (fn, ms) {
      var entry = { fn: fn, ms: ms, cancelled: false };
      waiting.push(entry);
      return function () { entry.cancelled = true; };
    }
  };
  screentime.init(stOpts);
  screentime.start();
  return {
    state: state, calls: calls, toasts: toasts,
    advance: function (ms) { clock.wall += ms; clock.mono += ms; screentime.check(); },
    // The wait of ms running out: the minute's grace unless given.
    elapse: function (ms) {
      ms = ms || 60000;
      var due = waiting.filter(function (e) { return e.ms === ms; });
      waiting = waiting.filter(function (e) { return e.ms !== ms; });
      due.forEach(function (e) { if (!e.cancelled) e.fn(); });
    },
    // The screen coming on, and the seconds before a toast is seen.
    screen: function (on) {
      state.update('power', 'screenOn', on);
      if (on) this.elapse(5000);
    },
    on: function (app) {
      state.update('power', 'systemOn', true);
      state.update('application', 'app_id', app);
      state.update('application', 'app', app);
      this.screen(true);
    },
    off: function () {
      state.update('power', 'systemOn', false);
      state.update('power', 'screenOn', false);
    },
    // The server restarting, as on a TV that shuts down fully.
    restart: function () {
      screentime.stop();
      screentime.init(stOpts);
      screentime.start();
    },
    done: function () { screentime.stop(); history.stop(); }
  };
}

(function testDailyLimit() {
  var tv = setup({ dailyMinutes: 60, action: 'off' });
  tv.on('netflix');
  tv.advance(54 * 60000);
  assert.deepEqual(tv.toasts, []);
  tv.advance(2 * 60000);
  assert.deepEqual(tv.toasts, ['4 minutes of screen time left today.']);
  tv.advance(60000);
  assert.strictEqual(tv.toasts.length, 1, 'warned once');
  tv.advance(3 * 60000);
  assert.strictEqual(tv.toasts[1], 'Today\'s screen time is used up. The TV switches off in a minute.');
  tv.advance(30000);
  assert.strictEqual(tv.toasts.length, 2, 'said once while it waits');
  assert.deepEqual(tv.calls, []);
  tv.elapse();
  assert.deepEqual(tv.calls, ['powerOff']);
  tv.done();
  console.log('  ✓ the daily limit warns five minutes before, then switches the TV off a minute after it is reached');
})();

(function testScreenOffCancels() {
  var tv = setup({ dailyMinutes: 30, action: 'off' });
  tv.on('netflix');
  tv.advance(31 * 60000);
  tv.screen(false);
  tv.elapse();
  assert.deepEqual(tv.calls, [], 'the screen went off within the minute');
  tv.done();
  console.log('  ✓ a pending action is dropped once the screen is off');
})();

(function testAppLimit() {
  var tv = setup({ apps: { netflix: 30 }, appAction: 'home' });
  tv.on('netflix');
  tv.advance(29 * 60000);
  assert.deepEqual(tv.toasts, ['1 minute left for this today.']);
  tv.on('youtube');
  tv.advance(60 * 60000);
  assert.strictEqual(tv.toasts.length, 1, 'another app has no limit');
  tv.on('netflix');
  tv.advance(2 * 60000);
  assert.strictEqual(tv.toasts[1], 'Today\'s time for this is used up. Going to Home in a minute.');
  tv.elapse();
  assert.deepEqual(tv.calls, ['rcu:home']);
  tv.done();
  console.log('  ✓ an app\'s limit counts only that app, and goes to Home');
})();

(function testBedtime() {
  var tv = setup({ bedtimeStart: '21:00', bedtimeEnd: '07:00', action: 'screenOff' });
  tv.on('netflix');
  tv.advance(6 * 60000);
  assert.deepEqual(tv.toasts, ['Bedtime in 4 minutes.']);
  tv.advance(5 * 60000);
  assert.strictEqual(tv.toasts[1], 'It is bedtime. The screen goes off in a minute.');
  tv.elapse();
  assert.deepEqual(tv.calls, ['screenOff']);
  tv.done();

  var b = screentime.bedtime({ bedtimeStart: '22:30', bedtimeEnd: '06:00' }, Date.UTC(2026, 9, 15, 2, 0));
  assert.deepEqual(b, { inside: true, untilStart: 20.5 * 3600 }, 'past midnight is inside');
  b = screentime.bedtime({ bedtimeStart: '22:30', bedtimeEnd: '06:00' }, Date.UTC(2026, 9, 15, 6, 0));
  assert.strictEqual(b.inside, false, 'the end is outside');
  assert.strictEqual(screentime.bedtime({ bedtimeStart: '', bedtimeEnd: '06:00' }, T), null);
  console.log('  ✓ bedtime warns, acts, and runs past midnight');
})();

(function testWarnOnly() {
  var tv = setup({ dailyMinutes: 30, action: 'warn' });
  tv.on('netflix');
  tv.advance(29 * 60000);
  tv.advance(2 * 60000);
  tv.advance(10 * 60000);
  tv.elapse();
  assert.deepEqual(tv.toasts, ['1 minute of screen time left today.', 'Today\'s screen time is used up.']);
  assert.deepEqual(tv.calls, []);
  tv.done();
  console.log('  ✓ Only warn says so once and does nothing else');
})();

(function testScreenSaverNotCounted() {
  var tv = setup({ dailyMinutes: 30 });
  tv.on('netflix');
  tv.state.update('power', 'state', 'Screen Saver');
  tv.advance(40 * 60000);
  assert.deepEqual(tv.toasts, [], 'LG\'s screen saver is not screen time');
  var keys = screentime.status(T + 40 * 60000).choices.map(function (c) { return c.key; });
  assert.ok(keys.indexOf('screen_saver') === -1, 'and is not offered as an app to limit');
  tv.done();
  console.log('  ✓ time on LG\'s screen saver counts toward no limit, and is not offered as one');
})();

(function testNeedsWatchTime() {
  var tv = setup({ dailyMinutes: 30 }, false);
  tv.on('netflix');
  tv.advance(60 * 60000);
  tv.elapse();
  assert.deepEqual(tv.toasts, []);
  assert.deepEqual(tv.calls, []);
  assert.strictEqual(screentime.status(T).historyOn, false);
  tv.done();
  console.log('  ✓ nothing is limited while watch time is off');
})();

(function testToastWaitsForScreen() {
  var tv = setup({ apps: { netflix: 10 }, appAction: 'screenOff' });
  tv.on('netflix');
  tv.advance(11 * 60000);
  tv.elapse();
  assert.deepEqual(tv.calls, ['screenOff']);
  tv.elapse(3000);
  tv.state.update('power', 'screenOn', true);
  tv.advance(1000);
  assert.strictEqual(tv.toasts.length, 1, 'no toast while the panel wakes');
  tv.elapse(5000);
  assert.strictEqual(tv.toasts[1], 'Today\'s time for this is used up. The screen goes off in a minute.');
  tv.done();
  console.log('  ✓ a toast waits five seconds after the screen comes on');
})();

(function testSwitchedBackOn() {
  var again = 'Today\'s screen time is used up. The screen goes off now, and the TV switches off in 5 minutes unless the limit is changed in Glasshouse.';
  var tv = setup({ dailyMinutes: 30, action: 'off' });
  tv.on('netflix');
  tv.advance(31 * 60000);
  tv.elapse();
  assert.deepEqual(tv.calls, ['powerOff']);
  tv.off();

  tv.on('netflix');
  assert.strictEqual(tv.toasts[tv.toasts.length - 1], again);
  tv.elapse();
  assert.deepEqual(tv.calls, ['powerOff'], 'not off after a minute');
  tv.elapse(10000);
  assert.deepEqual(tv.calls, ['powerOff', 'screenOff'], 'the screen off once the toast is read');
  tv.elapse(3000);
  // A key wakes the screen: off again, with no new toast.
  var toasts = tv.toasts.length;
  tv.screen(true);
  assert.deepEqual(tv.calls, ['powerOff', 'screenOff', 'screenOff']);
  assert.strictEqual(tv.toasts.length, toasts);
  tv.elapse(3000);
  tv.advance(4 * 60000);
  tv.elapse(300000);
  assert.deepEqual(tv.calls, ['powerOff', 'screenOff', 'screenOff', 'powerOff']);
  tv.off();

  // Raised from Glasshouse within the 5 minutes.
  tv.on('netflix');
  tv.elapse(10000);
  screentime.apply({ dailyMinutes: 120 });
  tv.elapse(300000);
  assert.deepEqual(tv.calls.slice(4), ['screenOff'], 'stays on');
  tv.done();
  console.log('  ✓ switched back on after its limit: the screen off, and the TV off 5 minutes later unless the limit is changed');
})();

(function testSwitchedOnAfterRestart() {
  var tv = setup({ dailyMinutes: 30, action: 'off' });
  tv.on('netflix');
  tv.advance(31 * 60000);
  tv.elapse();
  assert.deepEqual(tv.calls, ['powerOff']);
  tv.off();
  tv.restart();
  tv.on('netflix');
  assert.ok(/switches off in 5 minutes/.test(tv.toasts[tv.toasts.length - 1]), 'remembered across the restart');
  tv.elapse(10000);
  assert.deepEqual(tv.calls, ['powerOff', 'screenOff']);
  tv.elapse(3000);

  // Switched off in Glasshouse: forgotten, though the limit is still reached.
  screentime.apply({ enabled: false });
  assert.strictEqual(fs.existsSync(path.join(root, 'screentime.json')), false);
  tv.done();
  console.log('  ✓ a switch-off by the limit is remembered across a server restart, until the settings are changed');
})();

(function testScreenSaver() {
  var tv = setup({ dailyMinutes: 30, action: 'screenOff' });
  tv.on('netflix');
  tv.advance(31 * 60000);
  // LG's screen saver comes on within the minute.
  tv.state.update('power', 'state', 'Screen Saver');
  tv.elapse();
  assert.deepEqual(tv.calls, ['key:158'], 'Back dismisses the screen saver first');
  tv.state.update('power', 'state', 'Active');
  tv.elapse(1500);
  assert.deepEqual(tv.calls, ['key:158', 'screenOff']);
  // Comes back on by itself, as the screen saver closing brings it back.
  tv.state.update('power', 'screenOn', true);
  tv.elapse(3000);
  assert.deepEqual(tv.calls, ['key:158', 'screenOff', 'screenOff'], 'turned off again');
  assert.strictEqual(tv.toasts.length, 1, 'with no second toast');
  tv.elapse(3000);
  tv.done();
  console.log('  ✓ over LG\'s screen saver, Back dismisses it before the screen goes off, and the screen is turned off again if it comes back');
})();

(function testNoHomeApp() {
  var config = { screenTime: { enabled: true, appAction: 'home', apps: { hdmi2: 30 } }, allowPower: true };
  screentime.init({ config: config, control: function (a, v, cb) { cb({ ok: true }); },
                    stateFile: path.join(os.tmpdir(), 'gh-st-nohome-' + process.pid + '.json'),
                    homeAppDir: path.join(os.tmpdir(), 'no-such-home-app-' + process.pid) });
  assert.strictEqual(screentime.settings().appAction, 'off', 'switched off, as Home is only the ribbon');
  config.allowPower = false;
  assert.strictEqual(screentime.settings().appAction, 'screenOff', 'or the screen off without power actions');
  config.screenTime.appAction = 'warn';
  assert.strictEqual(screentime.settings().appAction, 'warn', 'other choices kept');
  console.log('  ✓ without LG\'s Home app (webOS 3 to 5), an app\'s limit set to go Home switches the TV off');
})();

(function testValidate() {
  assert.strictEqual(screentime.validate({ dailyMinutes: 90, action: 'screenOff', bedtimeStart: '' }).error, null);
  assert.ok(screentime.validate({ dailyMinutes: 2000 }).error);
  assert.ok(screentime.validate({ bedtimeStart: '25:00' }).error);
  assert.ok(screentime.validate({ action: 'home' }).error, 'Home is for an app only');
  assert.ok(screentime.validate({ apps: { netflix: 0 } }).error);
  assert.ok(screentime.validate({ apps: [] }).error);
  assert.ok(screentime.validate({ allowPower: true }).error, 'nothing outside screenTime');
  console.log('  ✓ settings are checked before they are saved');
})();

rmrf(root);
console.log('test-screentime.js passed');
