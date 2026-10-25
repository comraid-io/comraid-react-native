import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadRunSubscribeFlow() {
	const built = path.join(root, 'lib/module/runSubscribeFlow.js');
	const mod = await import(pathToFileURL(built).href);
	return mod.runSubscribeFlow;
}

function createMocks(overrides = {}) {
	const calls = [];
	const deps = {
		requestNotificationPermission: async () => {
			calls.push('requestNotificationPermission');
			return true;
		},
		register: async () => {
			calls.push('register');
		},
		login: async (externalUserId, jwt) => {
			calls.push(['login', externalUserId, jwt]);
		},
		optIn: async () => {
			calls.push('optIn');
		},
		optOut: async () => {
			calls.push('optOut');
		},
		...overrides,
	};
	return { deps, calls };
}

test('grant → register → login when externalUserId is set', async () => {
	const runSubscribeFlow = await loadRunSubscribeFlow();
	const { deps, calls } = createMocks();

	const result = await runSubscribeFlow(deps, {
		externalUserId: 'user_123',
		jwt: 'jwt-token',
	});

	assert.deepEqual(calls, [
		'requestNotificationPermission',
		'register',
		['login', 'user_123', 'jwt-token'],
	]);
	assert.equal(result.status, 'registered');
});

test('grant → register only when identity is omitted', async () => {
	const runSubscribeFlow = await loadRunSubscribeFlow();
	const { deps, calls } = createMocks();

	const result = await runSubscribeFlow(deps, {});

	assert.deepEqual(calls, ['requestNotificationPermission', 'register']);
	assert.equal(result.status, 'registered');
});

test('deny → no register and no login', async () => {
	const runSubscribeFlow = await loadRunSubscribeFlow();
	const { deps, calls } = createMocks({
		requestNotificationPermission: async () => {
			calls.push('requestNotificationPermission');
			return false;
		},
	});

	const result = await runSubscribeFlow(deps, { externalUserId: 'user_123' });

	assert.deepEqual(calls, ['requestNotificationPermission']);
	assert.equal(result.status, 'denied');
});

test('register failure surfaces and skips login', async () => {
	const runSubscribeFlow = await loadRunSubscribeFlow();
	const { deps, calls } = createMocks({
		register: async () => {
			calls.push('register');
			throw new Error('register failed');
		},
	});

	await assert.rejects(
		() => runSubscribeFlow(deps, { externalUserId: 'user_123' }),
		/register failed/,
	);
	assert.deepEqual(calls, ['requestNotificationPermission', 'register']);
});

test('login failure after register surfaces', async () => {
	const runSubscribeFlow = await loadRunSubscribeFlow();
	const { deps, calls } = createMocks({
		login: async (externalUserId, jwt) => {
			calls.push(['login', externalUserId, jwt]);
			throw new Error('login failed');
		},
	});

	await assert.rejects(
		() => runSubscribeFlow(deps, { externalUserId: 'user_123' }),
		/login failed/,
	);
	assert.deepEqual(calls, [
		'requestNotificationPermission',
		'register',
		['login', 'user_123', undefined],
	]);
});

test('flow never calls optIn or optOut', async () => {
	const runSubscribeFlow = await loadRunSubscribeFlow();
	const { deps, calls } = createMocks();

	await runSubscribeFlow(deps, { externalUserId: 'user_123' });
	await runSubscribeFlow(deps, {});
	await runSubscribeFlow(
		{
			...deps,
			requestNotificationPermission: async () => {
				calls.push('requestNotificationPermission');
				return false;
			},
		},
		{ externalUserId: 'user_123' },
	);

	assert.ok(!calls.includes('optIn'));
	assert.ok(!calls.includes('optOut'));
});

test('package entry does not export runSubscribeFlow (SubscribeBanner-only)', () => {
	const index = fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8');
	assert.doesNotMatch(index, /\brunSubscribeFlow\b/);
	assert.doesNotMatch(index, /\bSubscribeFlowResult\b/);
	assert.doesNotMatch(index, /\bSubscribeFlowDeps\b/);
	assert.doesNotMatch(index, /\bSubscribeFlowOptions\b/);
});
