import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Tests run against the built module (`npm run prepare` / bob build), like the other JS tests.
function loadModule() {
	return import(pathToFileURL(path.join(root, 'lib/module/createComRaid.js')).href);
}

function mockNative(overrides = {}) {
	const calls = [];
	const native = {
		endActivity: async (...args) => {
			calls.push(['endActivity', ...args]);
			return true;
		},
		listActivities: async () => {
			calls.push(['listActivities']);
			return [
				{ id: 'order_2', type: 'delivery' },
				{ id: 'ride_1', type: 'ride' },
			];
		},
		...overrides,
	};
	return { native, calls };
}

const noEvents = { addListener: () => ({ remove() {} }) };

async function setup(overrides) {
	const { createComRaid } = await loadModule();
	const { native, calls } = mockNative(overrides);
	return { comraid: createComRaid(native, noEvents), calls };
}

test('listActivities returns the native activities as {id, type}', async () => {
	const { comraid } = await setup();
	assert.deepEqual(await comraid.listActivities(), [
		{ id: 'order_2', type: 'delivery' },
		{ id: 'ride_1', type: 'ride' },
	]);
});

test('listActivities drops entries without an id and defaults a missing type to an empty string', async () => {
	const { comraid } = await setup({
		listActivities: async () => [{ id: 'a' }, { id: '', type: 'x' }, null, { type: 'only-type' }, { id: 'b', type: 'ride' }],
	});
	assert.deepEqual(await comraid.listActivities(), [
		{ id: 'a', type: '' },
		{ id: 'b', type: 'ride' },
	]);
});

test('endActivity forwards the id and resolves with the native answer', async () => {
	const { comraid, calls } = await setup();
	assert.equal(await comraid.endActivity('order_2'), true);
	assert.deepEqual(calls, [['endActivity', 'order_2']]);
});

test('endActivity says false for an activity that is not running', async () => {
	const { comraid } = await setup({ endActivity: async () => false });
	assert.equal(await comraid.endActivity('nope'), false);
});

test('endActivity rejects an empty or non-string id without calling native', async () => {
	const { comraid, calls } = await setup();
	await assert.rejects(() => comraid.endActivity(''), TypeError);
	await assert.rejects(() => comraid.endActivity('   '), TypeError);
	await assert.rejects(() => comraid.endActivity(undefined), TypeError);
	assert.deepEqual(calls, []);
});

test('a native error from endActivity or listActivities reaches the caller', async () => {
	const { comraid } = await setup({
		endActivity: async () => {
			throw new Error('native boom');
		},
		listActivities: async () => {
			throw new Error('native list boom');
		},
	});
	await assert.rejects(() => comraid.endActivity('a'), /native boom/);
	await assert.rejects(() => comraid.listActivities(), /native list boom/);
});
