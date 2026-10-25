/**
 * test/test-hdmi-map.js - Each HDMI input's signal comes from its own
 * receiver, by the input map in configd, and never from another input's
 *
 * Its own suite: telemetry remembers the map for good. The status files are
 * a C4's (webOS 9) with a PC at 4K 120 Hz on HDMI 4 and a streamer at 1080p
 * on HDMI 1; its input map puts HDMI 1 to 4 on receivers 3, 2, 1 and 0. A
 * C9's (webOS 4.10), whose configd has no map, have an Apple TV at 4K 50 Hz
 * on HDMI 4 and a soundbar at 1080p 30 Hz on HDMI 2.
 *
 * Strict ES5: runs on node 0.12.
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

function statusFiles(tv) {
  var files = {};
  for (var p = 0; p < 4; p++) {
    files['/proc/lg/hdmi20/port' + p + '/status'] =
      fs.readFileSync(path.join(__dirname, 'fixtures', 'hdmi20-' + tv, 'port' + p + '.status'), 'utf8');
  }
  return files;
}

var mockEnv = require('./mocks/mock-env').createMockEnv({ files: statusFiles('c4') });
mockEnv.install();

console.log('Running test-hdmi-map.js ...');

var C4_INPUT_MAP = {
  returnValue: true,
  configs: {
    'inputMap.videoInputMapIndexInfo0': [{
      maxHdmiCount: 4, maxCompCount: 1, maxAvCount: 1,
      assignment: { hdmi1: '3', hdmi2: '2', hdmi3: '1', hdmi4: '0', av1: '2', comp1: '1' }
    }]
  }
};

mockEnv.luna['com.webos.service.eim/getAllInputStatus'] = {
  returnValue: true,
  devices: [
    { id: 'HDMI_1', port: 1, label: 'Streamer', activate: true, hdmiPlugIn: true },
    { id: 'HDMI_2', port: 2, label: 'HDMI 2', activate: false },
    { id: 'HDMI_3', port: 3, label: 'HDMI 3', activate: false },
    { id: 'HDMI_4', port: 4, label: 'PC', activate: true, hdmiPlugIn: true }
  ]
};

var configdCalls = 0;
function load(configd) {
  configdCalls = 0;
  mockEnv.luna['com.webos.service.config/getConfigs'] = function (payload) {
    if (payload && payload.configNames && payload.configNames[0].indexOf('inputMap.') === 0) {
      configdCalls++;
      return configd;
    }
    return { returnValue: true, configs: { 'tv.model.logoLight': false } };
  };
  delete require.cache[require.resolve('../server/lib/telemetry')];
  var telemetry = require('../server/lib/telemetry');
  telemetry.init({
    // null stands for configd not answering at all, as a timed-out luna-send.
    luna: function (uri, payload, cb) {
      if (configd === null && uri === 'com.webos.service.config/getConfigs' &&
          payload.configNames[0].indexOf('inputMap.') === 0) {
        configdCalls++;
        return process.nextTick(function () { cb(null, ''); });
      }
      mockEnv.mockLuna(uri, payload, cb);
    },
    lunaCached: mockEnv.mockLunaCached,
    config: { port: 8080, allowControl: true },
    oled: { detectOled: function (cb) { cb(true); }, getIsOled: function () { return true; },
            refreshOledStats: function (s, ps, cb) { cb({}); } },
    privacy: { isAdBlockActive: function () { return false; }, collectPrivacy: function (cb) { cb({}); } },
    screensavers: { screensaverMode: function () { return 'stock'; }, screensaverLevel: function () { return 'dim'; }, launchedShowing: function () { return false; } },
    tvwebVersion: '0.0.0'
  });
  return telemetry;
}

function onScreen(app) {
  mockEnv.luna['com.webos.applicationManager/getForegroundAppInfo'] = { returnValue: true, appId: app };
}

// collectStats swallows what its callbacks throw, so a failure exits here.
function checked(fn) {
  return function (arg) {
    try { fn(arg); } catch (e) {
      console.error('  ✗ ' + e.message);
      process.exit(1);
    }
  };
}

function statsOn(telemetry, app, cb) {
  onScreen(app);
  telemetry.clearCache();
  telemetry.collectStats(checked(cb));
}

var c4 = load(C4_INPUT_MAP);
c4.hdmiReceiverMap(checked(function (map) {
  assert.deepEqual(map, { 1: 3, 2: 2, 3: 1, 4: 0 });

  statsOn(c4, 'com.webos.app.hdmi1', function (s1) {
    assert.strictEqual(s1.signal, '1920x1080 @ 60Hz', 'HDMI 1 is the streamer on receiver 3');
    assert.strictEqual(s1.hdmi_diag.port, 3);
    assert.strictEqual(s1.hdmi_diag.phy_mode, 'TMDS (3G)');
    assert.strictEqual(s1.hdmi_diag.hdcp, 'HDCP 2.3');

    statsOn(c4, 'com.webos.app.hdmi4', function (s4) {
      assert.strictEqual(s4.signal, '3840x2160 @ 120Hz', 'HDMI 4 is the PC on receiver 0');
      assert.strictEqual(s4.hdmi_diag.port, 0);
      assert.strictEqual(s4.hdmi_diag.phy_mode, 'FRL 48 Gbps');

      statsOn(c4, 'com.webos.app.hdmi3', function (s3) {
        assert.strictEqual(s3.signal, null, 'HDMI 3 has nothing on receiver 1, and takes no other input\'s signal');
        assert.strictEqual(s3.signal_timing, null);
        assert.strictEqual(s3.hdmi_diag, null);
        assert.strictEqual(configdCalls, 1, 'the map is asked for once');
        console.log('  ✓ an input\'s signal comes from the receiver the input map gives it');

        // Every input with a link, whichever is on screen; HDMI 2 and 3 have none.
        assert.deepEqual(s3.hdmi_links, [
          { input: 1, receiver: 3, phy_mode: '3G', chroma: 'Y422', hdcp: 'HDCP23', tmds_clock_khz: 148500, qms: false },
          { input: 4, receiver: 0, phy_mode: 'FRL 12G 4L(R6)', chroma: 'R444', hdcp: 'HDCP0', tmds_clock_khz: null, qms: false }
        ]);
        var lines = require('../server/lib/prometheus').render(s3, '').split('\n').filter(function (l) {
          return /^glasshouse_hdmi_/.test(l);
        });
        // The fixture's inputs have no appId, and are named by their port.
        assert.deepEqual(lines, [
          'glasshouse_hdmi_input_info{input="hdmi1",app_id="com.webos.app.hdmi1",name="Streamer"} 1',
          'glasshouse_hdmi_input_info{input="hdmi2",app_id="com.webos.app.hdmi2",name="HDMI 2"} 1',
          'glasshouse_hdmi_input_info{input="hdmi3",app_id="com.webos.app.hdmi3",name="HDMI 3"} 1',
          'glasshouse_hdmi_input_info{input="hdmi4",app_id="com.webos.app.hdmi4",name="PC"} 1',
          'glasshouse_hdmi_link_info{input="hdmi1",phy_mode="tmds_3g",chroma="ycbcr_422",hdcp="2_3"} 1',
          'glasshouse_hdmi_link_info{input="hdmi4",phy_mode="frl_48",chroma="rgb_444",hdcp="none"} 1',
          'glasshouse_hdmi_link_bits_per_second{input="hdmi1"} 4455000000',
          'glasshouse_hdmi_link_bits_per_second{input="hdmi4"} 48000000000',
          'glasshouse_hdmi_qms{input="hdmi1"} 0',
          'glasshouse_hdmi_qms{input="hdmi4"} 0',
          'glasshouse_hdmi_source_powered{input="hdmi1"} 1',
          'glasshouse_hdmi_source_powered{input="hdmi2"} 0',
          'glasshouse_hdmi_source_powered{input="hdmi3"} 0',
          'glasshouse_hdmi_source_powered{input="hdmi4"} 1'
        ]);
        console.log('  ✓ every input with a link is in the stats and the metrics, by its input number');
        // A PC at 1080p 60 over TMDS: the rate follows the colour depth.
        [['8', 4455000000], ['10', 5568600000], ['12', 6682500000]].forEach(function (d) {
          var deep = fs.readFileSync(path.join(__dirname, 'fixtures', 'hdmi20-c4', 'port0-1080p-' + d[0] + 'bit.status'), 'utf8');
          var rendered = require('../server/lib/prometheus').render({ hdmi_links: c4.hdmiLinks([deep, null, null, null], { 4: 0 }) }, '');
          assert.ok(rendered.indexOf('glasshouse_hdmi_link_bits_per_second{input="hdmi4"} ' + d[1] + '\n') !== -1, d[0] + '-bit:\n' + rendered);
          assert.ok(rendered.indexOf('phy_mode="tmds_3g"') !== -1);
        });
        // The HDMI 2.0 driver's receivers, as a B8's, have no link lines.
        assert.deepEqual(c4.hdmiLinks(['horizontal-active: 3840\nvertical-active: 2160\nconnected: on\n', null, null, null],
          { 1: 0, 2: 1, 3: 2, 4: 3 }), []);

        c4.hdmiInputs(checked(function (r) {
          assert.strictEqual(r.inputs[0].signal.port, 3);
          assert.strictEqual(r.inputs[0].signal.resolution, '1920x1080');
          assert.strictEqual(r.inputs[1].signal, null);
          assert.strictEqual(r.inputs[2].signal, null);
          assert.strictEqual(r.inputs[3].signal.port, 0);
          assert.strictEqual(r.inputs[3].signal.refreshHz, 120);
          console.log('  ✓ /api/hdmi pairs every input with its receiver, with two sources live');
          assert.strictEqual(r.inputs[0].signal.pixelClockMhz, 148.5, 'TMDS: Pixel Clk[0000148500]');
          assert.strictEqual(r.inputs[3].signal.pixelClockMhz, 1188, 'FRL: 4400 x 2250 x 120');
          console.log('  ✓ the pixel clock is the Pixel Clk field on TMDS and from the totals on FRL');

          noMap();
        }));
      });
    });
  });
}));

// A TV whose configd has no map takes the base table, HDMI 1 to 4 on
// receivers 3, 2, 1 and 0.
function noMap() {
  var noMapTv = load({ returnValue: true, configs: {}, missingConfigs: ['inputMap.videoInputMapIndexInfo0'] });
  statsOn(noMapTv, 'com.webos.app.hdmi2', function (s2) {
    assert.strictEqual(s2.signal, null, 'receiver 2 is idle, and the PC on 0 is not HDMI 2');
    assert.strictEqual(s2.hdmi_diag, null);
    assert.strictEqual(configdCalls, 1, 'an answer without a map is remembered too');
    console.log('  ✓ without a map, HDMI 2 takes nothing from receiver 0');
    c9();
  });
}

// A C9's HDMI 2.0 driver: no link lines and no 5V field.
function c9() {
  var files = statusFiles('c9');
  for (var f in files) mockEnv.files[f] = files[f];
  var t = load({ returnValue: true, configs: {}, missingConfigs: ['inputMap.videoInputMapIndexInfo0'] });
  statsOn(t, 'com.webos.app.hdmi4', function (s4) {
    assert.strictEqual(s4.signal, '3840x2160 @ 50Hz', 'HDMI 4 is the Apple TV on receiver 0');
    assert.deepEqual(s4.signal_timing, { width: 3840, height: 2160, refresh_hz: 50 });
    assert.strictEqual(s4.hdmi_diag.port, 0);
    assert.deepEqual(s4.hdmi_links, [], 'no link lines, no links');
    assert.deepEqual(s4.hdmi_sources, [], 'no 5V field, no sources');
    var lines = require('../server/lib/prometheus').render(s4, '').split('\n').filter(function (l) {
      return /^glasshouse_hdmi_(link|qms|source)/.test(l);
    });
    assert.deepEqual(lines, []);
    statsOn(t, 'com.webos.app.hdmi2', function (s2) {
      assert.strictEqual(s2.signal, '1920x1080 @ 30Hz', 'HDMI 2 is the soundbar on receiver 2');
      assert.strictEqual(s2.hdmi_diag.port, 2);
      console.log('  ✓ without a map, a C9\'s HDMI 4 is read from receiver 0 and HDMI 2 from receiver 2');
      t.hdmiInputs(checked(function (r) {
        assert.strictEqual(r.inputs[0].signal, null);
        assert.strictEqual(r.inputs[1].signal.port, 2);
        assert.strictEqual(r.inputs[1].signal.resolution, '1920x1080');
        assert.strictEqual(r.inputs[2].signal, null);
        assert.strictEqual(r.inputs[3].signal.port, 0);
        assert.strictEqual(r.inputs[3].signal.refreshHz, 50);
        console.log('  ✓ /api/hdmi pairs the inputs by the same table');
        unanswered();
      }));
    });
  });
}

var BASE_MAP = { 1: 3, 2: 2, 3: 1, 4: 0 };

// No answer is asked again, rather than remembered as no map; a refusal is not.
function unanswered() {
  var t = load(null);
  t.hdmiReceiverMap(checked(function (map) {
    assert.deepEqual(map, BASE_MAP, 'the base table meanwhile');
    t.hdmiReceiverMap(checked(function (map2) {
      assert.deepEqual(map2, BASE_MAP, 'still no answer');
      assert.strictEqual(configdCalls, 2, 'asked again after no answer');
      var refused = load({ returnValue: false, errorText: 'Unknown method' });
      refused.hdmiReceiverMap(checked(function () {
        refused.hdmiReceiverMap(checked(function (map3) {
          assert.deepEqual(map3, BASE_MAP);
          assert.strictEqual(configdCalls, 1, 'a refusal is remembered');
          console.log('  ✓ the map is asked for again until configd answers, and a refusal is final');
          absentInput();
        }));
      }));
    }));
  }));
}

function absentInput() {
  var t = load({
    returnValue: true,
    configs: { 'inputMap.videoInputMapIndexInfo0': [{ assignment: { hdmi1: '3', hdmi2: '2', hdmi3: '1', hdmi4: 'none' } }] }
  });
  t.hdmiReceiverMap(checked(function (map) {
    assert.strictEqual(map[4], null);
    statsOn(t, 'com.webos.app.hdmi4', function (s4) {
      assert.strictEqual(s4.signal, null, 'an input the board does not have has no receiver');
      console.log('  ✓ an input the map marks none has no signal');
      mockEnv.restore();
    });
  }));
}
