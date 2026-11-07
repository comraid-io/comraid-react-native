import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moduleKt = path.join(
	root,
	'android/src/main/java/com/comraid/reactnative/ComraidModule.kt',
);
const iosMm = path.join(root, 'ios/RNComraid.mm');

async function loadRunSubscribeFlow() {
	const built = path.join(root, 'lib/module/runSubscribeFlow.js');
	const mod = await import(pathToFileURL(built).href);
	return mod.runSubscribeFlow;
}

test('subscribe flow invokes register exactly once after permission grant', async () => {
	const runSubscribeFlow = await loadRunSubscribeFlow();
	let registerCalls = 0;
	const result = await runSubscribeFlow({
		requestNotificationPermission: async () => true,
		register: async () => {
			registerCalls += 1;
		},
		login: async () => {},
	});

	assert.equal(registerCalls, 1);
	assert.equal(result.status, 'registered');
});

test('Android requestNotificationPermission never calls ComRaid.register', () => {
	const source = fs.readFileSync(moduleKt, 'utf8');
	const permissionStart = source.indexOf('override fun requestNotificationPermission(promise: Promise)');
	const registerStart = source.indexOf('override fun registerSubscription(promise: Promise)');
	assert.ok(permissionStart >= 0 && registerStart > permissionStart);
	const permissionFn = source.slice(permissionStart, registerStart);
	assert.doesNotMatch(permissionFn, /ComRaid\.register/);

	const resultStart = source.indexOf('override fun onRequestPermissionsResult(');
	const scheduleStart = source.indexOf('override fun schedule(');
	assert.ok(resultStart >= 0 && scheduleStart > resultStart);
	const resultFn = source.slice(resultStart, scheduleStart);
	assert.doesNotMatch(resultFn, /ComRaid\.register/);
	assert.match(resultFn, /promise\?\.resolve\(granted\)/);
	assert.doesNotMatch(source, /registerExecutor/);
});

test('Android registerSubscription uses ticket-01 callback register API', () => {
	const source = fs.readFileSync(moduleKt, 'utf8');
	assert.match(source, /override fun registerSubscription\(promise: Promise\)/);
	// Non-blocking: ComRaid.register { result -> … } (no sync / blocking call).
	assert.match(source, /ComRaid\.register\s*\{/);
	assert.doesNotMatch(source, /ComRaid\.registerBlocking\(/);
	assert.doesNotMatch(
		source,
		/override fun registerSubscription\(promise: Promise\) = resolve\(promise\) \{\s*ComRaid\.register\(\)/,
	);
});

test('iOS requestNotificationPermission stays permission-only (no register)', () => {
	const source = fs.readFileSync(iosMm, 'utf8');
	const permissionFn = source.match(
		/- \(void\)requestNotificationPermission:[\s\S]*?\n\}/,
	);
	assert.ok(permissionFn, 'iOS requestNotificationPermission not found');
	assert.match(permissionFn[0], /requestNotificationPermissionWithCompletion/);
	assert.doesNotMatch(permissionFn[0], /registerWithCompletion/);
});
