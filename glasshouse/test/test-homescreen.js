/**
 * test/test-homescreen.js - LG's Home screen parts are hidden by writing a
 * copy of its own layout without them, input tiles are added and taken off as
 * LG's launch points, and putting LG's Home screen back removes only what was
 * added here
 *
 * Strict ES5: runs on node 0.12.
 */
var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var childProcess = require('child_process');

console.log('Running test-homescreen.js ...');

// LG's built-in layout, as a C2 (webOS 9.2.2) has it.
var LG_LAYOUT = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<home version="2.0">',
  '    <layout type="ShelfView" vMargin="30">',
  '        <firstPage>',
  '             <item type="Hero" itemX="10" itemY="24" uiWidth="1896" uiHeight="450"  itemWidth="1896" itemHeight="488" itemVideoWidth="1746" itemVideoHeight="450" focus="true" topGlobalOption="vertical"/>',
  '             <item type="Qcard" itemX="24" itemY="770" itemWidth="1872" itemHeight="120" focus="true" option="simple"/>',
  '             <item type="AppList" itemX="24" itemY="850" itemWidth="1872" itemHeight="173" focus="true" option="webOS24"/>',
  '             <item type="AdShelf" itemX="430" itemY="220" itemWidth="1920" itemHeight="350"/>',
  '        </firstPage>',
  '    </layout>',
  '</home>',
  ''
].join('\n');

var root = fs.mkdtempSync ? fs.mkdtempSync(path.join(os.tmpdir(), 'gh-home-')) :
  path.join(os.tmpdir(), 'gh-home-' + process.pid);
function mkdirp(p) { p.split(path.sep).reduce(function (acc, part) { acc = acc ? path.join(acc, part) : (part || path.sep); try { fs.mkdirSync(acc); } catch (e) {} return acc; }, ''); }
var homeDir = path.join(root, 'qml');
var layoutDir = path.join(root, 'manifest');
var stateDir = path.join(root, 'state');
var checkpoints = [path.join(root, 'tmpcp'), path.join(root, 'flashcp')];
mkdirp(path.join(homeDir, 'UserInterfaceLayer', 'Containers'));
mkdirp(stateDir);
checkpoints.forEach(function (d) { mkdirp(path.join(d, 'com.webos.app.home')); });
fs.writeFileSync(path.join(homeDir, 'UserInterfaceLayer', 'home_layoutShelfView.xml'), LG_LAYOUT);
fs.writeFileSync(path.join(homeDir, 'UserInterfaceLayer', 'Containers', 'MainView_M.qml'),
  'property var xmlResources: ({ path: "' + layoutDir + '/", defaultPath: "../" })\n');

// The home app restart runs a shell command: recorded, not run.
var shellRuns = [];
childProcess.execFile = function (file, args, opts, cb) {
  shellRuns.push(args[1]);
  process.nextTick(function () { cb(null, '', ''); });
};

var hs = require('../server/lib/homescreen');

// The TV's launch points, and every call made.
var tv;
function freshTv() {
  tv = { lps: [
    { launchPointId: 'youtube.leanback.v4_default', id: 'youtube.leanback.v4' },
    { launchPointId: '900', id: 'com.webos.app.hdmi3' } // added on the TV itself
  ], calls: [], next: 100 };
}
function luna(uri, params, cb) {
  tv.calls.push({ uri: uri, params: params });
  var r = { returnValue: true };
  var method = uri.split('/').pop();
  if (method === 'listLaunchPoints') r.launchPoints = tv.lps.slice();
  else if (method === 'addLaunchPoint') { r.launchPointId = String(tv.next++); tv.lps.push({ launchPointId: r.launchPointId, id: params.id, title: params.title, titleVisible: params.titleVisible }); }
  else if (method === 'getAllInputStatus') {
    r = tv.devices ? { returnValue: true, devices: tv.devices } : { returnValue: false };
  }
  else if (method === 'updateLaunchPoint') {
    tv.lps.forEach(function (p) {
      if (p.launchPointId === params.launchPointId) { p.title = params.title; p.titleVisible = params.titleVisible; }
    });
  }
  else if (method === 'removeLaunchPoint') tv.lps = tv.lps.filter(function (p) { return p.launchPointId !== params.launchPointId; });
  else if (method === 'moveLaunchPoint') {
    var at = -1;
    tv.lps.forEach(function (p, i) { if (p.launchPointId === params.launchPointId) at = i; });
    if (at !== -1) tv.lps.splice(params.position, 0, tv.lps.splice(at, 1)[0]);
  }
  else if (method === 'getForegroundAppInfo') r.appId = 'com.webos.app.hdmi2';
  process.nextTick(function () { cb(r); });
}
freshTv();

function setup(version) {
  hs.init({ luna: luna, inputNames: { hdmi2: 'Mac' }, stateDir: stateDir, webosVersion: version,
            homeDir: homeDir, layoutDir: layoutDir, checkpointDirs: checkpoints });
}
function ourLayout() {
  try { return fs.readFileSync(path.join(layoutDir, 'home_layoutShelfView.xml'), 'utf8'); } catch (e) { return null; }
}
function checked(fn) {
  return function (arg) {
    try { fn(arg); } catch (e) {
      console.error('  ✗ ' + e.message);
      process.exit(1);
    }
  };
}

function checkInputTitles(done) {
  tv.devices = [
    { id: 'HDMI_2', label: 'Receiver', subList: [
      { id: 'SIMPLINK', osdName: 'Receiver' }, { id: 'SIMPLINK', osdName: ' Console ' },
      { id: 'SIMPLINK', osdName: 'Console' }, { id: 'URCU', osdName: 'IR profile' }
    ] },
    { id: 'HDMI_3', label: 'Another device', subList: [] }
  ];
  hs.refreshInputTitles(checked(function () {
    var own = tv.lps.filter(function (p) { return p.id === 'com.webos.app.hdmi2'; })[0];
    assert.strictEqual(own.title, 'Receiver / Console \u2014 HDMI 2', 'the native Home title names the CEC chain and port');
    assert.strictEqual(own.titleVisible, true, 'a bookmark title is visible on focus');
    assert.strictEqual(tv.lps.filter(function (p) { return p.launchPointId === '900'; })[0].title, undefined, 'an input tile not added here is untouched');
    var writes = tv.calls.filter(function (c) { return /updateLaunchPoint$/.test(c.uri); }).length;
    hs.refreshInputTitles(checked(function () {
      assert.strictEqual(tv.calls.filter(function (c) { return /updateLaunchPoint$/.test(c.uri); }).length, writes, 'unchanged titles are not written repeatedly');
      tv.devices = null;
      hs.refreshInputTitles(checked(function () {
        assert.strictEqual(own.title, 'Receiver / Console \u2014 HDMI 2', 'a failed discovery keeps the last good name');
        tv.devices = [{ id: 'HDMI_2', label: 'Mac', hdmiPlugIn: true, connected: true, subList: [] }];
        hs.refreshInputTitles(checked(function () {
          assert.strictEqual(own.title, 'Mac \u2014 HDMI 2', 'with no CEC names, the TV\'s own name for the input is shown with the port');
          tv.devices = [{ id: 'HDMI_2', label: 'HDMI 2', hdmiPlugIn: false, connected: true }];
          hs.refreshInputTitles(checked(function () {
            assert.strictEqual(own.title, 'HDMI 2', 'an empty port is just its name');
            tv.devices = null;
            console.log('  \u2713 native Home labels show the CEC chain only on owned tiles, else the TV\'s name for the input, avoid repeated writes and retain names on discovery failure');
            done();
          }));
        }));
      }));
    }));
  }));
}

setup('4.4.3');
hs.getHomeScreen(checked(function (none) {
  assert.strictEqual(none, null, 'webOS 4 has no Home screen section');
  setup('9.2.2');
  hs.getHomeScreen(checked(function (d) {
    assert.deepEqual(d.parts.map(function (p) { return p.id + ':' + p.shown; }),
      ['banner:true', 'quickCards:true', 'apps:true', 'deviceFunctions:true']);
    assert.deepEqual(d.inputs.map(function (i) { return i.title + ':' + i.onHome; }),
      ['HDMI 1:false', 'Mac:false', 'HDMI 3:true', 'HDMI 4:false']);
    console.log('  ✓ webOS 9 shows every part and which inputs are on Home; webOS 4 has no section');

    hs.setPart('quickCards', false, checked(function (r) {
      assert.strictEqual(r.ok, true);
      var xml = ourLayout();
      assert.ok(xml.indexOf('<!-- glasshouse -->') !== -1, 'marked as ours');
      assert.ok(xml.indexOf('type="Qcard"') === -1 && xml.indexOf('type="Hero"') !== -1 && xml.indexOf('type="AppList"') !== -1);
      assert.strictEqual(fs.readFileSync(path.join(layoutDir, 'home_layout.xml'), 'utf8'), xml, 'both names written');
      assert.ok(/rm -rf .*tmpcp\/com\.webos\.app\.home/.test(shellRuns[0]) && /flashcp\/com\.webos\.app\.home/.test(shellRuns[0]) &&
        /kill \$\(pidof com\.webos\.app\.home\)/.test(shellRuns[0]), 'checkpoints dropped, then home restarted');
      console.log('  ✓ hiding a part writes LG\'s layout without it, marked, and restarts the home app fresh');

      hs.setPart('banner', false, checked(function () {
        hs.setPart('deviceFunctions', false, checked(function () {
          hs.setPart('apps', false, checked(function (last) {
            assert.strictEqual(last.ok, false, 'the last part stays');
            assert.ok(ourLayout().indexOf('type="AppList"') !== -1);
            console.log('  ✓ the last part showing cannot be hidden');

            // Glasshouse Home's empty starting layout in its place (lib/home-takeover.js).
            var mine = ourLayout();
            var starting = '<home>' + require('../server/lib/home-takeover').BLANK_MARK + '</home>';
            fs.writeFileSync(path.join(layoutDir, 'home_layoutShelfView.xml'), starting);
            hs.setPart('banner', true, checked(function (held) {
              assert.strictEqual(held.ok, false);
              assert.ok(/Glasshouse Home/.test(held.error));
              assert.strictEqual(ourLayout(), starting, 'its layout is left in place');
              fs.writeFileSync(path.join(layoutDir, 'home_layoutShelfView.xml'), mine);
              console.log('  ✓ while Glasshouse Home has LG\'s Home\'s place, its layout is not changed');

            hs.setInput('hdmi2', true, checked(function (a) {
              assert.strictEqual(a.ok, true);
              var add = tv.calls.filter(function (c) { return /addLaunchPoint$/.test(c.uri); })[0];
              assert.deepEqual(add.params, { id: 'com.webos.app.hdmi2', title: 'Mac', params: {}, titleVisible: true });
              assert.deepEqual(tv.lps.map(function (p) { return p.id; }),
                ['com.webos.app.hdmi2', 'com.webos.app.hdmi3', 'youtube.leanback.v4'], 'inputs first, in HDMI order');
              assert.ok(/kill \$\(pidof com\.webos\.app\.home\)/.test(shellRuns[shellRuns.length - 1]), 'home app restarted to show the order');
              var runs = shellRuns.length;
              checkInputTitles(function () {
                hs.setInput('hdmi2', true, checked(function () {
                  assert.strictEqual(tv.calls.filter(function (c) { return /addLaunchPoint$/.test(c.uri); }).length, 1, 'not added twice');
                  assert.strictEqual(shellRuns.length, runs, 'no restart when nothing moved');
                  console.log('  ✓ an input is added as LG\'s own launch point, with the TV\'s name for it, once, and the inputs put before the apps');

                  hs.restore(checked(function (back) {
                    assert.strictEqual(back.ok, true);
                    assert.strictEqual(ourLayout(), null, 'layout file gone');
                    assert.ok(!fs.existsSync(layoutDir), 'the folder, empty, gone too');
                    var ids = tv.lps.map(function (p) { return p.launchPointId; });
                    assert.ok(ids.indexOf('900') !== -1, 'the tile added on the TV stays');
                    assert.ok(!tv.lps.some(function (p) { return p.id === 'com.webos.app.hdmi2'; }), 'the tile added here goes');
                    console.log('  ✓ putting LG\'s Home screen back removes the layout and only the tiles added here');

                    // A layout file LG put there itself: left alone, and no section.
                    mkdirp(layoutDir);
                    fs.writeFileSync(path.join(layoutDir, 'home_layoutShelfView.xml'), LG_LAYOUT);
                    setup('9.2.2');
                    hs.getHomeScreen(checked(function (lgs) {
                      assert.strictEqual(lgs, null);
                      hs.restore(checked(function () {
                        assert.strictEqual(ourLayout(), LG_LAYOUT, 'LG\'s file untouched');
                        console.log('  ✓ a layout of LG\'s own in that folder is left alone, and the section is not offered');
                        console.log('ALL test-homescreen.js assertions passed!\n');
                      }));
                    }));
                  }));
                }));
              });
            }));
            }));
          }));
        }));
      }));
    }));
  }));
}));
