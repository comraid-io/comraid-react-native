import NativeComraid, { type NativeScheduleResult } from './NativeComraid';

export type SchedulePrecision = 'inexact' | 'exact';
export type FallbackPolicy = 'fail' | 'useInexact';
export type APNsEnvironment = 'sandbox' | 'production';

export interface ConfigureOptions {
	/** Publishable App ID (`cr_app_…`). Required. */
	appId: string;
	/** Optional API base; defaults to https://api.comraid.io on native. */
	apiBaseURL?: string;
	android?: {
		defaultChannelId?: string;
		defaultChannelName?: string;
		smallIconResourceName?: string;
	};
	ios?: {
		/** Required on iOS. */
		apnsEnvironment: APNsEnvironment;
		storageSuiteName?: string;
	};
}

export interface NotificationContent {
	id: string;
	title: string;
	body: string;
	data?: Readonly<Record<string, string>>;
}

export interface ScheduleOptions {
	notification: NotificationContent;
	triggerAt: Date | number;
	precision?: SchedulePrecision;
	fallbackPolicy?: FallbackPolicy;
}

export interface TimerOptions {
	notification: NotificationContent;
	durationMs: number;
	precision?: SchedulePrecision;
	fallbackPolicy?: FallbackPolicy;
}

export interface Capabilities {
	platform: 'ios' | 'android';
	notificationsEnabled: boolean;
	authorizationStatus: string;
	exactAlarmsAvailable: boolean;
}

export interface ScheduleResult {
	id: string;
	requestedPrecision: SchedulePrecision;
	appliedPrecision: SchedulePrecision;
	triggerAt: Date;
	fallbackReason?: string;
}

export interface PendingSchedule {
	notification: Pick<NotificationContent, 'id' | 'title' | 'body'>;
	triggerAt: Date;
}

function nativeModule() {
	if (!NativeComraid) {
		throw new Error(
			'react-native-comraid is not linked. Rebuild the native app; Expo Go cannot load this module.',
		);
	}
	return NativeComraid;
}

function validateNotification(notification: NotificationContent) {
	if (!notification.id.trim()) throw new TypeError('notification.id must not be empty');
	if (!notification.title.trim()) throw new TypeError('notification.title must not be empty');
}

function dataJson(data: NotificationContent['data']) {
	if (data != null && (typeof data !== 'object' || Array.isArray(data) || Object.values(data).some(value => typeof value !== 'string'))) {
		throw new TypeError('notification.data must be an object containing only string values');
	}
	return JSON.stringify(data ?? {});
}

function result(value: NativeScheduleResult): ScheduleResult {
	return {
		id: value.id,
		requestedPrecision: value.requestedPrecision as SchedulePrecision,
		appliedPrecision: value.appliedPrecision as SchedulePrecision,
		triggerAt: new Date(value.triggerAtMillis),
		fallbackReason: value.fallbackReason || undefined,
	};
}

export const Comraid = {
	/**
	 * Stores settings on the native SDKs. Does not register a Subscription yet —
	 * call `requestNotificationPermission` / `register` after permission is granted.
	 */
	async initialize(options: ConfigureOptions): Promise<void> {
		if (!options.appId?.trim()) {
			throw new TypeError('appId is required (cr_app_…)');
		}
		await nativeModule().configure(
			options.appId.trim(),
			options.apiBaseURL ?? '',
			options.ios?.apnsEnvironment ?? '',
			options.android?.defaultChannelId ?? '',
			options.android?.defaultChannelName ?? '',
			options.android?.smallIconResourceName ?? '',
			options.ios?.storageSuiteName ?? '',
		);
	},

	/** @deprecated Prefer `initialize`. */
	async configure(options: ConfigureOptions): Promise<void> {
		return Comraid.initialize(options);
	},

	async getCapabilities(): Promise<Capabilities> {
		return (await nativeModule().getCapabilities()) as Capabilities;
	},

	async requestNotificationPermission(): Promise<boolean> {
		return nativeModule().requestNotificationPermission();
	},

	async register(): Promise<void> {
		await nativeModule().register();
	},

	async login(externalUserId: string, jwt?: string): Promise<void> {
		if (!externalUserId.trim()) throw new TypeError('externalUserId must not be empty');
		await nativeModule().login(externalUserId.trim(), jwt ?? '');
	},

	async logout(): Promise<void> {
		await nativeModule().logout();
	},

	async optIn(): Promise<void> {
		await nativeModule().optIn();
	},

	async optOut(): Promise<void> {
		await nativeModule().optOut();
	},

	async schedule(options: ScheduleOptions): Promise<ScheduleResult> {
		validateNotification(options.notification);
		const triggerAtMillis = options.triggerAt instanceof Date
			? options.triggerAt.getTime()
			: options.triggerAt;
		if (!Number.isFinite(triggerAtMillis) || triggerAtMillis <= Date.now()) {
			throw new TypeError('triggerAt must be a future Date or Unix time in milliseconds');
		}
		return result(await nativeModule().schedule(
			options.notification.id,
			options.notification.title,
			options.notification.body,
			triggerAtMillis,
			options.precision ?? 'inexact',
			options.fallbackPolicy ?? 'fail',
			dataJson(options.notification.data),
		));
	},

	async startTimer(options: TimerOptions): Promise<ScheduleResult> {
		validateNotification(options.notification);
		if (!Number.isFinite(options.durationMs) || options.durationMs <= 0) {
			throw new TypeError('durationMs must be positive');
		}
		return result(await nativeModule().startTimer(
			options.notification.id,
			options.notification.title,
			options.notification.body,
			options.durationMs,
			options.precision ?? 'inexact',
			options.fallbackPolicy ?? 'fail',
			dataJson(options.notification.data),
		));
	},

	async cancel(id: string): Promise<void> {
		if (!id.trim()) throw new TypeError('id must not be empty');
		await nativeModule().cancel(id);
	},

	async pendingSchedules(): Promise<PendingSchedule[]> {
		return (await nativeModule().pendingSchedules()).map(value => ({
			notification: { id: value.id, title: value.title, body: value.body },
			triggerAt: new Date(value.triggerAtMillis),
		}));
	},
};

export default Comraid;
