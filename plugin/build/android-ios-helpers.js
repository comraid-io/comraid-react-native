'use strict';

const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const MESSAGING_SERVICE = 'com.comraid.android.internal.ComraidMessagingService';
const POST_NOTIFICATIONS = 'android.permission.POST_NOTIFICATIONS';
const FCM_EVENT = 'com.google.firebase.MESSAGING_EVENT';
const FIREBASE_MESSAGING_DEPENDENCY = 'com.google.firebase:firebase-messaging:24.1.1';
const DEFAULT_NOTIFICATION_COLOR_META = 'com.comraid.DEFAULT_NOTIFICATION_COLOR';
const APP_DELEGATE_TAG = 'comraid-push';

/**
 * Declares ComRaid's FCM MessagingService on the host application (idempotent).
 * @param {Record<string, unknown>} application AndroidManifest application node
 */
function addFcmMessagingService(application) {
  if (!Array.isArray(application.service)) {
    application.service = [];
  }
  const exists = application.service.some(
    entry => entry?.$?.['android:name'] === MESSAGING_SERVICE,
  );
  if (exists) return application;
  application.service.push({
    $: {
      'android:name': MESSAGING_SERVICE,
      'android:exported': 'false',
    },
    'intent-filter': [
      {
        action: [{ $: { 'android:name': FCM_EVENT } }],
      },
    ],
  });
  return application;
}

/**
 * Ensures UIBackgroundModes includes remote-notification (idempotent).
 * @param {Record<string, unknown>} plist
 */
function ensureBackgroundModes(plist) {
  const existing = Array.isArray(plist.UIBackgroundModes) ? plist.UIBackgroundModes : [];
  const modes = new Set(existing);
  modes.add('remote-notification');
  plist.UIBackgroundModes = [...modes];
  return plist;
}

/**
 * Adds firebase-messaging to the host app's build.gradle (idempotent).
 * ComRaid Android uses compileOnly for FCM, so the app must supply it.
 * @param {string} appBuildGradle
 */
function ensureFirebaseMessagingDependency(appBuildGradle) {
  if (appBuildGradle.includes('com.google.firebase:firebase-messaging')) {
    return appBuildGradle;
  }
  const dependencyLine = `    implementation("${FIREBASE_MESSAGING_DEPENDENCY}")`;
  if (/dependencies\s*\{/.test(appBuildGradle)) {
    return appBuildGradle.replace(/dependencies\s*\{/, match => `${match}\n${dependencyLine}`);
  }
  return `${appBuildGradle.trimEnd()}\n\ndependencies {\n${dependencyLine}\n}\n`;
}

/**
 * Writes default notification color meta-data (idempotent).
 * @param {Record<string, unknown>} application
 * @param {string} color Hex color, e.g. `#FF5722`
 */
function ensureNotificationColorMeta(application, color) {
  if (!color) return application;
  if (!Array.isArray(application['meta-data'])) {
    application['meta-data'] = [];
  }
  const existing = application['meta-data'].find(
    entry => entry?.$?.['android:name'] === DEFAULT_NOTIFICATION_COLOR_META,
  );
  if (existing) {
    existing.$['android:value'] = color;
    return application;
  }
  application['meta-data'].push({
    $: {
      'android:name': DEFAULT_NOTIFICATION_COLOR_META,
      'android:value': color,
    },
  });
  return application;
}

/**
 * Injects ComRaid APNs token + notification-delegate install into AppDelegate.
 * @param {string} contents
 * @param {'swift' | 'objc' | 'objcpp'} language
 */
function modifyAppDelegate(contents, language) {
  if (language === 'swift') {
    return modifySwiftAppDelegate(contents);
  }
  if (language === 'objc' || language === 'objcpp') {
    return modifyObjCAppDelegate(contents);
  }
  return contents;
}

function modifySwiftAppDelegate(src) {
  let next = src;
  if (!next.includes('import ReactNativeComraid') && !next.includes('RNComraidPushDelegate')) {
    const importMatch = next.match(/^import .+$/m);
    if (importMatch) {
      next = next.replace(importMatch[0], `${importMatch[0]}\nimport ReactNativeComraid`);
    } else {
      next = `import ReactNativeComraid\n${next}`;
    }
  }

  if (!next.includes('RNComraidPushDelegate.install()')) {
    const launchAnchor =
      /return super\.application\(\s*application,\s*didFinishLaunchingWithOptions:\s*launchOptions\s*\)/;
    if (launchAnchor.test(next)) {
      const merged = mergeContents({
        src: next,
        newSrc: '    RNComraidPushDelegate.install()',
        tag: `${APP_DELEGATE_TAG}-install`,
        anchor: launchAnchor,
        offset: 0,
        comment: '//',
      });
      next = merged.contents;
    } else {
      const alt = /return [^\n]*didFinishLaunchingWithOptions[^\n]*/;
      if (alt.test(next)) {
        const merged = mergeContents({
          src: next,
          newSrc: '    RNComraidPushDelegate.install()',
          tag: `${APP_DELEGATE_TAG}-install`,
          anchor: alt,
          offset: 0,
          comment: '//',
        });
        next = merged.contents;
      }
    }
  }

  if (!next.includes('didRegisterForRemoteNotificationsWithDeviceToken')) {
    const tokenMethod = `
  public override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
    RNComraidPushDelegate.setDeviceToken(deviceToken)
  }`;
    const merged = mergeContents({
      src: next,
      newSrc: tokenMethod,
      tag: `${APP_DELEGATE_TAG}-token`,
      anchor: /}\s*$/,
      offset: 0,
      comment: '//',
    });
    next = merged.contents;
  } else if (!next.includes('RNComraidPushDelegate.setDeviceToken')) {
    const merged = mergeContents({
      src: next,
      newSrc: '    RNComraidPushDelegate.setDeviceToken(deviceToken)',
      tag: `${APP_DELEGATE_TAG}-token-call`,
      anchor: /didRegisterForRemoteNotificationsWithDeviceToken[^{]*\{/,
      offset: 1,
      comment: '//',
    });
    next = merged.contents;
  }

  if (!next.includes('didReceiveRemoteNotification')) {
    const fetchMethod = `
  public override func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    RNComraidPushDelegate.handleRemoteNotification(userInfo, fetchCompletionHandler: completionHandler)
  }`;
    const merged = mergeContents({
      src: next,
      newSrc: fetchMethod,
      tag: `${APP_DELEGATE_TAG}-fetch`,
      anchor: /}\s*$/,
      offset: 0,
      comment: '//',
    });
    next = merged.contents;
  } else if (!next.includes('RNComraidPushDelegate.handleRemoteNotification')) {
    const merged = mergeContents({
      src: next,
      newSrc:
        '    RNComraidPushDelegate.handleRemoteNotification(userInfo, fetchCompletionHandler: completionHandler)',
      tag: `${APP_DELEGATE_TAG}-fetch-call`,
      anchor: /didReceiveRemoteNotification[^{]*\{/,
      offset: 1,
      comment: '//',
    });
    next = merged.contents;
  }

  return next;
}

function modifyObjCAppDelegate(src) {
  let next = src;
  if (!next.includes('RNComraidPushDelegate.h')) {
    const importLine = '#import "RNComraidPushDelegate.h"';
    if (next.includes('#import "AppDelegate.h"')) {
      next = next.replace(
        '#import "AppDelegate.h"',
        `#import "AppDelegate.h"\n${importLine}`,
      );
    } else {
      next = `${importLine}\n${next}`;
    }
  }

  // mergeContents matches per line; Expo ObjC templates put `{` on the following line.
  const launchSignature =
    /- \(BOOL\)application:\(UIApplication \*\)application didFinishLaunchingWithOptions:\(NSDictionary \*\)launchOptions/;
  if (launchSignature.test(next) && !next.includes('[RNComraidPushDelegate install]')) {
    const merged = mergeContents({
      src: next,
      newSrc: '  [RNComraidPushDelegate install];',
      tag: `${APP_DELEGATE_TAG}-install`,
      anchor: launchSignature,
      offset: 2,
      comment: '//',
    });
    next = merged.contents;
  }

  if (!next.includes('didRegisterForRemoteNotificationsWithDeviceToken')) {
    const tokenMethod = `
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  [RNComraidPushDelegate setDeviceToken:deviceToken];
}`;
    const merged = mergeContents({
      src: next,
      newSrc: tokenMethod,
      tag: `${APP_DELEGATE_TAG}-token`,
      anchor: /@end\s*$/,
      offset: 0,
      comment: '//',
    });
    next = merged.contents;
  } else if (!next.includes('[RNComraidPushDelegate setDeviceToken')) {
    const merged = mergeContents({
      src: next,
      newSrc: '  [RNComraidPushDelegate setDeviceToken:deviceToken];',
      tag: `${APP_DELEGATE_TAG}-token-call`,
      anchor: /didRegisterForRemoteNotificationsWithDeviceToken[^{]*\{/,
      offset: 1,
      comment: '//',
    });
    next = merged.contents;
  }

  if (!next.includes('didReceiveRemoteNotification')) {
    const fetchMethod = `
- (void)application:(UIApplication *)application
didReceiveRemoteNotification:(NSDictionary *)userInfo
fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler
{
  [RNComraidPushDelegate handleRemoteNotification:userInfo fetchCompletionHandler:completionHandler];
}`;
    const merged = mergeContents({
      src: next,
      newSrc: fetchMethod,
      tag: `${APP_DELEGATE_TAG}-fetch`,
      anchor: /@end\s*$/,
      offset: 0,
      comment: '//',
    });
    next = merged.contents;
  } else if (!next.includes('[RNComraidPushDelegate handleRemoteNotification')) {
    const merged = mergeContents({
      src: next,
      newSrc:
        '  [RNComraidPushDelegate handleRemoteNotification:userInfo fetchCompletionHandler:completionHandler];',
      tag: `${APP_DELEGATE_TAG}-fetch-call`,
      anchor: /didReceiveRemoteNotification[^{]*\{/,
      offset: 1,
      comment: '//',
    });
    next = merged.contents;
  }

  return next;
}

module.exports = {
  MESSAGING_SERVICE,
  POST_NOTIFICATIONS,
  FCM_EVENT,
  FIREBASE_MESSAGING_DEPENDENCY,
  DEFAULT_NOTIFICATION_COLOR_META,
  addFcmMessagingService,
  ensureBackgroundModes,
  ensureFirebaseMessagingDependency,
  ensureNotificationColorMeta,
  modifyAppDelegate,
};
