import assert from 'node:assert/strict';
import test from 'node:test';
import {
	addFcmMessagingService,
	ensureBackgroundModes,
	POST_NOTIFICATIONS,
	MESSAGING_SERVICE,
} from '../plugin/build/android-ios-helpers.js';

test('Expo helpers register ComraidMessagingService for FCM', () => {
	const application = { $: { 'android:name': '.MainApplication' } };
	addFcmMessagingService(application);
	assert.equal(application.service.length, 1);
	assert.equal(application.service[0].$['android:name'], MESSAGING_SERVICE);
	assert.equal(
		application.service[0]['intent-filter'][0].action[0].$['android:name'],
		'com.google.firebase.MESSAGING_EVENT',
	);
});

test('Expo helpers are idempotent for messaging service', () => {
	const application = { $: { 'android:name': '.MainApplication' } };
	addFcmMessagingService(application);
	addFcmMessagingService(application);
	assert.equal(application.service.length, 1);
});

test('Expo helpers add remote-notification background mode', () => {
	const plist = {};
	ensureBackgroundModes(plist);
	assert.deepEqual(plist.UIBackgroundModes, ['remote-notification']);
	ensureBackgroundModes(plist);
	assert.deepEqual(plist.UIBackgroundModes, ['remote-notification']);
});

test('POST_NOTIFICATIONS constant is the Android 13 permission', () => {
	assert.equal(POST_NOTIFICATIONS, 'android.permission.POST_NOTIFICATIONS');
});
