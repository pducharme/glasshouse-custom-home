/**
 * test/test-game.js - The source's frame rate: the Game tab's stream and the
 * stats' cached one-shot read, sharing one bind.
 */

// Strict ES5 - node v0.12.2 on webOS 4 (LG OLED B8) has no ES6 support.
var assert = require('assert');
var events = require('events');
var luna = require('../server/lib/luna');

console.log('Running test-game.js ...');

var BIND = 'com.webos.service.utp.extinputs/bind';
var VRR = 'com.webos.service.utp.extinputs/getVRRInfo';

// Subscriptions stand in for luna-send children: the test sends their replies.
var subs = [];
luna.Subscription = function (uri, payload, appId, handlers) {
  this.uri = uri;
  this.payload = payload;
  this.handlers = handlers;
  this.running = false;
  subs.push(this);
};
luna.Subscription.prototype.start = function () { this.running = true; };
luna.Subscription.prototype.stop = function () { this.running = false; };
function running(uri) {
  return subs.filter(function (s) { return s.running && s.uri === uri; });
}

// Timers run when the test says, so the 15 s idle drop needs no waiting.
var timers = [];
var realSetTimeout = global.setTimeout;
var realClearTimeout = global.clearTimeout;
global.setTimeout = function (fn, ms) { var t = { fn: fn, ms: ms }; timers.push(t); return t; };
global.clearTimeout = function (t) { var i = timers.indexOf(t); if (i !== -1) timers.splice(i, 1); };
function fire(ms) {
  timers.filter(function (t) { return t.ms === ms; }).forEach(function (t) { global.clearTimeout(t); t.fn(); });
}

// One-shot calls go through the real cache, as tvweb.js wires it.
var calls = [];
var replies = {};
var cache = luna.createCache(function (uri, payload, cb) {
  calls.push({ uri: uri, payload: payload });
  cb(replies[payload.pipelineId] || null, '');
});
var ttls = [];
var game = require('../server/lib/game');
var names = require('../server/lib/names');
// A G5 (webOS 10) reported HDMI 3 under another app id: here HDMI 4 is also
// com.example.hdmi4, as telemetry's inputKey maps it.
game.init({
  lunaCached: function (uri, payload, ttl, cb) { ttls.push(ttl); cache.get(uri, payload, ttl, cb); },
  inputKey: function (appId) { return names.shortAppId(appId, { 'com.example.hdmi4': 'hdmi4' }); }
});

var HDMI4 = 'com.webos.app.hdmi4';
function readNow(appId) {
  var got;
  game.read(appId, function (r) { got = r; });
  return got;
}

// 1. The stats read binds, waits for the pipeline, and asks once per TTL
(function testOneShot() {
  var got = 'pending';
  game.read(HDMI4, function (r) { got = r; });
  assert.strictEqual(running(BIND).length, 1, 'an input on screen holds the bind');
  assert.strictEqual(got, 'pending', 'the read waits for the bind\'s first reply');
  replies.p1 = { returnValue: true, port: 'HDMI4', pipelineId: 'p1', vrrInfo: { frameRate: 119, vrrType: 'gsync' } };
  running(BIND)[0].handlers.message({ returnValue: true, broadcastId: 'p1' });
  assert.deepEqual(got, { frameRate: 119, vrrType: 'gsync', port: 'HDMI4' });
  assert.deepEqual(calls, [{ uri: VRR, payload: { pipelineId: 'p1', mode: 'GameOptimizer' } }]);
  assert.ok(ttls[0] > 0 && ttls[0] <= 5000, 'a few seconds of cache');
  assert.strictEqual(running(VRR).length, 0, 'the stats never start the stream');

  assert.deepEqual(readNow(HDMI4), got);
  assert.strictEqual(calls.length, 1, 'a second read within the TTL is served from the cache');
  assert.deepEqual(readNow('com.example.hdmi4'), got, 'HDMI 4 under another app id is still HDMI 4');
  // HDMI 4's pipeline reporting behind HDMI 2 is not HDMI 2's reading.
  assert.strictEqual(readNow('com.webos.app.hdmi2'), null);
  assert.strictEqual(running(BIND).length, 1, 'still the one bind');
  console.log('  ✓ the stats read is one cached call on the bound pipeline');
})();

// 2. The Game tab's stream shares the bind, and serves the stats while it runs
(function testStream() {
  game.frameRate();
  var stream = running(VRR);
  assert.strictEqual(stream.length, 1);
  assert.deepEqual(stream[0].payload, { subscribe: true, pipelineId: 'p1', mode: 'GameOptimizer', interval: 1000 });
  assert.strictEqual(running(BIND).length, 1, 'no second bind');
  stream[0].handlers.message({ returnValue: true, port: 'HDMI4', vrrInfo: { frameRate: 40, vrrType: 'gsync' } });
  assert.deepEqual(game.frameRate(), { frameRate: 40, vrrType: 'gsync', port: 'HDMI4' });

  cache.forget();
  var before = calls.length;
  assert.deepEqual(readNow(HDMI4), { frameRate: 40, vrrType: 'gsync', port: 'HDMI4' });
  assert.strictEqual(calls.length, before, 'no one-shot call while the stream runs');

  // Off the input the stats have no reading; the stream still holds the bind.
  assert.strictEqual(readNow('com.webos.app.netflix'), null);
  assert.strictEqual(running(BIND).length, 1);
  fire(15000);
  assert.strictEqual(running(VRR).length, 0, 'the stream stops 15 s after the last request');
  assert.strictEqual(running(BIND).length, 0, 'and with no input on screen, the bind goes too');
  console.log('  ✓ the Game tab\'s stream shares the bind and serves the stats while it runs');
})();

// 3. Leaving the input drops the bind without waiting for a read
(function testAppChanged() {
  cache.forget();
  readNow(HDMI4);
  running(BIND)[0].handlers.message({ returnValue: true, broadcastId: 'p2' });
  assert.strictEqual(running(BIND).length, 1);
  game.appChanged('com.webos.app.hdmi1');
  assert.strictEqual(running(BIND).length, 1, 'another input keeps it');
  game.appChanged('com.webos.app.netflix');
  assert.strictEqual(running(BIND).length, 0);
  game.appChanged(HDMI4);
  assert.strictEqual(running(BIND).length, 0, 'a switch to an input alone does not bind');

  // With no source change reported (no MQTT), the stats' hold lapses five
  // minutes after their last read; each read starts the five minutes again.
  readNow(HDMI4);
  running(BIND)[0].handlers.message({ returnValue: true, broadcastId: 'p2' });
  readNow(HDMI4);
  assert.strictEqual(timers.filter(function (t) { return t.ms === 300000; }).length, 1);
  fire(300000);
  assert.strictEqual(running(BIND).length, 0);

  // A bind that never answers leaves the read empty after its wait.
  var got = 'pending';
  game.read(HDMI4, function (r) { got = r; });
  fire(1500);
  assert.strictEqual(got, null);
  game.stop();
  console.log('  ✓ the bind is held only while an input is on screen');
})();

// 3b. An input change disconnects the old pipeline and announces no new one:
// the bind is dropped, and the next reader binds afresh
(function testInputSwitch() {
  cache.forget();
  readNow(HDMI4);
  var first = running(BIND)[0];
  replies.p4 = { returnValue: true, port: 'HDMI4', vrrInfo: { frameRate: 119, vrrType: 'gsync' } };
  first.handlers.message({ returnValue: true, broadcastId: 'p4' });
  assert.strictEqual(readNow(HDMI4).frameRate, 119);

  first.handlers.message({ returnValue: true, broadcastId: 'p4', binded: false, status: 'disconnected' });
  assert.strictEqual(running(BIND).length, 0, 'the dead pipeline\'s bind is dropped');
  var got = 'pending';
  game.read('com.webos.app.hdmi1', function (r) { got = r; });
  var second = running(BIND)[0];
  assert.ok(second && second !== first, 'the next read binds afresh');
  replies.p5 = { returnValue: true, port: 'HDMI1', vrrInfo: { frameRate: 60, vrrType: 'off' } };
  second.handlers.message({ returnValue: true, broadcastId: 'p5' });
  assert.deepEqual(got, { frameRate: 60, vrrType: 'off', port: 'HDMI1' });
  assert.strictEqual(calls[calls.length - 1].payload.pipelineId, 'p5');

  // The stream likewise: dropped with the pipeline, and on the next request
  // started on the new one.
  game.frameRate();
  assert.strictEqual(running(VRR)[0].payload.pipelineId, 'p5');
  second.handlers.message({ returnValue: true, broadcastId: 'p5', binded: false, status: 'disconnected' });
  assert.strictEqual(running(VRR).length, 0);
  assert.strictEqual(running(BIND).length, 0);
  assert.deepEqual(game.frameRate(), { frameRate: 0, vrrType: 'off', port: null });
  var third = running(BIND)[0];
  assert.ok(third && third !== second);
  third.handlers.message({ returnValue: true, broadcastId: 'p6' });
  assert.strictEqual(running(VRR).length, 1);
  assert.strictEqual(running(VRR)[0].payload.pipelineId, 'p6');
  game.stop();
  console.log('  ✓ an input change drops the dead pipeline, and the next reader binds afresh');
})();

// 4. The route keeps its shape, from the stream
(function testRoute() {
  var routes = require('../server/lib/routes');
  var fg = 'com.webos.app.netflix';
  routes.init({
    config: { token: '', web: { enabled: true } },
    game: game,
    luna: function (uri, payload, cb) { cb({ returnValue: true, appId: fg }); }
  });
  function get(cb) {
    var req = new events.EventEmitter();
    req.url = '/api/game/fps';
    req.method = 'GET';
    req.headers = {};
    req.connection = { remoteAddress: '127.0.0.1' };
    var res = {
      setHeader: function () {},
      writeHead: function (code) { res.statusCode = code; },
      end: function (body) { cb(JSON.parse(String(body))); }
    };
    routes.handleRequest(req, res);
  }
  var bodies = [];
  get(function (b) { bodies.push(b); });
  running(BIND)[0].handlers.message({ returnValue: true, broadcastId: 'p3' });
  running(VRR)[0].handlers.message({ returnValue: true, port: 'HDMI4', vrrInfo: { frameRate: 119, vrrType: 'gsync' } });
  get(function (b) { bodies.push(b); });
  fg = HDMI4;
  get(function (b) { bodies.push(b); });
  assert.deepEqual(bodies, [
    { ok: true, fps: { frameRate: 0, vrrType: 'off', port: null } },
    { ok: true, fps: { frameRate: 0, vrrType: 'off', port: null } },
    { ok: true, fps: { frameRate: 119, vrrType: 'gsync', port: 'HDMI4' } }
  ]);
  game.stop();
  console.log('  ✓ /api/game/fps keeps its shape, from the stream');
})();

// 5. A TV without the service is not asked again
(function testUnsupported() {
  readNow(HDMI4);
  running(BIND)[0].handlers.message({ returnValue: false, errorCode: -1, errorText: 'Unknown method "bind" for category "/"' });
  assert.strictEqual(running(BIND).length, 0);
  var count = subs.length;
  assert.strictEqual(readNow(HDMI4), null);
  game.frameRate();
  assert.strictEqual(subs.length, count, 'no new luna-send');
  console.log('  ✓ a TV without the service is not asked again');
})();

// 6. webOS 5 lists the rate and type as strings
(function testSublists() {
  delete require.cache[require.resolve('../server/lib/game')];
  game = require('../server/lib/game');
  game.init({ lunaCached: function (uri, payload, ttl, cb) { cache.get(uri, payload, ttl, cb); } });
  cache.forget();
  // As a CX (webOS 5.6) answers with a 4K60 source on HDMI 4.
  replies.w1 = { returnValue: true, port: 'HDMI4', pipelineId: 'w1', vrrInfo: {
    sublist_1: '60.0Hz', sublist_2: 'FIXED', sublist_3: '3840 x 2160P@60', sublist_4: 'YCBCR422 8b TM HDR10  ',
    sublist_5: '', sublist_6: '', sublist_7: '', sublist_8: '', sublist_9: '', sublist_10: '' } };
  var got = 'pending';
  game.read(HDMI4, function (r) { got = r; });
  running(BIND)[0].handlers.message({ returnValue: true, broadcastId: 'w1' });
  assert.deepEqual(got, { frameRate: 60, vrrType: 'off', port: 'HDMI4' });

  game.frameRate();
  running(VRR)[0].handlers.message(replies.w1);
  assert.deepEqual(game.frameRate(), { frameRate: 60, vrrType: 'off', port: 'HDMI4' });
  game.stop();
  console.log('  ✓ webOS 5\'s sublist strings give the rate, and FIXED reads as off');
})();

global.setTimeout = realSetTimeout;
global.clearTimeout = realClearTimeout;
console.log('ALL test-game.js assertions passed!\n');
