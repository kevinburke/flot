// Type test. Verifies the .d.ts files compile and the public API has
// sensible types. Run `make types` to check.

import {
	color,
	type DataSeries,
	type Plot,
	type PlotOptions,
	type PointsOptions,
	plot,
	saturated,
	version,
} from "./index.js";

// Basic plot call
const el = document.getElementById("placeholder") as HTMLElement;
const data: DataSeries[] = [
	[
		[0, 0],
		[1, 1],
		[2, 4],
	],
	{
		data: [
			[0, 3],
			[4, 8],
		],
		label: "series 2",
		color: "#ff0000",
	},
];
const options: PlotOptions = {
	xaxis: { mode: "time", min: 0 },
	yaxis: { max: 10 },
	series: {
		lines: { show: true, fill: 0.5 },
		points: { show: true, radius: 3 },
	},
	grid: { hoverable: true, clickable: true },
	legend: { position: "ne", noColumns: 2 },
};

const p: Plot = plot(el, data, options);

// Plot methods
p.getData();
p.setData(data);
const _offset = p.getPlotOffset();
const _width: number = p.width();
const _height: number = p.height();
const _axes = p.getAxes();
const _xAxes = p.getXAxes();

// Plugin methods (optional)
p.highlight?.(0, 0);
p.pan?.({ left: 10, top: 0 });
p.setSelection?.({ xaxis: { from: 0, to: 5 } });

// Color helpers
const c = color.make(255, 0, 0);
c.scale("rgb", 0.5).toString();
const parsed = color.parse("#ff0000");
parsed.r; // number

// Math helpers
saturated.floorInBase(17, 5);
saturated.multiplyAdd(1e300, 10, 5);

// Version string
const _v: string = version;

// String placeholder also works
plot("#placeholder", data);

// Error-bar options work both globally and on individual series. Custom caps
// infer the canvas context and numeric coordinates without annotations.
const errorPoints: PointsOptions = {
	errorbars: "xy",
	shadowSize: 0,
	xerr: {
		show: true,
		asymmetric: true,
		upperCap: "-",
		lowerCap(ctx, x, y, radius) {
			ctx.moveTo(x - radius, y);
			ctx.lineTo(x + radius, y);
			ctx.stroke();
			// @ts-expect-error cap coordinates are numbers
			x.toUpperCase();
		},
	},
	yerr: {
		show: true,
		color: "red",
		radius: 5,
		lineWidth: 2,
		upperCap(ctx, x, y, radius) {
			ctx.arc(x, y, radius, 0, Math.PI);
			// @ts-expect-error caps receive a 2D canvas context
			ctx.getContext("2d");
		},
		lowerCap: null,
	},
};
plot(el, [{ data: [[1, 2, 0.1, 0.2, 0.3]], points: errorPoints }], {
	series: { points: errorPoints },
});

// Nullable defaults and partial overrides remain accepted.
plot(el, data, {
	series: {
		points: {
			errorbars: null,
			xerr: {
				show: null,
				asymmetric: null,
				upperCap: null,
				lowerCap: null,
				color: null,
				radius: null,
			},
			yerr: { show: false },
		},
	},
});

// Known error-bar options must not fall through PointsOptions' permissive
// extension keys. Each directive fails if an invalid value becomes accepted.
errorPoints.errorbars = "x";
errorPoints.errorbars = "y";
// @ts-expect-error only x, y, and xy select error-bar directions
errorPoints.errorbars = "yx";
// @ts-expect-error caps accept '-' or a drawing callback, not symbol names
errorPoints.xerr = { upperCap: "circle" };
// @ts-expect-error both upper and lower cap options have the same contract
errorPoints.yerr = { lowerCap: 5 };
// @ts-expect-error a drawing callback receives numeric coordinates
errorPoints.yerr = { upperCap: (_ctx: CanvasRenderingContext2D, _x: string) => {} };
// @ts-expect-error error-bar radii are numeric
errorPoints.xerr = { radius: "5" };
// @ts-expect-error showing error bars requires a boolean
errorPoints.yerr = { show: "true" };
