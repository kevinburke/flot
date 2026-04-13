import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "tests/browser",
	testMatch: "**/*.spec.ts",
	fullyParallel: true,
	outputDir: "/tmp/flot-playwright-test-results",
	reporter: "list",
	use: {
		baseURL: "http://localhost:4173",
		headless: true,
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "node tests/browser/server.mjs",
		url: "http://localhost:4173",
		reuseExistingServer: !process.env.CI,
	},
});
