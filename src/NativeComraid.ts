import { TurboModuleRegistry, type TurboModule } from 'react-native';

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

export interface Spec extends TurboModule {
	configure(
		appId: string,
		apiBaseURL: string,
		apnsEnvironment: string,
		defaultChannelId: string,
		defaultChannelName: string,
		smallIconResourceName: string,
		storageSuiteName: string,
	): Promise<void>;
	requestNotificationPermission(): Promise<boolean>;
	register(): Promise<void>;
	login(externalUserId: string, jwt: string): Promise<void>;
	logout(): Promise<void>;
	optIn(): Promise<void>;
	optOut(): Promise<void>;
	getCapabilities(): Promise<NativeCapabilities>;
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
	cancel(id: string): Promise<void>;
	pendingSchedules(): Promise<ReadonlyArray<NativePendingSchedule>>;
}

export default TurboModuleRegistry.get<Spec>('Comraid');
