import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const legacy = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.equal(
	legacy.name,
	"react-native-comraid",
	"legacy package name react-native-comraid must remain during expand",
);

const aliasPath = path.join(root, "packages/comraid-react-native/package.json");
assert.ok(fs.existsSync(aliasPath), "expected packages/comraid-react-native/package.json");
const alias = JSON.parse(fs.readFileSync(aliasPath, "utf8"));
assert.equal(alias.name, "@comraid/react-native");

const entry = path.join(root, "packages/comraid-react-native/src/index.ts");
assert.ok(fs.existsSync(entry), "expected packages/comraid-react-native/src/index.ts re-export");
const source = fs.readFileSync(entry, "utf8");
assert.match(source, /from ['"]\.\.\/\.\.\/\.\.\/src(?:\/index)?['"]/);

// Ensure the alias package can resolve the same public module surface locally.
const rootEntry = path.join(root, "src/index.ts");
assert.ok(fs.existsSync(rootEntry), "root src/index.ts must still exist");

console.log("naming expand checks passed:", legacy.name, "and", alias.name);
