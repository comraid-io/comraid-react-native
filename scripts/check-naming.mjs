import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const misspellings = ["comraide", "Comraide", "@comraide", "com.comraide"];

const primary = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.equal(primary.name, "@comraid/react-native");
assert.equal(primary.codegenConfig.android.javaPackageName, "com.comraid.reactnative");

assert.equal(
  fs.existsSync(path.join(root, "packages/react-native-comraid")),
  false,
  "packages/react-native-comraid alias must be removed",
);

const rootEntry = fs.readFileSync(path.join(root, "src/index.ts"), "utf8");
assert.match(rootEntry, /export const ComRaid =/);
assert.doesNotMatch(rootEntry, /export const Comraid = ComRaid/);

const gradle = fs.readFileSync(path.join(root, "android/build.gradle"), "utf8");
assert.match(gradle, /namespace "com\.comraid\.reactnative"/);
assert.match(gradle, /com\.comraid:comraid/);
assert.doesNotMatch(gradle, /com\.comraide/);

const config = fs.readFileSync(path.join(root, "react-native.config.js"), "utf8");
assert.match(config, /com\.comraid\.reactnative\.ComraidPackage/);
assert.doesNotMatch(config, /com\.comraide/);

const podspec = fs.readFileSync(path.join(root, "ReactNativeComraid.podspec"), "utf8");
assert.match(podspec, /dependency "ComRaid"/);

const moduleKt = fs.readFileSync(
  path.join(root, "android/src/main/java/com/comraid/reactnative/ComraidModule.kt"),
  "utf8",
);
assert.doesNotMatch(moduleKt, /com\.comraide/);
assert.doesNotMatch(moduleKt, /LEGACY_META_/);

const shipGlobs = [
  "package.json",
  "README.md",
  "LICENSE",
  "react-native.config.js",
  "ReactNativeComraid.podspec",
  "app.plugin.js",
  "src",
  "android/src",
  "android/build.gradle",
  "ios",
  "plugin",
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const offenders = [];
for (const rel of shipGlobs) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;
  const files = fs.statSync(full).isDirectory() ? walk(full) : [full];
  for (const file of files) {
    if (/\.(png|jar|aar|so)$/i.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const needle of misspellings) {
      if (text.includes(needle)) offenders.push(`${path.relative(root, file)}:${needle}`);
    }
  }
}
assert.deepEqual(offenders, [], `shipped misspellings remain: ${offenders.join(", ")}`);

console.log("naming contract checks passed:", primary.name);
