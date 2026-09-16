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

describe("error-bar rendering", () => {
	const cases = [
		["x", false, false, [2], [2, 2, null, null]],
		["x", true, false, [2, 3], [2, 3, null, null]],
		["y", false, false, [5], [null, null, 5, 5]],
		["y", false, true, [5, 7], [null, null, 5, 7]],
		["xy", false, false, [2, 5], [2, 2, 5, 5]],
		["xy", true, false, [2, 3, 5], [2, 3, 5, 5]],
		["xy", false, true, [2, 5, 7], [2, 2, 5, 7]],
		["xy", true, true, [2, 3, 5, 7], [2, 3, 5, 7]],
		["xy", true, true, [2, null, 5, null], [2, 2, 5, 5]],
		["xy", true, true, [2, undefined, 5, undefined], [2, 2, 5, 5]],
	] as const;

	for (const [showX, showY] of [
		[true, true],
		[false, true],
		[true, false],
	] as const) {
		describe(`visible x=${showX} y=${showY}`, () => {
			it.each(cases)(
				"positions caps for %s, asymmetric x=%s y=%s, values %j",
				(errorbars, asymmetricX, asymmetricY, values, expected) => {
					const lowerX = vi.fn();
					const upperX = vi.fn();
					const lowerY = vi.fn();
					const upperY = vi.fn();
					const series = {
						datapoints: {
							points: [50, 50, ...values, 60, 40, ...values],
							pointsize: values.length + 2,
						},
						xaxis: { min: 0, max: 100, p2c: (v: number) => v },
						yaxis: { min: 0, max: 100, p2c: (v: number) => 100 - v },
						points: {
							errorbars,
							radius: 0,
							lineWidth: 1,
							xerr: {
								err: "x",
								asymmetric: asymmetricX,
								show: showX,
								lowerCap: lowerX,
								upperCap: upperX,
							},
							yerr: {
								err: "y",
								asymmetric: asymmetricY,
								show: showY,
								lowerCap: lowerY,
								upperCap: upperY,
							},
						},
						color: "black",
						shadowSize: 0,
					};
					const ctx = {
						save() {},
						restore() {},
						translate() {},
						beginPath() {},
						moveTo() {},
						lineTo() {},
						stroke() {},
					};
					const plot = {
						hooks: { processRawData: [], draw: [] },
						getData: () => [series],
						getPlotOffset: () => ({ left: 0, top: 0 }),
					};
					plugins.find((plugin) => plugin.name === "errorbars").init(plot);
					plot.hooks.draw[0](plot, ctx);

					const [xl, xu, yl, yu] = expected;
					expect(lowerX.mock.calls).toEqual(
						showX && xl !== null
							? [
									[ctx, 50 - xl, 50, 0],
									[ctx, 60 - xl, 60, 0],
								]
							: [],
					);
					expect(upperX.mock.calls).toEqual(
						showX && xu !== null
							? [
									[ctx, 50 + xu, 50, 0],
									[ctx, 60 + xu, 60, 0],
								]
							: [],
					);
					expect(lowerY.mock.calls).toEqual(
						showY && yl !== null
							? [
									[ctx, 50, 50 + yl, 0],
									[ctx, 60, 60 + yl, 0],
								]
							: [],
					);
					expect(upperY.mock.calls).toEqual(
						showY && yu !== null
							? [
									[ctx, 50, 50 - yu, 0],
									[ctx, 60, 60 - yu, 0],
								]
							: [],
					);
				},
			);
		});
	}
});
