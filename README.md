# react-native-comraid

Thin TurboModule bridge over the Comraid Android and Apple SDKs (ADR 0004). Identity and HTTP live only in the native SDKs; JavaScript forwards arguments.

## Requirements

- React Native New Architecture with Codegen
- React Native 0.79 or newer; verified with React Native 0.86.3
- iOS 15 or newer
- Android API 24 or newer
- Host apps supply Firebase Messaging (Android) and APNs setup (iOS)
- Expo development or production builds for Expo apps; Expo Go cannot load this native module

## Identity loop

```ts
import { Comraid } from 'react-native-comraid';

await Comraid.initialize({
  appId: 'cr_app_your_id',
  // apiBaseURL: 'http://localhost:8080',
  android: {
    smallIconResourceName: 'ic_notification',
  },
  ios: {
    apnsEnvironment: 'sandbox', // or 'production'
  },
});

const granted = await Comraid.requestNotificationPermission();
// Android registers on grant. On iOS, forward the APNs token in native AppDelegate
// via ComraidBridge.setAPNsDeviceToken, then:
await Comraid.register();

await Comraid.login('user_123');
await Comraid.login('user_123', jwtFromYourBackend); // Identity verification JWT

await Comraid.logout(); // Subscription becomes Inactive
await Comraid.optOut(); // Contact Opted out of push (all Subscriptions)
await Comraid.optIn();
```

Logout means Inactive (Endpoint state). Opt-out is Contact × Channel and independent of Inactive — not OneSignal-style subscription-only mute.

Wire field is `external_user_id`. There is no JS HTTP client for mobile routes (ADR 0004).

## Local timers

```ts
const timer = await Comraid.startTimer({
  notification: {
    id: 'focus-1',
    title: 'Focus complete',
    body: 'Your timer has finished.',
    data: { screen: 'focus' },
  },
  durationMs: 25 * 60 * 1000,
});
```

## Expo plugin

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

App ID is passed at runtime via `initialize`, not only in the plugin.

## Local verification

```sh
npm run check
```
