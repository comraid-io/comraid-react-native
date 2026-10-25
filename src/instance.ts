import { NativeEventEmitter } from 'react-native';
import { createComRaid } from './createComRaid';
import NativeComraid from './NativeComraid';

const eventEmitter = NativeComraid != null ? new NativeEventEmitter(NativeComraid) : null;

/** Package singleton — SubscribeBanner and public exports share this instance. */
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
