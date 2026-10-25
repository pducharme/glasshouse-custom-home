/**
 * test/test-input-keys.js - HDMI inputs are keyed by their port whatever app
 * id the TV reports for them, so each gets a button the input command takes,
 * and the input on screen is still recognised under an unusual app id
 *
 * Strict ES5: runs on node 0.12.
 */
var assert = require('assert');
var telemetry = require('../server/lib/telemetry');
var state = require('../server/lib/state');

console.log('Running test-input-keys.js ...');

// As reported on a G5 (webOS 10): HDMI 3 under another app id, named "Sling
// TV". The id is a stand-in; the TV's own was not captured. The last entry is
// not an HDMI input and gets no button.
var DEVICES = [
  { id: 'HDMI_1', port: 1, appId: 'com.webos.app.hdmi1', label: 'HDMI 1' },
  { id: 'HDMI_2', port: 2, appId: 'com.webos.app.hdmi2', label: 'Apple TV' },
  { id: 'HDMI_3', port: 3, appId: 'com.sling.tv', label: 'Sling TV' },
  { id: 'HDMI_4', port: 4, label: 'HDMI 4' },
  { id: 'SLING', appId: 'com.sling.channels', label: 'Sling channels' }
];

telemetry.init({
  luna: function (uri, params, cb) {
    var r = { returnValue: true };
    if (uri === 'com.webos.service.eim/getAllInputStatus') r.devices = DEVICES;
    process.nextTick(function () { cb(r); });
  },
  lunaCached: function (uri, params, ttl, cb) { process.nextTick(function () { cb({ returnValue: true }); }); }
});

telemetry.refreshInputNames(function (map) {
  try {
    assert.deepEqual(map, { hdmi1: 'HDMI 1', hdmi2: 'Apple TV', hdmi3: 'Sling TV', hdmi4: 'HDMI 4' });
    console.log('  ✓ every HDMI input has a button keyed by its port, named as the TV names it');

    assert.strictEqual(telemetry.inputKey('com.sling.tv'), 'hdmi3');
    assert.strictEqual(telemetry.inputKey('com.webos.app.hdmi2'), 'hdmi2');
    assert.strictEqual(telemetry.inputKey('netflix'), 'netflix');
    console.log('  ✓ the input on screen is known by its port under an unusual app id');

    var values = state.applicationValues('com.sling.tv', map, telemetry.inputKey);
    assert.strictEqual(values.app, 'hdmi3');
    assert.strictEqual(values.app_id, 'com.sling.tv');
    assert.strictEqual(values.display_title, 'Sling TV (HDMI3)');
    console.log('  ✓ the live state names it as the input it is');
    console.log('ALL test-input-keys.js assertions passed!\n');
  } catch (e) {
    console.error('  ✗ ' + e.message);
    process.exit(1);
  }
});
