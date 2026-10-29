/* Local home layout: daily offline wallpaper, preview compatibility, French labels and console routing. */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

process.env.TZ = 'America/Toronto';
var clock = new Date(2026, 9, 22, 12);
function Clock() { return new Date(clock.getTime()); }
Clock.UTC = Date.UTC;
var layers = [{ style: {} }, { style: {} }];
var images = [];
var elements = { wall: { querySelectorAll: function () { return layers; } } };
var context = {
  Date: Clock, location: { search: '' }, window: { PalmSystem: {} },
  Image: function () { images.push(this); },
  document: { documentElement: { lang: 'fr-CA' }, getElementById: function (id) { return elements[id] || (elements[id] = { textContent: '' }); } },
  t: function (key, text, vars) {
    return text.replace(/\{(\w+)\}/g, function (whole, name) { return vars && vars[name] !== undefined ? vars[name] : whole; });
  }
};
var source = fs.readFileSync(path.join(__dirname, '../server/assets/home.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
// Load the real view up to browser event registration, then expose only what these checks exercise.
source = source.slice(0, source.indexOf("  window.addEventListener('resize'")) +
  'this.view = { weatherSymbol: weatherSymbol, wallSlot: wallSlot, updateWall: updateWall, stageClass: stageClass, dateText: dateText, renderNow: renderNow, titles: ROW_TITLES, items: items, tiles: TILE,' +
  ' preview: function (p) { preview = p; }, setup: function (d, l) { data = d; layout = l; },' +
  ' walls: function (available) { wallAvailable = available; wallShown = null; wallSlots = null; },' +
  ' arrange: function (on, quick) { state.arranging = on; state.quickArrange = !!quick; } }; })();';
vm.runInNewContext(source, context);
var view = context.view;
var daily = [];
for (var day = 22; day <= 26; day++) {
  clock = new Date(2026, 9, day, 0, 0);
  var first = view.wallSlot();
  daily.push(first.key);
  clock = new Date(2026, 9, day, 23, 59);
  assert.strictEqual(view.wallSlot().key, first.key, 'same wallpaper all local day, including after UTC midnight');
  assert.notStrictEqual(view.wallSlot().strength, first.strength, 'brightness still follows local time');
}
assert.strictEqual(daily.slice(0, 4).filter(function (v, i, a) { return a.indexOf(v) === i; }).length, 4);
assert.strictEqual(daily[0], daily[4], 'four uploaded wallpapers repeat offline');
assert.notStrictEqual(daily[0], daily[1], 'local midnight advances the wallpaper');
clock = new Date(2026, 10, 1, 0, 0);
var dstKey = view.wallSlot().key;
clock = new Date(2026, 10, 1, 23, 59);
assert.strictEqual(view.wallSlot().key, dstKey, 'DST does not change the wallpaper within a day');
clock = new Date(2026, 10, 1, 6);
dstKey = view.wallSlot().key;
clock = new Date(2026, 10, 1, 16, 59);
assert.strictEqual(view.wallSlot().key, dstKey, 'daytime rotation survives the DST transition');
view.preview({ hour: 19 });
assert.strictEqual(view.wallSlot().key, 'evening');
assert.strictEqual(view.wallSlot().strength, 0.72);
view.preview({ wall: 'morning', hour: 19 });
assert.strictEqual(view.wallSlot().key, 'morning', 'explicit wallpaper preview takes precedence');
assert.strictEqual(view.wallSlot().strength, 0.7);
view.preview({ wall: 'night' });
assert.strictEqual(view.wallSlot().strength, 0.65, 'existing night preview is preserved');
view.preview({});

// The local clock changes the skin even when the catalogue or wallpaper is unavailable.
view.walls(false);
[[16, 59, false], [17, 0, true], [5, 59, true], [6, 0, false]].forEach(function (at) {
  clock = new Date(2026, 9, 22, at[0], at[1]);
  view.updateWall();
  assert.strictEqual(/\bnight\b/.test(elements.stage.className), at[2], 'night boundary ' + at[0] + ':' + at[1]);
});
assert.ok(layers.every(function (layer) { return layer.style.opacity === 0; }), 'unavailable daytime wallpaper stays black');
view.preview({ hour: 19 });
view.updateWall();
assert.ok(/\bnight\b/.test(elements.stage.className), 'hour preview controls the night skin');
assert.strictEqual(images[images.length - 1].src, '/assets/home-wallpaper-dark.jpg', 'night image works without uploaded wallpapers');
images[images.length - 1].onload();
assert.ok(layers.some(function (layer) { return layer.style.backgroundImage === 'url(/assets/home-wallpaper-dark.jpg)'; }));
view.arrange(true, true);
view.stageClass();
assert.ok(/arranging/.test(elements.stage.className) && /night/.test(elements.stage.className), 'arranging keeps the night skin');
view.arrange(false);

view.walls(true);
view.preview({ wall: 'morning', hour: 19 });
view.updateWall();
assert.ok(/slot=morning/.test(images[images.length - 1].src), 'explicit wallpaper preview bypasses the night image');
images[images.length - 1].onload();

view.preview({});
clock = new Date(2026, 9, 22, 17);
view.updateWall();
var requestedDark = images[images.length - 1];
assert.strictEqual(requestedDark.src, '/assets/home-wallpaper-dark.jpg');
requestedDark.onerror();
var fallback = images[images.length - 1];
assert.ok(fallback.src.indexOf('/api/home/wallpaper?slot=' + view.wallSlot().key) === 0, 'night image failure falls back to the daily image');
fallback.onload();
assert.ok(layers.some(function (layer) { return layer.style.opacity === view.wallSlot().strength * 0.5; }), 'fallback is dimmed');

// An image that finishes after sunrise must not bring back the night scene.
view.walls(true);
view.updateWall();
requestedDark = images[images.length - 1];
clock = new Date(2026, 9, 23, 6);
view.updateWall();
var requestedDay = images[images.length - 1];
var before = JSON.stringify(layers);
requestedDark.onload();
assert.strictEqual(JSON.stringify(layers), before, 'stale night image is ignored');
requestedDay.onload();
assert.ok(layers.some(function (layer) { return layer.style.backgroundImage === 'url(' + requestedDay.src + ')'; }));
assert.ok(!/\bnight\b/.test(elements.stage.className));

clock = new Date(2026, 9, 22, 12);
assert.strictEqual(view.dateText(clock), 'Jeudi 22 octobre');
view.renderNow();
assert.strictEqual(elements.greeting.textContent, 'Bonjour');
clock = new Date(2026, 9, 22, 19);
view.renderNow();
assert.strictEqual(elements.greeting.textContent, 'Bonsoir');
assert.strictEqual(view.titles.app, 'Applications');
assert.strictEqual(view.titles.dev, 'Consoles');

var devices = [
  { id: 'hdmi1:switch-cec', port: 1, name: 'CEC Switch', address: '1.0.0.0' },
  { id: 'hdmi2:sonos', port: 2, name: 'Sonos' },
  { id: 'hdmi3', port: 3, name: 'HDMI 3' },
  { id: 'hdmi4:fibe', port: 4, name: 'Fibe' }
];
view.setup({ devices: devices, apps: [{ id: 'youtube', title: 'YouTube' }, { id: 'hidden-app', title: 'Other' }],
  order: { dev: devices.map(function (d) { return d.id; }), app: ['youtube', 'hidden-app', 'lg-home'] } },
  { hidden: { dev: [], app: ['hidden-app'] } });
assert.strictEqual(view.items('dev').map(function (d) { return d.id; }).join(','), 'hdmi1:switch-cec,hdmi3');
assert.strictEqual(view.items('app').map(function (a) { return a.id; }).join(','), 'youtube,lg-home');
assert.ok(/Nintendo Switch 2/.test(view.tiles.dev(devices[0], 0)));
assert.ok(/Xbox Series X/.test(view.tiles.dev(devices[2], 1)));
assert.strictEqual(devices[0].name, 'CEC Switch', 'display names do not change the native device or CEC identity');
view.arrange(true);
assert.strictEqual(view.items('dev').length, 2, 'Sonos and Bell never enter the Consoles section');
assert.strictEqual(view.items('app').length, 3, 'native arranging still reveals hidden apps');
view.arrange(true, true);
assert.strictEqual(view.items('app').length, 2, 'quick reordering keeps unrelated apps hidden');
assert.strictEqual(view.items('dev').length, 2, 'quick reordering preserves the console section');
view.arrange(false);
assert.ok(/brand-name/.test(view.tiles.dev(devices[0], 0)), 'Switch has a redistributable text fallback');
assert.ok(/brand-name/.test(view.tiles.dev(devices[2], 1)), 'Xbox has a redistributable text fallback');
assert.ok(/HDMI 3/.test(view.tiles.dev({ port: 3, id: 'hdmi3', unused: true }, 1)), 'console port remains visible while off');
var appIds = ['youtube.leanback.v4', 'cdp-30', 'ca.bellmedia.crave', 'netflix', 'amazon', 'tv.tou.ici.webos', 'com.webos.app.hdmi4'];
appIds.forEach(function (id) {
  var tile = view.tiles.app({ id: id, title: 'Name <safe>' }, 0);
  assert.ok(/brand-name/.test(tile), 'text fallback for ' + id);
  assert.ok(!/home-logos/.test(tile), 'no redistributed proprietary logo');
  assert.ok(/Name &lt;safe&gt;/.test(tile), 'labels remain escaped');
});
assert.ok(/native-icon/.test(view.tiles.app({ id: 'other', title: 'Other', icon: '/api/home/icon?id=other' }, 0)), 'other installed apps retain native icons');
assert.ok(/face lg/.test(view.tiles.app({ id: 'lg-home', title: 'Accueil LG', lg: true }, 0)), 'LG recovery tile stays available');
assert.notStrictEqual(view.weatherSymbol(0, true).svg, view.weatherSymbol(0, false).svg, 'clear sky changes between day and night');
assert.strictEqual(view.weatherSymbol(3, true).name, 'Couvert');
assert.strictEqual(view.weatherSymbol(48, true).name, 'Brouillard');
assert.strictEqual(view.weatherSymbol(67, true).name, 'Pluie verglaçante');
assert.strictEqual(view.weatherSymbol(86, true).name, 'Neige');
assert.strictEqual(view.weatherSymbol(99, true).name, 'Orage et grêle');
assert.strictEqual(view.weatherSymbol(-1, true).name, 'Conditions indisponibles');
console.log('All home personalisation tests passed.');
