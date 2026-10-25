import {
	type APNsEnvironment,
	type Capabilities,
	type ConfigureOptions,
	type ContactAttributes,
	type DeviceProperties,
	type FallbackPolicy,
	type NotificationContent,
	type PendingSchedule,
	type RemoteMessage,
	type RemoteMessageAction,
	type ScheduleOptions,
	type SchedulePrecision,
	type ScheduleResult,
	type TimerOptions,
	type Unsubscribe,
} from './createComRaid';
import { ComRaid as comRaidInstance } from './instance';
import {
	runSubscribeFlow,
	type SubscribeFlowDeps,
	type SubscribeFlowOptions,
	type SubscribeFlowResult,
} from './runSubscribeFlow';
import { SubscribeBanner, type SubscribeBannerProps } from './SubscribeBanner';

export type {
	APNsEnvironment,
	Capabilities,
	ConfigureOptions,
	ContactAttributes,
	DeviceProperties,
	FallbackPolicy,
	NotificationContent,
	PendingSchedule,
	RemoteMessage,
	RemoteMessageAction,
	ScheduleOptions,
	SchedulePrecision,
	ScheduleResult,
	TimerOptions,
	Unsubscribe,
	SubscribeFlowDeps,
	SubscribeFlowOptions,
	SubscribeFlowResult,
	SubscribeBannerProps,
};

export { runSubscribeFlow, SubscribeBanner };

export const ComRaid = comRaidInstance;

export default ComRaid;
