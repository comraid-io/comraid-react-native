import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('package entry exports SubscribeBanner and no OptIn alias', () => {
	const index = fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8');
	assert.match(index, /export \{[\s\S]*SubscribeBanner/);
	assert.doesNotMatch(index, /\bOptIn\b/);
	assert.doesNotMatch(index, /OptInBanner/);
});

test('SubscribeBanner wires runSubscribeFlow to real ComRaid methods', () => {
	const source = fs.readFileSync(path.join(root, 'src/SubscribeBanner.tsx'), 'utf8');
	assert.match(source, /runSubscribeFlow\s*\(/);
	assert.match(source, /requestNotificationPermission/);
	assert.match(source, /\.register\b/);
	assert.match(source, /\.login\b/);
	assert.match(source, /ComRaid/);
	assert.doesNotMatch(source, /\.optIn\b/);
	assert.doesNotMatch(source, /\.optOut\b/);
	assert.doesNotMatch(source, /\bOptIn\b/);
});

test('SubscribeBanner exposes host dismiss and result callbacks', () => {
	const source = fs.readFileSync(path.join(root, 'src/SubscribeBanner.tsx'), 'utf8');
	assert.match(source, /onDismiss/);
	assert.match(source, /onSuccess/);
	assert.match(source, /onError/);
	assert.match(source, /externalUserId/);
	assert.match(source, /jwt/);
	// Loading disables the primary action while the flow runs.
	assert.match(source, /loading|disabled|isPending|busy/i);
});
