import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

import jqueryFactory from "jquery";

const $ = jqueryFactory;
const globals = globalThis as typeof globalThis & {
	$: typeof $;
	jQuery: typeof $;
};
const browserWindow = window as typeof window & {
	$: typeof $;
	jQuery: typeof $;
};

globals.$ = $;
globals.jQuery = $;
browserWindow.$ = $;
browserWindow.jQuery = $;

if (!$.trim) {
	$.trim = (value: string) => value.trim();
}

// Load the built IIFE bundle — it picks up jQuery from the global and
// registers $.plot, $.color, etc.
loadBundle("dist/jquery.flot.js");

function loadBundle(relativePath: string) {
	const source = readFileSync(join(process.cwd(), relativePath), "utf8");
	vm.runInThisContext(source, { filename: relativePath });
}
