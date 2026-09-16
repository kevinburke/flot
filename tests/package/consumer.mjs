import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Window } from "happy-dom";

const require = createRequire(import.meta.url);
const mode = process.argv[2];
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

const load = mode === "import" ? (name) => import(name) : (name) => require(name);
const flot = await load("@kevinburke/flot");
assert.equal(typeof flot.plot, "function");
assert.equal(typeof flot.version, "string");
assert.ok(flot.plugins.some((plugin) => plugin.name === "errorbars"));

// Legacy resolvers use main without consulting exports.
if (mode === "require") {
	const legacy = require("./node_modules/@kevinburke/flot");
	assert.equal(legacy.plot, flot.plot);
}

// The adapter must import jQuery itself, without a global jQuery variable,
// and share the core's plugin registry within each module format.
assert.equal(globalThis.jQuery, undefined);
const jquery = await load("jquery");
const $ = mode === "import" ? jquery.default : jquery;
await load("@kevinburke/flot/jquery");
assert.equal(typeof $.plot, "function");
assert.equal(typeof $.fn.plot, "function");
assert.equal($.plot.version, flot.version);
assert.equal($.plot.plugins, flot.plugins);

const element = document.createElement("div");
const position = { x: 1, y: 2 };
let received;
$(element).on("plothover", (_event, pos) => {
	received = pos;
});
window.Flot.helpers.trigger(element, "plothover", [position]);
assert.equal(received, position);
await window.happyDOM.close();
