import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Android native SDK defaults to released 0.1.0 and resolves mavenLocal', () => {
	const gradle = fs.readFileSync(path.join(root, 'android/build.gradle'), 'utf8');
	assert.match(gradle, /mavenLocal\(\)/);
	assert.match(
		gradle,
		/com\.comraid:comraid:\$\{findProperty\('comraidAndroidVersion'\) \?: '0\.1\.0'\}/,
	);
	assert.doesNotMatch(gradle, /0\.1\.0-SNAPSHOT/);
});

test('iOS podspec pins ComRaid ~> 0.1.0', () => {
	const podspec = fs.readFileSync(path.join(root, 'ReactNativeComraid.podspec'), 'utf8');
	assert.match(podspec, /dependency "ComRaid", "~> 0\.1\.0"/);
});

test('Expo plugin documents local native path overrides for Android and iOS', async () => {
	const { applyComraidPodPathOverride, addNotificationServicePodTarget } = await import(
		'../plugin/build/notification-service-extension.js'
	);
	const { ensureMavenLocalRepository } = await import('../plugin/build/android-ios-helpers.js');

	const podfile = `platform :ios, '15.0'\n\ntarget 'App' do\n  use_react_native!\nend\n`;
	const withPath = applyComraidPodPathOverride(podfile, '../comraid-ios');
	assert.match(withPath, /pod 'ComRaid',\s*:path => '\.\.\/comraid-ios'/);
	assert.equal(applyComraidPodPathOverride(withPath, '../comraid-ios'), withPath);

	const nse = addNotificationServicePodTarget(withPath, { comraidPath: '../comraid-ios' });
	assert.match(nse, /target 'ComRaidNotificationService' do\n  pod 'ComRaid', :path => '\.\.\/comraid-ios'\nend/);

	const projectGradle = `buildscript {\n  repositories {\n    google()\n  }\n}\n\nallprojects {\n  repositories {\n    google()\n    mavenCentral()\n  }\n}\n`;
	const withMavenLocal = ensureMavenLocalRepository(projectGradle);
	assert.match(withMavenLocal, /allprojects \{[\s\S]*mavenLocal\(\)/);
	assert.doesNotMatch(
		withMavenLocal.split('allprojects')[0],
		/mavenLocal\(\)/,
		'mavenLocal must not be injected only into buildscript',
	);
	assert.equal(ensureMavenLocalRepository(withMavenLocal), withMavenLocal);

	const publishLocal = fs.readFileSync(
		path.join(root, 'scripts/publish-android-local.sh'),
		'utf8',
	);
	assert.match(publishLocal, /publishToMavenLocal/);
});

test('package scripts cover npm pack and publint dry runs', () => {
	const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
	assert.equal(pkg.version, '0.1.0');
	assert.match(pkg.scripts['pack:check'], /npm pack --dry-run/);
	assert.match(pkg.scripts.publint, /publint/);
	assert.equal(pkg.publishConfig?.access, 'public');
	assert.ok(pkg.devDependencies?.publint);
});

test('README and example document local native SDK overrides', () => {
	const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
	assert.match(readme, /## Native SDK versions/);
	assert.match(readme, /comraidPath/);
	assert.match(readme, /publishToMavenLocal/);
	assert.match(readme, /publish-android-local/);
	assert.match(readme, /## Releasing/);

	const example = fs.readFileSync(path.join(root, 'example/README.md'), 'utf8');
	assert.match(example, /comraidPath|mavenLocal|publish-android-local/);
	assert.doesNotMatch(example, /0\.1\.0-SNAPSHOT/);
});

test('draft release workflow runs pack dry-run on PRs and publishes on tags', () => {
	const workflow = fs.readFileSync(
		path.join(root, '.github/workflows/release-publish.yml'),
		'utf8',
	);
	assert.match(workflow, /v1-tracker\/issues\/35/);
	assert.match(workflow, /pack:check/);
	assert.match(workflow, /publint/);
	assert.match(workflow, /npm publish/);
	assert.match(workflow, /tags:/);
});
