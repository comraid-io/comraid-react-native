/**
 * Push payload contract goldens (ADR 0017): RN is a thin bridge (ADR 0004).
 * Coverage only — every expectedEvent field must be declared on RemoteMessage;
 * RN data must never expose Reserved cr_ keys. No native reserved-key list here.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const goldensDir = path.join(root, 'contracts', 'push-payload', 'goldens');
const remoteMessageSource = path.join(root, 'src', 'createComRaid.ts');

/** @param {string} source */
function declaredRemoteMessageFields(source) {
	const match = source.match(/export interface RemoteMessage \{([\s\S]*?)\n\}/);
	assert.ok(match, 'RemoteMessage interface must exist in createComRaid.ts');
	const body = match[1];
	const fields = new Set();
	for (const line of body.split('\n')) {
		const prop = line.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\??:/);
		if (prop) fields.add(prop[1]);
	}
	return fields;
}

/** @param {unknown} value @param {Set<string>} out */
function collectObjectKeys(value, out) {
	if (value == null || typeof value !== 'object' || Array.isArray(value)) return;
	for (const key of Object.keys(value)) out.add(key);
}

test('vendored goldens directory is committed with JSON fixtures', () => {
	assert.ok(fs.existsSync(goldensDir), `missing ${goldensDir}; run npm run sync:push-payload`);
	const files = fs.readdirSync(goldensDir).filter(name => name.endsWith('.json')).sort();
	assert.ok(files.length >= 1, 'expected at least one golden JSON file');
});

test('RemoteMessage declares every field that appears in any golden expectedEvent', () => {
	const declared = declaredRemoteMessageFields(fs.readFileSync(remoteMessageSource, 'utf8'));
	const files = fs.readdirSync(goldensDir).filter(name => name.endsWith('.json'));
	const expectedFields = new Set();
	for (const name of files) {
		const golden = JSON.parse(fs.readFileSync(path.join(goldensDir, name), 'utf8'));
		assert.ok(
			golden.expectedEvent && typeof golden.expectedEvent === 'object',
			`${name}: expectedEvent object required`,
		);
		collectObjectKeys(golden.expectedEvent, expectedFields);
	}
	const missing = [...expectedFields].filter(field => !declared.has(field)).sort();
	assert.deepEqual(
		missing,
		[],
		`RemoteMessage is missing golden expectedEvent fields: ${missing.join(', ')}`,
	);
});

test('golden expectedEvent data never exposes Reserved cr_ keys', () => {
	const files = fs.readdirSync(goldensDir).filter(name => name.endsWith('.json'));
	const offenders = [];
	for (const name of files) {
		const golden = JSON.parse(fs.readFileSync(path.join(goldensDir, name), 'utf8'));
		const data = golden.expectedEvent?.data;
		assert.ok(data && typeof data === 'object' && !Array.isArray(data), `${name}: data map required`);
		for (const key of Object.keys(data)) {
			if (key.startsWith('cr_')) offenders.push(`${name}: data.${key}`);
		}
	}
	assert.deepEqual(offenders, [], `Reserved keys must not appear in RN data: ${offenders.join(', ')}`);
});
