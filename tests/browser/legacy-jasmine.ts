import { expect, type Page } from "@playwright/test";

type LegacyResult = {
	fullName: string;
	status: "failed" | "passed" | "skipped";
	message?: string;
};

type LegacyRunOutput = {
	loadError: string | null;
	path: string;
	results: LegacyResult[];
};

type RunLegacyOptions = {
	skipTests?: string[];
};

export async function runLegacyJasmineFile(page: Page, testPath: string, options: RunLegacyOptions = {}) {
	await page.goto("/");

	const result = await page.evaluate(
		async ({ path, runOptions }) =>
			((window as any).__legacyJasmine.runFile(path, runOptions) as Promise<LegacyRunOutput>),
		{ path: testPath, runOptions: options },
	);

	if (result.loadError) {
		throw new Error(`${testPath} failed to load\n${result.loadError}`);
	}

	const failed = result.results.filter((entry) => entry.status === "failed");
	expect(result.results.length, `${testPath} should register at least one test`).toBeGreaterThan(0);

	if (failed.length > 0) {
		const details = failed.map((entry) => `${entry.fullName}\n${entry.message ?? "unknown failure"}`).join("\n\n");
		throw new Error(`${testPath} had ${failed.length} failing legacy tests\n\n${details}`);
	}
}
