/* The preview must never load a TV control module, launch a child or make outbound calls. */
'use strict';
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const script = fs.readFileSync(path.join(__dirname, '../scripts/emulate-tv.js'), 'utf8');
const loaded = [];
const context = { module: { exports: {} }, __dirname: path.join(__dirname, '../scripts'),
  URL, Buffer, console,
  require: name => {
    loaded.push(name);
    assert.ok(['fs', 'http', 'path'].includes(name), 'preview cannot import TV modules, processes or network clients');
    if (name === 'http') return { createServer: http.createServer };
    if (name === 'fs') return { readFile: fs.readFile.bind(fs), realpathSync: fs.realpathSync.bind(fs) };
    return require(name);
  }
};
vm.runInNewContext(script, context);
assert.deepStrictEqual(loaded.sort(), ['fs', 'http', 'path']);
const server = context.module.exports.createDemoServer();
function call(route, body, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: route,
      method: body === undefined ? 'GET' : 'POST', headers: Object.assign(body === undefined ? {} : { 'Content-Type': 'application/json' }, headers) }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed; try { parsed = JSON.parse(data); } catch (err) { parsed = null; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed, text: data });
      });
    });
    req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
(async function () {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    assert.strictEqual(server.address().address, '127.0.0.1');
    const home = await call('/');
    assert.strictEqual(home.status, 200);
    assert.ok(home.text.includes('Glasshouse Home'));
    assert.ok(home.headers['content-security-policy'].includes("connect-src 'self'"));
    const weather = (await call('/api/home/weather')).body;
    assert.strictEqual(weather.demo, true);
    assert.strictEqual(weather.label, 'Ville de démonstration');
    const catalogue = (await call('/api/home/catalogue')).body;
    assert.deepStrictEqual(catalogue.order.app.filter(id => !catalogue.layout.hidden.app.includes(id)),
      ['youtube.leanback.v4', 'netflix', 'cdp-30', 'ca.bellmedia.crave', 'amazon', 'tv.tou.ici.webos', 'com.webos.app.hdmi4', 'lg-home']);
    assert.deepStrictEqual(catalogue.layout.hidden.app, ['org.example.demo.music', 'org.example.demo.browser', 'org.example.demo.games']);
    assert.ok(catalogue.layout.hidden.app.every(id => catalogue.apps.some(app => app.id === id)), 'drawer apps exist in the synthetic catalogue');
    assert.deepStrictEqual(catalogue.photos, { appId: '', installed: false, icon: null });
    assert.strictEqual(catalogue.layout.photosAppId, '');
    assert.strictEqual((await call('/api/home/open', { kind: 'photos', id: 'netflix' })).body.ok, false);
    assert.deepStrictEqual((await call('/api/home/now')).body, { kind: null }, 'unconfigured Photos never launches another tile');
    assert.deepStrictEqual(catalogue.devices.map(device => device.port), [1, 3]);
    for (const slot of ['morning', 'afternoon', 'evening', 'night']) assert.strictEqual((await call('/api/home/wallpaper?slot=' + slot)).status, 200);
    for (const slot of ['__proto__', 'constructor', 'toString']) assert.strictEqual((await call('/api/home/wallpaper?slot=' + slot)).status, 404);
    assert.strictEqual((await call('/assets/home-wallpaper-dark.jpg')).status, 200);
    const reversed = catalogue.order.app.slice().reverse();
    assert.strictEqual((await call('/api/home/layout', { order: { app: reversed } })).status, 200);
    assert.deepStrictEqual((await call('/api/home/catalogue')).body.order.app, reversed);
    assert.strictEqual((await call('/api/home/layout', { order: { app: ['private-unknown'] } })).status, 400);
    assert.strictEqual((await call('/api/home/layout', { hidden: { app: ['lg-home'] } })).status, 400);
    assert.strictEqual((await call('/api/home/open', { kind: 'app', id: 'netflix' })).body.demo, true);
    assert.strictEqual((await call('/api/home/now')).body.appId, 'netflix');
    assert.strictEqual((await call('/api/home/recents')).body.apps.length, 1);
    assert.strictEqual((await call('/api/home/layout', { reset: true })).status, 200);
    assert.deepStrictEqual((await call('/api/home/catalogue')).body.order.app, catalogue.order.app);
    assert.deepStrictEqual((await call('/api/home/catalogue')).body.layout.hidden.app, catalogue.layout.hidden.app);
    assert.strictEqual((await call('/api/home/open', { kind: 'app', id: 'org.example.demo.music' })).body.demo, true, 'drawer launches are simulated');
    assert.strictEqual((await call('/api/home/layout', {}, { Origin: 'https://example.invalid' })).status, 403);
    assert.strictEqual((await call('/', undefined, { Host: 'example.invalid' })).status, 403);
    assert.strictEqual((await call('/', undefined, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.strictEqual((await call('/api/control', { command: 'reboot' })).status, 404);
    assert.strictEqual((await call('/api/home/wallpaper?slot=../config.json')).status, 404);
    assert.strictEqual((await call('/assets/%2e%2e%2f%2e%2e%2fconfig.example.json')).status, 404);
    assert.strictEqual((await call('/api/home/layout', { text: 'x'.repeat(17000) })).status, 413);
    console.log('Offline Home demo safety and API tests passed.');
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(err => { console.error(err); process.exitCode = 1; });
