import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";

const root = process.cwd();
const consumer = mkdtempSync(join(tmpdir(), "flot-package-"));

function run(command, args, cwd = consumer) {
	try {
		return execFileSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });
	} catch (error) {
		throw new Error(`${command} failed:\n${error.stdout}\n${error.stderr}`, { cause: error });
	}
}

before(() => {
	// Resolve Flot from published files, without relying on the checkout.
	// make test-package builds first; avoid recursively invoking prepack here.
	const [pack] = JSON.parse(
		run("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", consumer], root),
	);
	const packageDir = join(consumer, "node_modules/@kevinburke/flot");
	mkdirSync(packageDir, { recursive: true });
	run("tar", [
		"--extract",
		"--gzip",
		"--file",
		join(consumer, pack.filename),
		"--strip-components=1",
		"--directory",
		packageDir,
	]);
	for (const dependency of ["jquery", "happy-dom", "@types"]) {
		symlinkSync(resolve(root, "node_modules", dependency), join(consumer, "node_modules", dependency));
	}
	cpSync(join(root, "tests/package"), consumer, { recursive: true });
});

after(() => {
	rmSync(consumer, { recursive: true, force: true });
});

for (const mode of ["import", "require"]) {
	test(`packed package loads through ${mode}`, () => {
		run(process.execPath, ["consumer.mjs", mode]);
	});
}

for (const extension of ["mts", "cts"]) {
	test(`packed declarations work for ${extension} consumers`, () => {
		run(resolve(root, "node_modules/.bin/tsc"), [
			"--ignoreConfig",
			"--noEmit",
			"--strict",
			"--module",
			"Node16",
			"--moduleResolution",
			"Node16",
			"--target",
			"ES2019",
			"--types",
			"jquery",
			`consumer.${extension}`,
		]);
	});
}
