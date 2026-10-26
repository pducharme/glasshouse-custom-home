/**
 * test/test-oled-protections.js - The OLED protections and GSR stress count in
 * the cached panel stats
 */

var assert = require('assert');
var fs = require('fs');

console.log('Running test-oled-protections.js ...');

var PNWASH = '/mnt/lg/cmn_data/pnwash/';
var files = {};
var origExists = fs.existsSync;
var origRead = fs.readFileSync;
fs.existsSync = function (p) {
  if (String(p).indexOf('/mnt/lg/') === 0) return files.hasOwnProperty(p);
  return origExists.apply(fs, arguments);
};
fs.readFileSync = function (p) {
  if (String(p).indexOf('/mnt/lg/') === 0) {
    if (files.hasOwnProperty(p)) return files[p];
    throw new Error('ENOENT');
  }
  return origRead.apply(fs, arguments);
};

// services maps a luna method to its reply; one not listed fails as a TV
// without it does.
function refresh(services, markers) {
  files = markers || {};
  var calls = [];
  delete require.cache[require.resolve('../server/lib/oled')];
  var oled = require('../server/lib/oled');
  oled.init({
    config: {},
    luna: function (uri, params, cb) {
      calls.push(uri);
      cb(services[uri] || { returnValue: false });
    }
  });
  var result;
  oled.refreshOledStats(null, null, function (o) { result = o; });
  return { oled: oled, stats: result, calls: calls };
}

var EPL = 'com.webos.service.oledepl/';

(function testLiveService() {
  // The service wins over a marker that says otherwise.
  var markers = {};
  markers[PNWASH + 'autoOffRsInterval'] = '4';
  markers[PNWASH + 'gsrOff'] = '';
  var r = refresh({
    'com.webos.service.oledepl/getGlobalStressReduction': { returnValue: true, enable: true, stressCount: 7 },
    'com.webos.service.oledepl/getTemporalPeakControl': { returnValue: true, enable: false }
  }, markers);
  assert.strictEqual(r.stats.gsr_enabled, true);
  assert.strictEqual(r.stats.tpc_enabled, false);
  assert.strictEqual(r.stats.gsr_stress_count, 7);
  assert.strictEqual(r.stats.gsr_protection, 'Disabled', 'the marker is still reported as read');
  assert.strictEqual(r.oled.oledProtControllable(), true);

  // Within the cache interval the stats are served without asking the TV.
  var before = r.calls.length;
  r.oled.refreshOledStats(null, null, function (o) { assert.strictEqual(o.gsr_stress_count, 7); });
  assert.strictEqual(r.calls.length, before);
  assert.ok(r.calls.indexOf(EPL + 'getGlobalStressReduction') !== -1);
  console.log('  ✓ the live service is read into the cached stats, and wins over the markers');
})();

(function testMarkerFallback() {
  var markers = {};
  markers[PNWASH + 'autoOffRsInterval'] = '4';
  markers[PNWASH + 'tpcOff'] = '';
  var r = refresh({}, markers);
  assert.strictEqual(r.stats.gsr_enabled, true);
  assert.strictEqual(r.stats.tpc_enabled, false);
  assert.strictEqual(r.stats.gsr_stress_count, null, 'a TV without the service has no stress count');
  assert.strictEqual(r.stats.asbl_protection, 'Disabled');
  console.log('  ✓ without the service, the marker files decide');
})();

(function testSocTpcStatus() {
  // socTpcStatus sits at 0 between dimming checks whatever the setting.
  var markers = {};
  markers[PNWASH + 'socTpcStatus'] = '0';
  var r = refresh({}, markers);
  assert.strictEqual(r.stats.asbl_protection, 'Active');
  assert.strictEqual(r.stats.tpc_enabled, true);

  markers[PNWASH + 'tpcOff'] = '';
  r = refresh({}, markers);
  assert.strictEqual(r.stats.asbl_protection, 'Disabled');
  assert.strictEqual(r.stats.tpc_enabled, false);
  console.log('  ✓ socTpcStatus is the dimming state, not the setting; tpcOff alone turns ASBL off');
})();

(function testNeither() {
  // A B8 writes no marker, which is not the protections being off.
  var r = refresh({}, {});
  assert.strictEqual(r.stats.gsr_enabled, null);
  assert.strictEqual(r.stats.tpc_enabled, null);
  assert.strictEqual(r.stats.gsr_stress_count, null);
  console.log('  ✓ with neither the service nor a marker, the protections are not reported');
})();

fs.existsSync = origExists;
fs.readFileSync = origRead;
console.log('ALL test-oled-protections.js assertions passed!');
