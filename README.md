# `@comraid/react-native`

Thin TurboModule bridge over the ComRaid Android and Apple SDKs (ADR 0004). Identity and HTTP live only in the native SDKs; JavaScript forwards arguments. Vocabulary: **Subscription**, `external_user_id`, Identity verification **JWT** (`login(externalUserId, jwt)`), Contact **Attributes**, Subscription **Properties**. Server-side sends use **Message** / **Notification**, **Campaign**, **Single send**, **Broadcast**, and **Multi-send**.

Ship target is this package only (`@comraid/react-native`). Legacy paths (`react-native-comraid`, historical monorepo `packages/react-native`) are not published.

## Requirements

- React Native New Architecture with Codegen
- React Native 0.79 or newer; verified with React Native 0.86.3
- iOS 15 or newer
- Android API 24 or newer
- Host apps supply Firebase Messaging (Android) and APNs setup (iOS)
- Expo development or production builds for Expo apps; Expo Go cannot load this native module
- Native SDKs: Android `com.comraid:comraid`, iOS `ComRaid`. Contact Attributes require Login (`external_user_id`); delivery ACKs follow the native SDK enqueue/flush path.

## Identity loop

```ts
import { ComRaid } from '@comraid/react-native';

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

await ComRaid.setDeviceProperties({ appVersion: '1.2.0', model: 'Pixel 8' });
await ComRaid.setAttributes({ plan: 'premium' });

await ComRaid.logout(); // Subscription becomes Inactive
await ComRaid.optOut(); // Contact Opted out of push (all Subscriptions)
await ComRaid.optIn();
```

Logout means Inactive (Endpoint state). Opt-out is Contact × Channel and independent of Inactive — not OneSignal-style subscription-only mute.

Wire field is `external_user_id`. There is no JS HTTP client for mobile routes (ADR 0004).

## Delivery ACKs

Remote display and durable ACK enqueue usually run inside the native FCM / APNs path. JS can also forward explicit ACKs; both platforms call through to the native SDK:

```ts
await ComRaid.acknowledgeDelivered(deliveryId, attributionToken);
await ComRaid.acknowledgeOpened(deliveryId, attributionToken, 'accept');
await ComRaid.flushAcks();
```

## Deep links

This package does not add a second push stack or Message-send APIs. Rich fields are sent via the public API / `@comraid/node` / dashboard. On open, read `cr_deep_link` from the native notification payload (FCM data / APNs `userInfo`, or Expo `notification.request.content.data`) and route in your app — see the Android and iOS SDK READMEs (“Deep links and rich fields”).

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

## Expo config plugin

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
            "storageSuiteName": "com.example.app.comraid",
            "apnsEnvironment": "sandbox"
          }
        }
      ]
    ]
  }
}
```

The plugin (V1-ready):

- Writes Android meta-data for default channel / small icon (`com.comraid.*`)
- Declares `POST_NOTIFICATIONS`
- Registers `com.comraid.android.internal.ComraidMessagingService` for FCM (disable with `android.includeMessagingService: false` if the host subclasses it)
- Adds iOS `UIBackgroundModes` `remote-notification`
- Optionally sets `aps-environment` when `ios.apnsEnvironment` is `sandbox` or `production`

App ID is passed at runtime via `initialize`, not only in the plugin. Host apps still own the Firebase / APNs project setup.

## Local verification

```sh
npm test
npm run check
```

npm publish is blocked on domain/email readiness (#27); do not publish from a dirty tree.
