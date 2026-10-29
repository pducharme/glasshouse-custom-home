#!/usr/bin/env node
/* Offline Home preview: the real view, synthetic data and in-memory changes only. */
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'server/assets');
const WALLPAPERS = {
  morning: '01-lac-alpin-bleu.jpg', afternoon: '02-rockies-turquoise.jpg',
  evening: '03-lac-soleil-doux.jpg', night: '04-foret-brume-bleue.jpg'
};
const APPS = [
  ['youtube.leanback.v4', 'YouTube'], ['netflix', 'Netflix'], ['cdp-30', 'Plex'],
  ['ca.bellmedia.crave', 'Crave'], ['amazon', 'Prime Video'],
  ['tv.tou.ici.webos', 'ICI TOU.TV'], ['com.bell.fibetv.production', 'Bell Fibe TV'],
  ['org.example.demo.music', 'Musique démo'], ['org.example.demo.browser', 'Navigateur démo'],
  ['org.example.demo.games', 'Jeux démo'], ['com.tvweb.dashboard', 'Glasshouse']
].map(([id, title]) => ({ id, title }));
const DRAWER_APPS = APPS.slice(7).map(app => app.id);
const DEVICES = [
  { id: 'hdmi1', port: 1, name: 'Nintendo Switch 2' },
  { id: 'hdmi3', port: 3, name: 'Xbox Series X' }
];
const RECOMMENDATIONS = ['youtube.leanback.v4', 'netflix', 'amazon'].flatMap((app, source) =>
  Array.from({ length: 7 }, (_, index) => ({ id: 'demo-card-' + source + '-' + index, app,
    title: 'Exemple vidéo ' + (index + 1), category: 'Démonstration', image: '/demo/recommendations/' + source + '.svg' })));
const POSTERS = ['#385774', '#685978', '#64785b'].map(colour =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 294 142"><path fill="' + colour + '" d="M0 0h294v142H0z"/>' +
  '<path fill="#172536" d="M0 142L85 35l54 60 51-75 104 122z"/></svg>');
const IDS = { rec: RECOMMENDATIONS.map(card => card.id), app: APPS.map(app => app.id).concat('lg-home'), dev: DEVICES.map(device => device.id), ch: [] };
const WALL_STATE = { available: true, revision: 'synthetic-demo-1', slots: { morning: true, afternoon: true, evening: true, night: true } };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
function initialLayout() {
  return { enabled: true, rows: ['app', 'rec', 'dev'], order: JSON.parse(JSON.stringify(IDS)),
    sort: { app: 'custom', dev: 'custom', ch: 'custom', rec: 'custom' }, hidden: { app: DRAWER_APPS.slice(), dev: [], ch: [], rec: [] },
    folder: [], recommended: false, search: false, searchHintSeen: true,
    channels: [], hintSeen: true, picture: false, colours: null, photosAppId: '' };
}
function uniqueKnown(value, known) {
  return Array.isArray(value) && value.length <= known.length &&
    value.every((entry, i) => known.includes(entry) && value.indexOf(entry) === i);
}
function updateLayout(layout, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid layout');
  if (input.reset === true) return initialLayout();
  const next = JSON.parse(JSON.stringify(layout));
  if (input.rows !== undefined) {
    if (!uniqueKnown(input.rows, ['app', 'dev', 'ch', 'rec']) || !input.rows.includes('app')) throw new Error('Invalid rows');
    next.rows = input.rows;
  }
  for (const kind of ['app', 'dev', 'ch', 'rec']) {
    if (input.order && input.order[kind] !== undefined) {
      if (!uniqueKnown(input.order[kind], IDS[kind])) throw new Error('Invalid order');
      next.order[kind] = input.order[kind].concat(IDS[kind].filter(id => !input.order[kind].includes(id)));
    }
    if (input.hidden && input.hidden[kind] !== undefined) {
      if (!uniqueKnown(input.hidden[kind], IDS[kind]) || input.hidden[kind].includes('lg-home')) throw new Error('Invalid hidden tiles');
      next.hidden[kind] = input.hidden[kind];
    }
    if (input.sort && input.sort[kind] !== undefined) {
      if (!['custom', 'recent'].includes(input.sort[kind])) throw new Error('Invalid sort');
      next.sort[kind] = input.sort[kind];
    }
  }
  if (input.recommended !== undefined) {
    if (typeof input.recommended !== 'boolean') throw new Error('Invalid recommendations preference');
    next.recommended = input.recommended;
  }
  if (input.folder !== undefined) {
    if (!uniqueKnown(input.folder, IDS.app)) throw new Error('Invalid folder');
    next.folder = input.folder;
  }
  if (input.hintSeen !== undefined) next.hintSeen = input.hintSeen === true;
  return next;
}
function createDemoServer() {
  let layout = initialLayout(), revision = 1, last = { kind: null }, recents = [];
  const server = http.createServer((req, res) => {
    const authority = '127.0.0.1:' + server.address().port;
    const origin = 'http://' + authority;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    function json(status, data) { res.writeHead(status, { 'Content-Type': TYPES['.json'] }); res.end(JSON.stringify(data)); }
    if (req.headers.host !== authority || (req.headers.origin && req.headers.origin !== origin)) return json(403, { ok: false });
    if (req.headers['sec-fetch-site'] === 'cross-site') return json(403, { ok: false });
    let url;
    try { url = new URL(req.url, origin); } catch (err) { return json(400, { ok: false }); }
    const route = url.pathname;
    function file(filename, mime) {
      fs.readFile(filename, (err, data) => {
        if (err) return json(404, { ok: false });
        res.writeHead(200, { 'Content-Type': mime }); res.end(data);
      });
    }
    if (req.method === 'GET') {
      const poster = /^\/demo\/recommendations\/([0-2])\.svg$/.exec(route);
      if (poster) { res.writeHead(200, { 'Content-Type': TYPES['.svg'] }); return res.end(POSTERS[Number(poster[1])]); }
      if (route === '/') return file(path.join(ASSETS, 'home.html'), TYPES['.html']);
      if (route.startsWith('/assets/')) {
        let target;
        try {
          target = fs.realpathSync(path.join(ASSETS, decodeURIComponent(route.slice(8))));
        } catch (err) { return json(404, { ok: false }); }
        if (!target.startsWith(fs.realpathSync(ASSETS) + path.sep) || !TYPES[path.extname(target)]) return json(404, { ok: false });
        return file(target, TYPES[path.extname(target)]);
      }
      if (route === '/api/home/wallpaper') {
        const slot = url.searchParams.get('slot');
        const image = Object.prototype.hasOwnProperty.call(WALLPAPERS, slot) ? WALLPAPERS[slot] : null;
        return image ? file(path.join(ROOT, '..', image), TYPES['.jpg']) : json(404, { ok: false });
      }
      if (route === '/api/home/catalogue') return json(200, { ok: true, apps: APPS, devices: DEVICES,
        channels: [], recommended: layout.recommended ? RECOMMENDATIONS : [],
        order: Object.assign({}, layout.order, { rec: layout.recommended ? layout.order.rec : [] }), layout, layoutVersion: String(revision), sources: { channels: 0, recommended: layout.recommended ? RECOMMENDATIONS.length : false }, wallpapers: WALL_STATE,
        photos: { appId: '', installed: false, icon: null } });
      if (route === '/api/home/weather') return json(200, { ok: true, temperature: 18, code: 2, isDay: true,
        observedAt: Date.now(), stale: false, label: 'Ville de démonstration', demo: true });
      if (route === '/api/home/now') return json(200, last);
      if (route === '/api/home/recents') return json(200, { ok: true, apps: recents });
      if (route === '/api/home/guide') return json(200, { ok: true, guide: {} });
      if (route === '/api/home/picture') return json(200, { ok: true });
      return json(404, { ok: false, error: 'Unavailable in offline demo' });
    }
    if (req.method !== 'POST') return json(405, { ok: false });
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(415, { ok: false });
    let body = '', tooLarge = false;
    req.on('data', chunk => { if (tooLarge) return; body += chunk; if (Buffer.byteLength(body) > 16384) { tooLarge = true; json(413, { ok: false }); } });
    req.on('end', () => {
      if (tooLarge) return;
      let input;
      try { input = JSON.parse(body); } catch (err) { return json(400, { ok: false }); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return json(400, { ok: false });
      if (route === '/api/home/layout') {
        try { layout = updateLayout(layout, input); revision++; } catch (err) { return json(400, { ok: false }); }
        return json(200, { ok: true, layout });
      }
      if (route === '/api/home/beat') return json(200, { ok: true, build: 'offline-demo', layoutVersion: String(revision), wallpapers: WALL_STATE });
      if (route === '/api/home/open') {
        if (input.kind === 'rec') {
          const card = layout.recommended && RECOMMENDATIONS.find(card => card.id === input.id);
          if (!card) return json(400, { ok: false });
          const app = APPS.find(app => app.id === card.app);
          last = { kind: 'app', appId: app.id, title: app.title };
          return json(200, { ok: true, demo: true });
        }
        if (input.kind === 'photos') return json(200, { ok: false, demo: true, error: 'Photos non configuré dans la démo hors ligne' });
        const item = input.kind === 'app' ? APPS.find(app => app.id === input.id) : input.kind === 'dev' ? DEVICES.find(device => device.id === input.id) : null;
        if (item) {
          last = input.kind === 'app' ? { kind: 'app', appId: item.id, title: item.title } : { kind: 'input', port: item.port, name: item.name };
          if (input.kind === 'app') recents = [item].concat(recents.filter(app => app.id !== item.id));
          return json(200, { ok: true, demo: true });
        }
        if (input.kind === 'lg' || (input.kind === 'app' && input.id === 'lg-home')) return json(200, { ok: true, demo: true });
        return json(400, { ok: false });
      }
      if (route === '/api/home/recents') {
        if (input.action === 'closeAll') recents = [];
        else if (input.action === 'close') recents = recents.filter(app => app.id !== input.id);
        else if (input.action !== 'open' || !recents.some(app => app.id === input.id)) return json(400, { ok: false });
        return json(200, { ok: true, apps: recents, demo: true });
      }
      return json(404, { ok: false, error: 'Unavailable in offline demo' });
    });
  });
  return server;
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log('Usage: node scripts/emulate-tv.js [--port 8080]\nOffline demo; loopback only; no TV or external network access.'); process.exit(0); }
  if (args.length && (args.length !== 2 || args[0] !== '--port' || !/^\d+$/.test(args[1]))) throw new Error('Use --port NUMBER');
  const port = args.length ? Number(args[1]) : 8080;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  const server = createDemoServer();
  server.on('error', err => { console.error('Demo could not listen: ' + err.code); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log('Offline demo: http://127.0.0.1:' + server.address().port + '/\nSynthetic weather and launches; layout changes reset on restart.'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
module.exports = { createDemoServer };
