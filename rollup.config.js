import { readFileSync } from "node:fs";
import terser from "@rollup/plugin-terser";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const banner = `/*! @kevinburke/flot v${pkg.version} | MIT License | https://github.com/kevinburke/flot */`;

const terserOpts = {
	ecma: 2019,
	compress: { passes: 2 },
	format: { comments: false },
};

// Main bundle: core + all bundled plugins.
const main = {
	input: "source/index.js",
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
		{
			file: "dist/jquery.flot.mjs",
			format: "es",
			banner,
		},
	],
};

// Standalone plugins: each is a separate build that expects the main
// bundle (and jQuery) to already be loaded.
const standalonePlugins = [
	"jquery.flot.crosshair.js",
	"jquery.flot.image.js",
	"jquery.flot.pie.js",
	"jquery.flot.resize.js",
	"jquery.flot.threshold.js",
];

const pluginBuilds = standalonePlugins.map((name) => ({
	input: `source/${name}`,
	external: ["jquery", /\.\/jquery\./, /\.\.\/jquery\./],
	output: [
		{
			file: `dist/plugins/${name}`,
			format: "iife",
			globals: { jquery: "jQuery" },
			banner,
		},
		{
			file: `dist/plugins/${name.replace(/\.js$/, ".min.js")}`,
			format: "iife",
			globals: { jquery: "jQuery" },
			banner,
			sourcemap: true,
			plugins: [terser(terserOpts)],
		},
	],
}));

export default [main, ...pluginBuilds];
