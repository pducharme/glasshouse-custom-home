/* Remote navigation of Photos and installed-app drawer against real Home handlers. No TV. */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var page = fs.readFileSync(path.join(__dirname, '../server/assets/home.html'), 'utf8');
var source = page.match(/<script>([\s\S]*?)<\/script>/)[1];
source = source.slice(0, source.indexOf("  window.addEventListener('resize'")) +
  'postJson = function (url, body, cb) { transport(url, body, cb); };' +
  'toast = function (main, detail) { notify(main, detail); };' +
  'this.view = { down: onKeyDown, up: onKeyUp, click: onClick, pointer: onPointer,' +
  ' state: state, drawer: drawer, recents: recents, open: openDrawer, close: closeDrawer, items: items, photosMarkup: photosMarkup,' +
  ' setup: function (d, l) { data = d; layout = l; }, data: function () { return data; },' +
  ' render: render, photoStatus: photosStatus }; })();';
var KEYS = { left: 37, up: 38, right: 39, down: 40, ok: 13, back: 461, escape: 27 };
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function harness(options) {
  options = options || {};
  var elements = {}, posts = [], messages = [], timers = {}, rows = [], nextTimer = 0, now = 1000, pending;
  function element(id) {
    if (!elements[id]) {
      var el = { id: id, className: '', textContent: '', style: {}, attrs: {}, offsetTop: 0,
        scrollTop: 0, clientHeight: 400, offsetHeight: 215,
        setAttribute: function (key, value) { this.attrs[key] = value; },
        getAttribute: function (key) { return this.attrs[key]; },
        querySelectorAll: function (selector) { return selector === '.drawer-app' ? this.tiles || [] : []; }
      };
      var markup = '';
      Object.defineProperty(el, 'innerHTML', {
        get: function () { return markup; }, set: function (value) {
          markup = value; el.tiles = [];
          var matches = value.match(/data-c="\d+"/g) || [];
          matches.forEach(function (entry, i) {
            var tile = element('drawer-item-' + i);
            tile.className = 'tile drawer-app'; tile.attrs['data-c'] = String(i);
            tile.offsetTop = Math.floor(i / 5) * 245; tile.parentNode = el;
            el.tiles.push(tile);
          });
        }
      });
      elements[id] = el;
    }
    return elements[id];
  }
  var body = element('body');
  var context = {
    Date: { now: function () { return now; } }, location: { search: '' }, window: {},
    document: { body: body, getElementById: element, querySelectorAll: function (selector) { return selector === '.row' ? rows : []; } },
    t: function (key, fallback, vars) { return fallback.replace(/\{(\w+)\}/g, function (all, key) { return vars && vars[key] !== undefined ? vars[key] : all; }); },
    setTimeout: function (fn, delay) { var id = ++nextTimer; timers[id] = { fn: fn, due: now + delay }; return id; },
    clearTimeout: function (id) { delete timers[id]; },
    notify: function (main, detail) { messages.push([main, detail]); },
    transport: function (url, payload, cb) { posts.push({ url: url, body: copy(payload) }); pending = cb; }
  };
  vm.runInNewContext(source, context);
  var view = context.view;
  var apps = [];
  for (var i = 0; i < 9; i++) apps.push({ id: 'app' + i, title: 'App ' + i });
  apps.push({ id: 'com.webos.app.hdmi4', title: 'Bell Fibe' });
  apps.push({ id: 'lg-home', title: 'Not a real app' });
  view.setup({ apps: apps, devices: [{ id: 'hdmi1', port: 1 }, { id: 'hdmi3', port: 3 }], channels: [],
    sources: { channels: 0 }, order: { app: apps.map(function (a) { return a.id; }), dev: ['hdmi1', 'hdmi3'], ch: [] },
    photos: { appId: '', installed: false }
  }, { rows: ['app', 'dev', 'ch'], sort: { app: 'custom', dev: 'custom', ch: 'custom' },
    hidden: { app: ['app1', 'app3', 'app5', 'app7'], dev: [], ch: [] }, channels: [] });
  function event(key) { return { keyCode: KEYS[key], preventDefault: function () {} }; }
  function advance(ms) {
    now += ms; Object.keys(timers).forEach(function (id) { if (timers[id] && timers[id].due <= now) { var fn = timers[id].fn; delete timers[id]; fn(); } });
  }
  return { view: view, posts: posts, messages: messages, element: element,
    setRows: function (value) { rows = value; },
    down: function (key) { view.down(event(key)); }, up: function (key) { view.up(event(key)); },
    tap: function (key) { view.down(event(key)); view.up(event(key)); },
    hold: function () { view.down(event('ok')); advance(900); view.up(event('ok')); },
    reply: function (r) { assert.ok(pending); var cb = pending; pending = null; cb(r); },
    callback: function () { return pending; },
    click: function (id) { view.click({ target: element(id) }); },
    hover: function (id) { view.pointer({ target: element(id) }); }
  };
}

var h = harness();
h.tap('right');
h.tap('down');
assert.strictEqual(h.view.state.row, 1, 'Down enters consoles');
h.tap('right'); h.tap('right');
assert.strictEqual(h.view.state.zone, 'photos', 'Right from last console reaches Photos');
assert.strictEqual(h.element('photosTile').className, 'focus', 'Photos receives visible focus');
h.tap('ok');
assert.strictEqual(h.posts.length, 0, 'nonconfigured Photos does not send a launch or access a service');
assert.strictEqual(h.messages[0][0], 'Non configuré');
h.hold();
assert.strictEqual(h.view.state.arranging, false, 'long OK on Photos never enters arrange mode');
assert.strictEqual(h.posts.length, 0);
h.tap('left');
assert.strictEqual(h.view.state.zone, 'rows');
assert.strictEqual(h.view.state.col.dev, 1, 'left returns to the last console');
h.tap('right'); h.tap('up');
assert.strictEqual(h.view.state.row, 0, 'up from Photos returns to the app carousel');
assert.strictEqual(h.view.state.col.app, 1, 'app carousel remembers its position');
h.tap('down'); h.tap('down');
assert.strictEqual(h.view.state.zone, 'all', 'down from final row focuses the All apps chevron');
h.tap('up');
assert.strictEqual(h.view.state.zone, 'rows', 'up from chevron returns to row without opening');
h.tap('down'); h.tap('down');
assert.strictEqual(h.view.drawer.open, true, 'down from chevron opens drawer');
assert.strictEqual(h.element('allApps').attrs['aria-hidden'], 'false');
assert.strictEqual(h.element('allAppsTrigger').attrs['aria-expanded'], 'true');
assert.strictEqual(h.view.drawer.apps.length, 9, 'drawer lists installed apps, including hidden apps, excluding synthetic shortcuts');
assert.ok(h.view.drawer.apps.some(function (a) { return a.id === 'app1'; }), 'nonfavorite app is available');
h.tap('right'); h.tap('down');
assert.strictEqual(h.view.drawer.index, 6, 'down advances one grid row');
assert.ok(h.element('allAppsScroll').scrollTop > 0, 'focused second row scrolls into view');
h.tap('up');
assert.strictEqual(h.view.drawer.index, 1);
h.tap('up');
assert.strictEqual(h.view.drawer.open, false, 'up from top row closes drawer');
assert.strictEqual(h.view.state.row, 1);
assert.strictEqual(h.view.state.col.dev, 1, 'drawer exit restores the exact carousel/console focus');
assert.strictEqual(h.view.state.zone, 'rows');
assert.strictEqual(h.element('allAppsTrigger').attrs['aria-expanded'], 'false');

h = harness();
h.click('allAppsTrigger'); h.tap('right'); h.hold();
assert.strictEqual(h.view.state.arranging, false, 'long OK inside drawer never starts reordering');
assert.deepStrictEqual(h.posts, [{ url: '/api/home/open', body: { kind: 'app', id: 'app1' } }], 'hidden app launches once on OK release');
h.tap('ok');
assert.strictEqual(h.posts.length, 1, 'pending launch prevents duplicate requests');
h.reply({ ok: false, error: 'Unavailable' });
assert.strictEqual(h.view.drawer.open, true, 'failed launch retains drawer and its selected app');
assert.strictEqual(h.view.drawer.index, 1);
assert.strictEqual(h.messages.length, 1, 'launch failure is announced');
h.tap('ok'); h.reply({ ok: true });
assert.strictEqual(h.view.drawer.open, false, 'successful launch closes drawer');

h = harness();
h.click('allAppsTrigger'); h.tap('ok');
var staleReply = h.callback();
h.tap('back'); h.click('allAppsTrigger'); h.tap('right');
staleReply({ ok: true });
assert.strictEqual(h.view.drawer.open, true, 'late response cannot close a newly reopened drawer');
assert.strictEqual(h.view.drawer.index, 1);
h.down('ok'); h.tap('escape'); h.up('ok');
assert.strictEqual(h.view.drawer.open, false, 'Escape closes the drawer');
assert.strictEqual(h.posts.length, 1, 'OK held while closing cannot launch a background carousel tile');

h = harness();
h.view.data().apps = [];
h.click('allAppsTrigger');
assert.ok(/Aucune application/.test(h.element('allAppsGrid').innerHTML));
h.tap('ok'); h.tap('left'); h.tap('right'); h.tap('down');
assert.strictEqual(h.posts.length, 0);
assert.strictEqual(h.view.drawer.index, 0, 'empty drawer focus remains bounded');
h.tap('up');
assert.strictEqual(h.view.drawer.open, false, 'empty drawer is escapable');

h = harness();
h.view.data().photos = { appId: 'com.immich.webos', installed: false };
h.click('photosTile');
assert.strictEqual(h.posts.length, 0, 'missing client never requests launch');
assert.strictEqual(h.view.photoStatus(), 'Application absente');
h.view.data().photos = { appId: 'com.immich.webos', installed: true, icon: '/api/home/icon?id=com.immich.webos' };
h.view.data().apps.push({ id: 'com.immich.webos', title: 'Immich' });
h.view.data().order.app.push('com.immich.webos');
assert.strictEqual(h.view.items('app').some(function (a) { return a.id === 'com.immich.webos'; }), false, 'configured Photos app is not duplicated as a large carousel tile');
assert.ok(/\/api\/home\/icon/.test(h.view.photosMarkup()), 'installed client uses its native local icon');
assert.strictEqual(h.view.photoStatus(), 'Prêt');
h.click('photosTile'); h.click('photosTile');
assert.deepStrictEqual(h.posts, [{ url: '/api/home/open', body: { kind: 'photos' } }], 'Photos sends only the kind, no app override/URL/auth and no duplicate');
h.reply({ ok: false });
assert.strictEqual(h.messages.length, 2);
h.click('allAppsTrigger');
assert.ok(h.view.drawer.apps.some(function (app) { return app.id === 'com.immich.webos'; }), 'configured client remains in All apps');
h.hover('drawer-item-3');
assert.strictEqual(h.view.drawer.index, 3, 'pointer moves drawer focus');
h.click('drawer-item-4');
assert.strictEqual(h.posts[1].body.id, 'app4', 'click targets clicked tile without requiring a preceding mousemove');
h.reply({ ok: false });
h.click('allAppsClose');
assert.strictEqual(h.view.drawer.open, false, 'visible return button closes drawer');

h = harness();
h.view.data().apps[0].title = '<unsafe & title>';
h.click('allAppsTrigger');
assert.ok(/&lt;unsafe &amp; title&gt;/.test(h.element('allAppsGrid').innerHTML), 'application titles remain escaped');
h = harness();
h.view.setup(null, null);
h.hover('allAppsTrigger'); h.click('allAppsTrigger');
assert.strictEqual(h.posts.length, 0, 'pointer before catalogue load does not access absent layout or launch');
// refreshNow renders periodically even when Recent apps is open. Its dimmed
// background must receive visible focus again when Back closes that panel.
h = harness();
var row = h.element('test-app-row'), tile = h.element('test-app-tile');
row.setAttribute('data-key', 'app');
tile.className = 'tile app';
row.querySelectorAll = function (selector) { return selector === '.tile' ? [tile] : []; };
row.querySelector = function (selector) { return selector === '.sort' ? h.element('test-sort') : null; };
h.setRows([row]);
h.view.render();
assert.ok(/\bfocus\b/.test(tile.className));
h.view.recents.open = true;
h.view.render();
assert.ok(!/\bfocus\b/.test(tile.className), 'refresh removes the background focus while Recent apps is open');
h.tap('back');
assert.strictEqual(h.view.recents.open, false);
assert.ok(/\bfocus\b/.test(tile.className), 'closing Recent apps restores focus after a periodic render');
console.log('All Photos and installed-app drawer navigation tests passed.');
