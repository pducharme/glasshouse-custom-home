// Strict ES5 - node v0.12.2 on webOS 4.
var fetch = require('./fetch');
var FRESH_MS = 15 * 60 * 1000, MAX_AGE_MS = 60 * 60 * 1000, RETRY_MS = 60 * 1000;
var CODES = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
var active = null;

function number(n) { return typeof n === 'number' && isFinite(n); }

function result(state, now) {
  var cached = state.cached, freshUntil = state.freshUntil;
  if (!cached || now - cached.observedAt > MAX_AGE_MS || cached.observedAt - now > 5 * 60 * 1000) {
    return { ok: false, error: 'weather unavailable' };
  }
  return { ok: true, temperature: cached.temperature, code: cached.code, isDay: cached.isDay,
    observedAt: cached.observedAt, label: state.label, stale: now >= freshUntil || now - cached.observedAt > FRESH_MS };
}

function settings(options) {
  if (!options || options.enabled !== true || !number(options.latitude) || !number(options.longitude) ||
      options.latitude < -90 || options.latitude > 90 || options.longitude < -180 || options.longitude > 180 ||
      typeof options.timezone !== 'string' || !/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(options.timezone) || options.timezone.length > 64 ||
      typeof options.label !== 'string' || !options.label.trim() || options.label.length > 80 || /[\x00-\x1f\x7f]/.test(options.label)) return null;
  return { label: options.label.trim(), url: 'https://api.open-meteo.com/v1/forecast?latitude=' + options.latitude +
    '&longitude=' + options.longitude + '&current=temperature_2m,weather_code,is_day&temperature_unit=celsius&timeformat=unixtime&timezone=' +
    encodeURIComponent(options.timezone) };
}

function get(cb, options) {
  var configured = settings(options);
  if (!configured) return cb({ ok: false, error: 'weather is not configured' });
  var key = configured.url + '\n' + configured.label;
  if (!active || active.key !== key) active = { key: key, label: configured.label, cached: null, freshUntil: 0, nextAttempt: 0, waiting: null };
  var state = active, now = Date.now();
  if (now < state.nextAttempt) return cb(result(state, now));
  if (state.waiting) { state.waiting.push(cb); return; }
  state.waiting = [cb];
  fetch.getJson(configured.url, function (err, data) {
    now = Date.now();
    var c = data && data.current, observedAt = c && c.time * 1000;
    var valid = !err && c && number(c.temperature_2m) && c.temperature_2m >= -100 && c.temperature_2m <= 70 &&
      CODES.indexOf(c.weather_code) !== -1 && (c.is_day === 0 || c.is_day === 1) &&
      number(c.time) && c.time % 1 === 0 && observedAt - now <= 5 * 60 * 1000 && now - observedAt <= MAX_AGE_MS;
    if (valid) {
      state.cached = { temperature: c.temperature_2m, code: c.weather_code, isDay: c.is_day === 1, observedAt: observedAt };
      state.freshUntil = now + FRESH_MS;
    } else {
      state.freshUntil = 0;
    }
    state.nextAttempt = now + (valid ? FRESH_MS : RETRY_MS);
    var callbacks = state.waiting;
    state.waiting = null;
    callbacks.forEach(function (done) { done(result(state, now)); });
  });
}

module.exports = { get: get };
