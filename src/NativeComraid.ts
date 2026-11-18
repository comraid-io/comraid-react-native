import { TurboModuleRegistry, type CodegenTypes, type TurboModule } from 'react-native';

export type NativeCapabilities = {
	platform: string;
	notificationsEnabled: boolean;
	authorizationStatus: string;
	exactAlarmsAvailable: boolean;
};

export type NativeScheduleResult = {
	id: string;
	requestedPrecision: string;
	appliedPrecision: string;
	triggerAtMillis: number;
	fallbackReason: string;
};

export type NativePendingSchedule = {
	id: string;
	title: string;
	body: string;
	triggerAtMillis: number;
};

export type NativeTimer = {
	id: string;
	title: string;
	body: string;
	state: string;
	triggerAtMillis: number;
	remainingDurationMs: number;
};

export type NativeRemoteMessage = {
	messageId?: string;
	deliveryId?: string;
	attributionToken?: string;
	title?: string;
	body?: string;
	data?: Readonly<Record<string, string>>;
	deepLink?: string;
	actions?: ReadonlyArray<{ id: string; text: string; icon?: string }>;
	actionId?: string;
	imageUrl?: string;
	subtitle?: string;
	sound?: string;
	badge?: number;
	threadId?: string;
	androidChannelId?: string;
	priority?: 'high' | 'normal';
};

export interface Spec extends TurboModule {
	configure(
		appId: string,
		apiBaseURL: string,
		apnsEnvironment: string,
		defaultChannelId: string,
		defaultChannelName: string,
		smallIconResourceName: string,
		storageSuiteName: string,
		displayForegroundNotifications: boolean,
		accentColor: string,
	): Promise<void>;
	requestNotificationPermission(): Promise<boolean>;
	/** JS `register()`; `register` is a C++ keyword, which breaks the generated JSI spec. */
	registerSubscription(): Promise<void>;
	login(externalUserId: string, jwt: string): Promise<void>;
	logout(): Promise<void>;
	optIn(): Promise<void>;
	optOut(): Promise<void>;
	setDeviceProperties(
		appVersion: string,
		model: string,
		osVersion: string,
		extrasJson: string,
	): Promise<void>;
	setAttributes(attributesJson: string): Promise<void>;
	acknowledgeDelivered(deliveryId: string, attributionToken: string): Promise<boolean>;
	acknowledgeOpened(
		deliveryId: string,
		attributionToken: string,
		actionId: string,
	): Promise<boolean>;
	flushAcks(): Promise<void>;
	getCapabilities(): Promise<NativeCapabilities>;
	getToken(): Promise<string>;
	/** Resolves a `NativeRemoteMessage`; codegen cannot type string maps, so it is untyped here. */
	getInitialNotification(): Promise<CodegenTypes.UnsafeObject | null>;
	presentNotification(messageJson: string): Promise<void>;
	setBackgroundHandlerRegistered(registered: boolean): Promise<void>;
	/** In-app messages: local triggers (kept on the device, passed to a presenter). */
	addTrigger(key: string, value: string): Promise<void>;
	addTriggers(triggersJson: string): Promise<void>;
	removeTrigger(key: string): Promise<void>;
	clearTriggers(): Promise<void>;
	/** Resolves a string map; codegen cannot type string maps, so it is untyped here. */
	getTriggers(): Promise<CodegenTypes.UnsafeObject>;
	setInAppMessagesPaused(paused: boolean): Promise<void>;
	isInAppMessagesPaused(): Promise<boolean>;
	/** Opt this Contact out of / back in to In-app messages (the `in_app` channel, independent of push). */
	optOutInApp(): Promise<void>;
	optInInApp(): Promise<void>;
	/**
	 * When enabled, native draws no In-app message itself: it emits `comraid_in_app_present` and the
	 * JS presenter reports outcomes back with the three calls below, keyed by message id.
	 */
	setInAppMessagePresenterEnabled(enabled: boolean): Promise<void>;
	inAppImpression(messageId: string): Promise<void>;
	inAppClicked(messageId: string, buttonId: string): Promise<void>;
	inAppDismissed(messageId: string): Promise<void>;
	/** TurboModule event emitter contract. */
	addListener(eventName: string): void;
	removeListeners(count: number): void;
	schedule(
		id: string,
		title: string,
		body: string,
		triggerAtMillis: number,
		precision: string,
		fallbackPolicy: string,
		dataJson: string,
	): Promise<NativeScheduleResult>;
	startTimer(
		id: string,
		title: string,
		body: string,
		durationMillis: number,
		precision: string,
		fallbackPolicy: string,
		dataJson: string,
	): Promise<NativeScheduleResult>;
	pauseTimer(id: string): Promise<NativeTimer>;
	resumeTimer(id: string): Promise<NativeTimer>;
	cancelTimer(id: string): Promise<void>;
	timers(): Promise<ReadonlyArray<NativeTimer>>;
	cancel(id: string): Promise<void>;
	pendingSchedules(): Promise<ReadonlyArray<NativePendingSchedule>>;
}

export default TurboModuleRegistry.get<Spec>('Comraid');
