'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var child = require('child_process');
var vm = require('vm');

function hash(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
function remove(file) { fs.rmSync(file, { recursive: true, force: true }); }
function location(base, relative) {
  if (typeof relative !== 'string' || !relative || /[\\\x00]/.test(relative) ||
      path.isAbsolute(relative) || relative.split('/').some(function (p) { return !p || p === '.' || p === '..'; })) {
    throw new Error('Invalid relative path: ' + relative);
  }
  var current = base;
  relative.split('/').forEach(function (part) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Symlink refused: ' + relative);
  });
  return current;
}
function snapshot(file) {
  try {
    var stat = fs.lstatSync(file);
    if (!stat.isFile()) throw new Error('Not a regular file: ' + file);
    var data = fs.readFileSync(file);
    return { data: data, hash: hash(data), mode: stat.mode & 4095 };
  } catch (err) { if (err.code === 'ENOENT') return null; throw err; }
}
function atomic(file, data, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  var temporary = file + '.personalisation-' + process.pid;
  try {
    fs.writeFileSync(temporary, data, { mode: mode, flag: 'wx' });
    fs.chmodSync(temporary, mode);
    fs.renameSync(temporary, file);
  } finally { remove(temporary); }
}
function processIdentity(pid) {
  try {
    var boot = fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
    var stat = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    var started = stat.slice(stat.lastIndexOf(') ') + 2).trim().split(/\s+/)[19];
    return boot && /^\d+$/.test(started) ? boot + ':' + started : null;
  } catch (_) { return null; }
}
function lock(root) {
  var directory = path.join(root, 'apply.lock');
  try { fs.mkdirSync(directory, { mode: 448 }); }
  catch (err) {
    if (err.code !== 'EEXIST') throw err;
    var owner;
    try { owner = JSON.parse(fs.readFileSync(path.join(directory, 'owner.json'), 'utf8')); }
    catch (_) {
      if (Date.now() - fs.statSync(directory).mtimeMs < 60000) return false;
    }
    if (owner && Number.isInteger(owner.pid) && owner.pid > 0) {
      var identity = processIdentity(owner.pid);
      if (!owner.identity || !identity || owner.identity === identity) {
        try { process.kill(owner.pid, 0); return false; }
        catch (check) { if (check.code !== 'ESRCH') return false; }
      }
    }
    remove(directory);
    try { fs.mkdirSync(directory, { mode: 448 }); }
    catch (retry) { if (retry.code === 'EEXIST') return false; throw retry; }
  }
  fs.writeFileSync(path.join(directory, 'owner.json'), JSON.stringify({ pid: process.pid, identity: processIdentity(process.pid) }));
  return true;
}
function run(command, args, cwd) {
  var result = child.spawnSync(command, args, { cwd: cwd, input: '', encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
  return !result.error && result.status === 0 && !/fuzz/i.test((result.stdout || '') + (result.stderr || ''));
}
// BusyBox patch has no fuzz=0 option; require every complete hunk to match exactly once.
function exactHunks(content, patch, reverse) {
  var lines = content.split('\n');
  var hunks = [], current = null;
  patch.split('\n').forEach(function (line) {
    if (/^@@ /.test(line)) { current = []; hunks.push(current); }
    else if (current && (line.charAt(0) === ' ' || line.charAt(0) === (reverse ? '+' : '-'))) current.push(line.slice(1));
  });
  return hunks.length > 0 && hunks.every(function (hunk) {
    if (!hunk.length) return false;
    var matches = 0;
    for (var i = 0; i <= lines.length - hunk.length; i++) {
      var j = 0;
      while (j < hunk.length && lines[i + j] === hunk[j]) j++;
      if (j === hunk.length && ++matches > 1) return false;
    }
    return matches === 1;
  });
}
function validate(file, relative) {
  if (/\.js$/.test(relative) && !run(process.execPath, ['--check', file])) throw new Error('Invalid JavaScript: ' + relative);
  if (/\.html$/.test(relative)) {
    var html = fs.readFileSync(file, 'utf8'), scripts = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, match;
    while ((match = scripts.exec(html))) {
      var type = /\btype\s*=\s*["']([^"']+)/i.exec(match[1]);
      if (!type || /^(text|application)\/(java|ecma)script$/i.test(type[1])) new vm.Script(match[2], { filename: relative });
    }
  }
}

function apply(root, target, options) {
  options = options || {};
  root = path.resolve(root); target = path.resolve(target);
  var acquired = false, stage, writes = [], committed = [];
  try {
    if (!fs.statSync(target).isDirectory()) throw new Error('Missing installation directory');
    acquired = lock(root);
    if (!acquired) return { state: 'busy', changed: false, message: 'Another personalisation apply is running.' };
    var manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    if (manifest.version !== 1 || !Array.isArray(manifest.patches) || !Array.isArray(manifest.assets)) throw new Error('Unsupported manifest');
    stage = fs.mkdtempSync(path.join(root, '.stage-'));
    var seen = Object.create(null), observations = [];
    function entry(relative) {
      if (seen[relative]) throw new Error('Duplicate destination: ' + relative);
      seen[relative] = true;
      var destination = location(target, relative);
      var item = { file: relative, destination: destination, before: snapshot(destination) };
      observations.push(item);
      return item;
    }
    manifest.patches.forEach(function (spec) {
      var item = entry(spec.file);
      if (!item.before) throw new Error('Missing upstream file: ' + spec.file);
      var patchFile = location(root, spec.patch), patch = fs.readFileSync(patchFile, 'utf8');
      var oldHeaders = patch.match(/^--- .*$/gm) || [], newHeaders = patch.match(/^\+\+\+ .*$/gm) || [];
      if (oldHeaders.length !== 1 || oldHeaders[0] !== '--- a/' + spec.file ||
          newHeaders.length !== 1 || newHeaders[0] !== '+++ b/' + spec.file) throw new Error('Patch path mismatch: ' + spec.file);
      if (spec.customSha256 && item.before.hash === spec.customSha256) return;
      var staged = location(stage, spec.file);
      atomic(staged, item.before.data, item.before.mode);
      var source = item.before.data.toString('utf8');
      if (exactHunks(source, patch, true) && run('patch', ['-R', '--dry-run', '-p1', '-i', patchFile], stage)) return;
      if (!exactHunks(source, patch, false) || !run('patch', ['--dry-run', '-p1', '-i', patchFile], stage) ||
          !run('patch', ['-p1', '-i', patchFile], stage)) throw new Error('Upstream conflict: ' + spec.file);
      validate(staged, spec.file);
      item.data = fs.readFileSync(staged); item.mode = item.before.mode;
      writes.push(item);
    });
    manifest.assets.forEach(function (spec) {
      var item = entry(spec.file), source = location(root, spec.source), data = fs.readFileSync(source);
      if (!/^[a-f0-9]{64}$/.test(spec.sha256) || hash(data) !== spec.sha256) throw new Error('Asset checksum mismatch: ' + spec.file);
      if (item.before && item.before.hash === spec.sha256) return;
      if (item.before) throw new Error('Asset collision: ' + spec.file);
      validate(source, spec.file);
      item.data = data; item.mode = fs.statSync(source).mode & 4095;
      writes.push(item);
    });
    if (!writes.length) return { state: 'current', changed: false, message: 'Personalisation is already installed.' };

    var backups = path.join(root, 'backups'), prepared = path.join(stage, 'backup');
    fs.mkdirSync(prepared);
    writes.forEach(function (item) {
      if (item.before) atomic(path.join(prepared, item.file), item.before.data, item.before.mode);
    });
    fs.writeFileSync(path.join(prepared, 'snapshot.json'), JSON.stringify({ at: new Date().toISOString(), files: writes.map(function (item) {
      return { file: item.file, existed: !!item.before, sha256: item.before && item.before.hash };
    }) }, null, 2));
    if (options.beforeCommit) options.beforeCommit();
    var stable = observations.every(function (item) {
      var current = snapshot(location(target, item.file));
      return (!current && !item.before) || (current && item.before && current.hash === item.before.hash && current.mode === item.before.mode);
    });
    if (!stable) return { state: 'busy', changed: false, message: 'Installation changed during preparation; retry when stable.' };
    fs.mkdirSync(backups, { recursive: true });
    remove(path.join(backups, 'previous'));
    if (fs.existsSync(path.join(backups, 'latest'))) fs.renameSync(path.join(backups, 'latest'), path.join(backups, 'previous'));
    fs.renameSync(prepared, path.join(backups, 'latest'));
    writes.forEach(function (item, index) {
      if (options.beforeWrite) options.beforeWrite(item.file, index);
      atomic(item.destination, item.data, item.mode);
      committed.push(item);
    });
    return { state: 'applied', changed: true, message: 'Personalisation applied, preserving unrelated upstream changes.', files: writes.map(function (item) { return item.file; }) };
  } catch (err) {
    var rollbackErrors = [];
    committed.reverse().forEach(function (item) {
      try {
        if (item.before) atomic(item.destination, item.before.data, item.before.mode);
        else fs.unlinkSync(item.destination);
      } catch (restore) { rollbackErrors.push(item.file + ': ' + restore.message); }
    });
    return { state: 'blocked', changed: rollbackErrors.length > 0, message: err.message + (rollbackErrors.length ? '; rollback failed: ' + rollbackErrors.join('; ') : '') };
  } finally {
    if (stage) remove(stage);
    if (acquired) remove(path.join(root, 'apply.lock'));
  }
}

module.exports = { apply: apply };
if (require.main === module) {
  var result = apply(process.argv[2] || __dirname, process.argv[3] || '/var/lib/tvweb');
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.state === 'blocked' ? 2 : result.state === 'busy' ? 3 : 0;
}
