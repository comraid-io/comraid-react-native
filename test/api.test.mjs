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

test('setAttributes rejects empty maps in JS before native', () => {
	const index = fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8');
	assert.match(index, /attributes must not be empty/);
});
