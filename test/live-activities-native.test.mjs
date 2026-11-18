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
const index = read('src/index.ts');

// The native module cannot be built in this repo's tests (no React Native toolchain), so, like the
// other native tests here, this checks the sources: each Live activity method in the TurboModule
// spec has a Kotlin and an Objective-C++ implementation that only forwards to the native SDK.

test('the TurboModule spec declares endActivity and listActivities', () => {
	assert.match(spec, /\n\tendActivity\(id: string\): Promise<boolean>;/);
	assert.match(spec, /\n\tlistActivities\(\): Promise<ReadonlyArray<NativeLiveActivity>>;/);
	assert.match(spec, /NativeLiveActivity = \{[^}]*id: string;[^}]*type: string;/s);
});

test('the Android module forwards to the SDK', () => {
	assert.match(kotlin, /override fun endActivity\(/);
	assert.match(kotlin, /override fun listActivities\(/);
	assert.ok(kotlin.includes('ComRaid.endLiveActivity('), 'must call ComRaid.endLiveActivity');
	assert.ok(kotlin.includes('ComRaid.liveActivities()'), 'must call ComRaid.liveActivities()');
	const list = kotlin.slice(kotlin.indexOf('override fun listActivities('));
	assert.match(list.slice(0, 500), /putString\("id", /);
	assert.match(list.slice(0, 500), /putString\("type", /);
});

test('the iOS module forwards to the SDK Objective-C bridge', () => {
	assert.match(objc, /- \(void\)endActivity:\(NSString \*\)id/);
	assert.match(objc, /- \(void\)listActivities:/);
	assert.ok(objc.includes('[[ComraidBridge shared] endActivityWithId:'), 'must call endActivityWithId:');
	assert.ok(objc.includes('[[ComraidBridge shared] listActivitiesWithCompletion:'), 'must call listActivitiesWithCompletion:');
});

test('the LiveActivity type is exported', () => {
	assert.match(index, /\bLiveActivity\b/);
});
