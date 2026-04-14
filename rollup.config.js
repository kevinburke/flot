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
		{
			file: "dist/flot.mjs",
			format: "es",
			banner,
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

const pluginBuilds = standalonePlugins.map((name) => ({
	input: `source/${name}`,
	external: [/\.\/jquery\./, /\.\.\/jquery\./, /\.\/helpers/],
	onwarn(warning, warn) {
		// Standalone plugins import from helpers.js and jquery.flot.js which
		// are external. Rollup warns about missing globals for IIFE output
		// but these plugins are loaded after the main bundle which provides
		// everything they need on the Flot global.
		if (warning.code === "MISSING_GLOBAL_NAME") return;
		warn(warning);
	},
	output: [
		{
			file: `dist/plugins/${name}`,
			format: "iife",
			banner,
		},
		{
			file: `dist/plugins/${name.replace(/\.js$/, ".min.js")}`,
			format: "iife",
			banner,
			sourcemap: true,
			plugins: [terser(terserOpts)],
		},
	],
}));

export default [core, jqueryAdapter, ...pluginBuilds];
