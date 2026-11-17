import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Soft-hide Channel optIn/optOut from V1 public README method tables / quickstarts.
 * TurboModule + JS wrappers must remain callable (no breaking removal).
 */
test('README does not advertise Channel optIn/optOut as app APIs', () => {
	const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
	assert.doesNotMatch(readme, /#### `optOut\(\)/);
	assert.doesNotMatch(readme, /#### `optIn\(\)/);
	assert.doesNotMatch(readme, /ComRaid\.optOut\s*\(/);
	assert.doesNotMatch(readme, /ComRaid\.optIn\s*\(/);
});

test('TurboModule and createComRaid still expose optIn/optOut', () => {
	const spec = fs.readFileSync(path.join(root, 'src/NativeComraid.ts'), 'utf8');
	assert.match(spec, /optIn\(\):\s*Promise<void>/);
	assert.match(spec, /optOut\(\):\s*Promise<void>/);

	const source = fs.readFileSync(path.join(root, 'src/createComRaid.ts'), 'utf8');
	assert.match(source, /async optIn\(\):\s*Promise<void>/);
	assert.match(source, /async optOut\(\):\s*Promise<void>/);
});
