import { expect, test } from "@playwright/test";

// Smoke-test a handful of representative example pages. Each example loads
// the source files via <script> tags and calls $.plot(). We verify:
//   1. No uncaught JS errors on the page.
//   2. At least one <canvas> element appears (proof that $.plot ran).
//
// This catches breakage from source file changes, load-order regressions, or
// missing globals without needing to pixel-compare every chart.

const EXAMPLES = [
	"/examples/basic-usage/index.html",
	"/examples/axes-time/index.html",
	"/examples/navigate/index.html",
	"/examples/interacting/index.html",
	"/examples/categories/index.html",
	"/examples/stacking/index.html",
];

for (const examplePath of EXAMPLES) {
	test(`example loads without errors: ${examplePath}`, async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", (err) => {
			errors.push(err.message);
		});

		await page.goto(examplePath, { waitUntil: "networkidle" });

		const canvasCount = await page.locator("canvas").count();
		expect(canvasCount, `expected at least one <canvas> in ${examplePath}`).toBeGreaterThan(0);

		expect(errors, `JS errors on ${examplePath}`).toEqual([]);
	});
}
