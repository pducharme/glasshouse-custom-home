/**
 * test/test-names.js - Each raw value the TV reports has its display name and
 * its Prometheus label from the one table
 *
 * Strict ES5: runs on node 0.12.
 */
var assert = require('assert');
var names = require('../server/lib/names');

console.log('Running test-names.js ...');

function phy(raw, clock) {
  var m = names.hdmiPhyMode(raw, clock);
  return [m.display, m.label, m.bitsPerSecond];
}

assert.deepEqual(phy('FRL 12G 4L(R6)', null), ['FRL 48 Gbps', 'frl_48', 48e9]);
assert.deepEqual(phy('FRL 10G 4L', null), ['FRL 40 Gbps', 'frl_40', 40e9]);
assert.deepEqual(phy('FRL 8G 4L', null), ['FRL 32 Gbps', 'frl_32', 32e9]);
assert.deepEqual(phy('FRL 6G 4L', null), ['FRL 24 Gbps', 'frl_24', 24e9]);
assert.deepEqual(phy('FRL 6G 3L', null), ['FRL 18 Gbps', 'frl_18', 18e9]);
assert.deepEqual(phy('FRL 3G 3L', null), ['FRL 9 Gbps', 'frl_9', 9e9]);
console.log('  ✓ FRL is the lane rate times the lanes');

assert.deepEqual(phy('6G', 594000), ['TMDS (6G)', 'tmds_6g', 594000 * 1000 * 10 * 3]);
assert.deepEqual(phy('3G', 148500), ['TMDS (3G)', 'tmds_3g', 148500 * 1000 * 10 * 3]);
assert.deepEqual(phy('6G', null), ['TMDS (6G)', 'tmds_6g', null]);
assert.deepEqual(phy('3G', 0), ['TMDS (3G)', 'tmds_3g', null]);
console.log('  ✓ TMDS is the character clock on three channels, with no rate without a clock');

assert.deepEqual(phy('FRL CTS', null), ['FRL CTS', 'other', null]);
console.log('  ✓ an unknown PHY mode is shown as given and labelled other');

function both(m) { return [m.display, m.label]; }

assert.deepEqual(both(names.hdmiChroma('R444')), ['RGB 4:4:4', 'rgb_444']);
assert.deepEqual(both(names.hdmiChroma('Y444')), ['YCbCr 4:4:4', 'ycbcr_444']);
assert.deepEqual(both(names.hdmiChroma('Y422')), ['YCbCr 4:2:2', 'ycbcr_422']);
assert.deepEqual(both(names.hdmiChroma('Y420')), ['YCbCr 4:2:0', 'ycbcr_420']);
assert.deepEqual(both(names.hdmiChroma('Y440')), ['Y440', 'y440']);
console.log('  ✓ chroma, and an unknown one shown as given');

assert.deepEqual(both(names.hdmiHdcp('HDCP23')), ['HDCP 2.3', '2_3']);
assert.deepEqual(both(names.hdmiHdcp('HDCP22')), ['HDCP 2.2', '2_2']);
assert.deepEqual(both(names.hdmiHdcp('HDCP14')), ['HDCP 1.4', '1_4']);
assert.deepEqual(both(names.hdmiHdcp('HDCP0')), ['None', 'none']);
assert.deepEqual(both(names.hdmiHdcp('HDCP2X')), ['HDCP2X', 'hdcp2_x']);
console.log('  ✓ HDCP, and an unknown version shown as given');

function range(raw) {
  var r = names.dynamicRange(raw);
  return [r.display, r.label, r.lowLatency];
}

assert.deepEqual(range('sdr'), ['SDR', 'sdr', false]);
assert.deepEqual(range('hdr'), ['HDR', 'hdr', false]);
assert.deepEqual(range('dolbyHdr'), ['Dolby Vision', 'dolby_vision', false]);
assert.deepEqual(range('technicolorHdr'), ['Technicolor HDR', 'technicolor', false]);
assert.deepEqual(range('hdrALLM'), ['HDR · Low latency', 'hdr', true]);
assert.deepEqual(range('dolbyHdrALLM'), ['Dolby Vision · Low latency', 'dolby_vision', true]);
assert.deepEqual(range('technicolorHdrALLM'), ['Technicolor HDR · Low latency', 'technicolor', true]);
console.log('  ✓ dynamic range, with ALLM read off as low latency');

assert.deepEqual(range('hdr10Plus'), ['HDR10 Plus', 'hdr10_plus', false]);
assert.deepEqual(range('hlgALLM'), ['HLG · Low latency', 'hlg', true]);
console.log('  ✓ an unknown dynamic range is shown readably and keeps its own label');

function hdrType(raw) {
  var n = names.signalHdrType(raw);
  return [n.display, n.label];
}
assert.deepEqual(hdrType('NONE'), ['SDR', 'sdr']);
assert.deepEqual(hdrType('HDR10'), ['HDR10', 'hdr10']);
assert.deepEqual(hdrType('DOLBY_VISION'), ['Dolby Vision', 'dolby_vision']);
assert.deepEqual(hdrType('DOLBY_LL'), ['Dolby Vision (low latency)', 'dolby_vision_low_latency']);
assert.deepEqual(hdrType('HLG'), ['HLG', 'hlg']);
console.log('  ✓ HDR type');

assert.deepEqual(hdrType('HDR10_PLUS'), ['HDR10 Plus', 'hdr10_plus']);
assert.deepEqual(hdrType('HdrTypeNew'), ['HDR Type New', 'hdr_type_new']);
console.log('  ✓ an unknown HDR type is spelled out and snake-cased');

assert.deepEqual([0, 1, 2, 3].map(function (c) { return names.signalEotf(c).label; }), ['sdr', 'hdr', 'pq', 'hlg']);
assert.strictEqual(names.signalEotf(4), null);
console.log('  ✓ EOTF, with no name for a reserved code');

assert.strictEqual(names.signalColorimetry('BT2020_RGBORYCbCr').label, 'bt2020_rgb_or_ycbcr');
assert.strictEqual(names.signalColorimetry('BT709').label, 'bt709');
assert.strictEqual(names.signalEncoding('RGB').label, 'rgb_444');
assert.strictEqual(names.signalEncoding('YCbCr444').label, 'ycbcr_444');
assert.strictEqual(names.signalEncoding('YCbCr422').label, 'ycbcr_422');
assert.strictEqual(names.signalEncoding('YCbCr420').label, 'ycbcr_420');
assert.strictEqual(names.signalEncoding('YCbCr440').label, 'ycb_cr440');
console.log('  ✓ colorimetry and pixel encoding, and unknown ones in snake case');

assert.strictEqual(names.powerOnReason('wakeOnWiFi').label, 'wake_on_wifi');
assert.strictEqual(names.powerOnReason('remoteKey').label, 'remote_key');
assert.strictEqual(names.powerOnReason('rebootByOnRegular').label, 'reboot_by_on_regular');
assert.strictEqual(names.powerOnReason('netflix').label, 'netflix');
console.log('  ✓ power-on reason, in snake case with Wi-Fi spelled as one word');

function mode(raw) { return both(names.pictureMode(raw)); }

assert.deepEqual(mode('normal'), ['Standard', 'standard']);
assert.deepEqual(mode('hdrCinemaBright'), ['HDR Cinema Bright', 'cinema_bright']);
assert.deepEqual(mode('dolbyHdrCinemaBright'), ['Dolby Vision Cinema Bright', 'cinema_bright']);
assert.deepEqual(mode('hdrFilmMaker'), ['HDR Filmmaker', 'filmmaker']);
assert.deepEqual(mode('expert1'), ['ISF Expert (Bright)', 'expert_bright']);
assert.deepEqual(mode('hdrEffect'), ['HDR Effect', 'hdr_effect']);
assert.deepEqual(mode('gallery'), ['Gallery', 'gallery']);
console.log('  ✓ picture mode, labelled by its base mode');

assert.deepEqual(mode('hdrExternal'), ['HDR External', 'standard']);
assert.deepEqual(mode('dolbyHdrDarkAmazon'), ['Dolby Vision Dark Amazon', 'cinema_bright']);
assert.deepEqual(mode('dolbyHdrCinemaHome'), ['Dolby Vision Cinema Home', 'dolby_hdr_cinema_home']);
console.log('  ✓ a picture mode named one way only is named the other as an unknown one');

assert.deepEqual(mode('dolbyHdrSomethingNew'), ['Dolby Vision Something New', 'dolby_hdr_something_new']);
assert.deepEqual(mode('hdrSomethingNew'), ['HDR Something New', 'hdr_something_new']);
assert.deepEqual(mode('somethingNew'), ['Something New', 'something_new']);
console.log('  ✓ an unknown picture mode is spelled out and keeps its own label');

function output(raw) { return both(names.soundOutput(raw)); }

assert.deepEqual(output('tv_speaker'), ['TV Speaker', 'tv_speaker']);
assert.deepEqual(output('internal'), ['TV Speaker', 'internal']);
assert.deepEqual(output('external_arc'), ['HDMI ARC', 'external_arc']);
assert.deepEqual(output('tv_external_speaker'), ['TV Speaker + Optical', 'tv_external_speaker']);
assert.deepEqual(output('tv_speaker_bluetooth'), ['TV Speaker + Bluetooth', 'tv_speaker_bluetooth']);
assert.deepEqual(output('tv_speaker_bt_surround'), ['TV Speaker + Bluetooth', 'tv_speaker_bt_surround']);
assert.deepEqual(output('ext_speaker_builtin_lg_optical'), ['Optical', 'ext_speaker_builtin_lg_optical']);
assert.deepEqual(output('headphone'), ['Headphone / AUX', 'headphone']);
assert.deepEqual(output('bt_soundbar'), ['Bluetooth', 'bt_soundbar']);
console.log('  ✓ sound output, labelled by its own key');

assert.deepEqual(output('usb_speaker'), ['Usb Speaker', 'usb_speaker']);
console.log('  ✓ an unknown sound output is spelled out and keeps its own label');

var power = names.powerState('Active Standby');
assert.strictEqual(power.display, 'Standby');
assert.strictEqual(power.systemOn, false);
assert.strictEqual(names.powerState('Screen Saver'), names.POWER_STATES.screensaver);
assert.strictEqual(names.powerState('screen_off'), names.POWER_STATES.screenoff);
assert.deepEqual(names.powerState('Warm Boot'), { display: 'Warm Boot', systemOn: false, screenOn: false });
assert.deepEqual(names.powerState(null), { display: 'Unknown', systemOn: false, screenOn: false });
Object.keys(names.POWER_STATES).forEach(function (key) {
  assert.strictEqual(names.powerState(key), names.POWER_STATES[key], key);
});
console.log('  ✓ power state, by tvpower\'s name in any spacing or case, and off outside the table');

Object.keys(names.INPUTS).forEach(function (id) {
  assert.deepEqual(names.input(id), { display: names.INPUTS[id], label: id });
});
assert.deepEqual(names.input('hdmi2'), { display: 'HDMI 2', label: 'hdmi2' });
assert.deepEqual(names.input('livetv'), { display: 'Live TV', label: 'livetv' });
assert.deepEqual(names.input('av1'), { display: 'av1', label: 'av1' });
console.log('  ✓ inputs, labelled by their id');

assert.strictEqual(names.inputTitle('hdmi2', 'Apple TV'), 'Apple TV (HDMI2)');
assert.strictEqual(names.inputTitle('hdmi1', 'HDMI 1'), 'HDMI 1 (HDMI1)');
assert.strictEqual(names.inputTitle('hdmi1', 'hdmi1'), 'hdmi1');
assert.strictEqual(names.inputTitle('netflix', undefined), 'netflix');
console.log('  ✓ an input\'s title is its name with its id, or the id alone');

assert.deepEqual(names.LOGO_DIMMING, { off: 'Off', light: 'Light', strong: 'High' });
assert.deepEqual(names.ENERGY_SAVING_STEPS, ['auto', 'off', 'min', 'med', 'max', 'screen_off']);
console.log('  ✓ logo dimming and energy saving steps');

assert.strictEqual(names.refresherStatus('cancel_schedule'), 'Scheduled');
assert.strictEqual(names.refresherStatus('processing'), 'Running');
assert.strictEqual(names.refresherStatus('schedule'), 'Idle');
assert.strictEqual(names.refresherStatus(undefined), 'Idle');
assert.deepEqual(names.compensationStatus(true), { display: 'Running', detail: 'Completing Panel Maintenance (Short Cycle)' });
assert.deepEqual(names.compensationStatus(false), { display: 'Idle', detail: 'Idle' });
console.log('  ✓ Pixel Refresher and compensation status');

assert.deepEqual(names.emmcEol(1), { display: 'Normal', label: 'normal' });
assert.deepEqual(names.emmcEol(2), { display: 'Warning', label: 'warning' });
assert.deepEqual(names.emmcEol(3), { display: 'Urgent', label: 'urgent' });
assert.strictEqual(names.emmcEol(0), null);
assert.strictEqual(names.emmcEol(NaN), null);
console.log('  ✓ eMMC pre-end-of-life state, none for an undefined code');

assert.deepEqual(names.vrrType('gsync'), { label: 'gsync' });
assert.deepEqual(names.vrrType('freeSync'), { label: 'free_sync' });
assert.deepEqual(names.vrrType('off'), { label: 'off' });
assert.deepEqual(names.vrrType(''), { label: 'off' });
assert.deepEqual(names.vrrType(null), { label: 'off' });
console.log('  ✓ VRR type, off without one');

assert.strictEqual(names.audioCodec('pcm').display, 'PCM');
assert.strictEqual(names.audioCodec('opus').display, 'Opus');
assert.strictEqual(names.audioCodec('eac3').display, 'Dolby Digital Plus');
assert.strictEqual(names.audioCodec('EAC3').display, 'Dolby Digital Plus');
assert.strictEqual(names.audioCodec('alac').display, 'ALAC', 'an unknown codec as the TV gives it');
assert.strictEqual(names.audioImmersive('none'), null);
assert.strictEqual(names.audioImmersive(''), null);
assert.strictEqual(names.audioImmersive('atmos').display, 'Dolby Atmos');
assert.strictEqual(names.audioImmersive('DOLBY_ATMOS').display, 'Dolby Atmos');
assert.strictEqual(names.audioImmersive('Dolby Atmos').display, 'Dolby Atmos');
assert.strictEqual(names.audioImmersive('dtsx').display, 'DTS:X');
console.log('  ✓ the sound format and its immersive layer, as the audio service names them');

assert.strictEqual(names.hdmiKeyForPortId('HDMI_3'), 'hdmi3');
assert.strictEqual(names.hdmiKeyForPortId('HDMI4'), 'hdmi4', 'getVRRInfo leaves the underscore out');
assert.strictEqual(names.hdmiKeyForPortId('HDMI_5'), null);
assert.strictEqual(names.hdmiKeyForPortId('AV_1'), null);
assert.strictEqual(names.hdmiPort('hdmi2'), 2);
assert.strictEqual(names.hdmiPort('livetv'), null);
assert.strictEqual(names.isHdmiKey('hdmi1'), true);
assert.strictEqual(names.isHdmiKey('hdmi5'), false);
assert.strictEqual(names.shortAppId('com.webos.app.hdmi3'), 'hdmi3');
assert.strictEqual(names.shortAppId('netflix'), 'netflix');
assert.strictEqual(names.shortAppId('com.sling.tv', { 'com.sling.tv': 'hdmi3' }), 'hdmi3');
assert.strictEqual(names.inputAppId('hdmi2'), 'com.webos.app.hdmi2');
console.log('  ✓ HDMI inputs by port key, from eim\'s and getVRRInfo\'s port ids and from app ids with their aliases');
