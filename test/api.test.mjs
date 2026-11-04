import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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
	const source = fs.readFileSync(path.join(root, 'src/createComRaid.ts'), 'utf8');
	for (const method of [
		'setDeviceProperties',
		'setAttributes',
		'acknowledgeDelivered',
		'acknowledgeOpened',
		'flushAcks',
	]) {
		assert.match(source, new RegExp(`async ${method}\\(`));
	}
	const index = fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8');
	assert.match(index, /export const ComRaid =/);
	const instance = fs.readFileSync(path.join(root, 'src/instance.ts'), 'utf8');
	assert.match(instance, /createComRaid\(/);
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
	assert.match(moduleKt, /ComRaid\.getToken/);
	assert.match(moduleKt, /ComRaid\.getInitialNotification/);
	assert.match(moduleKt, /ComRaid\.presentNotification/);
	assert.match(moduleKt, /ComRaid\.setBackgroundHandlerRegistered/);
	assert.match(moduleKt, /displayForegroundNotifications/);
	assert.match(moduleKt, /accentColor = color/);
	assert.match(moduleKt, /com\.comraid\.DEFAULT_NOTIFICATION_COLOR/);
	// Permission results arrive on the UI thread; register must not block it.
	assert.match(moduleKt, /registerExecutor\.execute \{\s+try \{\s+ComRaid\.register\(\)/);
	// Test sends omit delivery IDs; bridge must treat them as optional, not throw.
	assert.match(
		moduleKt,
		/deliveryId = json\.optString\("deliveryId"\)\.takeIf \{ it\.isNotBlank\(\) \}/,
	);
	assert.match(
		moduleKt,
		/attributionToken = json\.optString\("attributionToken"\)\.takeIf \{ it\.isNotBlank\(\) \}/,
	);
	assert.match(moduleKt, /event\.deliveryId\?\.let \{ putString\("deliveryId", it\) \}/);
});

test('iOS bridge forwards attribute, properties, and ACK APIs to ComraidBridge', () => {
	const moduleMm = fs.readFileSync(path.join(root, 'ios/RNComraid.mm'), 'utf8');
	assert.match(moduleMm, /\[\[ComraidBridge shared\] setDevicePropertiesWithAppVersion:/);
	assert.match(moduleMm, /\[\[ComraidBridge shared\] setAttributes:/);
	assert.match(moduleMm, /\[\[ComraidBridge shared\] acknowledgeDeliveredWithDeliveryId:/);
	assert.match(moduleMm, /\[\[ComraidBridge shared\] acknowledgeOpenedWithDeliveryId:/);
	assert.match(moduleMm, /\[\[ComraidBridge shared\] flushAcksWithCompletion:/);
	assert.match(moduleMm, /\[\[ComraidBridge shared\] getTokenWithCompletion:/);
	assert.match(moduleMm, /\[\[ComraidBridge shared\] getInitialNotificationWithCompletion:/);
	assert.match(moduleMm, /\[\[ComraidBridge shared\] presentNotificationWithMessageJson:/);
	assert.match(moduleMm, /\[\[ComraidBridge shared\] setBackgroundHandlerRegistered:/);
	assert.match(moduleMm, /displayForegroundNotifications:/);
	assert.match(moduleMm, /setEventEmitter:/);
	assert.doesNotMatch(
		moduleMm,
		/setDeviceProperties requires the iOS ComRaid SDK attribute APIs/,
	);
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
	assert.doesNotMatch(moduleMm, /getToken event bridging lands in ticket 04/);
	assert.doesNotMatch(moduleMm, /presentNotification lands in ticket 04/);
});

test('setAttributes allows empty maps through JS and native bridges', () => {
	const source = fs.readFileSync(path.join(root, 'src/createComRaid.ts'), 'utf8');
	assert.doesNotMatch(source, /attributes must not be empty/);
	// Empty `{}` is JSON.stringified and forwarded to native (no client non-empty guard).
	assert.match(source, /native\(\)\.setAttributes\(JSON\.stringify\(attributes\)\)/);

	const moduleKt = fs.readFileSync(
		path.join(root, 'android/src/main/java/com/comraid/reactnative/ComraidModule.kt'),
		'utf8',
	);
	assert.doesNotMatch(moduleKt, /attributes must not be empty/);
	assert.match(moduleKt, /ComRaid\.setAttributes\(jsonObjectToMap\(json\)\)/);

	const moduleMm = fs.readFileSync(path.join(root, 'ios/RNComraid.mm'), 'utf8');
	assert.doesNotMatch(moduleMm, /attributes must not be empty/);
	assert.match(moduleMm, /\[\[ComraidBridge shared\] setAttributes:/);
});

test('empty setAttributes HTTP path is recorded on Android SDK (sibling seam)', () => {
	// RN is a thin bridge; mobile PUT body is recorded in comraid-android unit tests.
	const candidates = [
		path.join(
			root,
			'../comraid-android/comraid/src/test/java/com/comraid/android/ComRaidRemoteAndPropertiesTest.kt',
		),
		path.join(
			root,
			'../../../comraid-android/comraid/src/test/java/com/comraid/android/ComRaidRemoteAndPropertiesTest.kt',
		),
		path.join(
			root,
			'../android-03/comraid/src/test/java/com/comraid/android/ComRaidRemoteAndPropertiesTest.kt',
		),
	];
	const androidTest = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(
		androidTest,
		'sibling comraid-android recording test required for empty Attributes HTTP seam',
	);
	const recorded = fs.readFileSync(androidTest, 'utf8');
	assert.match(recorded, /setAttributes_empty_map_after_login_puts_empty_attributes_body/);
	assert.match(recorded, /\/mobile\/subscriptions\/sub-1\/attributes/);
	assert.match(recorded, /ComRaid\.setAttributes\(emptyMap\(\)\)/);

	const clientCandidates = [
		path.join(
			root,
			'../comraid-android/comraid/src/main/java/com/comraid/android/internal/MobileApiClient.kt',
		),
		path.join(
			root,
			'../../../comraid-android/comraid/src/main/java/com/comraid/android/internal/MobileApiClient.kt',
		),
		path.join(
			root,
			'../android-03/comraid/src/main/java/com/comraid/android/internal/MobileApiClient.kt',
		),
	];
	const mobileClient = clientCandidates.find(candidate => fs.existsSync(candidate));
	assert.ok(mobileClient, 'sibling MobileApiClient required');
	assert.match(
		fs.readFileSync(mobileClient, 'utf8'),
		/\/mobile\/subscriptions\/\$subscriptionId\/attributes/,
	);
});

test('TurboModule Spec passes React Native codegen', () => {
	// Pod install / Gradle run codegen; an unsupported type (e.g. Record) breaks every native build.
	const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'comraid-codegen-')), 'schema.json');
	execFileSync(
		process.execPath,
		[
			path.join(root, 'node_modules/@react-native/codegen/lib/cli/combine/combine-js-to-schema-cli.js'),
			out,
			path.join(root, 'src/NativeComraid.ts'),
		],
		{ stdio: 'pipe' },
	);
	const schema = JSON.parse(fs.readFileSync(out, 'utf8'));
	const methods = schema.modules.NativeComraid.spec.methods.map(method => method.name);
	assert.ok(methods.includes('getInitialNotification'));
	// Method names become C++ members in the generated JSI header.
	const cppKeywords = ['register', 'delete', 'new', 'default', 'class', 'template', 'namespace', 'operator'];
	assert.deepEqual(methods.filter(name => cppKeywords.includes(name)), []);
	assert.ok(methods.includes('configure'));
});
