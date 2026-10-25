/**
 * test/test-history.js - Watch-time history
 */

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var history = require('../server/lib/history');
var StateManager = require('../server/lib/state').StateManager;

console.log('Running test-history.js ...');

var root = path.join(os.tmpdir(), 'gh-history-' + process.pid);

function rmrf(p) {
  try {
    fs.readdirSync(p).forEach(function (f) { fs.unlinkSync(path.join(p, f)); });
    fs.rmdirSync(p);
  } catch (e) {}
}

// A TV whose clocks the test moves: wall, the time of day, and mono, which a
// clock being set does not move.
function setup(opts) {
  opts = opts || {};
  rmrf(root);
  var clock = { wall: opts.wall, mono: 1000 };
  var state = new StateManager();
  var groups = [];
  var liveState = {
    state: state,
    startGroup: function (g) { groups.push('+' + g); },
    stopGroup: function (g) { groups.push('-' + g); }
  };
  var config = { history: { enabled: opts.enabled !== false } };
  history.init({
    config: config,
    dir: root,
    liveState: liveState,
    luna: opts.luna,
    appTitle: function (id) { return id === 'youtube.leanback.v4' ? 'YouTube' : null; },
    now: function () { return clock.wall; },
    mono: function () { return clock.mono; }
  });
  return {
    clock: clock, state: state, groups: groups, config: config,
    advance: function (ms) { clock.wall += ms; clock.mono += ms; },
    on: function (app, title) {
      state.update('power', 'systemOn', true);
      state.update('power', 'screenOn', true);
      // In the TV's order: the title last, after the app has changed.
      state.update('application', 'app_id', app);
      state.update('application', 'app', app);
      state.update('application', 'display_title', title || app);
    }
  };
}

function file(month) {
  return JSON.parse(fs.readFileSync(path.join(root, month + '.json'), 'utf8'));
}

var T = Date.UTC(2026, 9, 14, 18, 50, 0);

// 1. Counted per app and split at the hour
(function () {
  var tv = setup({ wall: T });
  history.start();
  assert.deepEqual(tv.groups, ['+application'], 'the app subscription starts without MQTT');
  tv.on('netflix', 'Netflix');
  tv.advance(20 * 60000);
  tv.on('hdmi2', 'PlayStation');
  tv.advance(5 * 60000);
  tv.state.update('power', 'systemOn', false);
  var f = file('2026-10');
  assert.deepEqual(f.hours['2026-10-14T18'], { netflix: 600 });
  assert.deepEqual(f.hours['2026-10-14T19'], { netflix: 600, hdmi2: 300 });
  assert.strictEqual(f.titles.hdmi2, 'PlayStation');
  assert.strictEqual(f.titles.netflix, 'Netflix', 'not the next app\'s title');
  console.log('  ✓ time is counted per app, split at the hour, and written when the TV goes off');
  history.stop();
})();

// 1b. An app by its title, which the live state does not have
(function () {
  var tv = setup({ wall: T });
  history.start();
  tv.on('youtube.leanback.v4', 'youtube.leanback.v4');
  tv.advance(60000);
  assert.strictEqual(history.query(T - 3600000, T + 3600000).titles['youtube.leanback.v4'], 'YouTube');
  history.stop();

  // Telemetry has no titles yet at start, and has them later.
  var known = false;
  history.init({
    config: { history: { enabled: true } }, dir: root, liveState: tv.state && {
      state: tv.state, startGroup: function () {}, stopGroup: function () {}
    },
    appTitle: function (id) { return known && id === 'youtube.leanback.v4' ? 'YouTube' : null; },
    now: function () { return tv.clock.wall; }, mono: function () { return tv.clock.mono; }
  });
  history.start();
  assert.strictEqual(history.query(T - 3600000, T + 3600000).titles['youtube.leanback.v4'], null);
  known = true;
  assert.strictEqual(history.query(T - 3600000, T + 3600000).titles['youtube.leanback.v4'], 'YouTube',
    'asked again when read');
  console.log('  ✓ an app is named by its title from telemetry');
  history.stop();
})();

// 2. Screen off
(function () {
  var tv = setup({ wall: T });
  history.start();
  tv.on('spotify');
  tv.advance(60000);
  tv.state.update('power', 'screenOn', false);
  tv.advance(120000);
  tv.state.update('power', 'systemOn', false);
  assert.deepEqual(file('2026-10').hours['2026-10-14T18'], { spotify: 60, screen_off: 120 });

  // The screen goes off 20 ms before the TV does: nothing is kept for it.
  tv.on('spotify');
  tv.advance(1000);
  tv.state.update('power', 'screenOn', false);
  tv.advance(20);
  tv.state.update('power', 'systemOn', false);
  assert.deepEqual(file('2026-10').hours['2026-10-14T18'], { spotify: 61, screen_off: 120 });
  console.log('  ✓ time with the panel off is kept apart as screen_off, and a moment of it not at all');
  history.stop();
})();

// 2b. LG's screen saver
(function () {
  var tv = setup({ wall: T });
  history.start();
  tv.on('netflix');
  tv.advance(60000);
  tv.state.update('power', 'state', 'Screen Saver');
  tv.advance(300000);
  tv.state.update('power', 'state', 'Active');
  tv.advance(30000);
  tv.state.update('power', 'systemOn', false);
  assert.deepEqual(file('2026-10').hours['2026-10-14T18'], { netflix: 90, screen_saver: 300 });
  assert.ok(history.isIdle('screen_saver') && history.isIdle('screen_off') && !history.isIdle('netflix'));
  console.log('  ✓ time with LG\'s screen saver showing is kept apart as screen_saver, and not as watched');
  history.stop();
})();

// 3. A clock set after boot
(function () {
  var tv = setup({ wall: Date.UTC(2020, 0, 1) });
  history.start();
  tv.on('livetv');
  tv.advance(10 * 60000);
  tv.on('youtube.leanback.v4');
  // The clock is set: wall jumps, mono does not.
  tv.clock.wall = T;
  tv.advance(5 * 60000);
  tv.state.update('power', 'systemOn', false);
  var f = file('2026-10');
  assert.deepEqual(f.hours['2026-10-14T18'], { livetv: 600, 'youtube.leanback.v4': 300 },
    'placed back from the monotonic clock once the time was set');
  assert.ok(!fs.existsSync(path.join(root, '2020-01.json')), 'nothing written to the unset clock');
  console.log('  ✓ time counted before the clock was set is placed once it is');
  history.stop();
})();

// 4. Opt-in
(function () {
  var tv = setup({ wall: T, enabled: false });
  history.start();
  tv.on('netflix');
  tv.advance(60000);
  tv.state.update('power', 'systemOn', false);
  assert.ok(!fs.existsSync(root), 'nothing written while off');
  assert.deepEqual(tv.groups, []);
  assert.strictEqual(history.summary(), null);
  history.setEnabled(true);
  assert.strictEqual(tv.config.history.enabled, true);
  tv.on('netflix');
  tv.advance(60000);
  history.setEnabled(false);
  assert.deepEqual(file('2026-10').hours['2026-10-14T18'], { netflix: 60 });
  assert.deepEqual(tv.groups, ['+application', '-application']);
  console.log('  ✓ nothing is counted until it is turned on, and turning it off writes what was');
})();

// 5. Reload, query, totals and summary
(function () {
  var tv = setup({
    wall: T,
    luna: function (uri, p, cb) {
      // CEST: 20:50 local at 18:50 UTC.
      cb({ returnValue: true, utc: T / 1000, localtime: { year: 2026, month: 10, day: 14, hour: 20, minute: 50, second: 0 } });
    }
  });
  history.start();
  tv.on('netflix', 'Netflix');
  tv.advance(30 * 60000);
  history.flush();

  history.init({ config: tv.config, dir: root, now: function () { return tv.clock.wall; }, mono: function () { return tv.clock.mono; } });
  history.start();
  var tot = history.totals();
  assert.strictEqual(tot.netflix, 1800, 'read back from the file');

  var qr = history.query(T - 3600000, T + 3600000);
  assert.deepEqual(Object.keys(qr.hours).sort(), ['2026-10-14T18', '2026-10-14T19']);
  assert.strictEqual(qr.titles.netflix, 'Netflix');
  assert.strictEqual(qr.enabled, true);
  history.stop();

  // The offset: local midnight is 22:00 UTC, so 18:50 to 19:20 UTC is today.
  tv = setup({
    wall: T,
    luna: function (uri, p, cb) {
      cb({ returnValue: true, utc: tv.clock.wall / 1000, localtime: { year: 2026, month: 10, day: 14, hour: 20, minute: 50, second: 0 } });
    }
  });
  history.start();
  tv.on('netflix', 'Netflix');
  tv.advance(90 * 60000);
  var sum = history.summary();
  assert.strictEqual(sum.today_h, 1.5);
  assert.strictEqual(sum.week_h, 1.5);
  assert.strictEqual(sum.top_today, 'Netflix');
  // Past local midnight: 22:20 UTC is 00:20 the next day.
  tv.advance(120 * 60000);
  sum = history.summary();
  assert.strictEqual(sum.today_h, 0.33, 'only 22:00 to 22:20 UTC is the new day');
  assert.strictEqual(sum.week_h, 3.5);
  console.log('  ✓ a restart reads back what was kept, and today follows the TV\'s time zone');
  history.stop();
})();

// 5b. A title by the app's full id after a restart, over a wrong one saved
(function () {
  var tv = setup({ wall: T });
  history.start();
  tv.state.update('power', 'systemOn', true);
  tv.state.update('power', 'screenOn', true);
  tv.state.update('application', 'app_id', 'com.webos.app.home');
  tv.state.update('application', 'app', 'home');
  tv.advance(60000);
  history.stop();
  var saved = file('2026-10');
  assert.strictEqual(saved.ids.home, 'com.webos.app.home');
  // As written before ids were kept, with the last app's title.
  saved.titles.home = 'youtube.leanback.v4';
  fs.writeFileSync(path.join(root, '2026-10.json'), JSON.stringify(saved));

  history.init({
    config: tv.config, dir: root, now: function () { return tv.clock.wall; }, mono: function () { return tv.clock.mono; },
    appTitle: function (id) { return id === 'com.webos.app.home' ? 'Home' : null; }
  });
  history.start();
  assert.strictEqual(history.query(T - 3600000, T + 3600000).titles.home, 'Home');
  console.log('  ✓ after a restart an app is named by its full id, over a title saved wrong');
  history.stop();
})();

// 6. Clear and prune
(function () {
  var tv = setup({ wall: T });
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, '2025-09.json'), '{"v":1,"hours":{"2025-09-01T10":{"a":5}},"titles":{}}');
  fs.writeFileSync(path.join(root, '2025-10.json'), '{"v":1,"hours":{"2025-10-01T10":{"a":5}},"titles":{}}');
  history.start();
  tv.on('netflix');
  tv.advance(60000);
  history.flush();
  assert.ok(!fs.existsSync(path.join(root, '2025-09.json')), 'older than 13 months is deleted');
  assert.ok(fs.existsSync(path.join(root, '2025-10.json')), '13 months are kept');
  assert.strictEqual(history.oldestKept(T), '2025-10');
  history.clear();
  assert.deepEqual(fs.readdirSync(root), []);
  tv.advance(60000);
  history.flush();
  assert.deepEqual(file('2026-10').hours['2026-10-14T18'], { netflix: 60 }, 'counting goes on from the clear');
  console.log('  ✓ more than 13 months are pruned, and Clear deletes the rest');
  history.stop();
})();

// 7. The Server tab's switch and Clear, which answer with the tab's summary
(function () {
  var routes = require('../server/lib/routes');
  var controls = require('../server/lib/controls');
  var cfgPath = path.join(os.tmpdir(), 'tvweb-history-' + process.pid + '.json');
  fs.writeFileSync(cfgPath, JSON.stringify({ port: 8080 }), 'utf8');

  var tv = setup({ wall: T, enabled: false });
  // controls.js, routes.js and history.js are handed the same object, as in tvweb.js.
  var config = tv.config;
  config.allowControl = true;
  config.web = { enabled: false };
  routes.init({
    config: config,
    configFile: cfgPath,
    history: history,
    updater: { updateSummary: function () { return { ok: true, writable: true }; } },
    privacy: { tvUpdatesBlocked: function () { return false; } }
  });
  controls.init({ config: config, history: history, writeSettings: routes.writeSettings, updateSummary: routes.updateSummary });
  history.start();

  assert.deepEqual(routes.updateSummary().watchHistory, { enabled: false, running: false, kept: false });
  var checks = 0;
  controls.doControl('setHistoryEnabled', true, function (r) {
    checks++;
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.watchHistory.enabled, true);
    assert.strictEqual(JSON.parse(fs.readFileSync(cfgPath, 'utf8')).history.enabled, true);
  });
  tv.on('netflix');
  tv.advance(60000);
  controls.doControl('setHistoryEnabled', false, function (r) {
    checks++;
    assert.deepEqual(r.watchHistory, { enabled: false, running: false, kept: true }, 'stopping keeps the history');
  });
  controls.doControl('clearHistory', null, function (r) {
    checks++;
    assert.strictEqual(r.watchHistory.kept, false);
  });

  config.allowControl = false;
  controls.doControl('setHistoryEnabled', true, function (r) {
    checks++;
    assert.strictEqual(r.ok, false, 'refused with controls off');
  });

  try { fs.unlinkSync(cfgPath); } catch (e) {}
  assert.strictEqual(checks, 4, 'every callback ran');
  console.log('  ✓ the Server tab switch saves the setting, stopping keeps the history, and Clear deletes it');
})();

rmrf(root);
console.log('test-history.js passed');
