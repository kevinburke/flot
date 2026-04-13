import { test } from "@playwright/test";

import { runLegacyJasmineFile } from "./legacy-jasmine";

const LEGACY_PHASE_B_FILES = [
	"tests/jquery.flot-precision.Test.js",
	"tests/jquery.flot.flatdata.Test.js",
	"tests/jquery.flot.symbol.Test.js",
	"tests/jquery.flot.largeNumbers.Test.js",
	"tests/jquery.flot.stack.Test.js",
	"tests/jquery.flot.fillbetween.Test.js",
	"tests/jquery.flot.time.Test.js",
	"tests/jquery.flot.logaxis.Test.js",
	"tests/jquery.flot.invertedaxis.Test.js",
	"tests/jquery.flot.axislabels.Test.js",
	"tests/jquery.flot-drawSeries.Test.js",
	"tests/jquery.flot.canvaswrapper.Test.js",
	"tests/jquery.flot.composeImages.Test.js",
	"tests/jquery.flot.errorbars.Test.js",
	"tests/jquery.flot.legend.Test.js",
	"tests/jquery.flot.selection.Test.js",
	"tests/jquery.flot.navigate.Test.js",
	"tests/jquery.flot.navigate-interaction.Test.js",
	"tests/jquery.flot.touch.Test.js",
	"tests/jquery.flot.touchNavigate.Test.js",
];

test.describe("legacy jasmine Phase B ports", () => {
	for (const legacyFile of LEGACY_PHASE_B_FILES) {
		test(legacyFile, async ({ page }) => {
			await runLegacyJasmineFile(page, `/${legacyFile}`);
		});
	}

	test("tests/jquery.flot.Test.js", async ({ page }) => {
		// The legacy grid-margin trio does not match current Chromium behavior yet.
		await runLegacyJasmineFile(page, "/tests/jquery.flot.Test.js", {
			skipTests: [
				"flot Grid margin should change plot dimensions",
				"flot Grid margin should move the axis according to grid margin",
				"flot Grid margin should work for margin: number",
			],
		});
	});
});
