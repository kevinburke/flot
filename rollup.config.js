import { readFileSync } from "node:fs";
import terser from "@rollup/plugin-terser";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const banner = `/*! @kevinburke/flot v${pkg.version} | MIT License | https://github.com/kevinburke/flot */`;

const terserOpts = {
	ecma: 2019,
	compress: { passes: 2 },
	format: { comments: false },
};

// Core bundle (no jQuery dependency).
const core = {
	input: "source/index.js",
	output: [
		{
			file: "dist/flot.js",
			format: "iife",
			name: "Flot",
			banner,
		},
		{
			file: "dist/flot.min.js",
			format: "iife",
			name: "Flot",
			banner,
			sourcemap: true,
			plugins: [terser(terserOpts)],
		},
	],
};

// Build both package entries together so the adapter and core share plugin
// registration and event dispatch. Browser script bundles above/below remain
// self-contained; module consumers load their shared code from dist/shared/.
const modules = {
	input: { flot: "source/index.js", "jquery.flot": "source/jquery-adapter.js" },
	external: ["jquery"],
	output: [
		{
			dir: "dist",
			format: "es",
			entryFileNames: "[name].mjs",
			chunkFileNames: "shared/[name].mjs",
			banner,
		},
		{
			dir: "dist",
			format: "cjs",
			entryFileNames: "[name].cjs",
			chunkFileNames: "shared/[name].cjs",
			banner,
		},
	],
	plugins: [
		{
			name: "commonjs-declarations",
			generateBundle(output) {
				if (output.format !== "cjs") {
					return;
				}
				// Generate from the hand-written types on every build/prepack so the
				// CommonJS declarations cannot drift from the ES module declarations.
				this.emitFile({
					type: "asset",
					fileName: "flot.d.cts",
					source: readFileSync("types/index.d.ts", "utf8"),
				});
				this.emitFile({
					type: "asset",
					fileName: "jquery.flot.d.cts",
					source: readFileSync("types/jquery.d.ts", "utf8").replace('"./index.js"', '"./flot.cjs"'),
				});
			},
		},
	],
};

// jQuery adapter bundle: imports core + wires up $.plot.
const jqueryAdapter = {
	input: "source/jquery-adapter.js",
	external: ["jquery"],
	output: [
		{
			file: "dist/jquery.flot.js",
			format: "iife",
			globals: { jquery: "jQuery" },
			name: "Flot",
			banner,
		},
		{
			file: "dist/jquery.flot.min.js",
			format: "iife",
			globals: { jquery: "jQuery" },
			name: "Flot",
			banner,
			sourcemap: true,
			plugins: [terser(terserOpts)],
		},
	],
};

// Standalone plugins: each is a separate build.
const standalonePlugins = [
	"jquery.flot.crosshair.js",
	"jquery.flot.image.js",
	"jquery.flot.pie.js",
	"jquery.flot.resize.js",
	"jquery.flot.threshold.js",
];

// Plugin bundles run in the browser after dist/jquery.flot.js. They import
// from the (external) jQuery-adapter bundle and from helpers.js, and those
// imports must resolve to live values the adapter exposes on window.Flot:
//   - import { plugins } from './plugin-registry.js' → Flot.plugins
//   - import { bind, ... } from './helpers.js'    →  Flot.helpers
//   - import $ from 'jquery'                      →  jQuery
// Using a function for external/globals (rather than a plain object) lets us
// match resolved absolute paths, since Rollup has already resolved `./foo.js`
// to /abs/.../source/foo.js by the time these hooks run.
function pluginGlobal(id) {
	if (id === "jquery") {
		return "jQuery";
	}
	if (id.endsWith("plugin-registry.js")) {
		return "Flot";
	}
	if (id.endsWith("helpers.js")) {
		return "Flot.helpers";
	}
	return null;
}

const pluginBuilds = standalonePlugins.map((name) => ({
	input: `source/${name}`,
	external: (id) => pluginGlobal(id) !== null,
	output: [
		{
			file: `dist/plugins/${name}`,
			format: "iife",
			banner,
			globals: pluginGlobal,
		},
		{
			file: `dist/plugins/${name.replace(/\.js$/, ".min.js")}`,
			format: "iife",
			banner,
			sourcemap: true,
			globals: pluginGlobal,
			plugins: [terser(terserOpts)],
		},
	],
}));

export default [core, modules, jqueryAdapter, ...pluginBuilds];
