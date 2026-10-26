/**
 * test/test-sound-outputs.js - Home Assistant's Sound Output select offers the
 * outputs this TV has, as LG's own Quick Settings menu decides them, rather
 * than every output the firmware knows
 *
 * Strict ES5: runs on node 0.12.
 */
var assert = require('assert');
var telemetry = require('../server/lib/telemetry');
var ha = require('../server/lib/ha');
var names = require('../server/lib/names');

console.log('Running test-sound-outputs.js ...');

function v(value, visible, active) {
  return { value: value, visible: visible !== false, active: active !== false };
}

// A C2 on webOS 9.2, as getSystemSettingValues and configd answered it.
var C2_VALUES = ['tv_speaker', 'tv_speakerbar', 'external_optical', 'external_arc', 'bt_soundbar', 'wisa_speaker',
  'mobile_phone', 'lineout', 'builtin_soundbar', 'headphone', 'bt_audio', 'tv_external_speaker', 'tv_speaker_headphone',
  'tv_speaker_bluetooth', 'tv_speakerbar_headphone', 'tv_speaker_external_arc', 'usb_speaker'].map(function (x) { return v(x); })
  .concat([v('tv_speaker_optical_arc', false, false), v('wow_cast'), v('tv_speaker_wow_cast')]);
var C2_CONFIGS = {
  'system.supportBluetoothFeatures': ['btsound', 'wirelesskeyboard', 'gamepad', 'remoteapp', 'quicksettings', 'userguide',
    'remotediagnosis', 'btsoundsink', 'self-diagnosis', 'bluetoothPlusTvSpeaker'],
  'tv.model.supportHeadPhone': true,
  'com.webos.service.wowplay.supportWowCast': true,
  'tv.model.supportOpticalJack': 'On',
  'tv.model.supportAudioLineOut': true,
  'tv.model.supportWiSA': false
};

// 1. The C2: what LG's menu shows, in its order.
var c2 = telemetry.offeredSoundOutputs(C2_VALUES, C2_CONFIGS, 'tv_speaker');
assert.deepEqual(c2, ['tv_speaker', 'external_optical', 'tv_external_speaker', 'external_arc', 'bt_soundbar',
  'tv_speaker_bluetooth', 'wow_cast', 'lineout', 'headphone', 'tv_speaker_headphone', 'mobile_phone']);
['tv_speakerbar', 'builtin_soundbar', 'bt_audio', 'wisa_speaker', 'usb_speaker', 'tv_speaker_optical_arc'].forEach(function (id) {
  assert.strictEqual(c2.indexOf(id), -1, id + ' is not offered on the C2');
});
console.log('  ✓ a C2 is offered what LG\'s own menu offers: 11 of the 20 outputs it lists');

// 2. The output in use is always offered, even one only offered while in use.
var inUse = telemetry.offeredSoundOutputs(C2_VALUES, C2_CONFIGS, 'tv_speaker_external_arc');
assert.ok(inUse.indexOf('tv_speaker_external_arc') !== -1);
assert.ok(inUse.indexOf('tv_speaker_external_arc') < inUse.indexOf('bt_soundbar'), 'in LG\'s order');
console.log('  ✓ the output in use stays on the list');

// 3. What the model has decides the rest.
var noJack = {};
for (var k in C2_CONFIGS) noJack[k] = C2_CONFIGS[k];
noJack['tv.model.supportOpticalJack'] = 'Off';
noJack['tv.model.supportHeadPhone'] = false;
noJack['tv.model.supportWiSA'] = true;
noJack['system.supportBluetoothFeatures'] = ['remoteapp'];
var other = telemetry.offeredSoundOutputs(C2_VALUES, noJack, 'tv_speaker');
['external_optical', 'tv_external_speaker', 'headphone', 'tv_speaker_headphone', 'lineout', 'bt_soundbar',
  'tv_speaker_bluetooth'].forEach(function (id) { assert.strictEqual(other.indexOf(id), -1, id + ' dropped'); });
assert.ok(other.indexOf('wisa_speaker') !== -1, 'WiSA where the model has it');
console.log('  ✓ the model\'s settings take away what it lacks and add WiSA where it has it');

// 4. With no model settings (an older TV): common outputs stay, rare ones go,
// and outputs named outside LG's ordering are kept after it.
var older = telemetry.offeredSoundOutputs([v('optical'), v('tv_speaker'), v('external_arc'), v('wisa_speaker'),
  v('soundbar'), v('headphone')], {}, 'tv_speaker');
assert.deepEqual(older, ['tv_speaker', 'external_arc', 'headphone', 'optical', 'soundbar']);
console.log('  ✓ without the model\'s settings, an older TV\'s own outputs are kept');

// 5. Nothing listed: no list, so Home Assistant keeps every known output.
assert.deepEqual(telemetry.offeredSoundOutputs(null, C2_CONFIGS, 'tv_speaker'), []);
assert.deepEqual(telemetry.offeredSoundOutputs([v('tv_speakerbar')], C2_CONFIGS, ''), []);
console.log('  ✓ with no usable list there is none, and the full one stands');

// 6. The select: the offered outputs once known, every known output before.
function soundSelect(opts) {
  var ents = ha.buildEntities(opts);
  for (var i = 0; i < ents.length; i++) if (ents[i].id === 'sound_output') return ents[i].payload;
  return null;
}
var known = soundSelect({ soundOutputs: c2 });
assert.deepEqual(known.options, ['TV Speaker', 'Optical', 'TV Speaker + Optical', 'HDMI ARC', 'Bluetooth',
  'TV Speaker + Bluetooth', 'LG WOWCAST', 'Line Out', 'Headphone / AUX', 'TV Speaker + Headphone', 'Mobile Phone']);
var before = soundSelect({});
var everyName = [];
Object.keys(names.SOUND_OUTPUTS).forEach(function (id) {
  // Outputs sharing a name (optical and external_optical) are one option.
  if (everyName.indexOf(names.SOUND_OUTPUTS[id]) === -1) everyName.push(names.SOUND_OUTPUTS[id]);
});
assert.deepEqual(before.options, everyName, 'every known output before the TV says');
console.log('  ✓ Home Assistant\'s select lists the 11, and every known output until the TV has said');

console.log('ALL test-sound-outputs.js assertions passed!\n');
