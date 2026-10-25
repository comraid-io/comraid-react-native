import type { Spec } from './NativeComraid';

export type SchedulePrecision = 'inexact' | 'exact';
export type FallbackPolicy = 'fail' | 'useInexact';
export type APNsEnvironment = 'sandbox' | 'production';

export interface ConfigureOptions {
	/** Publishable App ID (`cr_app_…`). Required. */
	appId: string;
	/** Optional API base; defaults to https://api.comraid.io on native. */
	apiBaseURL?: string;
	/**
	 * When true (default), non–data-only Notifications are shown by the SDK in the
	 * foreground. Set false to handle alerts only via `onMessage`.
	 */
	displayForegroundNotifications?: boolean;
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

/** Subscription (device) Properties sent on the next register / token refresh. */
export interface DeviceProperties {
	appVersion?: string;
	model?: string;
	osVersion?: string;
	extras?: Readonly<Record<string, unknown>>;
}

export type ContactAttributes = Readonly<Record<string, string | number | boolean | null>>;

export interface RemoteMessageAction {
	id: string;
	text: string;
	icon?: string;
}

/** RNFirebase-shaped remote Notification event. */
export interface RemoteMessage {
	messageId?: string;
	deliveryId?: string;
	/** Present for opened ACK / presentNotification auto-ACK. Not a sender `data` key. */
	attributionToken?: string;
	title?: string;
	body?: string;
	/** Sender `data` keys only — ComRaid `cr_*` keys are not included. */
	data: Readonly<Record<string, string>>;
	deepLink?: string;
	actions?: ReadonlyArray<RemoteMessageAction>;
	actionId?: string;
}

export type Unsubscribe = () => void;

export type EventSubscription = { remove(): void };

export type EventBus = {
	addListener(eventType: string, listener: (event: unknown) => void): EventSubscription;
};

export const EVENT_MESSAGE = 'comraid_message';
export const EVENT_BACKGROUND_MESSAGE = 'comraid_background_message';
export const EVENT_NOTIFICATION_OPENED = 'comraid_notification_opened';
export const EVENT_TOKEN_REFRESH = 'comraid_token_refresh';

function parseRemoteMessage(raw: unknown): RemoteMessage {
	const value = (raw ?? {}) as Record<string, unknown>;
	const dataRaw = value.data;
	const data =
		dataRaw != null && typeof dataRaw === 'object' && !Array.isArray(dataRaw)
			? (dataRaw as Record<string, string>)
			: {};
	const actionsRaw = value.actions;
	let actions: RemoteMessageAction[] | undefined;
	if (Array.isArray(actionsRaw)) {
		actions = [];
		for (const item of actionsRaw) {
			const action = item as Record<string, unknown>;
			const id = typeof action.id === 'string' ? action.id : '';
			const text = typeof action.text === 'string' ? action.text : '';
			if (!id || !text) continue;
			const parsed: RemoteMessageAction = { id, text };
			if (typeof action.icon === 'string') parsed.icon = action.icon;
			actions.push(parsed);
		}
		if (actions.length === 0) actions = undefined;
	}
	return {
		messageId: typeof value.messageId === 'string' ? value.messageId : undefined,
		deliveryId: typeof value.deliveryId === 'string' ? value.deliveryId : undefined,
		attributionToken:
			typeof value.attributionToken === 'string' ? value.attributionToken : undefined,
		title: typeof value.title === 'string' ? value.title : undefined,
		body: typeof value.body === 'string' ? value.body : undefined,
		data,
		deepLink: typeof value.deepLink === 'string' ? value.deepLink : undefined,
		actions,
		actionId: typeof value.actionId === 'string' ? value.actionId : undefined,
	};
}

export function createComRaid(nativeModule: Spec | null, events: EventBus) {
	let backgroundHandler: ((message: RemoteMessage) => Promise<void> | void) | null = null;
	let backgroundSubscription: EventSubscription | null = null;

	function native() {
		if (!nativeModule) {
			throw new Error(
				'@comraid/react-native is not linked. Rebuild the native app; Expo Go cannot load this module.',
			);
		}
		return nativeModule;
	}

	function validateNotification(notification: NotificationContent) {
		if (!notification.id.trim()) throw new TypeError('notification.id must not be empty');
		if (!notification.title.trim()) throw new TypeError('notification.title must not be empty');
	}

	function dataJson(data: NotificationContent['data']) {
		if (
			data != null &&
			(typeof data !== 'object' ||
				Array.isArray(data) ||
				Object.values(data).some(value => typeof value !== 'string'))
		) {
			throw new TypeError('notification.data must be an object containing only string values');
		}
		return JSON.stringify(data ?? {});
	}

	function result(value: {
		id: string;
		requestedPrecision: string;
		appliedPrecision: string;
		triggerAtMillis: number;
		fallbackReason: string;
	}): ScheduleResult {
		return {
			id: value.id,
			requestedPrecision: value.requestedPrecision as SchedulePrecision,
			appliedPrecision: value.appliedPrecision as SchedulePrecision,
			triggerAt: new Date(value.triggerAtMillis),
			fallbackReason: value.fallbackReason || undefined,
		};
	}

	return {
		/**
		 * Stores settings on the native SDKs. Does not register a Subscription yet —
		 * call `requestNotificationPermission` / `register` after permission is granted.
		 */
		async initialize(options: ConfigureOptions): Promise<void> {
			if (!options.appId?.trim()) {
				throw new TypeError('appId is required (cr_app_…)');
			}
			await native().configure(
				options.appId.trim(),
				options.apiBaseURL ?? '',
				options.ios?.apnsEnvironment ?? '',
				options.android?.defaultChannelId ?? '',
				options.android?.defaultChannelName ?? '',
				options.android?.smallIconResourceName ?? '',
				options.ios?.storageSuiteName ?? '',
				options.displayForegroundNotifications !== false,
			);
		},

		/** @deprecated Prefer `initialize`. */
		async configure(options: ConfigureOptions): Promise<void> {
			return this.initialize(options);
		},

		async getCapabilities(): Promise<Capabilities> {
			return (await native().getCapabilities()) as Capabilities;
		},

		async requestNotificationPermission(): Promise<boolean> {
			return native().requestNotificationPermission();
		},

		async register(): Promise<void> {
			await native().register();
		},

		async login(externalUserId: string, jwt?: string): Promise<void> {
			if (!externalUserId.trim()) throw new TypeError('externalUserId must not be empty');
			await native().login(externalUserId.trim(), jwt ?? '');
		},

		async logout(): Promise<void> {
			await native().logout();
		},

		async optIn(): Promise<void> {
			await native().optIn();
		},

		async optOut(): Promise<void> {
			await native().optOut();
		},

		/**
		 * Persist Subscription device Properties for the next register / token refresh.
		 * Forwarded to native `ComRaid.setDeviceProperties` (Android / iOS).
		 */
		async setDeviceProperties(properties: DeviceProperties): Promise<void> {
			const extras = properties.extras ?? {};
			if (extras != null && (typeof extras !== 'object' || Array.isArray(extras))) {
				throw new TypeError('device properties extras must be a plain object');
			}
			await native().setDeviceProperties(
				properties.appVersion ?? '',
				properties.model ?? '',
				properties.osVersion ?? '',
				JSON.stringify(extras),
			);
		},

		/**
		 * Upsert Contact Attributes for the logged-in `external_user_id`.
		 * Requires Login. Forwards to native `ComRaid.setAttributes` (Android / iOS).
		 */
		async setAttributes(attributes: ContactAttributes): Promise<void> {
			if (attributes == null || typeof attributes !== 'object' || Array.isArray(attributes)) {
				throw new TypeError('attributes must be a plain object');
			}
			await native().setAttributes(JSON.stringify(attributes));
		},

		/** Enqueue + flush a delivered ACK. Returns false when ids are blank. */
		async acknowledgeDelivered(deliveryId: string, attributionToken: string): Promise<boolean> {
			return native().acknowledgeDelivered(deliveryId, attributionToken);
		},

		/** Enqueue + flush an opened ACK (optional action button id). */
		async acknowledgeOpened(
			deliveryId: string,
			attributionToken: string,
			actionId?: string,
		): Promise<boolean> {
			return native().acknowledgeOpened(deliveryId, attributionToken, actionId ?? '');
		},

		/** Flush any durable ACK backlog. */
		async flushAcks(): Promise<void> {
			await native().flushAcks();
		},

		/**
		 * Provider push token (FCM / APNs). Not a ComRaid Endpoint id.
		 */
		async getToken(): Promise<string> {
			return native().getToken();
		},

		onTokenRefresh(listener: (token: string) => void): Unsubscribe {
			const sub = events.addListener(EVENT_TOKEN_REFRESH, event => {
				const token =
					typeof event === 'string'
						? event
						: typeof (event as { token?: unknown })?.token === 'string'
							? (event as { token: string }).token
							: '';
				if (token) listener(token);
			});
			return () => sub.remove();
		},

		onMessage(listener: (message: RemoteMessage) => void): Unsubscribe {
			const sub = events.addListener(EVENT_MESSAGE, event => {
				listener(parseRemoteMessage(event));
			});
			return () => sub.remove();
		},

		/**
		 * Register from the app entry file before other setup. Invoked for background/killed
		 * data-only (and other) receives on Android when the native bridge emits.
		 */
		setBackgroundMessageHandler(
			handler: (message: RemoteMessage) => Promise<void> | void,
		): void {
			backgroundHandler = handler;
			void native().setBackgroundHandlerRegistered(true);
			if (backgroundSubscription == null) {
				backgroundSubscription = events.addListener(EVENT_BACKGROUND_MESSAGE, event => {
					const message = parseRemoteMessage(event);
					void Promise.resolve(backgroundHandler?.(message));
				});
			}
		},

		onNotificationOpenedApp(listener: (message: RemoteMessage) => void): Unsubscribe {
			const sub = events.addListener(EVENT_NOTIFICATION_OPENED, event => {
				listener(parseRemoteMessage(event));
			});
			return () => sub.remove();
		},

		async getInitialNotification(): Promise<RemoteMessage | null> {
			const value = await native().getInitialNotification();
			if (value == null) return null;
			return parseRemoteMessage(value);
		},

		/**
		 * Optional tray promotion from a received message's title/body/actions.
		 * Action/body taps auto acknowledgeOpened on native (with actionId for actions).
		 * Receive itself never auto-opens.
		 */
		async presentNotification(message: RemoteMessage): Promise<void> {
			await native().presentNotification(JSON.stringify(message));
		},

		async schedule(options: ScheduleOptions): Promise<ScheduleResult> {
			validateNotification(options.notification);
			const triggerAtMillis =
				options.triggerAt instanceof Date ? options.triggerAt.getTime() : options.triggerAt;
			if (!Number.isFinite(triggerAtMillis) || triggerAtMillis <= Date.now()) {
				throw new TypeError('triggerAt must be a future Date or Unix time in milliseconds');
			}
			return result(
				await native().schedule(
					options.notification.id,
					options.notification.title,
					options.notification.body,
					triggerAtMillis,
					options.precision ?? 'inexact',
					options.fallbackPolicy ?? 'fail',
					dataJson(options.notification.data),
				),
			);
		},

		async startTimer(options: TimerOptions): Promise<ScheduleResult> {
			validateNotification(options.notification);
			if (!Number.isFinite(options.durationMs) || options.durationMs <= 0) {
				throw new TypeError('durationMs must be positive');
			}
			return result(
				await native().startTimer(
					options.notification.id,
					options.notification.title,
					options.notification.body,
					options.durationMs,
					options.precision ?? 'inexact',
					options.fallbackPolicy ?? 'fail',
					dataJson(options.notification.data),
				),
			);
		},

		async cancel(id: string): Promise<void> {
			if (!id.trim()) throw new TypeError('id must not be empty');
			await native().cancel(id);
		},

		async pendingSchedules(): Promise<PendingSchedule[]> {
			return (await native().pendingSchedules()).map(value => ({
				notification: { id: value.id, title: value.title, body: value.body },
				triggerAt: new Date(value.triggerAtMillis),
			}));
		},
	};
}

export type ComRaidAPI = ReturnType<typeof createComRaid>;
