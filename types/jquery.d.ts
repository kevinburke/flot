// jQuery adapter types. Importing this module augments the jQuery
// static namespace with `$.plot()` and related properties.

import type { DataSeries, Plot, PlotOptions } from "./index.js";

declare global {
	interface JQueryStatic {
		plot: {
			(placeholder: string | HTMLElement | JQuery, data: DataSeries[], options?: PlotOptions): Plot;
			version: string;
			plugins: unknown[];
			saturated: unknown;
			browser: unknown;
			uiConstants: unknown;
			drawSeries: unknown;
			linearTickGenerator: unknown;
			defaultTickFormatter: unknown;
			expRepTickFormatter: unknown;
			logTicksGenerator: unknown;
			logTickFormatter: unknown;
			formatDate: unknown;
			makeUtcWrapper: unknown;
			dateGenerator: unknown;
			dateTickGenerator: unknown;
			composeImages: unknown;
		};
		color: {
			make(r: number, g: number, b: number, a?: number): unknown;
			parse(str: string): unknown;
			extract(elem: JQuery, cssProp: string): unknown;
		};
	}

	interface JQuery {
		plot(data: DataSeries[], options?: PlotOptions): JQuery;
	}
}
