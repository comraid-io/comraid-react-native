import { NativeEventEmitter } from 'react-native';
import {
	createComRaid,
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
import NativeComraid from './NativeComraid';
import {
	runSubscribeFlow,
	type SubscribeFlowDeps,
	type SubscribeFlowOptions,
	type SubscribeFlowResult,
} from './runSubscribeFlow';

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
};

export { runSubscribeFlow };

const eventEmitter = NativeComraid != null ? new NativeEventEmitter(NativeComraid) : null;

export const ComRaid = createComRaid(NativeComraid ?? null, {
	addListener(eventType, listener) {
		if (eventEmitter == null) {
			throw new Error(
				'@comraid/react-native is not linked. Rebuild the native app; Expo Go cannot load this module.',
			);
		}
		return eventEmitter.addListener(eventType, listener);
	},
});

export default ComRaid;
