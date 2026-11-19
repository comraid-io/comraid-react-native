import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Tests run against the built module (`npm run prepare` / bob build), like the other JS tests.
function loadModule() {
	return import(pathToFileURL(path.join(root, 'lib/module/createComRaid.js')).href);
}

function mockNative() {
	const calls = [];
	const record =
		(name, result) =>
		async (...args) => {
			calls.push([name, ...args]);
			return result;
		};
	const native = {
		addTrigger: record('addTrigger'),
		addTriggers: record('addTriggers'),
		removeTrigger: record('removeTrigger'),
		clearTriggers: record('clearTriggers'),
		getTriggers: record('getTriggers', { screen: 'checkout' }),
		setInAppMessagesPaused: record('setInAppMessagesPaused'),
		isInAppMessagesPaused: record('isInAppMessagesPaused', true),
		optOutInApp: record('optOutInApp'),
		optInInApp: record('optInInApp'),
		setInAppMessagePresenterEnabled: record('setInAppMessagePresenterEnabled'),
		inAppImpression: record('inAppImpression'),
		inAppClicked: record('inAppClicked'),
		inAppDismissed: record('inAppDismissed'),
	};
	return { native, calls };
}

function mockEvents() {
	const listeners = new Map();
	let subscriptions = 0;
	return {
		bus: {
			addListener(eventType, listener) {
				subscriptions += 1;
				const list = listeners.get(eventType) ?? [];
				list.push(listener);
				listeners.set(eventType, list);
				return {
					remove() {
						listeners.set(
							eventType,
							(listeners.get(eventType) ?? []).filter(item => item !== listener),
						);
					},
				};
			},
		},
		emit(eventType, payload) {
			for (const listener of listeners.get(eventType) ?? []) listener(payload);
		},
		count(eventType) {
			return (listeners.get(eventType) ?? []).length;
		},
		get subscriptions() {
			return subscriptions;
		},
	};
}

const nativeMessage = {
	id: 'm1',
	layout: 'modal',
	title: 'Welcome back',
	body: 'See what is new',
	imageUrl: 'https://cdn.example.com/a.png',
	buttons: [
		{ id: 'open', label: 'Open', deepLink: 'myapp://new' },
		{ id: 'later', label: 'Later' },
	],
	startAt: 1_796_095_800_000,
	endAt: 1_798_722_000_000,
	isTest: false,
};

async function setup() {
	const { createComRaid } = await loadModule();
	const { native, calls } = mockNative();
	const events = mockEvents();
	const comraid = createComRaid(native, events.bus);
	return { comraid, calls, events };
}

test('event names are the contract shared with the native bridges', async () => {
	const mod = await loadModule();
	assert.equal(mod.EVENT_IN_APP_PRESENT, 'comraid_in_app_present');
	assert.equal(mod.EVENT_IN_APP_LIFECYCLE, 'comraid_in_app_lifecycle');
});

test('triggers are forwarded to native and validated first', async () => {
	const { comraid, calls } = await setup();

	await comraid.addTrigger('screen', 'checkout');
	await comraid.addTriggers({ plan: 'pro', tier: 'gold' });
	await comraid.removeTrigger('screen');
	await comraid.clearTriggers();
	assert.deepEqual(await comraid.getTriggers(), { screen: 'checkout' });

	assert.deepEqual(calls, [
		['addTrigger', 'screen', 'checkout'],
		['addTriggers', JSON.stringify({ plan: 'pro', tier: 'gold' })],
		['removeTrigger', 'screen'],
		['clearTriggers'],
		['getTriggers'],
	]);

	await assert.rejects(() => comraid.addTrigger('', 'x'), TypeError);
	await assert.rejects(() => comraid.addTrigger('k', 5), TypeError);
	await assert.rejects(() => comraid.addTriggers({ ok: 'y', bad: 1 }), TypeError);
	await assert.rejects(() => comraid.addTriggers(['a']), TypeError);
	await assert.rejects(() => comraid.removeTrigger('  '), TypeError);
	assert.equal(calls.length, 5, 'invalid input must never reach native');
});

test('pause and the in-app opt-out are forwarded to native', async () => {
	const { comraid, calls } = await setup();

	await comraid.setInAppMessagesPaused(true);
	assert.equal(await comraid.isInAppMessagesPaused(), true);
	await comraid.optOutInApp();
	await comraid.optInInApp();

	assert.deepEqual(calls, [
		['setInAppMessagesPaused', true],
		['isInAppMessagesPaused'],
		['optOutInApp'],
		['optInInApp'],
	]);
	await assert.rejects(() => comraid.setInAppMessagesPaused('yes'), TypeError);
});

test('a listener hears the lifecycle with parsed messages until it unsubscribes', async () => {
	const { comraid, events } = await setup();
	const heard = [];
	const unsubscribe = comraid.addInAppMessageListener({
		willDisplay: m => heard.push(['willDisplay', m.id]),
		didDisplay: m => heard.push(['didDisplay', m.id]),
		didClick: (m, b) => heard.push(['didClick', m.id, b.id, b.deepLink]),
	});

	events.emit('comraid_in_app_lifecycle', { type: 'willDisplay', message: nativeMessage });
	events.emit('comraid_in_app_lifecycle', { type: 'didDisplay', message: nativeMessage });
	events.emit('comraid_in_app_lifecycle', {
		type: 'didClick',
		message: nativeMessage,
		button: { id: 'open', label: 'Open', deepLink: 'myapp://new' },
	});
	events.emit('comraid_in_app_lifecycle', { type: 'didDismiss', message: nativeMessage }); // no handler: ignored
	events.emit('comraid_in_app_lifecycle', { type: 'somethingNew', message: nativeMessage }); // unknown: ignored

	assert.deepEqual(heard, [
		['willDisplay', 'm1'],
		['didDisplay', 'm1'],
		['didClick', 'm1', 'open', 'myapp://new'],
	]);

	unsubscribe();
	events.emit('comraid_in_app_lifecycle', { type: 'didDisplay', message: nativeMessage });
	assert.equal(heard.length, 3);
});

test('native messages are parsed into the public shape', async () => {
	const { comraid, events } = await setup();
	let seen;
	comraid.addInAppMessageListener({ didDisplay: m => (seen = m) });

	events.emit('comraid_in_app_lifecycle', { type: 'didDisplay', message: nativeMessage });

	assert.equal(seen.id, 'm1');
	assert.equal(seen.layout, 'modal');
	assert.equal(seen.title, 'Welcome back');
	assert.equal(seen.body, 'See what is new');
	assert.equal(seen.imageUrl, 'https://cdn.example.com/a.png');
	assert.deepEqual(seen.buttons, [
		{ id: 'open', label: 'Open', deepLink: 'myapp://new' },
		{ id: 'later', label: 'Later', deepLink: undefined },
	]);
	assert.ok(seen.startAt instanceof Date);
	assert.equal(seen.startAt.getTime(), 1_796_095_800_000);
	assert.equal(seen.endAt.getTime(), 1_798_722_000_000);
	assert.equal(seen.isTest, false);
});

test('a malformed message or an unknown layout is dropped, never thrown at the host', async () => {
	const { comraid, events } = await setup();
	const heard = [];
	comraid.addInAppMessageListener({ didDisplay: m => heard.push(m.id) });

	events.emit('comraid_in_app_lifecycle', { type: 'didDisplay', message: { ...nativeMessage, id: '' } });
	events.emit('comraid_in_app_lifecycle', {
		type: 'didDisplay',
		message: { ...nativeMessage, layout: 'carousel' },
	});
	events.emit('comraid_in_app_lifecycle', { type: 'didDisplay' });
	events.emit('comraid_in_app_lifecycle', null);

	assert.deepEqual(heard, []);
});

test('a listener that throws does not stop the others', async () => {
	const { comraid, events } = await setup();
	const heard = [];
	comraid.addInAppMessageListener({
		didDisplay: () => {
			throw new Error('host bug');
		},
	});
	comraid.addInAppMessageListener({ didDisplay: m => heard.push(m.id) });

	events.emit('comraid_in_app_lifecycle', { type: 'didDisplay', message: nativeMessage });

	assert.deepEqual(heard, ['m1']);
});

test('a presenter receives the message, a handle and the triggers, and reports outcomes to native', async () => {
	const { comraid, calls, events } = await setup();
	let received;
	await comraid.setInAppMessagePresenter((message, handle, triggers) => {
		received = { message, handle, triggers };
	});
	assert.deepEqual(calls[0], ['setInAppMessagePresenterEnabled', true]);

	events.emit('comraid_in_app_present', { message: nativeMessage, triggers: { screen: 'checkout' } });

	assert.equal(received.message.id, 'm1');
	assert.deepEqual(received.triggers, { screen: 'checkout' });
	await received.handle.impression();
	await received.handle.clicked('open');
	await received.handle.dismissed();
	assert.deepEqual(calls.slice(1), [
		['inAppImpression', 'm1'],
		['inAppClicked', 'm1', 'open'],
		['inAppDismissed', 'm1'],
	]);
	await assert.rejects(() => received.handle.clicked(''), TypeError);
});

test('setting the presenter again swaps it without subscribing twice, and null removes it', async () => {
	const { comraid, calls, events } = await setup();
	const first = [];
	const second = [];
	await comraid.setInAppMessagePresenter(m => first.push(m.id));
	await comraid.setInAppMessagePresenter(m => second.push(m.id));
	assert.equal(events.count('comraid_in_app_present'), 1);

	events.emit('comraid_in_app_present', { message: nativeMessage, triggers: {} });
	assert.deepEqual(first, []);
	assert.deepEqual(second, ['m1']);

	await comraid.setInAppMessagePresenter(null);
	assert.equal(events.count('comraid_in_app_present'), 0);
	assert.deepEqual(calls.at(-1), ['setInAppMessagePresenterEnabled', false]);
	events.emit('comraid_in_app_present', { message: nativeMessage, triggers: {} });
	assert.deepEqual(second, ['m1']);
});

test('a presenter that throws or rejects does not break the event stream', async () => {
	const { comraid, events } = await setup();
	let calls = 0;
	await comraid.setInAppMessagePresenter(async () => {
		calls += 1;
		throw new Error('host bug');
	});

	events.emit('comraid_in_app_present', { message: nativeMessage, triggers: {} });
	events.emit('comraid_in_app_present', { message: nativeMessage, triggers: {} });
	await new Promise(resolve => setImmediate(resolve)); // let the rejections settle

	assert.equal(calls, 2);
});

test('a presenter event with a malformed message is ignored', async () => {
	const { comraid, events } = await setup();
	let calls = 0;
	await comraid.setInAppMessagePresenter(() => {
		calls += 1;
	});

	events.emit('comraid_in_app_present', { message: { id: '' }, triggers: {} });
	events.emit('comraid_in_app_present', null);

	assert.equal(calls, 0);
});

test('a presenter must be a function or null', async () => {
	const { comraid } = await setup();
	await assert.rejects(() => comraid.setInAppMessagePresenter('nope'), TypeError);
});

test('the in-app methods fail clearly when the native module is not linked', async () => {
	const { createComRaid } = await loadModule();
	const comraid = createComRaid(null, mockEvents().bus);

	await assert.rejects(() => comraid.addTrigger('a', 'b'), /not linked/);
	await assert.rejects(() => comraid.optOutInApp(), /not linked/);
});

test('a failed enable leaves no half-set presenter, and a retry works', async () => {
	const { createComRaid } = await loadModule();
	const { native } = mockNative();
	const events = mockEvents();
	let fail = true;
	native.setInAppMessagePresenterEnabled = async enabled => {
		if (enabled && fail) throw new Error('not configured');
	};
	const comraid = createComRaid(native, events.bus);
	const seen = [];

	await assert.rejects(() => comraid.setInAppMessagePresenter(m => seen.push(m.id)), /not configured/);
	assert.equal(events.count('comraid_in_app_present'), 0, 'the subscription must be rolled back');
	events.emit('comraid_in_app_present', { message: nativeMessage, triggers: {} });
	assert.deepEqual(seen, []);

	fail = false;
	await comraid.setInAppMessagePresenter(m => seen.push(m.id));
	assert.equal(events.count('comraid_in_app_present'), 1);
	events.emit('comraid_in_app_present', { message: nativeMessage, triggers: {} });
	assert.deepEqual(seen, ['m1']);
});

test('a message already on its way is still delivered while the presenter is being switched off', async () => {
	const { createComRaid } = await loadModule();
	const { native } = mockNative();
	const events = mockEvents();
	native.setInAppMessagePresenterEnabled = async enabled => {
		// Native hands over one last message while it is still in presenter mode.
		if (!enabled) events.emit('comraid_in_app_present', { message: nativeMessage, triggers: {} });
	};
	const comraid = createComRaid(native, events.bus);
	const seen = [];
	await comraid.setInAppMessagePresenter(m => seen.push(m.id));

	await comraid.setInAppMessagePresenter(null);

	assert.deepEqual(seen, ['m1'], 'the subscription must outlive the native disable call');
	assert.equal(events.count('comraid_in_app_present'), 0);
});

test('addTriggers accepts only a plain object', async () => {
	const { comraid, calls } = await setup();

	await assert.rejects(() => comraid.addTriggers(new Map([['a', 'b']])), TypeError);
	await assert.rejects(() => comraid.addTriggers(new Date()), TypeError);
	await assert.rejects(
		() =>
			comraid.addTriggers(
				new (class Triggers {
					a = 'b';
				})(),
			),
		TypeError,
	);
	await comraid.addTriggers(Object.create(null, { a: { value: 'b', enumerable: true } }));
	assert.equal(calls.length, 1);
});

test('a message the presenter could not receive is reported through console.warn, not lost silently', async () => {
	const { comraid, events } = await setup();
	const warnings = [];
	const original = console.warn;
	console.warn = (...args) => warnings.push(args.join(' '));
	try {
		await comraid.setInAppMessagePresenter(async () => {
			throw new Error('host bug');
		});
		events.emit('comraid_in_app_present', { message: { ...nativeMessage, layout: 'carousel' }, triggers: {} });
		events.emit('comraid_in_app_present', { message: nativeMessage, triggers: {} });
		await new Promise(resolve => setImmediate(resolve));
	} finally {
		console.warn = original;
	}

	assert.equal(warnings.length, 2);
	assert.match(warnings[0], /unknown In-app message/i);
	assert.match(warnings[1], /presenter .*failed|host bug/i);
});
