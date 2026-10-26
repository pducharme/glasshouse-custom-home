/* Photos only launches a configured, installed client; no media server or credentials. */
var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var home = require('../server/lib/home');
var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glasshouse-photos-'));
var calls, installed, refused;
var clients = ['com.immich.webos', 'com.seeky91.immichtv'];
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function setup(id, apps) {
  calls = []; installed = apps || []; refused = false;
  fs.writeFileSync(path.join(dir, 'home.json'), JSON.stringify({ photosAppId: id }));
  home.init({ stateDir: dir, luna: function (uri, payload, cb) {
    calls.push({ uri: uri, payload: copy(payload) });
    if (uri === 'com.webos.applicationManager/listLaunchPoints') return cb({ returnValue: true, launchPoints: installed });
    if (uri === 'com.webos.applicationManager/getAppInfo') return cb({ returnValue: false });
    if (uri === 'com.webos.service.eim/getAllInputStatus') return cb({ returnValue: true, devices: [] });
    if (uri === 'com.webos.service.apiadapter/tv/getChannelList') return cb({ returnValue: true, channelList: [] });
    if (uri === 'com.webos.applicationManager/launch') return cb({ returnValue: !refused });
    throw new Error('Unexpected platform operation: ' + uri);
  } });
}
function call(method, body) {
  var result;
  if (body === undefined) home[method](function (r) { result = r; });
  else home[method](body, function (r) { result = r; });
  assert.ok(result, 'mock platform completes ' + method);
  return result;
}
function launches() { return calls.filter(function (c) { return c.uri === 'com.webos.applicationManager/launch'; }); }
try {
  assert.strictEqual(home.normalise(null).photosAppId, '');
  ['', 'https://example.invalid', 'com.webos.app.browser', '../config', {}, [], null, 1].forEach(function (id) {
    assert.strictEqual(home.normalise({ photosAppId: id }).photosAppId, '', 'unsupported IDs normalize to nonconfigured');
  });
  clients.forEach(function (id) { assert.strictEqual(home.normalise({ photosAppId: id }).photosAppId, id); });
  setup('', [{ id: clients[0], title: 'Immich' }]);
  assert.strictEqual(call('open', { kind: 'photos', id: clients[0], url: 'https://example.invalid' }).ok, false);
  assert.strictEqual(calls.length, 0, 'nonconfigured Photos does not even query installed apps');
  assert.deepStrictEqual(call('catalogue').photos, { appId: '', installed: false, icon: null }, 'installation alone never opts in');

  clients.forEach(function (id) {
    setup(id, [{ id: id, title: 'Immich', icon: '/synthetic/immich.png' }, { id: 'netflix', title: 'Netflix' }]);
    assert.strictEqual(home.layout().photosAppId, id);
    assert.deepStrictEqual(call('catalogue').photos,
      { appId: id, installed: true, icon: '/api/home/icon?id=' + encodeURIComponent(id) });
    assert.strictEqual(call('open', { kind: 'photos', id: 'netflix', params: { url: 'https://example.invalid' } }).ok, true);
    assert.deepStrictEqual(launches(), [{ uri: 'com.webos.applicationManager/launch', payload: { id: id } }],
      'request fields cannot replace the configured target or inject launch parameters');
    assert.strictEqual(call('setLayout', { hintSeen: true }).layout.photosAppId, id, 'ordinary edits retain Photos');
    assert.strictEqual(call('setLayout', { reset: true }).layout.photosAppId, id, 'row reset retains Photos');
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'home.json'), 'utf8')).photosAppId, id);
    var before = fs.readFileSync(path.join(dir, 'home.json'), 'utf8');
    ['https://example.invalid', 'netflix', null, {}, []].forEach(function (invalid) {
      assert.strictEqual(call('setLayout', { photosAppId: invalid }).ok, false);
      assert.strictEqual(fs.readFileSync(path.join(dir, 'home.json'), 'utf8'), before, 'invalid values are not written');
    });
    refused = true;
    assert.strictEqual(call('open', { kind: 'photos' }).ok, false, 'client launch failure remains visible');
    assert.strictEqual(call('setLayout', { photosAppId: '' }).layout.photosAppId, '', 'explicit empty string disconnects launcher');
    var count = calls.length;
    assert.strictEqual(call('open', { kind: 'photos' }).ok, false);
    assert.strictEqual(calls.length, count, 'disconnected launcher makes no platform calls');
  });

  setup(clients[0], [{ id: 'netflix', title: 'Netflix' }]);
  assert.deepStrictEqual(call('catalogue').photos, { appId: clients[0], installed: false, icon: null });
  assert.strictEqual(call('open', { kind: 'photos' }).ok, false);
  assert.strictEqual(launches().length, 0, 'missing configured app is never installed or substituted');
  assert.strictEqual(call('open', { kind: 'app', id: 'netflix' }).ok, true, 'ordinary installed app launching is unchanged');
  assert.strictEqual(launches()[0].payload.id, 'netflix');

  setup(clients[0], [{ id: clients[0], title: 'Immich', visible: false }]);
  assert.strictEqual(call('catalogue').photos.installed, false, 'nonlaunchable platform entries are unavailable');
  assert.strictEqual(call('open', { kind: 'photos' }).ok, false);
  assert.strictEqual(launches().length, 0);
  console.log('Photos launcher configuration and isolation tests passed.');
} finally {
  home.flush();
  fs.rmSync(dir, { recursive: true, force: true });
}
