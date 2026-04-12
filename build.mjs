#!/usr/bin/env node
// Build script for @kevinburke/flot.
//
// Replaces the legacy gulp + babel + uglify pipeline. Concatenates the
// per-plugin source files into a single IIFE bundle and minifies the result
// with terser. Standalone plugins (pie, image, threshold, etc.) are minified
// individually so users can still <script src="jquery.flot.pie.js"> them.
//
// Outputs land in dist/. The unminified bundle is the package "main" so
// debuggers see readable source by default; the .min.js + .map are intended
// for production <script> tags. dist/ is git-ignored — CI rebuilds it before
// tests and before publish.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants as zlibConstants } from "node:zlib";

import { minify } from "terser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "source");
const DIST = join(__dirname, "dist");
const PLUGINS_DIR = join(DIST, "plugins");

// Files that make up the main bundle. Order matters: jquery.flot.js depends on
// canvaswrapper having registered window.Flot.Canvas, drawSeries depends on
// flot core, etc. This list mirrors the legacy gulpfile.js.
const MAIN_BUNDLE = [
	"jquery.canvaswrapper.js",
	"jquery.colorhelpers.js",
	"jquery.flot.js",
	"jquery.flot.saturated.js",
	"jquery.flot.browser.js",
	"jquery.flot.drawSeries.js",
	"jquery.flot.errorbars.js",
	"jquery.flot.uiConstants.js",
	"jquery.flot.logaxis.js",
	"jquery.flot.symbol.js",
	"jquery.flot.flatdata.js",
	"jquery.flot.navigate.js",
	"jquery.flot.fillbetween.js",
	"jquery.flot.categories.js",
	"jquery.flot.stack.js",
	"jquery.flot.touchNavigate.js",
	"jquery.flot.hover.js",
	"jquery.flot.touch.js",
	"jquery.flot.time.js",
	"jquery.flot.axislabels.js",
	"jquery.flot.selection.js",
	"jquery.flot.composeImages.js",
	"jquery.flot.legend.js",
];

// Standalone plugins. Each ships as its own minified file.
const STANDALONE_PLUGINS = [
	"jquery.flot.crosshair.js",
	"jquery.flot.image.js",
	"jquery.flot.pie.js",
	"jquery.flot.resize.js",
	"jquery.flot.threshold.js",
];

// Terser options. ES2019 target lets us drop a lot of legacy transforms while
// still covering Chrome 73+, Firefox 67+, Safari 12.1+, Edge 79+ — i.e. every
// browser released after early 2019.
const TERSER_OPTIONS = {
	ecma: 2019,
	module: false,
	compress: {
		passes: 2,
		// Flot has a few intentional `'use strict'` directives per IIFE; let
		// terser merge them.
		drop_console: false,
		pure_funcs: [],
	},
	mangle: true,
	format: {
		comments: false,
	},
};

const BANNER = `/*! @kevinburke/flot ${await readVersion()} | MIT License | https://github.com/kevinburke/flot */\n`;

async function readVersion() {
	const pkg = JSON.parse(await readFile(join(__dirname, "package.json"), "utf8"));
	return `v${pkg.version}`;
}

async function readSources(filenames) {
	const out = {};
	for (const f of filenames) {
		out[f] = await readFile(join(SRC, f), "utf8");
	}
	return out;
}

function concatSources(sources) {
	const parts = [];
	for (const [name, code] of Object.entries(sources)) {
		parts.push(`/* ===== ${name} ===== */`);
		parts.push(code);
	}
	return `${parts.join("\n")}\n`;
}

async function buildBundle(name, files) {
	const sources = await readSources(files);

	// Unminified output: human-readable concat with file markers, useful for
	// debugging without a sourcemap.
	const unmin = BANNER + concatSources(sources);
	const unminPath = join(DIST, `${name}.js`);
	await writeFile(unminPath, unmin);

	// Minified output: terser ingests the {filename: code} map directly so
	// the resulting sourcemap points back to original source files instead of
	// a generated concat blob.
	const minified = await minify(sources, {
		...TERSER_OPTIONS,
		sourceMap: {
			filename: `${name}.min.js`,
			url: `${name}.min.js.map`,
			root: "../source",
			includeSources: true,
		},
	});

	if (minified.code == null) {
		throw new Error(`terser produced no code for bundle ${name}`);
	}

	const minPath = join(DIST, `${name}.min.js`);
	const mapPath = `${minPath}.map`;
	await writeFile(minPath, BANNER + minified.code);
	await writeFile(mapPath, minified.map);

	return {
		name,
		unminPath,
		minPath,
		raw: Buffer.byteLength(unmin),
		minRaw: Buffer.byteLength(minified.code) + Buffer.byteLength(BANNER),
		minBrotli: brotliSize(BANNER + minified.code),
	};
}

async function buildPlugin(name) {
	// Standalone plugins are single-file. Run them through terser as a
	// one-entry map so the sourcemap still points at the original file name.
	const code = await readFile(join(SRC, name), "utf8");
	const sources = { [name]: code };

	const minified = await minify(sources, {
		...TERSER_OPTIONS,
		sourceMap: {
			filename: name.replace(/\.js$/, ".min.js"),
			url: `${name.replace(/\.js$/, ".min.js")}.map`,
			root: "../../source",
			includeSources: true,
		},
	});

	if (minified.code == null) {
		throw new Error(`terser produced no code for plugin ${name}`);
	}

	const baseMin = name.replace(/\.js$/, ".min.js");
	await writeFile(join(PLUGINS_DIR, name), BANNER + code);
	await writeFile(join(PLUGINS_DIR, baseMin), BANNER + minified.code);
	await writeFile(join(PLUGINS_DIR, `${baseMin}.map`), minified.map);

	return {
		name,
		raw: Buffer.byteLength(code) + Buffer.byteLength(BANNER),
		minRaw: Buffer.byteLength(minified.code) + Buffer.byteLength(BANNER),
		minBrotli: brotliSize(BANNER + minified.code),
	};
}

function brotliSize(content) {
	return brotliCompressSync(Buffer.from(content), {
		params: {
			[zlibConstants.BROTLI_PARAM_QUALITY]: 11,
		},
	}).length;
}

function fmt(n) {
	return n.toLocaleString("en-US").padStart(9);
}

function printSizeReport(rows) {
	const w = (s, n) => s.padEnd(n);
	console.log("");
	console.log(
		`${w("artifact", 38)}  ${"raw".padStart(9)}  ${"minified".padStart(9)}  ${"brotli".padStart(9)}`,
	);
	console.log("-".repeat(38 + 2 + 9 + 2 + 9 + 2 + 9));
	for (const r of rows) {
		console.log(`${w(r.name, 38)}  ${fmt(r.raw)}  ${fmt(r.minRaw)}  ${fmt(r.minBrotli)}`);
	}
	console.log("");
}

async function buildAll() {
	await rm(DIST, { recursive: true, force: true });
	await mkdir(DIST, { recursive: true });
	await mkdir(PLUGINS_DIR, { recursive: true });

	const rows = [];
	rows.push(await buildBundle("jquery.flot", MAIN_BUNDLE));
	for (const plugin of STANDALONE_PLUGINS) {
		rows.push(await buildPlugin(plugin));
	}
	printSizeReport(rows);
	return rows;
}

buildAll().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
