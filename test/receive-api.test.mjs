import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function loadCreateComRaid() {
	// Prefer built module (prepare); fall back to source via ts transpile is not available —
	// tests run after `npm run prepare` / bob build.
	const built = path.join(root, 'lib/module/createComRaid.js');
	return import(pathToFileURL(built).href);
}

function mockNative(overrides = {}) {
	const calls = {
		configure: [],
		presentNotification: [],
		acknowledgeOpened: [],
		acknowledgeDelivered: [],
		getToken: 0,
		setBackgroundHandlerRegistered: [],
		addListener: [],
		removeListeners: [],
	};
	const native = {
		configure: async (...args) => {
			calls.configure.push(args);
		},
		requestNotificationPermission: async () => true,
		register: async () => {},
		login: async () => {},
		logout: async () => {},
		optIn: async () => {},
		optOut: async () => {},
		setDeviceProperties: async () => {},
		setAttributes: async () => {},
		acknowledgeDelivered: async (...args) => {
			calls.acknowledgeDelivered.push(args);
			return true;
		},
		acknowledgeOpened: async (...args) => {
			calls.acknowledgeOpened.push(args);
			return true;
		},
		flushAcks: async () => {},
		getCapabilities: async () => ({
			platform: 'android',
			notificationsEnabled: true,
			authorizationStatus: 'authorized',
			exactAlarmsAvailable: true,
		}),
		getToken: async () => {
			calls.getToken += 1;
			return 'fcm-provider-token';
		},
		getInitialNotification: async () => null,
		presentNotification: async messageJson => {
			calls.presentNotification.push(messageJson);
		},
		setBackgroundHandlerRegistered: async registered => {
			calls.setBackgroundHandlerRegistered.push(registered);
		},
		addListener: eventName => {
			calls.addListener.push(eventName);
		},
		removeListeners: count => {
			calls.removeListeners.push(count);
		},
		schedule: async () => {
			throw new Error('unused');
		},
		startTimer: async () => {
			throw new Error('unused');
		},
		cancel: async () => {},
		pendingSchedules: async () => [],
		...overrides,
	};
	return { native, calls };
}

function mockEvents() {
	const listeners = new Map();
	return {
		bus: {
			addListener(eventType, listener) {
				const list = listeners.get(eventType) ?? [];
				list.push(listener);
				listeners.set(eventType, list);
				return {
					remove() {
						const current = listeners.get(eventType) ?? [];
						listeners.set(
							eventType,
							current.filter(item => item !== listener),
						);
					},
				};
			},
		},
		emit(eventType, payload) {
			for (const listener of listeners.get(eventType) ?? []) {
				listener(payload);
			}
		},
	};
}

test('onMessage delivers RNFirebase-shaped payload; sender data keys unchanged', async () => {
	const { createComRaid, EVENT_MESSAGE } = await loadCreateComRaid();
	const { native } = mockNative();
	const { bus, emit } = mockEvents();
	const api = createComRaid(native, bus);
	/** @type {import('../lib/typescript/src/createComRaid').RemoteMessage | null} */
	let received = null;
	api.onMessage(message => {
		received = message;
	});
	emit(EVENT_MESSAGE, {
		messageId: 'm1',
		deliveryId: 'd1',
		title: 'Hello',
		body: 'World',
		data: { path: '/orders/1', params: '{"id":1}' },
		deepLink: 'app://orders/1',
		actions: [{ id: 'accept', text: 'Accept' }],
	});
	assert.ok(received);
	assert.equal(received.messageId, 'm1');
	assert.equal(received.deliveryId, 'd1');
	assert.equal(received.title, 'Hello');
	assert.equal(received.body, 'World');
	assert.deepEqual(received.data, { path: '/orders/1', params: '{"id":1}' });
	assert.equal(received.deepLink, 'app://orders/1');
	assert.equal(received.actions?.[0]?.id, 'accept');
});

test('getToken returns Provider token from TurboModule', async () => {
	const { createComRaid } = await loadCreateComRaid();
	const { native, calls } = mockNative();
	const { bus } = mockEvents();
	const api = createComRaid(native, bus);
	assert.equal(await api.getToken(), 'fcm-provider-token');
	assert.equal(calls.getToken, 1);
});

test('onTokenRefresh forwards Provider token events', async () => {
	const { createComRaid, EVENT_TOKEN_REFRESH } = await loadCreateComRaid();
	const { native } = mockNative();
	const { bus, emit } = mockEvents();
	const api = createComRaid(native, bus);
	const tokens = [];
	api.onTokenRefresh(token => tokens.push(token));
	emit(EVENT_TOKEN_REFRESH, { token: 'rotated-fcm' });
	assert.deepEqual(tokens, ['rotated-fcm']);
});

test('initialize passes foreground display opt-out to native configure', async () => {
	const { createComRaid } = await loadCreateComRaid();
	const { native, calls } = mockNative();
	const { bus } = mockEvents();
	const api = createComRaid(native, bus);
	await api.initialize({
		appId: 'cr_app_test',
		displayForegroundNotifications: false,
		ios: { apnsEnvironment: 'sandbox' },
	});
	assert.equal(calls.configure.length, 1);
	const args = calls.configure[0];
	assert.equal(args[0], 'cr_app_test');
	assert.equal(args[7], false);
});

test('presentNotification invokes native with message JSON', async () => {
	const { createComRaid } = await loadCreateComRaid();
	const { native, calls } = mockNative();
	const { bus } = mockEvents();
	const api = createComRaid(native, bus);
	await api.presentNotification({
		messageId: 'm1',
		deliveryId: 'd1',
		title: 'Rematch?',
		body: 'Play again',
		data: { matchId: '42' },
		actions: [
			{ id: 'accept', text: 'Accept' },
			{ id: 'reject', text: 'Reject' },
		],
	});
	assert.equal(calls.presentNotification.length, 1);
	const parsed = JSON.parse(calls.presentNotification[0]);
	assert.equal(parsed.title, 'Rematch?');
	assert.equal(parsed.deliveryId, 'd1');
	assert.equal(parsed.data.matchId, '42');
	assert.equal(parsed.actions.length, 2);
});

test('background receive handler runs without auto acknowledgeOpened', async () => {
	const { createComRaid, EVENT_BACKGROUND_MESSAGE } = await loadCreateComRaid();
	const { native, calls } = mockNative();
	const { bus, emit } = mockEvents();
	const api = createComRaid(native, bus);
	const seen = [];
	api.setBackgroundMessageHandler(async message => {
		seen.push(message.deliveryId);
	});
	assert.deepEqual(calls.setBackgroundHandlerRegistered, [true]);
	emit(EVENT_BACKGROUND_MESSAGE, {
		deliveryId: 'd-bg',
		title: 'Hint',
		body: 'Body',
		data: { path: '/rematch' },
	});
	await new Promise(resolve => setImmediate(resolve));
	assert.deepEqual(seen, ['d-bg']);
	assert.equal(calls.acknowledgeOpened.length, 0);
	assert.equal(calls.acknowledgeDelivered.length, 0);
});

test('onNotificationOpenedApp surfaces open events including actionId', async () => {
	const { createComRaid, EVENT_NOTIFICATION_OPENED } = await loadCreateComRaid();
	const { native } = mockNative();
	const { bus, emit } = mockEvents();
	const api = createComRaid(native, bus);
	const opened = [];
	api.onNotificationOpenedApp(message => opened.push(message));
	emit(EVENT_NOTIFICATION_OPENED, {
		deliveryId: 'd1',
		title: 'Rematch?',
		data: {},
		actionId: 'accept',
	});
	assert.equal(opened.length, 1);
	assert.equal(opened[0].actionId, 'accept');
	assert.equal(opened[0].deliveryId, 'd1');
});

test('getInitialNotification returns null when native has none', async () => {
	const { createComRaid } = await loadCreateComRaid();
	const { native } = mockNative();
	const { bus } = mockEvents();
	const api = createComRaid(native, bus);
	assert.equal(await api.getInitialNotification(), null);
});

// Keep require available for environments that resolve CJS helpers.
void require;
