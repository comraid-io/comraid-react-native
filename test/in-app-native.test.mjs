import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const spec = read('src/NativeComraid.ts');
const kotlin = read('android/src/main/java/com/comraid/reactnative/ComraidModule.kt');
const objc = read('ios/RNComraid.mm');
const js = read('src/createComRaid.ts');

// The native module cannot be built in this repo's tests (no React Native toolchain), so, like the
// other native tests here, this checks the sources: every In-app method in the TurboModule spec has
// a Kotlin and an Objective-C++ implementation that forwards to the SDK, and the events and message
// shape match what the JS layer parses.

const inAppSpecMethods = [
	'addTrigger',
	'addTriggers',
	'removeTrigger',
	'clearTriggers',
	'getTriggers',
	'setInAppMessagesPaused',
	'isInAppMessagesPaused',
	'optOutInApp',
	'optInInApp',
	'setInAppMessagePresenterEnabled',
	'inAppImpression',
	'inAppClicked',
	'inAppDismissed',
];

test('every In-app method is declared in the TurboModule spec', () => {
	for (const name of inAppSpecMethods) {
		assert.match(spec, new RegExp(`\\n\\t${name}\\(`), `${name} missing from NativeComraid.ts`);
	}
});

test('the Android module implements every In-app spec method', () => {
	for (const name of inAppSpecMethods) {
		assert.match(kotlin, new RegExp(`override fun ${name}\\(`), `ComraidModule.kt missing ${name}`);
	}
});

test('the iOS module implements every In-app spec method', () => {
	for (const name of inAppSpecMethods) {
		assert.match(objc, new RegExp(`- \\(void\\)${name}:`), `RNComraid.mm missing ${name}`);
	}
});

test('Android forwards to the SDK instead of re-implementing it', () => {
	for (const call of [
		'ComRaid.addTrigger(',
		'ComRaid.addTriggers(',
		'ComRaid.removeTrigger(',
		'ComRaid.clearTriggers(',
		'ComRaid.getTriggers(',
		'ComRaid.setInAppMessagesPaused(',
		'ComRaid.isInAppMessagesPaused(',
		'ComRaid.optOutInApp(',
		'ComRaid.optInInApp(',
		'ComRaid.setInAppMessagePresenter(',
		'ComRaid.addInAppMessageListener(',
		'ComRaid.removeInAppMessageListener(',
	]) {
		assert.ok(kotlin.includes(call), `ComraidModule.kt must call ${call}`);
	}
});

test('iOS forwards to the SDK Objective-C bridge instead of re-implementing it', () => {
	for (const selector of [
		'addTriggerWithKey:',
		'addTriggersWithJson:',
		'removeTriggerWithKey:',
		'clearTriggersWithCompletion:',
		'getTriggersWithCompletion:',
		'setInAppMessagesPaused:',
		'isInAppMessagesPausedWithCompletion:',
		'optOutInAppWithCompletion:',
		'optInInAppWithCompletion:',
		'setInAppMessagePresenterEnabled:',
		'inAppImpressionWithMessageId:',
		'inAppClickedWithMessageId:',
		'inAppDismissedWithMessageId:',
	]) {
		assert.ok(
			objc.includes(`[[ComraidBridge shared] ${selector}`),
			`RNComraid.mm must call [[ComraidBridge shared] ${selector}`,
		);
	}
});

test('the event names match the JS constants', () => {
	const present = js.match(/EVENT_IN_APP_PRESENT = '([^']+)'/)?.[1];
	const lifecycle = js.match(/EVENT_IN_APP_LIFECYCLE = '([^']+)'/)?.[1];
	assert.equal(present, 'comraid_in_app_present');
	assert.equal(lifecycle, 'comraid_in_app_lifecycle');
	assert.ok(kotlin.includes(`EVENT_IN_APP_PRESENT = "${present}"`));
	assert.ok(kotlin.includes(`EVENT_IN_APP_LIFECYCLE = "${lifecycle}"`));
});

test('Android emits the message shape the JS layer parses', () => {
	for (const key of ['id', 'layout', 'title', 'body', 'imageUrl', 'buttons', 'startAt', 'endAt', 'isTest']) {
		assert.ok(kotlin.includes(`"${key}"`), `message map must carry "${key}"`);
	}
	for (const key of ['deepLink', 'label']) {
		assert.ok(kotlin.includes(`"${key}"`), `button map must carry "${key}"`);
	}
	// Lifecycle and present payloads.
	assert.match(kotlin, /putString\("type", type\)/);
	assert.match(kotlin, /putMap\("message",/);
	assert.match(kotlin, /putMap\("button",/);
	assert.match(kotlin, /putMap\("triggers",/);
	// The layout goes out in its wire form, e.g. banner_top.
	assert.match(kotlin, /layout\.wire/);
});

test('Android keeps a presenter handle per message id until it is dismissed', () => {
	assert.match(kotlin, /ConcurrentHashMap<String, InAppMessageHandle>/);
	assert.match(kotlin, /inAppHandles\[message\.id\] = handle/);
	assert.match(kotlin, /inAppHandles\.remove\(messageId\)/);
	// Turning the presenter off forgets handles for messages that will never be reported.
	assert.match(kotlin, /inAppHandles\.clear\(\)/);
});

test('Android attaches and detaches the In-app listener with the other native listeners', () => {
	const attach = kotlin.slice(kotlin.indexOf('private fun attachNativeListeners'), kotlin.indexOf('private fun detachNativeListeners'));
	const detach = kotlin.slice(kotlin.indexOf('private fun detachNativeListeners'), kotlin.indexOf('private fun emit('));
	assert.ok(attach.includes('ComRaid.addInAppMessageListener('));
	assert.ok(detach.includes('ComRaid.removeInAppMessageListener('));
});

test('turning the JS presenter off is wired through to the SDK on both platforms', () => {
	assert.match(kotlin, /setInAppMessagePresenter\(if \(enabled\)/);
	assert.match(objc, /setInAppMessagePresenterEnabled:\(BOOL\)enabled/);
});

test('Android releases the presenter and its handles when the React instance goes away', () => {
	const detach = kotlin.slice(kotlin.indexOf('private fun detachNativeListeners'), kotlin.indexOf('private fun emitInApp('));
	assert.ok(
		detach.includes('ComRaid.setInAppMessagePresenter(null)'),
		'a presenter that outlives its JS side would swallow every message',
	);
	assert.ok(detach.includes('inAppHandles.clear()'));
});

test('iOS releases the JS presenter when the module is invalidated', () => {
	assert.match(objc, /- \(void\)invalidate\s*\{[\s\S]*?setInAppMessagePresenterEnabled:NO/);
});

test('the Android In-app imports keep the file sorted', () => {
	const imports = kotlin.split('\n').filter(l => l.startsWith('import com.comraid.android.'));
	assert.deepEqual(imports, [...imports].sort(), 'imports must stay alphabetical');
});
