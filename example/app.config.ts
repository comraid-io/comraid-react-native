import type { ConfigContext, ExpoConfig } from 'expo/config';

// Expo evaluates this from the example/ cwd.
const googleServicesCandidate =
	process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';

function hasGoogleServicesFile(): boolean {
	try {
		return require('node:fs').existsSync(googleServicesCandidate);
	} catch {
		return false;
	}
}

const googleServicesFile = hasGoogleServicesFile() ? googleServicesCandidate : undefined;
const apnsEnvironment =
	(process.env.EXPO_PUBLIC_COMRAID_APNS_ENVIRONMENT as 'sandbox' | 'production' | undefined) ??
	'sandbox';

export default ({ config }: ConfigContext): ExpoConfig => ({
	...config,
	name: 'ComRaid Example',
	slug: 'comraid-react-native-example',
	version: '1.0.0',
	orientation: 'portrait',
	icon: './assets/icon.png',
	userInterfaceStyle: 'light',
	scheme: 'comraid-example',
	ios: {
		supportsTablet: true,
		bundleIdentifier: 'io.comraid.example',
		infoPlist: {
			UIBackgroundModes: ['remote-notification'],
		},
	},
	android: {
		package: 'io.comraid.example',
		adaptiveIcon: {
			backgroundColor: '#0B1F33',
			foregroundImage: './assets/android-icon-foreground.png',
			backgroundImage: './assets/android-icon-background.png',
			monochromeImage: './assets/android-icon-monochrome.png',
		},
		...(googleServicesFile ? { googleServicesFile } : {}),
		permissions: ['POST_NOTIFICATIONS'],
	},
	web: {
		favicon: './assets/favicon.png',
	},
	plugins: [
		[
			'expo-build-properties',
			{
				android: { newArchEnabled: true },
				ios: { newArchEnabled: true },
			},
		],
		'expo-dev-client',
		[
			'@comraid/react-native',
			{
				android: {
					defaultChannelId: 'comraid-example',
					defaultChannelName: 'ComRaid Example',
					smallIconResourceName: 'ic_launcher',
					...(googleServicesFile ? { googleServicesFile } : {}),
				},
				ios: {
					apnsEnvironment,
					storageSuiteName: 'io.comraid.example.comraid',
				},
			},
		],
	],
});
