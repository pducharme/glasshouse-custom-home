'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var execFileSync = require('child_process').execFileSync;
var ROOT = '/var/lib/glasshouse-personalisation';
var TARGET = '/var/lib/tvweb';

function stamp(file) {
  try {
    var s = fs.statSync(file);
    return [s.ino, s.size, s.mtime.getTime(), s.ctime.getTime()];
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

function fingerprint(root, target) {
  var manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  var files = [path.join(root, 'manifest.json'), path.join(root, 'apply.js'),
    path.join(target, 'tvweb.js'), path.join(target, 'tvwebctl')];
  (manifest.patches || []).concat(manifest.assets || []).forEach(function (entry) {
    var dest = path.resolve(target, entry.file);
    var source = path.resolve(root, entry.patch || entry.source);
    if (dest.indexOf(target + path.sep) !== 0 || source.indexOf(root + path.sep) !== 0) {
      throw new Error('manifest path outside its directory');
    }
    files.push(dest, source);
  });
  return crypto.createHash('sha256').update(JSON.stringify(files.sort().map(function (file) {
    return [file, stamp(file)];
  }))).digest('hex');
}

function isRunning(target) {
  try {
    var pid = fs.readFileSync('/var/run/tvweb.pid', 'utf8').trim();
    if (!/^[1-9][0-9]*$/.test(pid)) return false;
    process.kill(Number(pid), 0);
    return fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8').split('\0')
      .indexOf(path.join(target, 'tvweb.js')) !== -1;
  } catch (e) { return false; }
}

function createGuard(options) {
  options = options || {};
  var root = path.resolve(options.root || ROOT);
  var target = path.resolve(options.target || TARGET);
  var apply = options.apply || require('./apply').apply;
  var running = options.isRunning || function () { return isRunning(target); };
  var restart = options.restart || function () {
    execFileSync(path.join(target, 'tvwebctl'), ['restart'], {
      timeout: 20000, maxBuffer: 65536, stdio: 'pipe'
    });
  };
  var previous = null, processed = null, processedResult = null, lastStatus = null;

  function installing() {
    return ['.update', '.deploy', '.hbc-stage'].some(function (name) {
      return fs.existsSync(path.join(target, name));
    });
  }

  function save(result, key) {
    var status = {
      state: result.state, changed: !!result.changed, message: result.message || '',
      fingerprint: key || null, restart: result.restart || 'not-needed'
    };
    if (result.files) status.files = result.files;
    if (result.restartError) status.restartError = result.restartError;
    var plain = JSON.stringify(status);
    if (plain === lastStatus) return result;
    status.at = new Date().toISOString();
    var tmp = path.join(root, 'status.json.new.' + process.pid);
    fs.writeFileSync(tmp, JSON.stringify(status, null, 2) + '\n', { mode: 384 });
    fs.renameSync(tmp, path.join(root, 'status.json'));
    lastStatus = plain;
    return result;
  }

  function cycle(force) {
    if (!fs.existsSync(path.join(target, 'tvweb.js'))) {
      previous = null;
      return save({ state: 'waiting', changed: false, message: 'Glasshouse is not installed; no action.' });
    }
    if (installing()) {
      previous = null;
      return save({ state: 'busy', changed: false, message: 'Waiting for the Glasshouse installer to finish.' });
    }
    var key;
    try { key = fingerprint(root, target); }
    catch (e) { return save({ state: 'blocked', changed: false, message: e.message }); }
    if (key === processed) {
      save(processedResult, processed);
      return { state: 'unchanged', changed: false };
    }
    if (!force && key !== previous) {
      previous = key;
      return { state: 'settling', changed: false };
    }
    previous = key;
    var result;
    try { result = apply(root, target); }
    catch (e) { result = { state: 'blocked', changed: false, message: e.message }; }
    if (result.state === 'busy') return save(result, key);
    if (installing()) {
      previous = processed = null;
      return save({ state: 'busy', changed: false, message: 'Installer started during the check; restart deferred.' });
    }
    // Remember failures too: a conflict or failed restart must not create a loop.
    try { processed = fingerprint(root, target); } catch (e) { processed = key; }
    previous = processed;
    if (result.state === 'applied' && result.changed) {
      if (!running()) result.restart = 'stopped';
      else {
        try { restart(); result.restart = 'done'; }
        catch (e) {
          result.restart = 'failed';
          result.restartError = String(e.message || e).slice(0, 500);
        }
      }
    }
    processedResult = result;
    return save(result, processed);
  }
  return { cycle: cycle };
}

module.exports = { createGuard: createGuard, fingerprint: fingerprint, isRunning: isRunning };

if (require.main === module) {
  if (process.argv[2] !== '--once' && process.argv[2] !== '--watch') {
    console.error('usage: guard.js --once|--watch');
    process.exitCode = 2;
  } else {
    var guard = createGuard();
    if (process.argv[2] === '--once') console.log(JSON.stringify(guard.cycle(true)));
    else {
      function tick() {
        try { guard.cycle(false); }
        catch (e) { console.error('personalisation: ' + e.message); }
      }
      tick();
      setInterval(tick, 10000);
    }
  }
}
