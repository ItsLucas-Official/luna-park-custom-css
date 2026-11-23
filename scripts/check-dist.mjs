/**
 * Publish guard (`prepublishOnly`, after the build): makes sure `dist/` is the build of the code
 * that is about to be published, so a stale bundle can never reach npm.
 *
 * - `dist/index.js` and `dist/runtime.js` exist;
 * - the editor bundle contains this package's name and version (they are read from package.json at
 *   build time, so a bundle built before `npm version` would carry the old number);
 * - no source file is newer than the bundle.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const { name, version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const problems = [];

function newest(directory) {
    let latest = 0;

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);

        latest = Math.max(latest, entry.isDirectory() ? newest(path) : statSync(path).mtimeMs);
    }

    return latest;
}

let bundle = "";

try {
    bundle = readFileSync(join(root, "dist", "index.js"), "utf8");
    statSync(join(root, "dist", "runtime.js"));
}
catch {
    problems.push("dist/index.js or dist/runtime.js is missing: run `pnpm build`.");
}

if (bundle && !bundle.includes(`"${ version }"`)) {
    problems.push(`dist/index.js does not contain version ${ version }: it was built before the version bump.`);
}

if (bundle && !bundle.includes(`"${ name }"`)) {
    problems.push(`dist/index.js does not contain the package name "${ name }": the name changed since the build.`);
}

if (bundle && newest(join(root, "src")) > statSync(join(root, "dist", "index.js")).mtimeMs + 1000) {
    problems.push("a file in src/ is newer than dist/index.js: run `pnpm build`.");
}

if (problems.length) {
    console.error(`\nRefusing to publish ${ name }@${ version }:\n- ${ problems.join("\n- ") }\n`);
    process.exit(1);
}

console.log(`dist/ is up to date for ${ name }@${ version }.`);
