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
		/**
		 * Tint for the small icon and action buttons on SDK-drawn notifications,
		 * as `#RRGGBB` or `#AARRGGBB`. Defaults to the Expo plugin's `defaultNotificationColor`.
		 */
		accentColor?: string;
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

export type TimerState = 'running' | 'paused' | 'cancelled' | 'completed';

export interface Timer {
	id: string;
	notification: Pick<NotificationContent, 'id' | 'title' | 'body'>;
	state: TimerState;
	triggerAt?: Date;
	remainingDurationMs: number;
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

/**
 * Optional overrides for Subscription / Contact Properties.
 * Native SDKs auto-collect app/SDK version, OS, model, locale, language,
 * timezone and country on register and session; fields set here win when non-empty.
 */
export interface DeviceProperties {
	appVersion?: string;
	model?: string;
	osVersion?: string;
	extras?: Readonly<Record<string, unknown>>;
}

/** Contact Attribute map. A `null` value removes that Attribute on the server. */
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
	/** Push image (`content.push.image_url`); `presentNotification` shows it. */
	imageUrl?: string;
	/** iOS subtitle (`content.push.subtitle`); Android exposes it but never draws it. */
	subtitle?: string;
	/** Sound name (`chime` on Android `res/raw`, `chime.caf` bundled on iOS). */
	sound?: string;
	badge?: number;
	/** Thread / tag (`content.push.thread_id`). */
	threadId?: string;
	/** Android notification channel for the push's category (carried on both platforms when sent). */
	androidChannelId?: string;
	/** Always `'high' | 'normal'` on received events (default `'high'`). */
	priority?: 'high' | 'normal';
}

/** How an In-app message is laid out (wire values). */
export type InAppLayout = 'modal' | 'banner_top' | 'banner_bottom' | 'fullscreen';

/** A button on an In-app message. Your app routes `deepLink`; the SDK never opens it. */
export interface InAppButton {
	id: string;
	label: string;
	deepLink?: string;
}

/** One In-app message as received from ComRaid. */
export interface InAppMessage {
	id: string;
	layout: InAppLayout;
	title: string;
	body: string;
	imageUrl?: string;
	buttons: InAppButton[];
	/** Start of the display window; absent when open-ended. */
	startAt?: Date;
	/** End of the display window; absent when open-ended. */
	endAt?: Date;
	/** True for a Dashboard Test send: shown normally, but no ACKs are sent for it. */
	isTest: boolean;
}

/**
 * Reports what happened to an In-app message you draw yourself. `clicked` and `dismissed`
 * behave as on the native SDKs: a close after a click is not recorded as a dismissal.
 */
export interface InAppMessageHandle {
	/** The message is on screen. Recorded once. */
	impression(): Promise<void>;
	/** The user tapped the button with this id. Unknown ids are ignored. */
	clicked(buttonId: string): Promise<void>;
	/** The user closed the message. Recorded once. */
	dismissed(): Promise<void>;
}

/** Draws In-app messages in place of the SDK's default layouts. */
export type InAppMessagePresenter = (
	message: InAppMessage,
	handle: InAppMessageHandle,
	triggers: Readonly<Record<string, string>>,
) => void | Promise<void>;

/** Observes In-app messages. A listener cannot change or suppress a message; every method is optional. */
export interface InAppMessageListener {
	willDisplay?(message: InAppMessage): void;
	didDisplay?(message: InAppMessage): void;
	willDismiss?(message: InAppMessage): void;
	didDismiss?(message: InAppMessage): void;
	/** A button was tapped. Route `button.deepLink` yourself. */
	didClick?(message: InAppMessage, button: InAppButton): void;
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
/** Native asks the JS presenter to draw a message: `{ message, triggers }`. */
export const EVENT_IN_APP_PRESENT = 'comraid_in_app_present';
/** Native reports the message lifecycle: `{ type, message, button? }`. */
export const EVENT_IN_APP_LIFECYCLE = 'comraid_in_app_lifecycle';

const IN_APP_LAYOUTS: ReadonlyArray<InAppLayout> = [
	'modal',
	'banner_top',
	'banner_bottom',
	'fullscreen',
];

function optionalString(value: unknown): string | undefined {
	return typeof value === 'string' && value !== '' ? value : undefined;
}

function parseInAppButton(raw: unknown): InAppButton | null {
	if (raw == null || typeof raw !== 'object') return null;
	const value = raw as Record<string, unknown>;
	if (typeof value.id !== 'string' || value.id === '') return null;
	return {
		id: value.id,
		label: typeof value.label === 'string' ? value.label : '',
		deepLink: optionalString(value.deepLink),
	};
}

function dateFromMillis(value: unknown): Date | undefined {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? new Date(value) : undefined;
}

/** Parse a native In-app message; returns null for anything the SDK could not have drawn. */
function parseInAppMessage(raw: unknown): InAppMessage | null {
	if (raw == null || typeof raw !== 'object') return null;
	const value = raw as Record<string, unknown>;
	if (typeof value.id !== 'string' || value.id === '') return null;
	if (!IN_APP_LAYOUTS.includes(value.layout as InAppLayout)) return null;
	const buttons = Array.isArray(value.buttons)
		? value.buttons.map(parseInAppButton).filter((b): b is InAppButton => b != null)
		: [];
	return {
		id: value.id,
		layout: value.layout as InAppLayout,
		title: typeof value.title === 'string' ? value.title : '',
		body: typeof value.body === 'string' ? value.body : '',
		imageUrl: optionalString(value.imageUrl),
		buttons,
		startAt: dateFromMillis(value.startAt),
		endAt: dateFromMillis(value.endAt),
		isTest: value.isTest === true,
	};
}

function parseStringMap(raw: unknown): Record<string, string> {
	const out: Record<string, string> = {};
	if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
		for (const [key, value] of Object.entries(raw)) {
			if (typeof value === 'string') out[key] = value;
		}
	}
	return out;
}

/** Presentation string fields: keep non-empty strings only (absent when unset). */
function optionalPresentationString(value: unknown): string | undefined {
	return typeof value === 'string' && value !== '' ? value : undefined;
}

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
		imageUrl: optionalPresentationString(value.imageUrl),
		subtitle: optionalPresentationString(value.subtitle),
		sound: optionalPresentationString(value.sound),
		badge:
			typeof value.badge === 'number' && Number.isInteger(value.badge) && value.badge >= 0
				? value.badge
				: undefined,
		threadId: optionalPresentationString(value.threadId),
		androidChannelId: optionalPresentationString(value.androidChannelId),
		priority: value.priority === 'high' || value.priority === 'normal' ? value.priority : undefined,
	};
}

export function createComRaid(nativeModule: Spec | null, events: EventBus) {
	let backgroundHandler: ((message: RemoteMessage) => Promise<void> | void) | null = null;
	let backgroundSubscription: EventSubscription | null = null;
	let inAppPresenter: InAppMessagePresenter | null = null;
	let inAppPresenterSubscription: EventSubscription | null = null;

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

	function inAppHandle(messageId: string): InAppMessageHandle {
		return {
			async impression() {
				await native().inAppImpression(messageId);
			},
			async clicked(buttonId: string) {
				if (typeof buttonId !== 'string' || !buttonId.trim()) {
					throw new TypeError('buttonId must not be empty');
				}
				await native().inAppClicked(messageId, buttonId);
			},
			async dismissed() {
				await native().inAppDismissed(messageId);
			},
		};
	}

	function requireTriggerKey(key: unknown): asserts key is string {
		if (typeof key !== 'string' || !key.trim()) throw new TypeError('trigger key must not be empty');
	}

	function triggerMap(triggers: unknown): Record<string, string> {
		const prototype = triggers == null ? undefined : Object.getPrototypeOf(triggers);
		if (
			triggers == null ||
			typeof triggers !== 'object' ||
			(prototype !== Object.prototype && prototype !== null)
		) {
			// A Map, Date or class instance would serialise to an empty or wrong object.
			throw new TypeError('triggers must be a plain object');
		}
		for (const [key, value] of Object.entries(triggers)) {
			requireTriggerKey(key);
			if (typeof value !== 'string') throw new TypeError('trigger values must be strings');
		}
		return triggers as Record<string, string>;
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
				options.android?.accentColor ?? '',
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
			await native().registerSubscription();
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

		/** Opt this Contact out of In-app messages (independent of push `optOut`). */
		async optOutInApp(): Promise<void> {
			await native().optOutInApp();
		},

		/** Opt this Contact back in to In-app messages. */
		async optInInApp(): Promise<void> {
			await native().optInInApp();
		},

		/**
		 * Set a local trigger. Triggers stay on the device and are passed to your presenter; they do
		 * not decide which message shows.
		 */
		async addTrigger(key: string, value: string): Promise<void> {
			requireTriggerKey(key);
			if (typeof value !== 'string') throw new TypeError('trigger values must be strings');
			await native().addTrigger(key, value);
		},

		async addTriggers(triggers: Readonly<Record<string, string>>): Promise<void> {
			await native().addTriggers(JSON.stringify(triggerMap(triggers)));
		},

		async removeTrigger(key: string): Promise<void> {
			requireTriggerKey(key);
			await native().removeTrigger(key);
		},

		async clearTriggers(): Promise<void> {
			await native().clearTriggers();
		},

		async getTriggers(): Promise<Record<string, string>> {
			return parseStringMap(await native().getTriggers());
		},

		/** Pause or resume showing In-app messages on this device. Messages wait while paused. */
		async setInAppMessagesPaused(paused: boolean): Promise<void> {
			if (typeof paused !== 'boolean') throw new TypeError('paused must be a boolean');
			await native().setInAppMessagesPaused(paused);
		},

		async isInAppMessagesPaused(): Promise<boolean> {
			return (await native().isInAppMessagesPaused()) === true;
		},

		/** Observe In-app messages being displayed, clicked and dismissed. */
		addInAppMessageListener(listener: InAppMessageListener): Unsubscribe {
			const sub = events.addListener(EVENT_IN_APP_LIFECYCLE, event => {
				if (event == null || typeof event !== 'object') return;
				const payload = event as { type?: unknown; message?: unknown; button?: unknown };
				const message = parseInAppMessage(payload.message);
				if (message == null) return;
				try {
					switch (payload.type) {
						case 'willDisplay':
							listener.willDisplay?.(message);
							break;
						case 'didDisplay':
							listener.didDisplay?.(message);
							break;
						case 'willDismiss':
							listener.willDismiss?.(message);
							break;
						case 'didDismiss':
							listener.didDismiss?.(message);
							break;
						case 'didClick': {
							const button = parseInAppButton(payload.button);
							if (button != null) listener.didClick?.(message, button);
							break;
						}
						default:
							break; // a lifecycle step this version does not know about
					}
				} catch {
					// A host listener bug must not stop the other listeners.
				}
			});
			return () => sub.remove();
		},

		/**
		 * Draw In-app messages yourself. While a presenter is set the SDK draws nothing: you receive
		 * the message, a handle and the triggers, and report impression / click / dismissal through
		 * the handle. Pass `null` to return to the SDK's layouts.
		 */
		async setInAppMessagePresenter(presenter: InAppMessagePresenter | null): Promise<void> {
			if (presenter !== null && typeof presenter !== 'function') {
				throw new TypeError('presenter must be a function or null');
			}
			if (presenter === null) {
				// Tell native first and keep listening until it confirms, so a message it hands over
				// just before switching modes still reaches the presenter.
				try {
					await native().setInAppMessagePresenterEnabled(false);
				} finally {
					inAppPresenterSubscription?.remove();
					inAppPresenterSubscription = null;
					inAppPresenter = null;
				}
				return;
			}
			const previousPresenter = inAppPresenter;
			const hadSubscription = inAppPresenterSubscription != null;
			inAppPresenter = presenter;
			if (inAppPresenterSubscription == null) {
				// Subscribe before enabling native, so no message handed over right away is missed.
				inAppPresenterSubscription = events.addListener(EVENT_IN_APP_PRESENT, event => {
					if (event == null || typeof event !== 'object') return;
					const payload = event as { message?: unknown; triggers?: unknown };
					const message = parseInAppMessage(payload.message);
					if (message == null) {
						console.warn('@comraid/react-native: ignoring an unknown In-app message (unsupported layout or id)');
						return;
					}
					const current = inAppPresenter;
					if (current == null) return;
					const failed = (error: unknown) =>
						console.warn(
							`@comraid/react-native: the In-app presenter failed: ${error instanceof Error ? error.message : String(error)}`,
						);
					try {
						Promise.resolve(
							current(message, inAppHandle(message.id), parseStringMap(payload.triggers)),
						).catch(failed);
					} catch (error) {
						failed(error);
					}
				});
			}
			try {
				await native().setInAppMessagePresenterEnabled(true);
			} catch (error) {
				// Native did not switch modes: leave JS exactly as it was before this call.
				if (!hadSubscription) {
					inAppPresenterSubscription?.remove();
					inAppPresenterSubscription = null;
				}
				inAppPresenter = previousPresenter;
				throw error;
			}
		},

		/**
		 * Override auto-collected Properties for subsequent native register / token /
		 * session calls. Forwarded to native `ComRaid.setDeviceProperties`.
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
		 * A `null` value removes that Attribute.
		 */
		async setAttributes(attributes: ContactAttributes): Promise<void> {
			if (attributes == null || typeof attributes !== 'object' || Array.isArray(attributes)) {
				throw new TypeError('attributes must be a plain object');
			}
			await native().setAttributes(JSON.stringify(attributes));
		},

		/** Enqueue + flush a delivered ACK. Returns false when ids are blank (e.g. Test send). */
		async acknowledgeDelivered(deliveryId: string, attributionToken: string): Promise<boolean> {
			if (!deliveryId.trim() || !attributionToken.trim()) return false;
			return native().acknowledgeDelivered(deliveryId, attributionToken);
		},

		/** Enqueue + flush an opened ACK (optional action button id). */
		async acknowledgeOpened(
			deliveryId: string,
			attributionToken: string,
			actionId?: string,
		): Promise<boolean> {
			if (!deliveryId.trim() || !attributionToken.trim()) return false;
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

		async pauseTimer(id: string): Promise<Timer> {
			if (!id.trim()) throw new TypeError('id must not be empty');
			return timerResult(await native().pauseTimer(id));
		},

		async resumeTimer(id: string): Promise<Timer> {
			if (!id.trim()) throw new TypeError('id must not be empty');
			return timerResult(await native().resumeTimer(id));
		},

		async cancelTimer(id: string): Promise<void> {
			if (!id.trim()) throw new TypeError('id must not be empty');
			await native().cancelTimer(id);
		},

		async timers(): Promise<Timer[]> {
			return (await native().timers()).map(timerResult);
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

function timerResult(value: {
	id: string;
	title: string;
	body: string;
	state: string;
	triggerAtMillis: number;
	remainingDurationMs: number;
}): Timer {
	const state = value.state.toLowerCase();
	const normalized: TimerState =
		state === 'running' || state === 'paused' || state === 'cancelled' || state === 'completed'
			? state
			: 'cancelled';
	return {
		id: value.id,
		notification: { id: value.id, title: value.title, body: value.body },
		state: normalized,
		triggerAt:
			Number.isFinite(value.triggerAtMillis) && value.triggerAtMillis > 0
				? new Date(value.triggerAtMillis)
				: undefined,
		remainingDurationMs: value.remainingDurationMs,
	};
}

export type ComRaidAPI = ReturnType<typeof createComRaid>;
