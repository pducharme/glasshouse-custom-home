/* Synthetic-only integration: the native Recommended toggle must preserve the custom layout. */
var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var home = require('../server/lib/home');
var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glasshouse-custom-recommended-'));
var calls = [], reads = 0, unavailable = false;
var apps = [
  { id: 'com.bell.fibetv.production', title: 'Bell Fibe TV' },
  { id: 'netflix', title: 'Netflix' },
  { id: 'cdp-30', title: 'Plex' },
  { id: 'com.haystacktv.app', title: 'News' },
  { id: 'com.immich.webos', title: 'Immich', icon: '/synthetic/immich.svg' }
];
function card(app, title, target) {
  return { type: 'content', titleText: title, category: 'Continue watching',
    image: { url: 'https://example.invalid/synthetic.jpg' },
    onClick: { targetAppId: app, contentId: target } };
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function luna(uri, payload, cb) {
  calls.push({ uri: uri, payload: clone(payload) });
  if (uri === 'com.webos.service.sdx/getHttpHeaderForServiceRequest') return cb({ returnValue: false });
  if (uri === 'com.webos.applicationManager/listLaunchPoints') return cb({ returnValue: true, launchPoints: apps });
  if (uri === 'com.webos.applicationManager/getAppInfo') return cb({ returnValue: false });
  if (uri === 'com.webos.service.eim/getAllInputStatus') return cb({ returnValue: true, devices: [] });
  if (uri === 'com.webos.service.apiadapter/tv/getChannelList') return cb({ returnValue: true, channelList: [] });
  if (uri === 'com.webos.applicationManager/launch') return cb({ returnValue: true });
  if (uri === 'com.webos.service.applicationmanager/getAllContents') {
    reads++;
    return cb(unavailable ? { returnValue: false } : { returnValue: true, allContents: [{ contents: [
      card('com.haystacktv.app', 'Hidden item', 'hidden'),
      card('netflix', 'Synthetic episode', 'episode'),
      card('cdp-30', 'Synthetic film', 'film'),
      card('org.example.notinstalled', 'Unknown app', 'missing')
    ] }] });
  }
  throw Error('Unexpected platform operation: ' + uri);
}
function call(method, body) {
  var result;
  if (body === undefined) home[method](function (r) { result = r; });
  else home[method](body, function (r) { result = r; });
  assert.ok(result, 'mock completes ' + method);
  return result;
}
function withoutRecommended(layout) { var v = clone(layout); delete v.recommended; return v; }
try {
  fs.writeFileSync(path.join(dir, 'home.json'), JSON.stringify({
    photosAppId: 'com.immich.webos', recommended: false, search: false,
    rows: ['app', 'dev', 'ch'], order: { app: ['com.bell.fibetv.production', 'cdp-30', 'netflix'], dev: ['hdmi4'] },
    hidden: { app: ['com.haystacktv.app'] }, colours: { text: '#ffffff', accent: '#4aa3df' },
    showClock: true, rowsBottom: true, showLastOn: false, showAppCount: false, showCec: false
  }));
  home.init({ stateDir: dir, luna: luna });
  var original = home.layout(), beforeReads = reads;
  assert.strictEqual(original.recommended, false);
  assert.deepStrictEqual(call('catalogue').recommended, []);
  assert.strictEqual(reads, beforeReads, 'off does not query recommendation contents');
  assert.strictEqual(call('open', { kind: 'rec', id: 'invented' }).ok, false);
  assert.strictEqual(reads, beforeReads, 'off does not open/read a recommendation');
  var changed = call('setLayout', { recommended: true });
  assert.strictEqual(changed.ok, true);
  assert.deepStrictEqual(withoutRecommended(changed.layout), withoutRecommended(original));
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'home.json'))).photosAppId, 'com.immich.webos');
  var catalog = call('catalogue');
  assert.deepStrictEqual(catalog.recommended.map(function (c) { return c.app; }), ['cdp-30', 'netflix'],
    'native filters hide News/uninstalled apps, order cards with app order');
  assert.strictEqual(catalog.photos.installed, true);
  assert.strictEqual(catalog.order.app[0], 'com.bell.fibetv.production');
  assert.strictEqual(call('open', { kind: 'rec', id: catalog.recommended[0].id }).ok, true);
  assert.deepStrictEqual(calls[calls.length - 1], { uri: 'com.webos.applicationManager/launch',
    payload: { id: 'cdp-30', params: { contentTarget: 'film' } } });
  assert.strictEqual(call('setLayout', { photosAppId: 'com.seeky91.immichtv' }).layout.recommended, true,
    'Photos edit preserves recommendation selection');
  assert.strictEqual(call('setLayout', { photosAppId: 'com.immich.webos' }).layout.recommended, true);
  assert.strictEqual(call('setLayout', { recommended: 'true' }).layout.recommended, true,
    'nonboolean input cannot change current recommendation setting');
  unavailable = true;
  catalog = call('catalogue');
  assert.deepStrictEqual(catalog.recommended, []);
  assert.strictEqual(catalog.sources.recommended, null);
  assert.strictEqual(catalog.photos.installed, true, 'unsupported recommendation service leaves Photos/apps available');
  changed = call('setLayout', { recommended: false });
  assert.deepStrictEqual(withoutRecommended(changed.layout), withoutRecommended(original));
  beforeReads = reads;
  assert.deepStrictEqual(call('catalogue').recommended, []);
  assert.strictEqual(reads, beforeReads, 'switching off stops subsequent content reads');
  console.log('Custom Photos/Bell/News layout and native Recommended integration passed.');
} finally {
  home.flush();
  fs.rmSync(dir, { recursive: true, force: true });
}
