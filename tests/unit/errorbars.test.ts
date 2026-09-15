import { createErrorBarFormat } from "../../source/jquery.flot.errorbars.js";
import { plugins } from "../../source/plugin-registry.js";

describe("error-bar formats", () => {
	it.each([
		["x", false, false, "xyx"],
		["x", false, true, "xyx"],
		["x", true, false, "xyxx"],
		["x", true, true, "xyxx"],
		["y", false, false, "xyy"],
		["y", false, true, "xyyy"],
		["y", true, false, "xyy"],
		["y", true, true, "xyyy"],
		["xy", false, false, "xyxy"],
		["xy", false, true, "xyxyy"],
		["xy", true, false, "xyxxy"],
		["xy", true, true, "xyxxyy"],
	] as const)("orders fields for %s, asymmetric x=%s y=%s", (direction, x, y, axes) => {
		expect(createErrorBarFormat(direction, x, y)).toEqual(
			Array.from(axes, (axis) => ({ [axis]: true, number: true, required: true })),
		);
	});

	it("defaults missing or null symmetry options to symmetric errors", () => {
		const symmetric = createErrorBarFormat("xy", false, false);
		expect(createErrorBarFormat("xy")).toEqual(symmetric);
		expect(createErrorBarFormat("xy", null, null)).toEqual(symmetric);
	});

	it("does not share mutable fields between calls or within a format", () => {
		const format = createErrorBarFormat("xy", true, true);
		const original = structuredClone(format);
		const next = createErrorBarFormat("xy", true, true);

		expect(new Set(format).size).toBe(format.length);
		// @ts-expect-error deliberately corrupt one result to check isolation
		format[0].x = false;
		format.pop();
		expect(next).toEqual(original);
		expect(createErrorBarFormat("xy", true, true)).toEqual(original);
	});

	it("preserves existing formats for disabled series and replaces enabled ones", () => {
		const hooks = { processRawData: [], draw: [] };
		const plot = { hooks };
		const plugin = plugins.find((plugin) => plugin.name === "errorbars");
		expect(plugin).toBeDefined();
		plugin.init(plot);
		expect(hooks.processRawData).toHaveLength(1);
		const hook = hooks.processRawData[0];
		const original = [{ number: false, required: false }];
		const datapoints = { format: original };
		const rawData = Object.freeze([[1, 2, 0.3, 0.4, 0.5]]);

		// Disabled series do not need the xerr/yerr defaults or a replacement format.
		for (const points of [{}, { errorbars: null }]) {
			expect(hook(plot, { points }, rawData, datapoints)).toBeUndefined();
			expect(datapoints.format).toBe(original);
		}

		const series = Object.freeze({
			points: Object.freeze({
				errorbars: "xy",
				xerr: Object.freeze({ asymmetric: true, show: false }),
				yerr: Object.freeze({ asymmetric: false, show: false }),
			}),
		});
		expect(hook(plot, series, rawData, datapoints)).toBeUndefined();
		expect(datapoints.format).toEqual(createErrorBarFormat("xy", true, false));
		expect(original).toEqual([{ number: false, required: false }]);
	});
});
