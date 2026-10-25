/**
 * test/test-mqtt-ca.js - a broker CA file, where there is one, is what the
 * TLS connection to the broker trusts; without it, Node's own list
 *
 * Strict ES5: runs on node 0.12.
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var tls = require('tls');
var EventEmitter = require('events').EventEmitter;
var toBuffer = require('../server/lib/util').toBuffer;

var CA_FILE = path.join(__dirname, '..', 'server', 'mqtt-ca.pem');
var PEM = '-----BEGIN CERTIFICATE-----\nMIIBexample\n-----END CERTIFICATE-----\n';

// The file is read through fs, so only its path is answered here.
var caPresent = false;
var realRead = fs.readFileSync;
fs.readFileSync = function (p) {
  if (path.resolve(String(p)) === CA_FILE) {
    if (caPresent) return toBuffer(PEM);
    var e = new Error('ENOENT: no such file'); e.code = 'ENOENT'; throw e;
  }
  return realRead.apply(fs, arguments);
};

// Each connection is a socket that fails at once, after its options are kept.
var seen = [];
tls.connect = function (opts) {
  seen.push(opts);
  var s = new EventEmitter();
  s.write = s.end = s.destroy = s.setTimeout = s.setNoDelay = s.setKeepAlive = function () {};
  process.nextTick(function () { s.emit('error', new Error('refused')); s.emit('close'); });
  return s;
};

var MiniMQTT = require('../server/lib/mqtt');

console.log('Running test-mqtt-ca.js ...');

function check(present, done) {
  caPresent = present;
  seen = [];
  MiniMQTT.testConnection({ host: 'broker.example', port: 8883, tls: true }, function () {
    var client = new MiniMQTT({ host: 'broker.example', tls: true, clientId: 'test' });
    client.on('error', function () {});
    client.connect();
    assert.strictEqual(seen.length, 2, 'the connection test and the client both connected over TLS');
    seen.forEach(function (opts) {
      if (present) assert.strictEqual(String(opts.ca), PEM, 'the CA file is what the broker is verified against');
      else assert.strictEqual(opts.ca, undefined, 'without the file, Node\'s own list is used');
      assert.strictEqual(opts.rejectUnauthorized, true, 'the broker is still verified');
    });
    done();
  });
}

check(true, function () {
  console.log('  ✓ with mqtt-ca.pem, the client and the connection test trust that CA');
  check(false, function () {
    console.log('  ✓ without it, they use Node\'s own list');
    console.log('ALL test-mqtt-ca.js assertions passed!\n');
    process.exit(0);
  });
});
