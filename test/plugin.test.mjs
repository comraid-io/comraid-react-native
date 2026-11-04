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
	// The new methods are AppDelegate members, not nested inside didFinishLaunching.
	const launchBody = next.slice(next.indexOf('didFinishLaunchingWithOptions'), next.indexOf('didRegisterFor'));
	assert.match(launchBody, /return super\.application[^\n]*\n  \}/);
	assert.match(next, /RNComraidPushDelegate\.handleRemoteNotification[^\n]*\n  \}\n\/\/ @generated end comraid-push-fetch\n\}/);
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

test('Notification Service Extension Podfile target links ComRaid once', async () => {
	const { addNotificationServicePodTarget, NSE_TARGET_NAME } = await import(
		'../plugin/build/notification-service-extension.js'
	);
	const podfile = "target 'App' do\n  use_expo_modules!\nend\n";
	const next = addNotificationServicePodTarget(podfile);
	assert.match(next, new RegExp(`target '${NSE_TARGET_NAME}' do\\n  pod 'ComRaid'\\nend`));
	assert.ok(next.startsWith(podfile.trimEnd()));
	assert.equal(addNotificationServicePodTarget(next), next);
});

test('Notification Service Extension source enriches through RemoteNotificationDisplay', async () => {
	const { NSE_SWIFT_SOURCE, notificationServicePlist } = await import(
		'../plugin/build/notification-service-extension.js'
	);
	assert.match(NSE_SWIFT_SOURCE, /import ComRaid/);
	assert.match(NSE_SWIFT_SOURCE, /RemoteNotificationDisplay\.enrich\(request\)/);
	assert.match(NSE_SWIFT_SOURCE, /serviceExtensionTimeWillExpire/);
	const plist = notificationServicePlist({ version: '2.1.0', buildNumber: '42' });
	assert.match(plist, /com\.apple\.usernotifications\.service/);
	assert.match(plist, /<string>2\.1\.0<\/string>/);
	assert.match(plist, /<string>42<\/string>/);
});

test('Notification Service Extension registers once with EAS Build', async () => {
	const { addEasAppExtension, NSE_TARGET_NAME } = await import(
		'../plugin/build/notification-service-extension.js'
	);
	const config = addEasAppExtension(addEasAppExtension({}, 'com.example.app'), 'com.example.app');
	assert.deepEqual(config.extra.eas.build.experimental.ios.appExtensions, [
		{
			targetName: NSE_TARGET_NAME,
			bundleIdentifier: `com.example.app.${NSE_TARGET_NAME}`,
			entitlements: {},
		},
	]);
});
