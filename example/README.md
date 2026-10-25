# ComRaid React Native example

Expo SDK **57** / React Native **0.86** / New Architecture playground for [`@comraid/react-native`](../README.md).

Use it to learn the public methods: initialize → permission → register → login → Properties/Attributes → receive events → present/ACKs → local schedule/timer.

Expo Go is **not** supported (native TurboModule). Use a **dev client** / `expo run:*` build.

## Setup

```bash
cd example
cp .env.example .env
# Edit .env — at least EXPO_PUBLIC_COMRAID_APP_ID=cr_app_…

# Android: place Firebase config next to this README
cp /path/to/google-services.json ./google-services.json

# Ensure the sibling package is built
(cd .. && npm run prepare)

npm install
```

### Native SDK artifacts (until Maven Central / CocoaPods publish)

- **Android:** publish `com.comraid:comraid` to `mavenLocal` from `../comraid-android` (or set `comraidAndroidVersion` / composite build). The RN package defaults to `0.1.0-SNAPSHOT`.
- **iOS:** CocoaPods resolves `ComRaid` from the sibling path / your usual local pod setup for unpublished packages.

Then:

```bash
npx expo prebuild
npx expo run:android
# or
npx expo run:ios
```

Metro with the already-built app:

```bash
npx expo start --dev-client
```

## Happy path in the UI

1. **requestNotificationPermission**
2. **register** (especially on iOS after the plugin wires APNs)
3. **setDeviceProperties** (optional; hitchhikes on the next register/token refresh)
4. **login** with `external_user_id` (and optional JWT)
5. Send a Message from the dashboard or `@comraid/node` to that External user ID
6. Watch **onMessage** / **onNotificationOpenedApp** / background logs

`setBackgroundMessageHandler` is registered in [`index.ts`](./index.ts) before the root component mounts.

## Layout

| Path | Role |
|------|------|
| `App.tsx` | Method playground + event log |
| `index.ts` | Background message handler + root register |
| `app.config.ts` | Expo config + `@comraid/react-native` plugin |
| `src/config.ts` | `EXPO_PUBLIC_*` loader |
| `.env.example` | Required env vars |

## Note

This folder is the reference app shipped with the SDK (`REQUIREMENTS.md` §7). It is not published to npm.
