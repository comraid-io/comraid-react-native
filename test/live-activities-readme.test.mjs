import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

test('the README documents each Live activity method and the type', () => {
	assert.ok(readme.includes('### Live activities'));
	for (const heading of ['#### `endActivity(', '#### `listActivities(']) {
		assert.ok(readme.includes(heading), `README must document ${heading}`);
	}
	assert.ok(readme.includes('`LiveActivity`'), 'README Types must list LiveActivity');
});

test('the README says what each platform does and what the host must write', () => {
	for (const fact of ['trackActivity', 'trackRunningActivities', 'NSSupportsLiveActivities', 'pushType: .token', 'Android 16', 'Live activities need a native SDK version that includes them']) {
		assert.ok(readme.includes(fact), `README must mention: ${fact}`);
	}
});
