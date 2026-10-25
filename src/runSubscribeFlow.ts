export type SubscribeFlowDeps = {
	requestNotificationPermission: () => Promise<boolean>;
	register: () => Promise<void>;
	login: (externalUserId: string, jwt?: string) => Promise<void>;
};

export type SubscribeFlowOptions = {
	externalUserId?: string;
	jwt?: string;
};

export type SubscribeFlowResult =
	| { status: 'denied' }
	| { status: 'registered' };

/**
 * Permission → register → optional Login. Never touches Channel optIn/optOut.
 * Injectable deps keep this testable without a device (ADR 0004 thin bridge).
 * Internal to SubscribeBanner — not part of the package public API.
 */
export async function runSubscribeFlow(
	deps: SubscribeFlowDeps,
	options: SubscribeFlowOptions = {},
): Promise<SubscribeFlowResult> {
	const granted = await deps.requestNotificationPermission();
	if (!granted) {
		return { status: 'denied' };
	}

	await deps.register();

	const externalUserId = options.externalUserId;
	if (externalUserId != null && externalUserId !== '') {
		await deps.login(externalUserId, options.jwt);
	}

	return { status: 'registered' };
}
