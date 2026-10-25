import assert from 'node:assert/strict';
import test from 'node:test';
import {
	addFcmMessagingService,
	ensureBackgroundModes,
	ensureFirebaseMessagingDependency,
	ensureNotificationColorMeta,
	modifyAppDelegate,
	POST_NOTIFICATIONS,
	MESSAGING_SERVICE,
	FIREBASE_MESSAGING_DEPENDENCY,
	DEFAULT_NOTIFICATION_COLOR_META,
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

test('Expo helpers add firebase-messaging to app build.gradle', () => {
	const gradle = `dependencies {
    implementation("com.facebook.react:react-android")
}
`;
	const next = ensureFirebaseMessagingDependency(gradle);
	assert.match(next, /com\.google\.firebase:firebase-messaging:/);
	assert.equal(ensureFirebaseMessagingDependency(next), next);
	assert.equal(FIREBASE_MESSAGING_DEPENDENCY, 'com.google.firebase:firebase-messaging:24.1.1');
});

test('Expo helpers write default notification color meta when provided', () => {
	const application = { $: { 'android:name': '.MainApplication' }, 'meta-data': [] };
	ensureNotificationColorMeta(application, '#FF5722');
	const entry = application['meta-data'].find(
		item => item?.$?.['android:name'] === DEFAULT_NOTIFICATION_COLOR_META,
	);
	assert.ok(entry);
	assert.equal(entry.$['android:value'], '#FF5722');
	ensureNotificationColorMeta(application, '#FF5722');
	assert.equal(
		application['meta-data'].filter(
			item => item?.$?.['android:name'] === DEFAULT_NOTIFICATION_COLOR_META,
		).length,
		1,
	);
});

test('Expo helpers wire APNs token + notification delegate in Swift AppDelegate', () => {
	const src = `import Expo
import React

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;
	const next = modifyAppDelegate(src, 'swift');
	assert.match(next, /RNComraidPushDelegate\.install\(\)/);
	assert.match(
		next,
		/didRegisterForRemoteNotificationsWithDeviceToken[\s\S]*RNComraidPushDelegate\.setDeviceToken/,
	);
	assert.match(
		next,
		/didReceiveRemoteNotification[\s\S]*fetchCompletionHandler[\s\S]*RNComraidPushDelegate\.handleRemoteNotification/,
	);
	assert.equal(modifyAppDelegate(next, 'swift'), next);
});

test('Expo helpers wire APNs token + notification delegate in ObjC AppDelegate', () => {
	const src = `#import "AppDelegate.h"

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  return YES;
}

@end
`;
	const next = modifyAppDelegate(src, 'objc');
	assert.match(next, /\[RNComraidPushDelegate install\]/);
	assert.match(
		next,
		/didRegisterForRemoteNotificationsWithDeviceToken[\s\S]*setDeviceToken/,
	);
	assert.match(
		next,
		/didReceiveRemoteNotification[\s\S]*fetchCompletionHandler[\s\S]*handleRemoteNotification/,
	);
	assert.equal(modifyAppDelegate(next, 'objc'), next);
});

test('Expo helpers add fetch handler when install already present (upgrade path)', () => {
	const src = `import Expo
import ReactNativeComraid

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    RNComraidPushDelegate.install()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  public override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
    RNComraidPushDelegate.setDeviceToken(deviceToken)
  }
}
`;
	const next = modifyAppDelegate(src, 'swift');
	assert.match(
		next,
		/didReceiveRemoteNotification[\s\S]*fetchCompletionHandler[\s\S]*RNComraidPushDelegate\.handleRemoteNotification/,
	);
	assert.equal(modifyAppDelegate(next, 'swift'), next);
});
