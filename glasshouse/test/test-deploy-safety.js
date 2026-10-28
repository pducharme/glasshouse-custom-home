/* Exercise the real deployment gates with a mock SSH transport and a temporary TV tree. */
'use strict';
const assert = require('assert');
const child = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../server/deploy.sh'), 'utf8');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'glasshouse-deploy-safety-'));
let number = 0;
function write(file, data, mode) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data, { mode: mode || 0o600 }); }
function fixture(options) {
  options = options || {};
  const root = path.join(temporary, String(++number));
  const install = path.join(root, 'tvweb');
  const local = path.join(root, 'server');
  const bin = path.join(root, 'bin');
  const record = path.join(root, 'transport.txt');
  // File copying is covered by the package checks; keep these shell tests small.
  let script = source.replace(/FILES="[\s\S]*?"/, 'FILES="LICENSE tvweb.js tvwebctl"');
  // If a regression selects telnet, fail the assertion without opening a socket.
  script = script.replace('# ---------------------------------------------------------------- go',
    'deploy_telnet() { echo telnet >> "$MOCK_RECORD"; exit 9; }\n# ---------------------------------------------------------------- go');
  write(path.join(local, 'deploy.sh'), script, 0o700);
  write(path.join(local, 'LICENSE'), fs.readFileSync(path.join(__dirname, '../LICENSE')));
  write(path.join(local, 'tvweb.js'), "var TVWEB_VERSION = '0.130.0';\n");
  write(path.join(local, 'tvwebctl'), '#!/bin/sh\nexit 0\n', 0o700);
  write(path.join(local, '50-tvweb.sh'), '#!/bin/sh\nexit 0\n', 0o700);
  if (options.seed !== undefined) write(path.join(local, 'config.json'), options.seed);
  if (options.existing !== undefined) {
    write(path.join(install, 'config.json'), options.existing);
    write(path.join(install, 'tvweb.js'), 'old installed server\n');
  }
  write(path.join(install, 'build.json'), 'installed-build-sentinel\n');
  write(path.join(bin, 'sleep'), '#!/bin/sh\nexit 0\n', 0o700);
  write(path.join(bin, 'ssh'), '#!' + process.execPath + '\n' + `
'use strict';
const fs = require('fs'), path = require('path'), child = require('child_process');
const command = process.argv[process.argv.length - 1];
function record(value) { fs.appendFileSync(process.env.MOCK_RECORD, value + '\\n'); }
if (command === 'true') { record('probe'); process.exit(process.env.MOCK_FAIL === '1' ? 1 : 0); }
if (command.includes('cat >')) {
  record('upload');
  const target = path.join(process.env.MOCK_ROOT, '.deploy/bundle.tar');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fs.readFileSync(0));
  process.exit(0);
}
if (command === 'sh -s') {
  record('install');
  const script = fs.readFileSync(0, 'utf8')
    .split('/var/lib/tvweb').join(process.env.MOCK_ROOT)
    .split('/var/lib/webosbrew').join(path.join(process.env.MOCK_ROOT, 'webosbrew'))
    .split('/usr/bin/node').join(process.execPath);
  const result = child.spawnSync('sh', ['-s'], { input: script, encoding: 'utf8', env: process.env });
  process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
  process.exit(result.status === null ? 1 : result.status);
}
throw new Error('Unexpected mock SSH command');
`, 0o700);
  const result = child.spawnSync('bash', [path.join(local, 'deploy.sh'), 'demo.invalid', '--no-persist', '--no-app'].concat(options.telnet ? ['--telnet'] : []), {
    encoding: 'utf8', timeout: 20000,
    env: Object.assign({}, process.env, { PATH: bin + path.delimiter + process.env.PATH, MOCK_ROOT: install,
      MOCK_RECORD: record, MOCK_FAIL: options.sshFail ? '1' : '0' })
  });
  if (result.error) throw result.error;
  return { install, result, output: result.stdout + result.stderr,
    calls: fs.existsSync(record) ? fs.readFileSync(record, 'utf8').trim().split('\n') : [] };
}
function config() { return JSON.stringify({ host: '127.0.0.1', token: crypto.randomBytes(24).toString('hex'), port: 8080 }); }
try {
  assert.ok(/FILES="LICENSE /.test(source), 'deployment includes the MIT license');
  assert.strictEqual(fs.readFileSync(path.join(__dirname, '../server/LICENSE'), 'utf8'), fs.readFileSync(path.join(__dirname, '../LICENSE'), 'utf8'));
  let test = fixture({ sshFail: true });
  assert.strictEqual(test.result.status, 1);
  assert.deepStrictEqual(test.calls, ['probe'], 'SSH failure cannot select telnet or send a bundle');
  assert.ok(test.output.includes('without falling back to telnet'));

  const seed = config();
  test = fixture({ seed, telnet: true });
  assert.strictEqual(test.result.status, 1);
  assert.deepStrictEqual(test.calls, [], 'telnet with a private seed fails before any transport');
  assert.ok(test.output.includes('Telnet cannot send a configuration seed'));
  assert.ok(!test.output.includes(JSON.parse(seed).token));

  for (const invalid of ['not JSON', JSON.stringify({ token: '' }), JSON.stringify({ token: 'REPLACE_WITH_RANDOM_TOKEN' })]) {
    test = fixture({ seed: invalid });
    assert.strictEqual(test.result.status, 1);
    assert.deepStrictEqual(test.calls, [], 'invalid seed is rejected locally before transport');
    assert.ok(test.output.includes('Invalid configuration seed'));
    assert.ok(!test.output.includes(invalid));
  }

  test = fixture();
  assert.strictEqual(test.result.status, 1);
  assert.deepStrictEqual(test.calls, ['probe', 'upload', 'install']);
  assert.ok(test.output.includes('first install requires a validated configuration seed'));
  assert.deepStrictEqual(fs.readdirSync(test.install), ['build.json'], 'missing config must not write installed code or delete build metadata');
  assert.strictEqual(fs.readFileSync(path.join(test.install, 'build.json'), 'utf8'), 'installed-build-sentinel\n');

  const existing = config();
  test = fixture({ existing, seed });
  assert.strictEqual(test.result.status, 0, test.output);
  assert.strictEqual(fs.readFileSync(path.join(test.install, 'config.json'), 'utf8'), existing, 'existing configuration is preserved exactly');
  assert.ok(fs.existsSync(path.join(test.install, 'LICENSE')));
  assert.ok(!test.output.includes(JSON.parse(existing).token) && !test.output.includes(JSON.parse(seed).token));

  test = fixture({ existing });
  assert.strictEqual(test.result.status, 0, test.output);
  assert.strictEqual(fs.readFileSync(path.join(test.install, 'config.json'), 'utf8'), existing, 'updates do not require a local private config copy');

  test = fixture({ seed });
  assert.strictEqual(test.result.status, 0, test.output);
  assert.strictEqual(fs.readFileSync(path.join(test.install, 'config.json'), 'utf8'), seed);
  assert.strictEqual(fs.statSync(path.join(test.install, 'config.json')).mode & 0o777, 0o600);
  assert.ok(!test.output.includes(JSON.parse(seed).token));

  test = fixture({ telnet: true, existing });
  assert.strictEqual(test.result.status, 9);
  assert.deepStrictEqual(test.calls, ['telnet'], 'telnet requires the explicit option and no seed');
  console.log('Deployment safety tests passed with mock transports; no TV or network was contacted.');
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
