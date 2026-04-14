import { extend } from "../../source/helpers.js";

describe("helpers extend", () => {
	it("does not overwrite existing values with undefined", () => {
		const result = extend(
			true,
			{},
			{
				series: {
					lines: { show: true, lineWidth: 2 },
					bars: { show: false },
				},
			},
			{
				series: {
					lines: undefined,
					bars: { show: true },
				},
			},
		);

		expect(result.series.lines).toEqual({ show: true, lineWidth: 2 });
		expect(result.series.bars).toEqual({ show: true });
	});

	it("replaces arrays instead of merging them and clones nested objects", () => {
		const source = {
			xaxes: [{ offset: { below: -10, above: -10 } }],
		};
		const result = extend(
			true,
			{ xaxes: [{ offset: { below: 0, above: 0 } }, { offset: { below: 5, above: 5 } }] },
			source,
		);

		expect(result.xaxes).toEqual([{ offset: { below: -10, above: -10 } }]);
		expect(result.xaxes).not.toBe(source.xaxes);
		expect(result.xaxes[0]).not.toBe(source.xaxes[0]);

		result.xaxes[0].offset.below = 25;
		expect(source.xaxes[0].offset.below).toBe(-10);
	});

	it("preserves DOM elements by reference instead of deep-copying them", () => {
		const container = document.createElement("div");
		container.style.width = "10px";

		const result = extend(true, {}, { legend: { container } });

		expect(result.legend.container).toBe(container);
		expect(result.legend.container.style.width).toBe("10px");
	});
});
