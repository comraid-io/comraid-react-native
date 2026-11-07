import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statusKt = path.join(
	root,
	'android/src/main/java/com/comraid/reactnative/AuthorizationStatus.kt',
);
const moduleKt = path.join(
	root,
	'android/src/main/java/com/comraid/reactnative/ComraidModule.kt',
);

test('AuthorizationStatus.kt maps notDetermined before first Android 13+ prompt', () => {
	const source = fs.readFileSync(statusKt, 'utf8');
	assert.match(source, /NOT_DETERMINED = "notDetermined"/);
	assert.match(source, /AUTHORIZED = "authorized"/);
	assert.match(source, /DENIED = "denied"/);
	assert.match(source, /TIRAMISU = 33/);
	// Decision table (ticket 03): before prompt → notDetermined; grant/deny after.
	assert.match(
		source,
		/apiLevel >= TIRAMISU &&\s*!postNotificationsGranted &&\s*!hasRequestedPermission/,
	);
	assert.match(source, /return NOT_DETERMINED/);
	assert.match(
		source,
		/if \(postNotificationsGranted && notificationsEnabled\) \{\s*return AUTHORIZED/,
	);
	assert.match(source, /return DENIED/);
});

test('ComraidModule reports authorizationStatus via AuthorizationStatus.from', () => {
	const source = fs.readFileSync(moduleKt, 'utf8');
	assert.match(source, /AuthorizationStatus\.from\(/);
	assert.match(source, /putString\(\s*"authorizationStatus",/);
	assert.doesNotMatch(
		source,
		/if \(value\.notificationsEnabled\) "authorized" else "denied"/,
	);
});

test('Android marks permission requested when showing the system prompt', () => {
	const source = fs.readFileSync(moduleKt, 'utf8');
	assert.match(source, /markPermissionRequested\(/);
	assert.match(source, /hasRequestedPermission\(/);
	assert.match(source, /KEY_PERMISSION_REQUESTED/);
	const permissionFn = source.match(
		/override fun requestNotificationPermission\(promise: Promise\) \{[\s\S]*?\n  \}/,
	);
	assert.ok(permissionFn, 'requestNotificationPermission body not found');
	assert.match(permissionFn[0], /markPermissionRequested\(/);
});
