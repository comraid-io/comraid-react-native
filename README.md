# `/react-native`

Thin TurboModule bridge over the ComRaid Android and Apple SDKs (ADR 0004). Identity and HTTP live only in the native SDKs; JavaScript forwards arguments. Vocabulary: **Subscription**, `external_user_id`, Identity verification **JWT** (`login(externalUserId, jwt)`). Server-side sends use **Message** / **Notification**, **Campaign**, **Single send**, **Broadcast**, and **Multi-send**.

## Requirements

- React Native New Architecture with Codegen
- React Native 0.79 or newer; verified with React Native 0.86.3
- iOS 15 or newer
- Android API 24 or newer
- Host apps supply Firebase Messaging (Android) and APNs setup (iOS)
- Expo development or production builds for Expo apps; Expo Go cannot load this native module

## Identity loop

```ts
import { ComRaid } from '/react-native';

await ComRaid.initialize({
  appId: 'cr_app_your_id',
  // apiBaseURL: 'http://localhost:8080',
  android: {
    smallIconResourceName: 'ic_notification',
  },
  ios: {
    apnsEnvironment: 'sandbox', // or 'production'
  },
});

const granted = await ComRaid.requestNotificationPermission();
// Android registers on grant. On iOS, forward the APNs token in native AppDelegate
// via ComraidBridge.setAPNsDeviceToken, then:
await ComRaid.register();

await ComRaid.login('user_123');
await ComRaid.login('user_123', jwtFromYourBackend); // Identity verification JWT

await ComRaid.logout(); // Subscription becomes Inactive
await ComRaid.optOut(); // Contact Opted out of push (all Subscriptions)
await ComRaid.optIn();
```

Logout means Inactive (Endpoint state). Opt-out is Contact × Channel and independent of Inactive — not OneSignal-style subscription-only mute.

Wire field is `external_user_id`. There is no JS HTTP client for mobile routes (ADR 0004).

## Local timers

```ts
const timer = await ComRaid.startTimer({
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
        "@comraid/react-native",
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
