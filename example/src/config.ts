export type ExampleConfig = {
	appId: string;
	apiBaseURL?: string;
	externalUserId: string;
	jwt?: string;
	apnsEnvironment: 'sandbox' | 'production';
};

function trim(value: string | undefined): string | undefined {
	const next = value?.trim();
	return next && next.length > 0 ? next : undefined;
}

/** Runtime settings from `EXPO_PUBLIC_*` (see `.env.example`). */
export function loadConfig(): ExampleConfig {
	const appId = trim(process.env.EXPO_PUBLIC_COMRAID_APP_ID);
	if (!appId) {
		throw new Error(
			'Set EXPO_PUBLIC_COMRAID_APP_ID in example/.env (publishable cr_app_… from the dashboard).',
		);
	}

	const apns =
		trim(process.env.EXPO_PUBLIC_COMRAID_APNS_ENVIRONMENT) === 'production'
			? 'production'
			: 'sandbox';

	return {
		appId,
		apiBaseURL: trim(process.env.EXPO_PUBLIC_COMRAID_API_BASE_URL),
		externalUserId: trim(process.env.EXPO_PUBLIC_COMRAID_EXTERNAL_USER_ID) ?? 'example_user_1',
		jwt: trim(process.env.EXPO_PUBLIC_COMRAID_JWT),
		apnsEnvironment: apns,
	};
}
