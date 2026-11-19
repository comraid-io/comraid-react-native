import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

test('the README documents every public In-app method and type', () => {
	const methods = [
		'setInAppMessagePresenter',
		'addInAppMessageListener',
		'addTrigger',
		'addTriggers',
		'removeTrigger',
		'clearTriggers',
		'getTriggers',
		'setInAppMessagesPaused',
		'isInAppMessagesPaused',
		'optOutInApp',
		'optInInApp',
	];
	const missing = methods.filter(name => !readme.includes(`#### \`${name}(`));
	assert.deepEqual(missing, [], `README must document each In-app method. Missing: ${missing}`);
	assert.ok(readme.includes('### In-app messages'));
	for (const type of ['InAppMessage', 'InAppButton', 'InAppLayout', 'InAppMessageHandle', 'InAppMessagePresenter', 'InAppMessageListener']) {
		assert.ok(readme.includes(`\`${type}\``), `README Types must list ${type}`);
	}
});

test('the README says which native SDK version has In-app messages', () => {
	assert.match(readme, /In-app messages need a native SDK version that includes them/);
});
