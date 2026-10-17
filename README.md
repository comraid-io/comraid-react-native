# react-native-comraid

TurboModule bindings for the Comraid Android and Apple SDKs, with an Expo config plugin.

The current `0.1.0` foundation supports:

- notification permission requests;
- capability inspection;
- local notification scheduling;
- durable native timers;
- cancellation and pending-schedule queries;
- Expo prebuild configuration for Android channel metadata and the iOS storage suite.

Remote push, notification actions, Live Activities, AlarmKit, Android Live Updates, Handoff, native event replay, and extension generation are planned follow-up slices.

## Requirements

- React Native New Architecture with Codegen
- React Native 0.79 or newer; verified with React Native 0.86.3
- iOS 15 or newer
- Android API 24 or newer
- Expo development or production builds for Expo apps; Expo Go cannot load this native module

The workspace build currently resolves local prerelease native artifacts. Before publishing this npm package, publish `Comraid` 0.1.0 to the selected CocoaPods source and `com.comraide:comraid` 0.1.0 to the selected Maven repository, then replace the Android snapshot default with the released version.

## Expo installation

Install the package, add the plugin, then rebuild the native application:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-comraid",
        {
          "android": {
            "defaultChannelId": "general",
            "defaultChannelName": "General",
            "smallIconResourceName": "ic_notification"
          },
          "ios": {
            "storageSuiteName": "com.example.app.comraid"
          }
        }
      ]
    ]
  }
}
```

```sh
npx expo prebuild
npx expo run:android
npx expo run:ios
```

The Android icon must be a drawable or mipmap resource in the host app. Use a monochrome notification drawable for production apps.

## Runtime API

Call `configure` when the app starts. Ask for notification permission from a user action.

```ts
import { Comraid } from 'react-native-comraid';

await Comraid.configure();

const granted = await Comraid.requestNotificationPermission();
const capabilities = await Comraid.getCapabilities();

const timer = await Comraid.startTimer({
  notification: {
    id: 'focus-1',
    title: 'Focus complete',
    body: 'Your timer has finished.',
    data: { screen: 'focus' },
  },
  durationMs: 25 * 60 * 1000,
  precision: 'inexact',
  fallbackPolicy: 'fail',
});

await Comraid.schedule({
  notification: {
    id: 'meeting-reminder',
    title: 'Meeting soon',
    body: 'The meeting starts in five minutes.',
  },
  triggerAt: new Date(Date.now() + 60_000),
});

const pending = await Comraid.pendingSchedules();
await Comraid.cancel(timer.id);
```

`triggerAt` accepts a `Date` or Unix time in milliseconds. Notification data is currently limited to string values so it maps safely to both native SDKs.

Android can request exact alarms only when the host declares the applicable permission and system access is available. iOS local notifications do not provide exact-alarm semantics. With `fallbackPolicy: 'useInexact'`, an exact request degrades explicitly and reports `requestedPrecision`, `appliedPrecision`, and `fallbackReason`; with `fail`, it rejects.

## Bare React Native

Autolinking discovers the Android package and iOS pod. Install CocoaPods after adding the package:

```sh
cd ios && pod install
```

Configure Android defaults through application manifest metadata when no Expo plugin is used:

```xml
<meta-data android:name="com.comraide.DEFAULT_CHANNEL_ID" android:value="general" />
<meta-data android:name="com.comraide.DEFAULT_CHANNEL_NAME" android:value="General" />
<meta-data android:name="com.comraide.SMALL_ICON_RESOURCE" android:value="ic_notification" />
```

Set `ComraidStorageSuiteName` in the iOS app's `Info.plist` when a custom suite is needed. Runtime values passed to `Comraid.configure` take precedence over build-time defaults.

## Local verification

The included Expo example exercises permission requests, capability inspection, a ten-second timer, cancellation, and pending schedules. Its generated `ios/` and `android/` directories are ignored and are created with `npx expo prebuild`.

```sh
npm run check
cd example && npm install
```

Native notification delivery, reboot restoration, exact-alarm access, and permissions still require device testing. Simulator builds verify integration and compilation, not operating-system delivery guarantees.
