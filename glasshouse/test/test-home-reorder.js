/* Remote reorder regression checks against the real Home handlers; no browser or TV. */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var source = fs.readFileSync(path.join(__dirname, '../server/assets/home.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
source = source.slice(0, source.indexOf("  window.addEventListener('resize'")) +
  '\nrender = applyFocus = function () {' +
  '  var current = items(rowKey())[colOf(rowKey())];' +
  '  state.last = current ? { kind: rowKey(), id: current.id } : null;' +
  '};' +
  'load = function () {}; toast = function () {};' +
  'postJson = function (url, body, cb) { transport(url, body, cb, layout); };' +
  'this.view = { down: onKeyDown, up: onKeyUp, click: onClick, state: state,' +
  '  setup: function (d, l) { data = d; layout = l; applyFocus(); },' +
  '  order: function () { return data.order.app; }, rows: function () { return layout.rows; },' +
  '  hidden: function () { return layout.hidden.app; }, busy: function () { return layoutBusy; },' +
  '  fullArrange: function () { setArranging(true); } }; })();';

var KEY = { left: 37, up: 38, right: 39, down: 40, ok: 13, back: 461, red: 403, yellow: 405 };
function copy(value) { return JSON.parse(JSON.stringify(value)); }

function harness() {
  var now = 1000, nextTimer = 0, timers = {}, posts = [], save = null;
  var body = {}, elements = {};
  var context = {
    Date: { now: function () { return now; } }, location: { search: '' }, window: { PalmSystem: {} },
    document: { body: body, querySelector: function () { return null; }, getElementById: function (id) {
      return elements[id] || (elements[id] = { textContent: '' });
    } },
    t: function (key, text, vars) {
      return text.replace(/\{(\w+)\}/g, function (whole, name) { return vars && vars[name] !== undefined ? vars[name] : whole; });
    },
    setTimeout: function (fn, delay) { var id = ++nextTimer; timers[id] = { fn: fn, at: now + delay }; return id; },
    clearTimeout: function (id) { delete timers[id]; },
    transport: function (url, payload, cb, layout) {
      posts.push({ url: url, body: copy(payload) });
      if (url === '/api/home/layout') save = function () { cb({ ok: true, layout: copy(layout) }); };
      else cb({ ok: true });
    }
  };
  vm.runInNewContext(source, context);
  var view = context.view;
  view.setup({
    apps: [{ id: 'one', title: 'One' }, { id: 'hidden', title: 'Hidden' }, { id: 'two', title: 'Two' }],
    devices: [{ id: 'hdmi1', port: 1 }, { id: 'hdmi3', port: 3 }], channels: [],
    order: { app: ['one', 'hidden', 'two', 'lg-home'], dev: ['hdmi1', 'hdmi3'], ch: [] }
  }, {
    rows: ['app', 'dev', 'ch'], hidden: { app: ['hidden'], dev: [], ch: [] },
    sort: { app: 'custom', dev: 'custom', ch: 'custom' }, channels: []
  });
  function event(key) { return { keyCode: KEY[key], preventDefault: function () {} }; }
  function advance(ms) {
    now += ms;
    Object.keys(timers).forEach(function (id) {
      if (timers[id] && timers[id].at <= now) { var fn = timers[id].fn; delete timers[id]; fn(); }
    });
  }
  function tap(key) { view.down(event(key)); view.up(event(key)); }
  function hold() { view.down(event('ok')); advance(800); view.up(event('ok')); }
  return { view: view, posts: posts, advance: advance, tap: tap, hold: hold,
    down: function (key) { view.down(event(key)); }, up: function (key) { view.up(event(key)); },
    clickTile: function () { view.click({ target: { className: 'tile app', parentNode: body } }); },
    finishSave: function () { assert.ok(save, 'a save is pending'); var cb = save; save = null; cb(); }
  };
}

var h = harness();
h.down('ok');
h.advance(799);
assert.strictEqual(h.view.state.arranging, false, 'a short press does not enter reorder mode');
h.up('ok');
assert.deepStrictEqual(h.posts, [{ url: '/api/home/open', body: { kind: 'app', id: 'one' } }], 'short OK opens once on release');

h = harness();
h.down('ok');
h.advance(400);
h.down('ok');
h.advance(400);
assert.strictEqual(h.view.state.arranging, true, 'repeated keydown does not reset the long-press threshold');
assert.strictEqual(h.view.state.held, true, 'long OK picks the focused tile up immediately');
h.up('ok');
assert.strictEqual(h.posts.length, 0, 'releasing long OK neither launches nor saves');
h.tap('right');
assert.strictEqual(h.view.order().join(','), 'two,hidden,one,lg-home', 'right swaps visible neighbours without moving hidden slots');
assert.strictEqual(h.view.state.col.app, 1, 'focus follows the moved tile');
h.tap('left');
assert.strictEqual(h.view.order().join(','), 'one,hidden,two,lg-home');
h.tap('left');
assert.strictEqual(h.view.state.col.app, 0, 'left edge cannot enter the order control');
['up', 'down', 'red', 'yellow'].forEach(function (key) { h.tap(key); });
assert.strictEqual(h.view.rows().join(','), 'app,dev,ch', 'quick reorder cannot move sections');
assert.strictEqual(h.view.state.row, 0, 'up and down keep the selected row');
assert.strictEqual(h.view.hidden().join(','), 'hidden', 'quick reorder cannot hide tiles');
assert.strictEqual(h.posts.length, 0, 'quick reorder cannot reset the layout');
h.tap('right');
h.tap('ok');
assert.strictEqual(h.view.state.arranging, false, 'short OK exits quick reorder');
assert.strictEqual(h.view.state.held, false);
assert.strictEqual(h.posts.length, 1, 'OK writes the layout once without launching');
assert.strictEqual(h.posts[0].url, '/api/home/layout');
assert.deepStrictEqual(h.posts[0].body.order, { app: ['two', 'hidden', 'one', 'lg-home'] }, 'save sends only the moved row');
assert.deepStrictEqual(h.posts[0].body.hidden.app, ['hidden']);
assert.strictEqual(h.view.busy(), true);
h.tap('right');
h.tap('ok');
assert.strictEqual(h.posts.length, 1, 'keys during the pending save do not open apps or resubmit');
h.finishSave();
assert.strictEqual(h.view.busy(), false);
h.tap('ok');
assert.strictEqual(h.posts[1].url, '/api/home/open', 'normal activation resumes after saving');
assert.strictEqual(h.posts[1].body.id, 'one');

h = harness();
h.hold();
h.tap('right');
h.tap('back');
assert.strictEqual(h.view.state.arranging, false, 'Back exits quick reorder');
assert.strictEqual(h.view.hidden().join(','), 'hidden', 'Back does not hide the held tile');
assert.strictEqual(h.posts.length, 1);
assert.strictEqual(h.posts[0].url, '/api/home/layout', 'Back saves the same order as OK');
assert.deepStrictEqual(h.posts[0].body.order.app, ['two', 'hidden', 'one', 'lg-home']);

h = harness();
h.hold();
h.tap('right');
h.clickTile();
assert.strictEqual(h.view.state.arranging, false, 'Magic Remote click finishes quick reorder');
assert.strictEqual(h.posts.length, 1);
assert.strictEqual(h.posts[0].url, '/api/home/layout', 'click saves without launching');

h = harness();
h.tap('right');
assert.strictEqual(h.view.state.col.app, 1);
assert.strictEqual(h.view.order().join(','), 'one,hidden,two,lg-home', 'normal arrows only move focus');
assert.strictEqual(h.posts.length, 0);
h.view.fullArrange();
h.tap('ok');
assert.strictEqual(h.view.state.held, true, 'full arranging still picks tiles up separately');
h.tap('down');
assert.strictEqual(h.view.rows().join(','), 'dev,app,ch', 'full arranging retains section movement');
assert.strictEqual(h.view.state.row, 1);
console.log('All home remote reorder tests passed.');
