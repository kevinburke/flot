describe("colorhelpers plugin", () => {
	it("can make a new color", () => {
		const color = $.color.make(10, 20, 30, 0.5);

		expect(color.r).toBe(10);
		expect(color.g).toBe(20);
		expect(color.b).toBe(30);
		expect(color.a).toBe(0.5);
	});

	it("scales the specified components with given factor", () => {
		const color = $.color.make(10, 20, 30, 0.5);
		const factor = 0.2;

		color.scale("ga", factor);

		expect(color.r).toBe(10);
		expect(color.g).toBe(20 * factor);
		expect(color.b).toBe(30);
		expect(color.a).toBe(0.5 * factor);
	});

	it("adds to the specified component a given delta", () => {
		const color = $.color.make(10, 20, 30, 0.5);
		const delta = 3;

		color.add("rb", delta);

		expect(color.r).toBe(10 + delta);
		expect(color.g).toBe(20);
		expect(color.b).toBe(30 + delta);
		expect(color.a).toBe(0.5);
	});

	it("normalizes invalid values", () => {
		const color = $.color.make(-1, 256, 200.1, -0.1);

		expect(color.r).toBe(0);
		expect(color.g).toBe(255);
		expect(color.b).toBe(200);
		expect(color.a).toBe(0);
	});

	it("can make a color from several string formats", () => {
		for (const value of ["rgb(17, 170, 187)", "rgba(17, 170, 187, 1)", "#1ab", "#11aabb"]) {
			const color = $.color.parse(value);

			expect(color.r).toBe(17);
			expect(color.g).toBe(170);
			expect(color.b).toBe(187);
			expect(color.a).toBe(1);
		}
	});

	it("can make a color from a named color string", () => {
		for (const testCase of [
			{ input: "darkolivegreen", rgba: [85, 107, 47, 1] },
			{ input: "transparent", rgba: [255, 255, 255, 0] },
		]) {
			const color = $.color.parse(testCase.input);

			expect(color.r).toBe(testCase.rgba[0]);
			expect(color.g).toBe(testCase.rgba[1]);
			expect(color.b).toBe(testCase.rgba[2]);
			expect(color.a).toBe(testCase.rgba[3]);
		}
	});

	describe("by looking in DOM", () => {
		beforeEach(() => {
			document.body.innerHTML =
				'<div style="color: red"><div id="test-element" style="background-color: yellow"></div></div>';
		});

		it("extracts a specified CSS color from a given element", () => {
			const testElement = $("#test-element");
			const color = $.color.extract(testElement, "background-color");

			expect($.color.parse("yellow").toString()).toBe(color.toString());
		});

		it("extracts a specified CSS color from the parent of a given element", () => {
			const testElement = $("#test-element");
			const color = $.color.extract(testElement, "color");

			expect($.color.parse("red").toString()).toBe(color.toString());
		});
	});
});
