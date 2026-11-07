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
		registerSubscription: async () => {},
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

const RICH_PRESENTATION = {
	imageUrl: 'https://cdn.example.com/a.png',
	subtitle: 'Order update',
	sound: 'chime',
	badge: 3,
	threadId: 'order-42',
	androidChannelId: 'orders',
	priority: 'high',
};

function assertPresentationFields(message) {
	assert.equal(message.imageUrl, RICH_PRESENTATION.imageUrl);
	assert.equal(message.subtitle, RICH_PRESENTATION.subtitle);
	assert.equal(message.sound, RICH_PRESENTATION.sound);
	assert.equal(message.badge, RICH_PRESENTATION.badge);
	assert.equal(message.threadId, RICH_PRESENTATION.threadId);
	assert.equal(message.androidChannelId, RICH_PRESENTATION.androidChannelId);
	assert.equal(message.priority, RICH_PRESENTATION.priority);
}

test('onMessage keeps presentation fields and drops wrong-typed ones', async () => {
	const { createComRaid, EVENT_MESSAGE } = await loadCreateComRaid();
	const { native } = mockNative();
	const { bus, emit } = mockEvents();
	const api = createComRaid(native, bus);
	const received = [];
	api.onMessage(message => received.push(message));
	emit(EVENT_MESSAGE, {
		title: 'Hello',
		data: {},
		...RICH_PRESENTATION,
	});
	emit(EVENT_MESSAGE, {
		title: 'Hello',
		data: {},
		badge: -1,
		subtitle: 12,
		priority: 'urgent',
		imageUrl: null,
		sound: true,
		threadId: {},
		androidChannelId: 7,
	});
	assertPresentationFields(received[0]);
	assert.equal(received[1].badge, undefined);
	assert.equal(received[1].subtitle, undefined);
	assert.equal(received[1].priority, undefined);
	assert.equal(received[1].imageUrl, undefined);
	assert.equal(received[1].sound, undefined);
	assert.equal(received[1].threadId, undefined);
	assert.equal(received[1].androidChannelId, undefined);
});

test('onMessage drops empty-string presentation fields', async () => {
	const { createComRaid, EVENT_MESSAGE } = await loadCreateComRaid();
	const { native } = mockNative();
	const { bus, emit } = mockEvents();
	const api = createComRaid(native, bus);
	const received = [];
	api.onMessage(message => received.push(message));
	emit(EVENT_MESSAGE, {
		title: 'Hello',
		data: {},
		imageUrl: '',
		subtitle: '',
		sound: '',
		threadId: '',
		androidChannelId: '',
		priority: 'normal',
		badge: 0,
	});
	assert.equal(received[0].imageUrl, undefined);
	assert.equal(received[0].subtitle, undefined);
	assert.equal(received[0].sound, undefined);
	assert.equal(received[0].threadId, undefined);
	assert.equal(received[0].androidChannelId, undefined);
	assert.equal(received[0].priority, 'normal');
	assert.equal(received[0].badge, 0);
});

test('background, opened, and initial receive paths keep presentation fields', async () => {
	const {
		createComRaid,
		EVENT_BACKGROUND_MESSAGE,
		EVENT_NOTIFICATION_OPENED,
	} = await loadCreateComRaid();
	const { native } = mockNative({
		getInitialNotification: async () => ({
			title: 'Cold start',
			data: {},
			...RICH_PRESENTATION,
			priority: 'normal',
		}),
	});
	const { bus, emit } = mockEvents();
	const api = createComRaid(native, bus);

	const background = [];
	api.setBackgroundMessageHandler(message => {
		background.push(message);
	});
	emit(EVENT_BACKGROUND_MESSAGE, {
		title: 'Background',
		data: {},
		...RICH_PRESENTATION,
	});
	await new Promise(resolve => setImmediate(resolve));
	assertPresentationFields(background[0]);

	const opened = [];
	api.onNotificationOpenedApp(message => opened.push(message));
	emit(EVENT_NOTIFICATION_OPENED, {
		title: 'Opened',
		data: {},
		...RICH_PRESENTATION,
		actionId: 'accept',
	});
	assertPresentationFields(opened[0]);
	assert.equal(opened[0].actionId, 'accept');

	const initial = await api.getInitialNotification();
	assert.ok(initial);
	assert.equal(initial.imageUrl, RICH_PRESENTATION.imageUrl);
	assert.equal(initial.subtitle, RICH_PRESENTATION.subtitle);
	assert.equal(initial.sound, RICH_PRESENTATION.sound);
	assert.equal(initial.badge, RICH_PRESENTATION.badge);
	assert.equal(initial.threadId, RICH_PRESENTATION.threadId);
	assert.equal(initial.androidChannelId, RICH_PRESENTATION.androidChannelId);
	assert.equal(initial.priority, 'normal');
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
	assert.equal(args[8], '');
});

test('presentNotification serializes every presentation field', async () => {
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
		...RICH_PRESENTATION,
		priority: 'normal',
	});
	assert.equal(calls.presentNotification.length, 1);
	const parsed = JSON.parse(calls.presentNotification[0]);
	assert.equal(parsed.title, 'Rematch?');
	assert.equal(parsed.deliveryId, 'd1');
	assert.equal(parsed.data.matchId, '42');
	assert.equal(parsed.actions.length, 2);
	assert.equal(parsed.imageUrl, RICH_PRESENTATION.imageUrl);
	assert.equal(parsed.subtitle, RICH_PRESENTATION.subtitle);
	assert.equal(parsed.sound, RICH_PRESENTATION.sound);
	assert.equal(parsed.badge, RICH_PRESENTATION.badge);
	assert.equal(parsed.threadId, RICH_PRESENTATION.threadId);
	assert.equal(parsed.androidChannelId, RICH_PRESENTATION.androidChannelId);
	assert.equal(parsed.priority, 'normal');
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

test('test send without delivery ids: receive and present, no ack attempts', async () => {
	const { createComRaid, EVENT_MESSAGE, EVENT_NOTIFICATION_OPENED } = await loadCreateComRaid();
	const { native, calls } = mockNative();
	const { bus, emit } = mockEvents();
	const api = createComRaid(native, bus);

	/** @type {import('../lib/typescript/src/createComRaid').RemoteMessage | null} */
	let received = null;
	api.onMessage(message => {
		received = message;
	});
	emit(EVENT_MESSAGE, {
		messageId: 'm-test',
		title: 'Test',
		body: 'No delivery ids',
		data: { path: '/test' },
	});
	assert.ok(received);
	assert.equal(received.deliveryId, undefined);
	assert.equal(received.attributionToken, undefined);
	assert.deepEqual(received.data, { path: '/test' });
	assert.equal(calls.acknowledgeDelivered.length, 0);
	assert.equal(calls.acknowledgeOpened.length, 0);

	await api.presentNotification({
		title: 'Test',
		body: 'No delivery ids',
		data: { path: '/test' },
	});
	assert.equal(calls.presentNotification.length, 1);
	const parsed = JSON.parse(calls.presentNotification[0]);
	assert.equal(parsed.deliveryId, undefined);
	assert.equal(parsed.attributionToken, undefined);

	const opened = [];
	api.onNotificationOpenedApp(message => opened.push(message));
	emit(EVENT_NOTIFICATION_OPENED, {
		title: 'Test',
		body: 'Tap',
		data: {},
	});
	assert.equal(opened.length, 1);
	assert.equal(opened[0].deliveryId, undefined);
	assert.equal(calls.acknowledgeOpened.length, 0);

	assert.equal(await api.acknowledgeDelivered('', ''), false);
	assert.equal(await api.acknowledgeOpened('  ', 'tok'), false);
	assert.equal(await api.acknowledgeOpened('d1', ''), false);
	assert.equal(calls.acknowledgeDelivered.length, 0);
	assert.equal(calls.acknowledgeOpened.length, 0);
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

test('opened listener receives actionId from action-button open (done path)', async () => {
	const { createComRaid, EVENT_NOTIFICATION_OPENED } = await loadCreateComRaid();
	const { native } = mockNative();
	const { bus, emit } = mockEvents();
	const api = createComRaid(native, bus);
	/** @type {string | undefined} */
	let seenActionId;
	api.onNotificationOpenedApp(message => {
		seenActionId = message.actionId;
	});
	emit(EVENT_NOTIFICATION_OPENED, {
		deliveryId: 'd-action',
		attributionToken: 'tok',
		title: 'Choose',
		data: { path: '/rematch' },
		actionId: 'reject',
	});
	assert.equal(seenActionId, 'reject');
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

test('initialize forwards the Android accent colour to native configure', async () => {
	const { createComRaid } = await loadCreateComRaid();
	const { native, calls } = mockNative();
	const { bus } = mockEvents();
	const api = createComRaid(native, bus);
	await api.initialize({ appId: 'cr_app_test', android: { accentColor: '#FF5722' } });
	assert.equal(calls.configure[0][8], '#FF5722');
});
