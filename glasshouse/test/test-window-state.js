/* Window transitions settle without hiding a lasting loss of focus. ES5. */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var StateManager = require('../server/lib/state').StateManager;
var now = 0, timers = [], published = [];
var moduleMock = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server/lib/mqtt-state.js'), 'utf8'), {
  module: moduleMock,
  require: function (name) { return require('../server/lib/' + name); },
  setTimeout: function (fn, ms) {
    var timer = { fn: fn, at: now + ms, cancelled: false };
    timers.push(timer);
    return timer;
  },
  clearTimeout: function (timer) { timer.cancelled = true; }
});
function advance(ms) {
  now += ms;
  timers.forEach(function (timer) {
    if (!timer.cancelled && timer.at <= now) { timer.cancelled = true; timer.fn(); }
  });
}
var state = new StateManager();
var bridge = moduleMock.exports.init({ prefix: 'test', client: { publish: function (topic, body, retain) {
  if (topic === 'test/state/application/remote') {
    assert.strictEqual(retain, true);
    published.push(JSON.parse(body));
  }
} } });
bridge.attach(state);
function focus(id) { state.update('focus', 'control_app_id', id); }
function last() { return published[published.length - 1]; }
state.update('application', 'app_id', 'com.webos.app.hdmi3');
state.update('power', 'systemOn', true);
focus('com.palm.app.settings');
published = [];
focus('');
advance(100);
state.update('surface', 'control_app_id', 'com.webos.app.hdmi3');
assert.strictEqual(published.length, 0, 'surface changes cannot publish a transient empty focus');
focus('com.webos.app.hdmi3');
assert.strictEqual(published.length, 1);
assert.strictEqual(last().control_app_id, 'com.webos.app.hdmi3');
advance(300);
assert.strictEqual(published.length, 1, 'cancelled empty does not arrive after the settled window');
state.update('surface', 'control_app_id', 'com.webos.app.home');
assert.strictEqual(published.length, 1, 'unchanged effective focus is not published twice');

focus('');
advance(199);
assert.strictEqual(last().control_app_id, 'com.webos.app.hdmi3');
state.update('application', 'app_id', 'netflix');
advance(1);
assert.strictEqual(last().control_app_id, '', 'persistent empty releases the remote after 200 ms');
assert.strictEqual(last().app_id, 'netflix', 'delayed publication uses the current app');
var count = published.length;
bridge.publishSnapshot();
advance(200);
assert.strictEqual(published.length, count + 1, 'reconnect republishes even an unchanged empty state');
focus('netflix');
count = published.length;
bridge.publishSnapshot();
assert.strictEqual(published.length, count + 1, 'reconnect immediately republishes a focused window');

focus('');
advance(50);
state.update('power', 'systemOn', false);
assert.strictEqual(last().control_app_id, '', 'standby clears focus immediately');
count = published.length;
advance(300);
assert.strictEqual(published.length, count, 'standby cancels the pending empty publication');
focus('com.webos.app.home');
assert.strictEqual(published.length, count, 'a late window event cannot restore focus in standby');
state.update('power', 'systemOn', true);
assert.strictEqual(last().control_app_id, 'com.webos.app.home');
focus('');
bridge.publishSnapshot();
count = published.length;
focus('com.webos.app.home');
assert.strictEqual(published.length, count + 1, 'a reconnect during an empty transition still republishes the settled state');
advance(300);
assert.strictEqual(published.length, count + 1);
console.log('ALL test-window-state.js assertions passed!');
