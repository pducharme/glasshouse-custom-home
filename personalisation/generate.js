#!/usr/bin/env node
'use strict';

// Generate only the explicitly listed public files; never copy TV configuration.
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var spawnSync = require('child_process').spawnSync;
var root = __dirname;
var server = path.join(root, '..', 'glasshouse', 'server');
var check = process.argv.slice(2).join(' ') === '--check';
if (process.argv.length > 2 && !check) {
  console.error('Usage: node personalisation/generate.js [--check]');
  process.exit(2);
}
var files = {
  'assets/home.html': '292735c255dc1f296713b5c5bff95c3edafa69df56dd93b73de72145a644045f',
  'lib/home.js': 'a4c2a497044712d9556f4f35b538ea93da071330a741bfba448740b81fa71680',
  'lib/routes.js': '1590eb5471882b5f73cb8b0576abfd10cb385deba936212304c3254f377efaf6'
};
var manifest = {
  version: 1,
  baseVersion: '0.118.0',
  baseCommit: '859f5e134e0d9d4b499afe48084b9cdb82db9164',
  patches: [],
  assets: []
};
var outputs = {};
function hash(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
function read(file) {
  if (!fs.lstatSync(file).isFile()) throw new Error('Expected a regular source file: ' + file);
  return fs.readFileSync(file);
}

Object.keys(files).forEach(function (relative) {
  var before = path.join(root, 'base', relative);
  var after = path.join(server, relative);
  if (hash(read(before)) !== files[relative]) throw new Error('Pinned base changed: ' + relative);
  var result = spawnSync('diff', ['-u', '-L', 'a/' + relative, '-L', 'b/' + relative, before, after], {
    encoding: 'utf8', maxBuffer: 2 * 1024 * 1024
  });
  if (result.error || result.status !== 1) throw new Error('Expected a readable, changed source: ' + relative);
  var patch = 'patches/' + relative.replace(/\//g, '-') + '.patch';
  outputs[patch] = Buffer.from(result.stdout);
  manifest.patches.push({ file: relative, patch: patch, baseSha256: files[relative], customSha256: hash(read(after)) });
});

['lib/home-weather.js', 'assets/home-wallpaper-dark.jpg'].forEach(function (relative) {
  var data = read(path.join(server, relative));
  var source = 'files/' + relative;
  outputs[source] = data;
  manifest.assets.push({ file: relative, source: source, sha256: hash(data) });
});
outputs['manifest.json'] = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');

var stale = [];
Object.keys(outputs).forEach(function (relative) {
  var destination = path.join(root, relative);
  if (check) {
    if (!fs.existsSync(destination) || !read(destination).equals(outputs[relative])) stale.push(relative);
  } else {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, outputs[relative], { mode: 420 });
    fs.chmodSync(destination, 420);
  }
});
if (stale.length) {
  console.error('Regenerate the bundle: ' + stale.join(', '));
  process.exitCode = 1;
} else {
  console.log(check ? 'Bundle matches public sources and pinned base.' : 'Generated 3 patches and 2 public assets.');
}
