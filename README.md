# `@comraid/react-native`

Thin TurboModule bridge over the ComRaid Android and Apple SDKs (ADR 0004). Identity and HTTP live only in the native SDKs; JavaScript forwards arguments. Vocabulary: **Subscription**, `external_user_id`, Identity verification **JWT** (`login(externalUserId, jwt)`), Contact **Attributes**, Subscription **Properties**. Server-side sends use **Message** / **Notification**, **Campaign**, **Single send**, **Broadcast**, and **Multi-send**.

Ship target is this package only (`@comraid/react-native`). Legacy paths (`react-native-comraid`, historical monorepo `packages/react-native`) are not published.

Canonical docs: [docs.comraid.io/sdks/react-native](https://docs.comraid.io/sdks/react-native).

## Requirements

- React Native New Architecture with Codegen
- React Native 0.79 or newer; verified with React Native 0.86.3
- iOS 15 or newer
- Android API 24 or newer
- Android needs Firebase (`google-services.json`); iOS needs an APNs key/cert in your Apple developer account. Expo apps: the config plugin wires Gradle / AppDelegate for the happy path (see below)
- Expo development or production builds for Expo apps; Expo Go cannot load this native module
- Native SDKs: Android `com.comraid:comraid`, iOS `ComRaid`. Contact Attributes require Login (`external_user_id`); delivery ACKs follow the native SDK enqueue/flush path.

## Getting started

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

const caps = await ComRaid.getCapabilities();
const granted = await ComRaid.requestNotificationPermission();
// Android registers on grant. On iOS with the Expo config plugin, APNs token
// forwarding is automatic after prebuild — then:
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

## Method reference

Public surface is `ComRaid` from `src/index.ts` (TurboModule `NativeComraid.ts`). Grouped by lifecycle. Examples are clustered per group, not per method.

### Configure

#### `initialize(options: ConfigureOptions): Promise<void>`

Stores settings on the native SDKs. Does not register a Subscription — call `requestNotificationPermission` / `register` after permission is granted.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options.appId` | `string` | yes | Publishable App ID (`cr_app_…`) |
| `options.apiBaseURL` | `string` | no | API base; native default `https://api.comraid.io` |
| `options.android.defaultChannelId` | `string` | no | Android notification channel id |
| `options.android.defaultChannelName` | `string` | no | Android notification channel name |
| `options.android.smallIconResourceName` | `string` | no | Drawable resource name for the small icon |
| `options.ios.apnsEnvironment` | `'sandbox' \| 'production'` | yes on iOS | APNs environment |
| `options.ios.storageSuiteName` | `string` | no | Optional iOS storage suite |

**Returns:** `Promise<void>`

#### `configure(options: ConfigureOptions): Promise<void>`

Deprecated alias of `initialize`. Prefer `initialize`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `ConfigureOptions` | yes | Same as `initialize` |

**Returns:** `Promise<void>`

```ts
await ComRaid.initialize({
  appId: 'cr_app_your_id',
  apiBaseURL: 'http://localhost:8080',
  android: { smallIconResourceName: 'ic_notification' },
  ios: { apnsEnvironment: 'sandbox' },
});
```

### Capabilities and permission

#### `getCapabilities(): Promise<Capabilities>`

Reads platform notification / exact-alarm capability from the native SDK.

**Returns:** `Promise<Capabilities>` — `platform`, `notificationsEnabled`, `authorizationStatus`, `exactAlarmsAvailable`

#### `requestNotificationPermission(): Promise<boolean>`

Requests OS notification permission. On Android, a grant typically registers the Subscription; on iOS, still call `register()` after the APNs token is forwarded natively.

**Returns:** `Promise<boolean>` — whether permission was granted

#### `register(): Promise<void>`

Registers (or refreshes) the push Subscription with the current device token.

**Returns:** `Promise<void>`

```ts
const caps = await ComRaid.getCapabilities();
if (!caps.notificationsEnabled) {
  await ComRaid.requestNotificationPermission();
}
await ComRaid.register();
```

### Identity

#### `login(externalUserId: string, jwt?: string): Promise<void>`

Associates the Subscription with a Contact (`external_user_id`). Optional Identity verification **JWT**.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `externalUserId` | `string` | yes | Contact `external_user_id` (non-empty) |
| `jwt` | `string` | no | Identity verification JWT from your backend |

**Returns:** `Promise<void>`

#### `logout(): Promise<void>`

Clears Login. Subscription becomes **Inactive**; stored credential may still allow Contact-level opt-in/out.

**Returns:** `Promise<void>`

#### `optOut(): Promise<void>`

Opts the Contact out of the push Channel (all Subscriptions for that Contact).

**Returns:** `Promise<void>`

#### `optIn(): Promise<void>`

Opts the Contact back into the push Channel.

**Returns:** `Promise<void>`

```ts
await ComRaid.login('user_123', jwtFromYourBackend);
await ComRaid.logout();
await ComRaid.optOut();
await ComRaid.optIn();
```

### Properties and Attributes

#### `setDeviceProperties(properties: DeviceProperties): Promise<void>`

Persists Subscription device **Properties** for the next register / token refresh.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `properties.appVersion` | `string` | no | App version string |
| `properties.model` | `string` | no | Device model |
| `properties.osVersion` | `string` | no | OS version string |
| `properties.extras` | `Record<string, unknown>` | no | Additional plain-object fields |

**Returns:** `Promise<void>`

#### `setAttributes(attributes: ContactAttributes): Promise<void>`

Upserts Contact **Attributes** for the logged-in `external_user_id`. Requires Login. Values are `string | number | boolean | null`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `attributes` | `ContactAttributes` | yes | Plain object of attribute keys (empty `{}` is a successful empty update) |

**Returns:** `Promise<void>`

```ts
await ComRaid.setDeviceProperties({
  appVersion: '1.2.0',
  model: 'Pixel 8',
  osVersion: '14',
  extras: { carrier: 'demo' },
});
await ComRaid.setAttributes({ plan: 'premium', seats: 3 });
```

### Delivery ACKs

Remote display and durable ACK enqueue usually run inside the native FCM / APNs path. JS can also forward explicit ACKs; both platforms call through to the native SDK.

#### `acknowledgeDelivered(deliveryId: string, attributionToken: string): Promise<boolean>`

Enqueue + flush a delivered ACK.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deliveryId` | `string` | yes | Delivery id from the push payload |
| `attributionToken` | `string` | yes | Attribution token from the payload |

**Returns:** `Promise<boolean>` — `false` when ids are blank

#### `acknowledgeOpened(deliveryId: string, attributionToken: string, actionId?: string): Promise<boolean>`

Enqueue + flush an opened ACK (optional action button id).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deliveryId` | `string` | yes | Delivery id |
| `attributionToken` | `string` | yes | Attribution token |
| `actionId` | `string` | no | Action button id (e.g. `'accept'`) |

**Returns:** `Promise<boolean>`

#### `flushAcks(): Promise<void>`

Flushes any durable ACK backlog.

**Returns:** `Promise<void>`

```ts
await ComRaid.acknowledgeDelivered(deliveryId, attributionToken);
await ComRaid.acknowledgeOpened(deliveryId, attributionToken, 'accept');
await ComRaid.flushAcks();
```

### Local schedule and timers

Local notifications only — not server **Message** / **Campaign** sends. Prefer ComRaid schedule APIs over Expo `Notifications.scheduleNotificationAsync` when using this package.

#### `schedule(options: ScheduleOptions): Promise<ScheduleResult>`

Schedules a local notification at a future trigger time.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options.notification` | `NotificationContent` | yes | `id`, `title`, `body`; optional string-only `data` |
| `options.triggerAt` | `Date \| number` | yes | Future `Date` or Unix time in milliseconds |
| `options.precision` | `'inexact' \| 'exact'` | no | Default `'inexact'` |
| `options.fallbackPolicy` | `'fail' \| 'useInexact'` | no | Default `'fail'` when exact is unavailable |

**Returns:** `Promise<ScheduleResult>` — `id`, `requestedPrecision`, `appliedPrecision`, `triggerAt`, optional `fallbackReason`

#### `startTimer(options: TimerOptions): Promise<ScheduleResult>`

Schedules a local notification after `durationMs` from now.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options.notification` | `NotificationContent` | yes | Same as `schedule` |
| `options.durationMs` | `number` | yes | Positive duration in milliseconds |
| `options.precision` | `'inexact' \| 'exact'` | no | Default `'inexact'` |
| `options.fallbackPolicy` | `'fail' \| 'useInexact'` | no | Default `'fail'` |

**Returns:** `Promise<ScheduleResult>`

#### `cancel(id: string): Promise<void>`

Cancels a pending local schedule by notification id.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | yes | Notification id (non-empty) |

**Returns:** `Promise<void>`

#### `pendingSchedules(): Promise<PendingSchedule[]>`

Lists pending local schedules.

**Returns:** `Promise<PendingSchedule[]>` — each entry has `notification` (`id`, `title`, `body`) and `triggerAt`

```ts
const scheduled = await ComRaid.schedule({
  notification: {
    id: 'reminder-1',
    title: 'Reminder',
    body: 'Time to check in.',
    data: { screen: 'home' },
  },
  triggerAt: Date.now() + 60_000,
  precision: 'inexact',
});

const timer = await ComRaid.startTimer({
  notification: {
    id: 'focus-1',
    title: 'Focus complete',
    body: 'Your timer has finished.',
    data: { screen: 'focus' },
  },
  durationMs: 25 * 60 * 1000,
});

const pending = await ComRaid.pendingSchedules();
await ComRaid.cancel(scheduled.id);
await ComRaid.cancel(timer.id);
```

Exact alarms are platform opt-in (host permissions / policy). Defaults are inexact.

## Types

Exported from `@comraid/react-native` (see `src/index.ts`):

| Type | Role |
|------|------|
| `ConfigureOptions` | `initialize` / `configure` input |
| `Capabilities` | `getCapabilities` result |
| `DeviceProperties` | Subscription Properties for register / token refresh |
| `ContactAttributes` | Contact Attribute map (`string \| number \| boolean \| null`) |
| `NotificationContent` | Local notification payload (`data` values must be strings) |
| `ScheduleOptions` / `TimerOptions` | `schedule` / `startTimer` input |
| `ScheduleResult` / `PendingSchedule` | Schedule outputs |
| `SchedulePrecision` / `FallbackPolicy` / `APNsEnvironment` | Enumerated string unions |

## Errors

This package does not export a dedicated `ComRaidError` type. Failures surface as:

| Kind | When |
|------|------|
| `Error` | Native module not linked (e.g. Expo Go / missing rebuild) |
| `TypeError` | Invalid JS arguments (`appId`, empty `externalUserId`, non-object attributes, past `triggerAt`, non-positive `durationMs`, non-string `notification.data` values, etc.) |
| Native promise rejection | Platform / network / native SDK failures forwarded from Android / iOS |

Validate inputs in JS before the TurboModule call; treat native rejections as operational errors (permission, token, HTTP).

## Not in this SDK

| Surface | Reason |
|---------|--------|
| Message / Campaign send (`/messages`, `/campaigns`) | Mobile SDKs own Subscriptions and delivery, not server-side sends — use the public API or `@comraid/node` |
| `POST .../session` (`mobileSubscriptionSession`) | **HTTP-only** until a product/SDK wrapper lands; no RN method |
| iOS-only timer pause / resume / list APIs | Not bridged on the TurboModule (`schedule` / `startTimer` / `cancel` / `pendingSchedules` only) |

## Deep links

This package does not add a second push stack or Message-send APIs. Rich fields are sent via the public API / `@comraid/node` / dashboard. On open, read `cr_deep_link` from the native notification payload (FCM data / APNs `userInfo`, or Expo `notification.request.content.data`) and route in your app — see the Android and iOS SDK READMEs (“Deep links and rich fields”).

## Expo config plugin

Zero-hand-edit happy path: add the plugin, point at `google-services.json`, set APNs environment, then `npx expo prebuild`. No manual AppDelegate or Gradle edits for register/receive.

```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    },
    "plugins": [
      [
        "@comraid/react-native",
        {
          "android": {
            "defaultChannelId": "general",
            "defaultChannelName": "General",
            "smallIconResourceName": "ic_notification",
            "defaultNotificationColor": "#FF5722"
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

You may also pass `android.googleServicesFile` as a plugin option (same path). The plugin:

- Applies the `com.google.gms.google-services` Gradle plugin and copies `google-services.json` when `android.googleServicesFile` is set (Expo config or plugin option)
- Adds the host `firebase-messaging` dependency (required because the Android SDK depends on FCM as `compileOnly`)
- Writes Android meta-data for default channel id/name, small icon, and optional notification color (`com.comraid.*`)
- Declares `POST_NOTIFICATIONS`
- Registers `com.comraid.android.internal.ComraidMessagingService` for FCM (disable with `android.includeMessagingService: false` if the host subclasses it)
- Adds iOS `UIBackgroundModes` `remote-notification`
- Sets `aps-environment` when `ios.apnsEnvironment` is `sandbox` or `production`
- Wires AppDelegate for APNs token + `UNUserNotificationCenter` delegate via `RNComraidPushDelegate` (disable with `ios.wireAppDelegate: false` for bare apps that install the delegate themselves)

App ID is passed at runtime via `initialize`, not only in the plugin. Create the Firebase project / APNs key in the provider consoles; the plugin only applies the native wiring.

## Local verification

```sh
npm test
npm run check
```

npm publish is blocked on domain/email readiness (#27); do not publish from a dirty tree.
