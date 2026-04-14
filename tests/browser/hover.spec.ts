import { expect, test } from "@playwright/test";

const HIGHLIGHT_RGBA = [10, 20, 30, 255];

test.describe("flot hover plugin", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await page.evaluate(() => {
			const placeholder = document.querySelector("#placeholder");
			if (!placeholder) {
				throw new Error("missing #placeholder");
			}

			placeholder.outerHTML = '<div id="placeholder" style="width: 600px; height: 400px"></div>';

			const win = window as any;
			win.__hoverPortHelpers = {
				canvasContainsColor(canvas: HTMLCanvasElement, expected: number[]) {
					return win.__hoverPortHelpers.containsPixelColor(
						Array.from(win.colors.getEntireCanvasData(canvas)),
						expected,
					);
				},
				canvasRegionContainsColor(
					canvas: HTMLCanvasElement,
					x: number,
					y: number,
					width: number,
					height: number,
					expected: number[],
				) {
					return win.__hoverPortHelpers.containsPixelColor(
						Array.from(win.colors.canvasData(canvas, x, y, width, height)),
						expected,
					);
				},
				containsPixelColor(pixelData: number[], expected: number[]) {
					for (let index = 0; index < pixelData.length; index += 4) {
						if (
							pixelData[index] === expected[0] &&
							pixelData[index + 1] === expected[1] &&
							pixelData[index + 2] === expected[2] &&
							pixelData[index + 3] === expected[3]
						) {
							return true;
						}
					}

					return false;
				},
				createBaseOptions() {
					return {
						grid: { hoverable: true, clickable: true },
						pan: { enableTouch: true, active: true },
						series: {
							lines: { show: true },
							points: { show: false },
						},
					};
				},
				createMouseHoverOptions() {
					const options = win.__hoverPortHelpers.createBaseOptions();
					options.series.hoverable = true;
					options.series.highlightColor = "rgba(10, 20, 30, 1)";
					return options;
				},
			};
		});
	});

	test("tap on plot triggers plothover event", async ({ page }) => {
		await page.clock.install({ time: new Date("2026-04-12T00:00:00.000Z") });
		await page.evaluate(() => {
			const win = window as any;
			const $ = win.jQuery;
			const options = win.__hoverPortHelpers.createBaseOptions();
			const plot = $.plot($("#placeholder"), [[[0, 0], [10, 10]]], options);
			const eventHolder = plot.getEventHolder();
			const axisx = plot.getXAxes()[0];
			const axisy = plot.getYAxes()[0];
			const coords = [{ x: axisx.p2c(0.5), y: axisy.p2c(-3.5) }];

			win.__hoverPortState = { plothoverCount: 0 };
			$(plot.getPlaceholder()).on("plothover", () => {
				win.__hoverPortState.plothoverCount += 1;
			});

			win.simulate.sendTouchEvents(coords, eventHolder, "touchstart");
			window.setTimeout(() => {
				win.simulate.sendTouchEvents(coords, eventHolder, "touchend");
			}, 50);
		});

		await page.clock.runFor(50);
		const plothoverCount = await page.evaluate(() => (window as any).__hoverPortState.plothoverCount);
		expect(plothoverCount).toBe(1);
	});

	test("pan plot triggers plothovercleanup event", async ({ page }) => {
		const plothovercleanupCount = await page.evaluate(() => {
			const win = window as any;
			const $ = win.jQuery;
			const options = win.__hoverPortHelpers.createBaseOptions();
			const plot = $.plot($("#placeholder"), [[[0, 0], [10, 10]]], options);
			const eventHolder = plot.getEventHolder();
			const axisx = plot.getXAxes()[0];
			const axisy = plot.getYAxes()[0];
			const coords = [{ x: axisx.p2c(0.5), y: axisy.p2c(-3.5) }];
			let count = 0;

			$(plot.getPlaceholder()).on("plothovercleanup", () => {
				count += 1;
			});

			win.simulate.sendTouchEvents(coords, eventHolder, "touchstart");
			return count;
		});

		expect(plothovercleanupCount).toBe(1);
	});

	test("set data to the plot triggers plothovercleanup event", async ({ page }) => {
		const plothovercleanupCount = await page.evaluate(() => {
			const win = window as any;
			const $ = win.jQuery;
			const options = win.__hoverPortHelpers.createBaseOptions();
			const plot = $.plot($("#placeholder"), [[[0, 0], [10, 10]]], options);
			let count = 0;

			$(plot.getPlaceholder()).on("plothovercleanup", () => {
				count += 1;
			});

			plot.setData([1, 2, 3, 4]);
			return count;
		});

		expect(plothovercleanupCount).toBeGreaterThan(0);
	});

	test("should highlight the point when hovered", async ({ page }) => {
		await page.clock.install({ time: new Date("2026-04-12T00:00:00.000Z") });
		await page.evaluate(() => {
			const win = window as any;
			const $ = win.jQuery;
			const options = win.__hoverPortHelpers.createMouseHoverOptions();
			const plot = $.plot($("#placeholder"), [[[0, 0], [2, 3], [10, 10]]], options);
			const eventHolder = plot.getEventHolder();
			const offset = plot.getPlotOffset();
			const axisx = plot.getXAxes()[0];
			const axisy = plot.getYAxes()[0];

			win.__hoverPortState = { canvas: eventHolder };
			win.simulate.mouseMove(eventHolder, axisx.p2c(2) + offset.left, axisy.p2c(3) + offset.top, 0);
		});

		await page.clock.runFor(100);
		const containsHighlight = await page.evaluate((highlightColor) => {
			const win = window as any;
			return win.__hoverPortHelpers.canvasContainsColor(win.__hoverPortState.canvas, highlightColor);
		}, HIGHLIGHT_RGBA);
		expect(containsHighlight).toBe(true);
	});

	test("should highlight the point when hovered from a small distance", async ({ page }) => {
		await page.clock.install({ time: new Date("2026-04-12T00:00:00.000Z") });
		await page.evaluate(() => {
			const win = window as any;
			const $ = win.jQuery;
			const options = win.__hoverPortHelpers.createMouseHoverOptions();
			const plot = $.plot($("#placeholder"), [[[0, 0], [2, 3], [10, 10]]], options);
			const eventHolder = plot.getEventHolder();
			const offset = plot.getPlotOffset();
			const axisx = plot.getXAxes()[0];
			const axisy = plot.getYAxes()[0];
			const epsilon = 2;

			win.__hoverPortState = { canvas: eventHolder };
			win.simulate.mouseMove(
				eventHolder,
				axisx.p2c(2) + offset.left + epsilon,
				axisy.p2c(3) + offset.top - epsilon,
				0,
			);
		});

		await page.clock.runFor(100);
		const containsHighlight = await page.evaluate((highlightColor) => {
			const win = window as any;
			return win.__hoverPortHelpers.canvasContainsColor(win.__hoverPortState.canvas, highlightColor);
		}, HIGHLIGHT_RGBA);
		expect(containsHighlight).toBe(true);
	});

	test("should not highlight the point when hovered and the grid is not hoverable", async ({
		page,
	}) => {
		await page.clock.install({ time: new Date("2026-04-12T00:00:00.000Z") });
		await page.evaluate(() => {
			const win = window as any;
			const $ = win.jQuery;
			const options = win.__hoverPortHelpers.createMouseHoverOptions();
			options.grid.hoverable = false;

			const plot = $.plot($("#placeholder"), [[[0, 0], [2, 3], [10, 10]]], options);
			const eventHolder = plot.getEventHolder();
			const offset = plot.getPlotOffset();
			const axisx = plot.getXAxes()[0];
			const axisy = plot.getYAxes()[0];

			win.__hoverPortState = { canvas: eventHolder };
			win.simulate.mouseMove(eventHolder, axisx.p2c(2) + offset.left, axisy.p2c(3) + offset.top, 0);
		});

		await page.clock.runFor(100);
		const containsHighlight = await page.evaluate((highlightColor) => {
			const win = window as any;
			return win.__hoverPortHelpers.canvasContainsColor(win.__hoverPortState.canvas, highlightColor);
		}, HIGHLIGHT_RGBA);
		expect(containsHighlight).toBe(false);
	});

	test("should not highlight the point when hovered and the series is not hoverable", async ({
		page,
	}) => {
		await page.clock.install({ time: new Date("2026-04-12T00:00:00.000Z") });
		await page.evaluate(() => {
			const win = window as any;
			const $ = win.jQuery;
			const options = win.__hoverPortHelpers.createMouseHoverOptions();
			options.series.hoverable = false;

			const plot = $.plot($("#placeholder"), [[[0, 0], [2, 3], [10, 10]]], options);
			const eventHolder = plot.getEventHolder();
			const offset = plot.getPlotOffset();
			const axisx = plot.getXAxes()[0];
			const axisy = plot.getYAxes()[0];

			win.__hoverPortState = { canvas: eventHolder };
			win.simulate.mouseMove(eventHolder, axisx.p2c(2) + offset.left, axisy.p2c(3) + offset.top, 0);
		});

		await page.clock.runFor(100);
		const containsHighlight = await page.evaluate((highlightColor) => {
			const win = window as any;
			return win.__hoverPortHelpers.canvasContainsColor(win.__hoverPortState.canvas, highlightColor);
		}, HIGHLIGHT_RGBA);
		expect(containsHighlight).toBe(false);
	});

	test("should unhighlight the previous point when hovering a new one", async ({ page }) => {
		await page.clock.install({ time: new Date("2026-04-12T00:00:00.000Z") });
		await page.evaluate(() => {
			const win = window as any;
			const $ = win.jQuery;
			const options = win.__hoverPortHelpers.createMouseHoverOptions();
			const plot = $.plot($("#placeholder"), [[[0, 0], [2, 3], [10, 10]]], options);
			const eventHolder = plot.getEventHolder();
			const offset = plot.getPlotOffset();
			const axisx = plot.getXAxes()[0];
			const axisy = plot.getYAxes()[0];

			win.__hoverPortState = {
				canvas: eventHolder,
				radius: 5,
				x1: axisx.p2c(2) + offset.left,
				x2: axisx.p2c(10) + offset.left,
				y1: axisy.p2c(3) + offset.top,
				y2: axisy.p2c(10) + offset.top,
			};

			win.simulate.mouseMove(eventHolder, win.__hoverPortState.x1, win.__hoverPortState.y1, 0);
		});

		await page.clock.runFor(100);
		const firstHoverState = await page.evaluate((highlightColor) => {
			const win = window as any;
			const { canvas, radius, x1, x2, y1, y2 } = win.__hoverPortState;
			return {
				firstPointHighlighted: win.__hoverPortHelpers.canvasRegionContainsColor(
					canvas,
					x1 - radius,
					y1 - radius,
					2 * radius,
					2 * radius,
					highlightColor,
				),
				secondPointHighlighted: win.__hoverPortHelpers.canvasRegionContainsColor(
					canvas,
					x2 - radius,
					y2 - radius,
					2 * radius,
					2 * radius,
					highlightColor,
				),
			};
		}, HIGHLIGHT_RGBA);

		expect(firstHoverState.firstPointHighlighted).toBe(true);
		expect(firstHoverState.secondPointHighlighted).toBe(false);

		await page.evaluate(() => {
			const win = window as any;
			const { canvas, x2, y2 } = win.__hoverPortState;
			win.simulate.mouseMove(canvas, x2, y2, 0);
		});

		await page.clock.runFor(100);
		const secondHoverState = await page.evaluate((highlightColor) => {
			const win = window as any;
			const { canvas, radius, x1, x2, y1, y2 } = win.__hoverPortState;
			return {
				firstPointHighlighted: win.__hoverPortHelpers.canvasRegionContainsColor(
					canvas,
					x1 - radius,
					y1 - radius,
					2 * radius,
					2 * radius,
					highlightColor,
				),
				secondPointHighlighted: win.__hoverPortHelpers.canvasRegionContainsColor(
					canvas,
					x2 - radius,
					y2 - radius,
					2 * radius,
					2 * radius,
					highlightColor,
				),
			};
		}, HIGHLIGHT_RGBA);

		expect(secondHoverState.firstPointHighlighted).toBe(false);
		expect(secondHoverState.secondPointHighlighted).toBe(true);
	});

	test("should update the current hover point to the placeholder when the plot is created again", async ({
		page,
	}) => {
		await page.clock.install({ time: new Date("2026-04-12T00:00:00.000Z") });
		await page.evaluate(() => {
			const win = window as any;
			const $ = win.jQuery;
			const options = win.__hoverPortHelpers.createMouseHoverOptions();
			const placeholder = $("#placeholder");
			const plot = $.plot(placeholder, [[[0, 0], [2, 3], [10, 10]]], options);

			win.__hoverPortState = { hovered: false };
			$(plot.getPlaceholder()).on("plothover", () => {
				win.__hoverPortState.hovered = true;
			});

			const eventHolder = plot.getEventHolder();
			const offset = plot.getPlotOffset();
			const axisx = plot.getXAxes()[0];
			const axisy = plot.getYAxes()[0];

			win.__hoverPortState.event = win.simulate.mouseMove(
				eventHolder,
				axisx.p2c(2) + offset.left,
				axisy.p2c(3) + offset.top,
				0,
			);
		});

		await page.clock.runFor(1000);
		const result = await page.evaluate(() => {
			const win = window as any;
			const $ = win.jQuery;
			const options = win.__hoverPortHelpers.createMouseHoverOptions();
			const placeholder = $("#placeholder");

			win.__hoverPortState.hovered = false;
			const plot = $.plot(placeholder, [[[0, 0], [2, 3], [10, 10]]], options);
			const lastMouseMoveEvent = plot.getPlaceholder().lastMouseMoveEvent;
			return {
				actualX: lastMouseMoveEvent.x,
				actualY: lastMouseMoveEvent.y,
				expectedX: win.__hoverPortState.event.x,
				expectedY: win.__hoverPortState.event.y,
				hovered: win.__hoverPortState.hovered,
			};
		});

		expect(result.actualX).toBe(result.expectedX);
		expect(result.actualY).toBe(result.expectedY);
		expect(result.hovered).toBe(true);
	});

	test("should highlight a bar when hovered", async ({ page }) => {
		await page.clock.install({ time: new Date("2026-04-12T00:00:00.000Z") });
		await page.evaluate(() => {
			const win = window as any;
			const $ = win.jQuery;
			const options = win.__hoverPortHelpers.createMouseHoverOptions();
			options.series.bars = { show: true, barWidth: 0.5 };
			options.series.lines = undefined;

			const plot = $.plot($("#placeholder"), [[[0, 3], [1, 5], [2, 4]]], options);
			const eventHolder = plot.getEventHolder();
			const offset = plot.getPlotOffset();
			const axisx = plot.getXAxes()[0];
			const axisy = plot.getYAxes()[0];

			win.__hoverPortState = { canvas: eventHolder };
			win.simulate.mouseMove(eventHolder, axisx.p2c(1.25) + offset.left, axisy.p2c(2) + offset.top, 0);
		});

		await page.clock.runFor(100);
		const containsHighlight = await page.evaluate((highlightColor) => {
			const win = window as any;
			return win.__hoverPortHelpers.canvasContainsColor(win.__hoverPortState.canvas, highlightColor);
		}, HIGHLIGHT_RGBA);
		expect(containsHighlight).toBe(true);
	});

	test("should correctly highlight bars with bottom points specified", async ({ page }) => {
		await page.evaluate(() => {
			const win = window as any;
			const $ = win.jQuery;
			const options = win.__hoverPortHelpers.createMouseHoverOptions();
			options.series.bars = { show: true, barWidth: 0.5 };
			options.series.lines = undefined;

			const plot = $.plot($("#placeholder"), [[[0, 5, 2], [1, 7, 2], [2, 6, 2]]], options);
			const eventHolder = plot.getEventHolder();
			const offset = plot.getPlotOffset();
			const axisx = plot.getXAxes()[0];
			const axisy = plot.getYAxes()[0];

			win.__hoverPortState = {
				canvas: eventHolder,
				x: axisx.p2c(1.25) + offset.left,
				y1: axisy.p2c(1) + offset.top,
				y2: axisy.p2c(4) + offset.top,
			};

			win.simulate.mouseMove(eventHolder, win.__hoverPortState.x, win.__hoverPortState.y1, 0);
		});

		await page.waitForTimeout(100);
		const firstHoverContainsHighlight = await page.evaluate((highlightColor) => {
			const win = window as any;
			return win.__hoverPortHelpers.canvasContainsColor(win.__hoverPortState.canvas, highlightColor);
		}, HIGHLIGHT_RGBA);
		expect(firstHoverContainsHighlight).toBe(false);

		await page.evaluate(() => {
			const win = window as any;
			win.simulate.mouseMove(win.__hoverPortState.canvas, win.__hoverPortState.x, win.__hoverPortState.y2, 0);
		});

		await page.waitForTimeout(100);
		const secondHoverContainsHighlight = await page.evaluate((highlightColor) => {
			const win = window as any;
			return win.__hoverPortHelpers.canvasContainsColor(win.__hoverPortState.canvas, highlightColor);
		}, HIGHLIGHT_RGBA);
		expect(secondHoverContainsHighlight).toBe(true);
	});

	test("should call hooked function when canvas is hovered over", async ({ page }) => {
		const hookCallCount = await page.evaluate(() => {
			const win = window as any;
			const $ = win.jQuery;
			const options = win.__hoverPortHelpers.createMouseHoverOptions();
			let hookCalls = 0;

			options.hooks = {
				findNearbyItems: [
					() => {
						hookCalls += 1;
					},
				],
			};

			const plot = $.plot($("#placeholder"), [[[0, 0], [2, 3], [10, 10]]], options);
			const eventHolder = plot.getEventHolder();
			const offset = plot.getPlotOffset();
			const axisx = plot.getXAxes()[0];
			const axisy = plot.getYAxes()[0];

			win.simulate.mouseMove(eventHolder, axisx.p2c(2) + offset.left, axisy.p2c(3) + offset.top, 0);
			return hookCalls;
		});

		expect(hookCallCount).toBe(1);
	});

	test("should pass item returned from hook in items", async ({ page }) => {
		await page.evaluate(() => {
			const win = window as any;
			const $ = win.jQuery;
			const options = win.__hoverPortHelpers.createMouseHoverOptions();
			const testItem = { distance: 5 };

			options.hooks = {
				findNearbyItems: [
					(_0: unknown, _1: unknown, _2: unknown, _3: unknown, _4: unknown, _5: unknown, _6: unknown, items: unknown[]) => {
						items.push(testItem);
					},
				],
			};

			win.__hoverPortState = { seenTestItem: false };
			const plot = $.plot($("#placeholder"), [[[0, 0], [2, 3], [10, 10]]], options);
			$(plot.getPlaceholder()).on(
				"plothover",
				(event: { originalEvent?: { detail?: unknown[] } }, _pos: unknown, _item: unknown, items: unknown[]) => {
					const detailItems = event.originalEvent?.detail?.[2] as unknown[] | undefined;
					win.__hoverPortState.seenTestItem = Array.isArray(items) && items.includes(testItem);
					if (!win.__hoverPortState.seenTestItem && detailItems) {
						win.__hoverPortState.seenTestItem = detailItems.includes(testItem);
					}
				},
			);

			const eventHolder = plot.getEventHolder();
			const offset = plot.getPlotOffset();
			const axisx = plot.getXAxes()[0];
			const axisy = plot.getYAxes()[0];

			win.simulate.mouseMove(eventHolder, axisx.p2c(2) + offset.left, axisy.p2c(3) + offset.top, 0);
		});

		await expect
			.poll(async () => await page.evaluate(() => (window as any).__hoverPortState.seenTestItem))
			.toBe(true);
	});

	test("should choose closest item from items returned by hooks", async ({ page }) => {
		await page.evaluate(() => {
			const win = window as any;
			const $ = win.jQuery;
			const options = win.__hoverPortHelpers.createMouseHoverOptions();
			const distance = 5;
			const testItem = { distance };

			options.hooks = {
				findNearbyItems: [
					(_0: unknown, _1: unknown, _2: unknown, _3: unknown, _4: unknown, _5: unknown, _6: unknown, items: unknown[]) => {
						items.push(testItem);
					},
				],
			};

			win.__hoverPortState = { closerThanHookItem: false };
			const plot = $.plot($("#placeholder"), [[[0, 0], [2, 3], [10, 10]]], options);
			$(plot.getPlaceholder()).on(
				"plothover",
				(event: { originalEvent?: { detail?: unknown[] } }, _pos: unknown, item: { distance: number }) => {
					const detailItem = event.originalEvent?.detail?.[1] as { distance: number } | undefined;
					const hoverItem = item || detailItem;
					win.__hoverPortState.closerThanHookItem = hoverItem.distance < distance;
				},
			);

			const eventHolder = plot.getEventHolder();
			const offset = plot.getPlotOffset();
			const axisx = plot.getXAxes()[0];
			const axisy = plot.getYAxes()[0];

			win.simulate.mouseMove(eventHolder, axisx.p2c(2) + offset.left, axisy.p2c(3) + offset.top, 0);
		});

		await expect
			.poll(async () => await page.evaluate(() => (window as any).__hoverPortState.closerThanHookItem))
			.toBe(true);
	});
});
