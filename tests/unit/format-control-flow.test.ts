import { formatControlFlow } from "../../scripts/format-control-flow.mjs";

describe("control-flow formatting", () => {
	it("expands an inline block", () => {
		expect(formatControlFlow("if (ready) { return; }\n").formatted).toBe(
			"if (ready) {\n    return;\n}\n",
		);
	});

	it("keeps a trailing comment with its statement", () => {
		expect(formatControlFlow("while (ready) { continue; // handled\n}\n").formatted).toBe(
			"while (ready) {\n    continue; // handled\n}\n",
		);
	});

	it("preserves an else-if chain while expanding its bodies", () => {
		const source = "if (first) { run(); } else if (second) { stop(); }\n";
		expect(formatControlFlow(source).formatted).toBe(
			"if (first) {\n    run();\n} else if (second) {\n    stop();\n}\n",
		);
	});

	it("puts else on the same line as the preceding brace", () => {
		const source = "if (ready) {\n    run();\n}\nelse {\n    stop();\n}\n";
		expect(formatControlFlow(source).formatted).toBe(
			"if (ready) {\n    run();\n} else {\n    stop();\n}\n",
		);
	});

	it("moves comments before else into the else body", () => {
		const source =
			"if (ready) {\n    run();\n}\n// Explain the fallback.\nelse {\n    stop();\n}\n";
		expect(formatControlFlow(source).formatted).toBe(
			"if (ready) {\n    run();\n} else {\n    // Explain the fallback.\n    stop();\n}\n",
		);
	});

	it("preserves a two-space indentation style", () => {
		const source = "function run() {\n  if (ready) { return; }\n}\n";
		expect(formatControlFlow(source).formatted).toBe(
			"function run() {\n  if (ready) {\n    return;\n  }\n}\n",
		);
	});

	it("preserves a tab indentation style", () => {
		const source = "function run() {\n\tif (ready) { return; }\n}\n";
		expect(formatControlFlow(source).formatted).toBe(
			"function run() {\n\tif (ready) {\n\t\treturn;\n\t}\n}\n",
		);
	});
});
