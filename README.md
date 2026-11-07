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
// Permission only asks the OS. Register the Subscription once after a grant.
// On iOS with the Expo config plugin, APNs token forwarding is automatic after prebuild.
await ComRaid.register();

await ComRaid.login('user_123');
await ComRaid.login('user_123', jwtFromYourBackend); // Identity verification JWT

await ComRaid.setDeviceProperties({ appVersion: '1.2.0', model: 'Pixel 8' });
await ComRaid.setAttributes({ plan: 'premium' });

await ComRaid.logout(); // Subscription becomes Inactive
```

Logout means Inactive (Endpoint state): native SDKs clear persisted identity and register a fresh Subscription. Native SDKs persist Subscription id, credential, and External user ID across launches; iOS APNs updates via the bridge call `setAPNsDeviceToken`, which refreshes `/token` when a credential exists. Wire field is `external_user_id`. There is no JS HTTP client for mobile routes (ADR 0004).

### SubscribeBanner (optional UI)

After `initialize`, drop in `SubscribeBanner` for permission → register Subscription → optional Login. Host owns visibility / re-prompt via `onDismiss` (no SDK snooze storage). Never calls Channel `optIn` / `optOut`.

```tsx
import { useState } from 'react';
import { ComRaid, SubscribeBanner } from '@comraid/react-native';

await ComRaid.initialize({ /* … */ });

function Prompt() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <SubscribeBanner
      externalUserId="user_123" // omit for Anonymous contact after register
      // jwt={jwtFromYourBackend}
      onDismiss={() => setVisible(false)}
      onSuccess={() => setVisible(false)}
      onError={(err) => console.warn(err)}
    />
  );
}
```

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
| `options.android.accentColor` | `string` | no | `#RRGGBB` / `#AARRGGBB` tint for the small icon and action buttons on SDK-drawn notifications; defaults to the plugin's `defaultNotificationColor` |
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

**Returns:** `Promise<Capabilities>` — `platform`, `notificationsEnabled`, `authorizationStatus` (`authorized` / `denied` / Android `notDetermined` before the first prompt), `exactAlarmsAvailable`

#### `requestNotificationPermission(): Promise<boolean>`

Requests OS notification permission only — it does not register a Subscription. Call `register()` after a grant (SubscribeBanner / the subscribe flow already do this once). On iOS, ensure the APNs token is forwarded natively first (Expo config plugin does this after prebuild).

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

Makes the Subscription **Inactive**, clears persisted native identity, and registers a fresh Subscription on a new Anonymous contact.

**Returns:** `Promise<void>`

```ts
await ComRaid.login('user_123', jwtFromYourBackend);
await ComRaid.logout();
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

Upserts Contact **Attributes** for the logged-in `external_user_id`. Requires Login. Values are `string | number | boolean | null` (`null` removes that Attribute).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `attributes` | `ContactAttributes` | yes | Plain object of attribute keys (empty `{}` is a successful empty update). A `null` value removes that Attribute. |

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

Starts a countdown timer that fires a Local notification after `durationMs`. Bridged on
Android and iOS (pause/resume/list below).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options.notification` | `NotificationContent` | yes | Same as `schedule` |
| `options.durationMs` | `number` | yes | Positive duration in milliseconds |
| `options.precision` | `'inexact' \| 'exact'` | no | Default `'inexact'` |
| `options.fallbackPolicy` | `'fail' \| 'useInexact'` | no | Default `'fail'` |

**Returns:** `Promise<ScheduleResult>`

#### `pauseTimer(id: string): Promise<Timer>`

Pauses a running timer and stores remaining duration.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | yes | Timer / notification id |

**Returns:** `Promise<Timer>` (`state: 'paused'`)

#### `resumeTimer(id: string): Promise<Timer>`

Resumes a paused timer from remaining duration.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | yes | Timer / notification id |

**Returns:** `Promise<Timer>` (`state: 'running'`)

#### `cancelTimer(id: string): Promise<void>`

Cancels a timer and removes its pending schedule.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | yes | Timer / notification id |

**Returns:** `Promise<void>`

#### `timers(): Promise<Timer[]>`

Lists persisted timers (`running` / `paused` / `cancelled` / `completed`).

**Returns:** `Promise<Timer[]>`

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
await ComRaid.pauseTimer(timer.id);
await ComRaid.resumeTimer(timer.id);
const allTimers = await ComRaid.timers();
await ComRaid.cancelTimer(timer.id);

const pending = await ComRaid.pendingSchedules();
await ComRaid.cancel(scheduled.id);
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
| `RemoteMessage` | Receive / present Notification event (see below) |
| `RemoteMessageAction` | Action button on a `RemoteMessage` (`id`, `text`, optional `icon`) |
| `NotificationContent` | Local notification payload (`data` values must be strings) |
| `ScheduleOptions` / `TimerOptions` | `schedule` / `startTimer` input |
| `ScheduleResult` / `PendingSchedule` | Schedule outputs |
| `Timer` / `TimerState` | Timer pause/resume/list outputs |
| `SchedulePrecision` / `FallbackPolicy` / `APNsEnvironment` | Enumerated string unions |

### `RemoteMessage`

RNFirebase-shaped event from `onMessage`, `setBackgroundMessageHandler`, `onNotificationOpenedApp`, and `getInitialNotification`. Pass the same object (or a hand-built one) to `presentNotification`. Wrong-typed fields are dropped by the parser rather than throwing. Presentation fields are absent when not set (never empty strings), except `priority` which is always `'high' | 'normal'` on received events.

| Field | Type | Notes |
|-------|------|-------|
| `messageId` | `string?` | Provider / SDK message id |
| `deliveryId` | `string?` | Delivery id for ACKs; omitted on Test sends |
| `attributionToken` | `string?` | For opened ACK / `presentNotification` auto-ACK |
| `title` / `body` | `string?` | Tray title and body |
| `data` | `Record<string, string>` | Sender keys only — ComRaid `cr_*` keys are stripped |
| `deepLink` | `string?` | Deep link URL |
| `actions` | `RemoteMessageAction[]?` | Action buttons |
| `actionId` | `string?` | Tapped action id on open events |
| `imageUrl` | `string?` | Push image URL; `presentNotification` shows it |
| `subtitle` | `string?` | iOS subtitle; Android exposes it but never draws it |
| `sound` | `string?` | Sound name (`chime`, `default`, …) |
| `badge` | `number?` | Integer ≥ 0 |
| `threadId` | `string?` | Thread / tag for grouping |
| `androidChannelId` | `string?` | Category channel (carried on both platforms when sent) |
| `priority` | `'high' \| 'normal'?` | Always set on received events; default `'high'` |

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

## Deep links

`onNotificationOpenedApp` and `getInitialNotification` include `deepLink` (from API `content.push.deep_link` / `cr_deep_link`) on Android and iOS. The SDK does not route — navigate in the host (React Navigation / Expo Router `Linking`). On Android the native SDK opens the launch activity only; it never fires `ACTION_VIEW`.

## Images, sounds and action buttons

Receive events carry presentation fields (`imageUrl`, `subtitle`, `sound`, `badge`, `threadId`, `androidChannelId`, `priority`). Pass a received (or hand-built) `RemoteMessage` to `presentNotification` so a promoted Data-only Notification keeps those fields.

- **Android:** when the SDK draws the notification (action buttons, foreground display, or `presentNotification`) it shows `imageUrl` as an expanded picture, long `body` text as expandable text, `actions[].icon` from your app's `res/drawable`, `threadId` as the notification tag, `badge` as the notification count, and posts on `androidChannelId` when set. On Android 8+ the channel decides sound and importance; `sound` only matters on Android 7 and older. `subtitle` is exposed on the event but never drawn. See the Android SDK README (ADR 0012).
- **iOS:** the system (and `presentNotification`) apply `subtitle`, `sound`, `badge` and `threadId`. Images, and action buttons on a device that has not seen them yet, need a **Notification Service Extension** — set `ios.notificationServiceExtension: true` on the Expo plugin (below), or add one by hand in a bare app.

### Notification Service Extension in a bare React Native app

Add a Notification Service Extension target in Xcode, replace its `NotificationService.swift` with:

```swift
import ComRaid
import UserNotifications

final class NotificationService: UNNotificationServiceExtension {
  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    Task { contentHandler(await RemoteNotificationDisplay.enrich(request)) }
  }
}
```

and link `ComRaid` to it in your `Podfile`, outside the app target:

```ruby
target 'NotificationService' do
  pod 'ComRaid'
end
```

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
            "storageSuiteName": "group.com.example.app.comraid",
            "apnsEnvironment": "sandbox",
            "notificationServiceExtension": true
          }
        }
      ]
    ]
  }
}
```

Optional iOS local override while developing: `ios.comraidPath` (path to the `comraid-ios` checkout, relative to generated `ios/`). Android local tips use [`scripts/publish-android-local.sh`](./scripts/publish-android-local.sh) → mavenLocal. See [Native SDK versions](#native-sdk-versions).

You may also pass `android.googleServicesFile` as a plugin option (same path). The plugin:

- Applies the `com.google.gms.google-services` Gradle plugin and copies `google-services.json` when `android.googleServicesFile` is set (Expo config or plugin option)
- Adds the host `firebase-messaging` dependency (required because the Android SDK depends on FCM as `compileOnly`)
- Writes Android meta-data for default channel id/name, small icon, and optional notification color (`com.comraid.*`); the color becomes the default `android.accentColor`
- Declares `POST_NOTIFICATIONS`
- Registers `com.comraid.android.internal.ComraidMessagingService` for FCM (disable with `android.includeMessagingService: false` if the host subclasses it)
- Adds iOS `UIBackgroundModes` `remote-notification`
- Sets `aps-environment` when `ios.apnsEnvironment` is `sandbox` or `production`
- With `ios.storageSuiteName`, adds the App Group entitlement on the main app (pass the same id to `initialize`)
- Wires AppDelegate for APNs token + `UNUserNotificationCenter` delegate via `RNComraidPushDelegate` (disable with `ios.wireAppDelegate: false` for bare apps that install the delegate themselves)
- With `ios.notificationServiceExtension: true`, adds a `ComRaidNotificationService` Notification Service Extension (bundle id `<app bundle id>.ComRaidNotificationService`) that shows push images/action buttons and sends the delivered ACK via `RemoteNotificationDisplay.enrich` (bakes in `storageSuiteName` + App Group entitlement), links it to the `ComRaid` pod, and registers it with EAS Build (`extra.eas.build.experimental.ios.appExtensions`). It signs with `ios.appleTeamId` (plugin option or Expo `ios.appleTeamId`), else the app target's team. If your Podfile pins `ComRaid` to a `:path` or `:git` source, give the `ComRaidNotificationService` target the same source.

App ID is passed at runtime via `initialize`, not only in the plugin. Create the Firebase project / APNs key in the provider consoles; the plugin only applies the native wiring.

## Native SDK versions

Pinned release coords (match Android/iOS `0.1.0`):

| Platform | Default |
|----------|---------|
| Android | `com.comraid:comraid:0.1.0` (`android/build.gradle`; override with Gradle property `comraidAndroidVersion`) |
| iOS | `ComRaid ~> 0.1.0` (`ReactNativeComraid.podspec`) |

`android/build.gradle` resolves through `mavenLocal()` then Maven Central. The Expo config plugin also injects `mavenLocal()` into the host `allprojects.repositories` block. Direct `includeBuild` of `comraid-android` is not supported against Expo’s AGP (SDK ships AGP 9; Expo apps use 8.x) — use mavenLocal instead.

### Local override (development)

**Android — mavenLocal from a checkout path:**

```sh
./scripts/publish-android-local.sh ../comraid-android
# equivalent: (cd ../comraid-android && ./gradlew :comraid:publishToMavenLocal)
```

Then build the RN / Expo app as usual (no extra Gradle properties).

**iOS — CocoaPods path:** until the pod is on trunk, pin a checkout in the Podfile (and keep the NSE target in sync):

```ruby
pod 'ComRaid', :path => '../comraid-ios'
```

Expo: set plugin option `ios.comraidPath` (path relative to the generated `ios/` directory). The config plugin injects the Podfile override and uses the same `:path` for `ComRaidNotificationService`.

Bare React Native without the Expo plugin: add the Podfile lines yourself after autolinking.

## Example app

See [`example/`](./example/) — Expo SDK 57 / RN 0.86 New Architecture playground that exercises the public methods (initialize, permission, register, login, Properties/Attributes, receive events, present/ACKs, schedule/timer). Dev client only (not Expo Go). Setup notes in [`example/README.md`](./example/README.md).

## Releasing

Package version is `package.json` / podspec `spec.version` (SemVer, **no `v` prefix** on the git tag — e.g. `0.1.0`).

```sh
npm run check
npm run pack:dry-run   # npm pack --dry-run + publint
git tag 0.1.0
git push origin 0.1.0
```

Actual `npm publish` is owned by the launch tracker (npm org / domain readiness). Draft GitHub Actions: [`.github/workflows/release-publish.yml`](./.github/workflows/release-publish.yml) — enablement blocked on [v1-tracker #35](https://github.com/comraid-io/planning/blob/main/.scratch/v1-tracker/issues/35-ci-github-actions-sdk-repos.md).

## Local verification

```sh
npm test
npm run check
npm run pack:dry-run
```

npm publish is blocked on domain/email readiness (#27); do not publish from a dirty tree.
