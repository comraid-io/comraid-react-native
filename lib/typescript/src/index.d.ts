export type SchedulePrecision = 'inexact' | 'exact';
export type FallbackPolicy = 'fail' | 'useInexact';
export interface ConfigureOptions {
    android?: {
        defaultChannelId?: string;
        defaultChannelName?: string;
        smallIconResourceName?: string;
    };
    ios?: {
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
export declare const Comraid: {
    configure(options?: ConfigureOptions): Promise<void>;
    getCapabilities(): Promise<Capabilities>;
    requestNotificationPermission(): Promise<boolean>;
    schedule(options: ScheduleOptions): Promise<ScheduleResult>;
    startTimer(options: TimerOptions): Promise<ScheduleResult>;
    cancel(id: string): Promise<void>;
    pendingSchedules(): Promise<PendingSchedule[]>;
};
export default Comraid;
//# sourceMappingURL=index.d.ts.map