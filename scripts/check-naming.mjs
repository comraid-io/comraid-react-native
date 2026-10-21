import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const primary = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.equal(primary.name, "@comraid/react-native");
assert.equal(primary.codegenConfig.android.javaPackageName, "com.comraid.reactnative");

const aliasPath = path.join(root, "packages/react-native-comraid/package.json");
assert.ok(fs.existsSync(aliasPath), "expected packages/react-native-comraid/package.json");
const alias = JSON.parse(fs.readFileSync(aliasPath, "utf8"));
assert.equal(alias.name, "react-native-comraid");

const entry = path.join(root, "packages/react-native-comraid/src/index.ts");
assert.ok(fs.existsSync(entry), "expected packages/react-native-comraid/src/index.ts re-export");
const source = fs.readFileSync(entry, "utf8");
assert.match(source, /from ['"]\.\.\/\.\.\/\.\.\/src(?:\/index)?['"]/);

const rootEntry = fs.readFileSync(path.join(root, "src/index.ts"), "utf8");
assert.match(rootEntry, /export const ComRaid =/);
assert.match(rootEntry, /export const Comraid = ComRaid/);

const gradle = fs.readFileSync(path.join(root, "android/build.gradle"), "utf8");
assert.match(gradle, /namespace "com\.comraid\.reactnative"/);
assert.match(gradle, /com\.comraid:comraid/);

const config = fs.readFileSync(path.join(root, "react-native.config.js"), "utf8");
assert.match(config, /com\.comraid\.reactnative\.ComraidPackage/);

const podspec = fs.readFileSync(path.join(root, "ReactNativeComraid.podspec"), "utf8");
assert.match(podspec, /dependency "ComRaid"/);

console.log("naming migrate checks passed:", primary.name, "alias", alias.name);
