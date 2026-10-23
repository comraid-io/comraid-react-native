import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('TurboModule Spec declares attributes, properties, and ACK methods', () => {
	const spec = fs.readFileSync(path.join(root, 'src/NativeComraid.ts'), 'utf8');
	for (const method of [
		'setDeviceProperties',
		'setAttributes',
		'acknowledgeDelivered',
		'acknowledgeOpened',
		'flushAcks',
	]) {
		assert.match(spec, new RegExp(`${method}\\(`));
	}
});

test('public ComRaid API wraps attributes, properties, and ACKs', () => {
	const index = fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8');
	for (const method of [
		'setDeviceProperties',
		'setAttributes',
		'acknowledgeDelivered',
		'acknowledgeOpened',
		'flushAcks',
	]) {
		assert.match(index, new RegExp(`async ${method}\\(`));
	}
});

test('Android bridge forwards attribute and ACK APIs to ComRaid', () => {
	const moduleKt = fs.readFileSync(
		path.join(root, 'android/src/main/java/com/comraid/reactnative/ComraidModule.kt'),
		'utf8',
	);
	assert.match(moduleKt, /ComRaid\.setDeviceProperties/);
	assert.match(moduleKt, /ComRaid\.setAttributes/);
	assert.match(moduleKt, /ComRaid\.acknowledgeDelivered/);
	assert.match(moduleKt, /ComRaid\.acknowledgeOpened/);
	assert.match(moduleKt, /ComRaid\.flushAcks/);
});

test('iOS bridge forwards attribute and ACK APIs to ComraidBridge', () => {
	const moduleMm = fs.readFileSync(path.join(root, 'ios/RNComraid.mm'), 'utf8');
	assert.match(moduleMm, /\[\[ComraidBridge shared\] setAttributes:/);
	assert.match(moduleMm, /\[\[ComraidBridge shared\] acknowledgeDeliveredWithDeliveryId:/);
	assert.match(moduleMm, /\[\[ComraidBridge shared\] acknowledgeOpenedWithDeliveryId:/);
	assert.match(moduleMm, /\[\[ComraidBridge shared\] flushAcksWithCompletion:/);
	assert.doesNotMatch(
		moduleMm,
		/setAttributes requires the iOS ComRaid SDK attribute APIs/,
	);
	assert.doesNotMatch(
		moduleMm,
		/acknowledgeDelivered requires the iOS ComRaid SDK ACK APIs/,
	);
	assert.doesNotMatch(
		moduleMm,
		/acknowledgeOpened requires the iOS ComRaid SDK ACK APIs/,
	);
	assert.doesNotMatch(moduleMm, /flushAcks requires the iOS ComRaid SDK ACK APIs/);
});

test('setAttributes allows empty maps through JS and native bridges', () => {
	const index = fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8');
	assert.doesNotMatch(index, /attributes must not be empty/);

	const moduleKt = fs.readFileSync(
		path.join(root, 'android/src/main/java/com/comraid/reactnative/ComraidModule.kt'),
		'utf8',
	);
	assert.doesNotMatch(moduleKt, /attributes must not be empty/);
	assert.match(moduleKt, /ComRaid\.setAttributes\(jsonObjectToMap\(json\)\)/);

	const moduleMm = fs.readFileSync(path.join(root, 'ios/RNComraid.mm'), 'utf8');
	assert.doesNotMatch(moduleMm, /attributes must not be empty/);
	assert.match(moduleMm, /\[\[ComraidBridge shared\] setAttributes:/);

	// iOS setDeviceProperties stays stubbed (no implementation in this effort).
	assert.match(
		moduleMm,
		/setDeviceProperties requires the iOS ComRaid SDK attribute APIs/,
	);
});
