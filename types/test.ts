// Type test. Verifies the .d.ts files compile and the public API has
// sensible types. Run `npx tsc --noEmit types/test.ts` to check.

import {
	type DataSeries,
	type Plot,
	type PlotOptions,
	color,
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
const offset = p.getPlotOffset();
const width: number = p.width();
const height: number = p.height();
const axes = p.getAxes();
const xAxes = p.getXAxes();

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
const v: string = version;

// String placeholder also works
plot("#placeholder", data);
