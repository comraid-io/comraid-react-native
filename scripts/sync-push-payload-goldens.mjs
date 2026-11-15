#!/usr/bin/env node
/**
 * Vendor Push payload goldens from sibling planning (ADR 0017).
 *
 * Source: sibling planning/contracts/push-payload/goldens/ (or COMRAID_PLANNING_ROOT).
 * Dest:   contracts/push-payload/goldens/
 *
 * Usage:
 *   node scripts/sync-push-payload-goldens.mjs          # copy
 *   node scripts/sync-push-payload-goldens.mjs --check  # fail on drift
 *
 * RN vendors goldens only (no contract.json); ADR 0004 thin bridge.
 */

import { createHash } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destDir = join(repoRoot, 'contracts', 'push-payload', 'goldens');
const checkOnly = process.argv.includes('--check');

/**
 * @param {string} root
 * @returns {string | undefined}
 */
function resolvePlanningGoldensDir(root) {
	if (process.env.COMRAID_PLANNING_ROOT) {
		const fromEnv = resolve(process.env.COMRAID_PLANNING_ROOT, 'contracts/push-payload/goldens');
		if (existsSync(fromEnv)) return fromEnv;
	}
	const candidates = [
		resolve(root, '../planning/contracts/push-payload/goldens'),
		resolve(root, '../../planning/contracts/push-payload/goldens'),
	];
	return candidates.find(candidate => existsSync(candidate));
}

/**
 * @param {string} dir
 * @returns {Map<string, string>} relative path → sha256 hex
 */
function fileHashes(dir) {
	/** @type {Map<string, string>} */
	const out = new Map();
	if (!existsSync(dir)) return out;
	for (const name of readdirSync(dir).sort()) {
		const full = join(dir, name);
		if (!statSync(full).isFile() || !name.endsWith('.json')) continue;
		const hash = createHash('sha256').update(readFileSync(full)).digest('hex');
		out.set(name, hash);
	}
	return out;
}

const sourceDir = resolvePlanningGoldensDir(repoRoot);
if (!sourceDir) {
	console.error(
		'Push payload goldens: planning goldens not found. Set COMRAID_PLANNING_ROOT or clone sibling planning/.',
	);
	process.exit(1);
}

const sourceHashes = fileHashes(sourceDir);
if (sourceHashes.size === 0) {
	console.error(`Push payload goldens: no JSON files in ${sourceDir}`);
	process.exit(1);
}

if (checkOnly) {
	const destHashes = fileHashes(destDir);
	/** @type {string[]} */
	const drifts = [];
	for (const [name, hash] of sourceHashes) {
		const destHash = destHashes.get(name);
		if (!destHash) drifts.push(`missing in repo: ${name}`);
		else if (destHash !== hash) drifts.push(`content drift: ${name}`);
	}
	for (const name of destHashes.keys()) {
		if (!sourceHashes.has(name)) drifts.push(`extra in repo: ${name}`);
	}
	if (drifts.length > 0) {
		console.error('Push payload goldens: committed copy drifts from planning:\n' + drifts.map(d => `  - ${d}`).join('\n'));
		console.error('Run: npm run sync:push-payload');
		process.exit(1);
	}
	console.log(
		`Push payload goldens: OK (${sourceHashes.size} files match ${relative(repoRoot, sourceDir)})`,
	);
	process.exit(0);
}

mkdirSync(dirname(destDir), { recursive: true });
rmSync(destDir, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });
for (const name of sourceHashes.keys()) {
	const bytes = readFileSync(join(sourceDir, name));
	writeFileSync(join(destDir, name), bytes);
}
console.log(
	`Push payload goldens: synced ${sourceHashes.size} files → ${relative(repoRoot, destDir)} from ${relative(repoRoot, sourceDir)}`,
);
