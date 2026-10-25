// Deterministic weather/cache checks; no network or TV access.
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var source = fs.readFileSync(path.join(__dirname, '../server/lib/home-weather.js'), 'utf8');
var now = Date.UTC(2026, 9, 22, 16), requests, weather, rawWeather;
var options = { enabled: true, latitude: 0, longitude: 0, timezone: 'Etc/UTC', label: 'Example location' };
var MINUTE = 60000;

function reset() {
  requests = [];
  var context = { module: { exports: {} }, Date: { now: function () { return now; } },
    require: function (name) {
      assert.strictEqual(name, './fetch');
      return { getJson: function (url, cb) { requests.push({ url: url, cb: cb }); } };
    }
  };
  vm.runInNewContext(source, context);
  rawWeather = context.module.exports;
  weather = { get: function (cb) { rawWeather.get(cb, options); } };
}
function current(changes) {
  var c = { temperature_2m: 8.4, weather_code: 3, is_day: 1, time: Math.floor(now / 1000) };
  Object.keys(changes || {}).forEach(function (key) { c[key] = changes[key]; });
  return { current: c };
}
function get() {
  var answer;
  weather.get(function (r) { answer = r; });
  return answer;
}

reset();
var replies = [];
weather.get(function (r) { replies.push(r); });
weather.get(function (r) { replies.push(r); });
assert.strictEqual(requests.length, 1, 'concurrent callers share one upstream request');
assert.ok(/latitude=0&longitude=0/.test(requests[0].url));
assert.ok(/timeformat=unixtime/.test(requests[0].url));
requests[0].cb(null, current());
assert.strictEqual(replies.length, 2);
assert.strictEqual(replies[0].temperature, 8.4);
assert.strictEqual(replies[0].observedAt, now, 'API timestamps become milliseconds');
assert.strictEqual(replies[0].isDay, true);
assert.strictEqual(replies[0].stale, false);
now += 15 * MINUTE - 1;
assert.strictEqual(get().ok, true);
assert.strictEqual(requests.length, 1, 'cache lasts fifteen minutes');
now += 1;
assert.strictEqual(get(), undefined);
assert.strictEqual(requests.length, 2);
requests[1].cb(new Error('offline'));
assert.strictEqual(get().stale, true, 'failed refresh exposes last good observation as stale');
assert.strictEqual(requests.length, 2, 'failures back off');
now += MINUTE;
get();
assert.strictEqual(requests.length, 3, 'one minute later may retry');
requests[2].cb(new Error('still offline'));
now = replies[0].observedAt + 60 * MINUTE;
var boundary;
weather.get(function (r) { boundary = r; });
requests[3].cb(new Error('offline'));
assert.strictEqual(boundary.ok, true, 'exactly one hour remains usable');
assert.strictEqual(boundary.stale, true);
now += 1;
assert.strictEqual(get().ok, false, 'older than one hour never returns a temperature');
assert.strictEqual(get().temperature, undefined);

[
  { temperature_2m: null }, { temperature_2m: '8.4' }, { temperature_2m: Infinity },
  { temperature_2m: 100 }, { weather_code: 4 }, { weather_code: '3' }, { is_day: 2 },
  { time: null }, { time: String(now / 1000) }, { time: Math.floor((now + 6 * MINUTE) / 1000) },
  { time: Math.floor((now - 61 * MINUTE) / 1000) }
].forEach(function (bad) {
  reset();
  var answer;
  weather.get(function (r) { answer = r; });
  requests[0].cb(null, current(bad));
  assert.strictEqual(answer.ok, false, 'reject malformed or implausible provider data');
  assert.strictEqual(get().ok, false);
  assert.strictEqual(requests.length, 1, 'invalid responses also back off');
});
reset();
var night;
weather.get(function (r) { night = r; });
requests[0].cb(new Error('offline'));
assert.strictEqual(night.ok, false, 'offline without history never invents a value');
assert.strictEqual(night.temperature, undefined);
reset();
weather.get(function (r) { night = r; });
requests[0].cb(null, current({ temperature_2m: 0, weather_code: 0, is_day: 0, time: Math.floor(now / 1000) }));
assert.strictEqual(night.temperature, 0, 'zero is a valid real temperature');
assert.strictEqual(night.isDay, false);
reset();
weather.get(function (r) { night = r; });
requests[0].cb(null, current({ time: Math.floor((now - 30 * MINUTE) / 1000) }));
assert.strictEqual(night.stale, true, 'a newly fetched older observation is still marked stale');
reset();
[undefined, {}, { enabled: false }, { enabled: true, latitude: '0', longitude: 0, timezone: 'UTC', label: 'Example' },
  { enabled: true, latitude: 91, longitude: 0, timezone: 'UTC', label: 'Example' },
  { enabled: true, latitude: 0, longitude: -181, timezone: 'UTC', label: 'Example' },
  { enabled: true, latitude: 0, longitude: 0, timezone: 'UTC&injected=true', label: 'Example' },
  { enabled: true, latitude: 0, longitude: 0, timezone: 'UTC', label: '' }
].forEach(function (invalid) {
  var reply;
  rawWeather.get(function (r) { reply = r; }, invalid);
  assert.strictEqual(reply.ok, false, 'missing, disabled and invalid configuration does not fetch');
});
assert.strictEqual(requests.length, 0);
var firstLocation, secondLocation;
rawWeather.get(function (r) { firstLocation = r; }, options);
rawWeather.get(function (r) { secondLocation = r; }, { enabled: true, latitude: 1, longitude: 1, timezone: 'UTC', label: 'Another example' });
assert.strictEqual(requests.length, 2, 'different settings do not share requests or cached observations');
requests[1].cb(null, current({ temperature_2m: 22 }));
requests[0].cb(null, current({ temperature_2m: 11 }));
assert.strictEqual(firstLocation.temperature, 11);
assert.strictEqual(firstLocation.label, 'Example location');
assert.strictEqual(secondLocation.temperature, 22);
assert.strictEqual(secondLocation.label, 'Another example');
console.log('All home weather tests passed.');
