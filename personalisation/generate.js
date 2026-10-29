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
// Public upstream source checksum, not a credential for remote access.
var remoteSourceSha256 = '0406460e157a9de8ae2c23f5e2597427d273cbb82f3f8d0917121af3baa8113b';
var files = {
  'assets/home.html': 'd06a2782462f6565cda0311c9e8bd667aa0fd7444b4f9f20eba793365b7a8573',
  'lib/home.js': '1c629931aed49bba02aa13efd60a0d7b832f5e1bf4674138790df7da58503890',
  'lib/routes.js': 'ba857a4bb6f19fac070967beb7eafdbca867c5a0d946338a56a0fa728ee79170',
  'lib/remotekeys.js': remoteSourceSha256
};
var manifest = {
  version: 1,
  baseVersion: '0.130.0',
  baseCommit: '1543769cfeb28c3ce0936dc6d20b24cd58c70255',
  patches: [],
  assets: []
};
var outputs = {};
// Python's stdlib gives macOS and Linux the same hunk selection. Native BSD and
// GNU diff can encode identical changes differently, breaking byte-for-byte checks.
var unifiedDiff = [
  'import difflib, pathlib, sys',
  'before = pathlib.Path(sys.argv[1]).read_bytes().decode("utf-8")',
  'after = pathlib.Path(sys.argv[2]).read_bytes().decode("utf-8")',
  'if not before.endswith("\\n") or not after.endswith("\\n"):',
  '    raise ValueError("Patch sources must end with a newline")',
  'patch = difflib.unified_diff(before.splitlines(keepends=True), after.splitlines(keepends=True),',
  '    fromfile="a/" + sys.argv[3], tofile="b/" + sys.argv[3], n=3)',
  'sys.stdout.buffer.write("".join(patch).encode("utf-8"))'
].join('\n');
function hash(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
function read(file) {
  if (!fs.lstatSync(file).isFile()) throw new Error('Expected a regular source file: ' + file);
  return fs.readFileSync(file);
}

Object.keys(files).forEach(function (relative) {
  var before = path.join(root, 'base', relative);
  var after = path.join(server, relative);
  if (hash(read(before)) !== files[relative]) throw new Error('Pinned base changed: ' + relative);
  var result = spawnSync('python3', ['-c', unifiedDiff, before, after, relative], {
    encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, timeout: 15000
  });
  if (result.error || result.status !== 0 || !result.stdout) {
    throw new Error('Could not generate patch for ' + relative + '; Python 3 and newline-terminated, changed UTF-8 sources are required.');
  }
  var patch = 'patches/' + relative.replace(/\//g, '-') + '.patch';
  outputs[patch] = Buffer.from(result.stdout);
  manifest.patches.push({ file: relative, patch: patch, baseSha256: files[relative], customSha256: hash(read(after)) });
});

['lib/home-weather.js', 'assets/home-wallpaper-dark.jpg',
  'assets/third-party/immich/immich-logo.svg', 'assets/third-party/immich/LICENSE-AGPL-3.0.txt',
  'assets/third-party/immich/NOTICE.txt'].forEach(function (relative) {
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
  console.log(check ? 'Bundle matches public sources and pinned base.' : 'Generated ' + manifest.patches.length + ' patches and ' + manifest.assets.length + ' public assets.');
}
