// Strict ES5 - node v0.12.2 on webOS 4 (LG OLED B8) has no ES6 support.
var assert = require('assert');
var power = require('../server/lib/power');

console.log('Running test-power.js ...');

var REASON_URI = 'com.webos.service.tvpower/power/getPowerOnReason';
var TIME_URI = 'com.webos.service.tvpower/power/getPowerOnTime';

// The C4's replies in Active Standby (webOS 9.2).
var C4_REASON = { reason: 'alwaysOn', returnValue: true };
var C4_TIME = { returnValue: true, time: { uptime: '27196.63', ontime: '0' } };
var UNKNOWN = { returnValue: false, errorCode: -1, errorText: 'Unknown method "getPowerOnReason" for category "/power"' };

/*
 * A TV answering from replies, a forwarder counting flushes and the lines
 * logged. Each luna answer comes on the next tick, as luna-send's would.
 */
function fakeTv(replies) {
  var tv = { calls: [], flushes: 0, lines: [] };
  power.init({
    luna: function (uri, payload, cb) {
      tv.calls.push(uri);
      process.nextTick(function () { cb(replies[uri] || null, ''); });
    },
    syslog: /** @type {any} */ ({ flush: function () { tv.flushes++; } }),
    log: function (line) { tv.lines.push(line); },
    clock: function () { return 0; }
  });
  return tv;
}

function later(fn) { setTimeout(fn, 10); }

// 1. The replies as /api/stats gives them
(function testParse() {
  assert.strictEqual(power.parseReason(C4_REASON), 'alwaysOn');
  assert.deepEqual(power.parseTime(C4_TIME), { uptime: 27196.63, ontime: 0 });
  assert.strictEqual(power.parseReason(UNKNOWN), null);
  assert.strictEqual(power.parseTime(UNKNOWN), null);
  assert.strictEqual(power.parseReason(null), null);
  assert.strictEqual(power.parseReason({ returnValue: true, reason: '' }), null);
  assert.deepEqual(power.parseTime({ returnValue: true, time: { uptime: '12.5' } }), { uptime: 12.5, ontime: null });
  assert.deepEqual(power.parseTime({ returnValue: true, time: { uptime: '', ontime: 'soon' } }), { uptime: null, ontime: null });
  console.log('  ✓ the reason and the times parse from the C4\'s replies, and a refusal gives nulls');
})();

// 2. One line at start, with the reason and the uptime
function testStart(next) {
  var replies = {};
  replies[REASON_URI] = { reason: 'rebootByOnRegular', returnValue: true };
  replies[TIME_URI] = { returnValue: true, time: { uptime: '12.4', ontime: '0' } };
  var tv = fakeTv(replies);
  power.start();
  later(function () {
    assert.deepEqual(tv.lines, ['power: on by rebootByOnRegular, up 12 s']);
    assert.deepEqual(power.current(), { onReason: 'rebootByOnRegular', onTime: { uptime: 12.4, ontime: 0 } });
    console.log('  ✓ start logs why the TV is on and how long it has been up');
    next();
  });
}

// 3. A TV without the methods: nulls, and one line at start only
function testUnknown(next) {
  var replies = {};
  replies[REASON_URI] = UNKNOWN;
  replies[TIME_URI] = UNKNOWN;
  var tv = fakeTv(replies);
  power.start();
  power.stateChanged('Active Standby');
  later(function () {
    power.stateChanged('Active');
    later(function () {
      assert.deepEqual(power.current(), { onReason: null, onTime: null });
      assert.deepEqual(tv.lines, ['power: the TV gives no power-on reason', 'power: Active Standby -> Active']);
      console.log('  ✓ a TV without the methods gets nulls and says so once');
      next();
    });
  });
}

// 4. Each transition is logged and flushed; turning on waits for the reason
function testTransitions(next) {
  var replies = {};
  replies[REASON_URI] = C4_REASON;
  replies[TIME_URI] = C4_TIME;
  var tv = fakeTv(replies);
  power.stateChanged('Active');
  assert.deepEqual(tv.lines, [], 'the first reading is no transition');
  assert.strictEqual(tv.calls.length, 0);

  power.stateChanged('Active Standby');
  // Before any luna answer: a power-off may follow at once.
  assert.deepEqual(tv.lines, ['power: Active -> Active Standby']);
  assert.strictEqual(tv.flushes, 1);

  later(function () {
    assert.deepEqual(tv.calls, [REASON_URI, TIME_URI], 'read again after the transition');
    replies[REASON_URI] = { reason: 'remoteKey', returnValue: true };
    power.stateChanged('Active');
    assert.strictEqual(tv.lines.length, 1, 'turning on waits for the reason');
    assert.strictEqual(tv.flushes, 1);
    later(function () {
      assert.deepEqual(tv.lines, ['power: Active -> Active Standby', 'power: Active Standby -> Active, on by remoteKey']);
      assert.strictEqual(tv.flushes, 2);
      assert.strictEqual(power.current().onReason, 'remoteKey');

      power.stateChanged('Active');
      assert.strictEqual(tv.lines.length, 2, 'the same state again is no transition');
      console.log('  ✓ each transition is logged and flushed, the way down before any read');
      next();
    });
  });
}

// 5. The times move on between reads, and an ontime of 0 stays 0
function testAging(next) {
  var replies = {};
  replies[REASON_URI] = { reason: 'remoteKey', returnValue: true };
  replies[TIME_URI] = { returnValue: true, time: { uptime: '10299.62', ontime: '462.36' } };
  var now = 5000;
  power.init({
    luna: function (uri, payload, cb) { process.nextTick(function () { cb(replies[uri], ''); }); },
    log: function () {},
    clock: function () { return now; }
  });
  power.refresh(function () {
    now += 60500;
    assert.deepEqual(power.current().onTime, { uptime: 10360.12, ontime: 522.86 });
    replies[TIME_URI] = C4_TIME;
    power.refresh(function () {
      now += 1000;
      assert.deepEqual(power.current().onTime, { uptime: 27197.63, ontime: 0 }, 'standby');
      console.log('  ✓ the times move on between reads, and standby stays at 0');
      next();
    });
  });
}

// 6. /api/stats carries both under powerState
function testStats(next) {
  var mockEnv = require('./mocks/mock-env').createMockEnv();
  mockEnv.install();
  var telemetry = require('../server/lib/telemetry');
  mockEnv.luna[REASON_URI] = C4_REASON;
  mockEnv.luna[TIME_URI] = C4_TIME;
  power.init({ luna: mockEnv.mockLuna, syslog: null, clock: function () { return 0; } });
  telemetry.init({
    luna: mockEnv.mockLuna,
    lunaCached: mockEnv.mockLunaCached,
    config: { port: 8080 },
    power: power,
    tvwebVersion: '0.0.0'
  });
  power.refresh(function () {
    telemetry.collectStats(function (stats) {
      // Asserted outside: collectStats swallows what its callbacks throw.
      setImmediate(function () {
        mockEnv.restore();
        assert.strictEqual(stats.powerState.raw, 'Active');
        assert.strictEqual(stats.powerState.onReason, 'alwaysOn');
        assert.deepEqual(stats.powerState.onTime, { uptime: 27196.63, ontime: 0 });
        console.log('  ✓ /api/stats gives the reason and the times under powerState');
        next();
      });
    });
  });
}

testStart(function () {
  testUnknown(function () {
    testTransitions(function () {
      testAging(function () {
        testStats(function () {
          console.log('test-power.js: all passed');
        });
      });
    });
  });
});
