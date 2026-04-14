// Type definitions for @kevinburke/flot
//
// These are hand-written declarations covering the public API. The flot
// options type is large and permissive — many sub-options accept any value
// a plugin understands. When in doubt, unknown option keys are allowed.

// ============================================================================
// Data input
// ============================================================================

/**
 * A single data point. Most commonly `[x, y]`, but error bars and similar
 * plugins accept longer tuples.
 */
export type DataPoint = number[] | null;

/**
 * A series of data points, or a series descriptor containing data and
 * per-series options.
 */
export type DataSeries =
	| DataPoint[]
	| {
			data: DataPoint[];
			label?: string;
			color?: number | string;
			lines?: LinesOptions;
			points?: PointsOptions;
			bars?: BarsOptions;
			xaxis?: number;
			yaxis?: number;
			hoverable?: boolean;
			clickable?: boolean;
			shadowSize?: number;
			highlightColor?: string;
			[key: string]: unknown;
	  };

// ============================================================================
// Options
// ============================================================================

export interface LinesOptions {
	show?: boolean;
	lineWidth?: number;
	fill?: boolean | number;
	fillColor?: string | null | { colors: Array<string | number | { opacity: number }> };
	steps?: boolean;
	zero?: boolean;
	[key: string]: unknown;
}

export interface PointsOptions {
	show?: boolean;
	radius?: number;
	lineWidth?: number;
	fill?: boolean | number;
	fillColor?: string | null;
	symbol?:
		| string
		| ((
				ctx: CanvasRenderingContext2D,
				x: number,
				y: number,
				radius: number,
				shadow: boolean,
		  ) => void);
	[key: string]: unknown;
}

export interface BarsOptions {
	show?: boolean;
	lineWidth?: number;
	barWidth?: number;
	fill?: boolean | number;
	fillColor?: string | null;
	align?: "left" | "right" | "center";
	horizontal?: boolean;
	zero?: boolean;
	[key: string]: unknown;
}

export interface SeriesOptions {
	lines?: LinesOptions;
	points?: PointsOptions;
	bars?: BarsOptions;
	shadowSize?: number;
	highlightColor?: string;
	hoverable?: boolean;
	clickable?: boolean;
	[key: string]: unknown;
}

export interface AxisOptions {
	show?: boolean | null;
	mode?: "time" | "categories" | null;
	position?: "bottom" | "top" | "left" | "right";
	color?: string | number | null;
	tickColor?: string | number | null;
	transform?: ((v: number) => number) | null;
	inverseTransform?: ((v: number) => number) | null;
	min?: number | null;
	max?: number | null;
	autoScale?: "loose" | "exact" | "none" | "sliding-window";
	autoScaleMargin?: number;
	ticks?:
		| number
		| number[]
		| Array<[number, string]>
		| ((axis: Axis) => Array<number | [number, string]>)
		| null;
	tickSize?: number | [number, string] | null;
	minTickSize?: number | [number, string] | null;
	tickFormatter?: ((value: number, axis: Axis) => string) | null;
	tickDecimals?: number | null;
	tickLength?: number | "full" | null;
	alignTicksWithAxis?: number | null;
	font?: FontOptions | null;
	timezone?: string | null;
	timeformat?: string | null;
	twelveHourClock?: boolean;
	monthNames?: string[] | null;
	dayNames?: string[] | null;
	reserveSpace?: boolean;
	[key: string]: unknown;
}

export interface FontOptions {
	size?: number;
	lineHeight?: number;
	style?: string;
	weight?: string;
	variant?: string;
	family?: string;
	color?: string;
}

export interface GridOptions {
	show?: boolean;
	aboveData?: boolean;
	color?: string;
	backgroundColor?: string | null | { colors: string[] };
	margin?: number | { top?: number; bottom?: number; left?: number; right?: number };
	labelMargin?: number;
	axisMargin?: number;
	borderWidth?: number | { top?: number; right?: number; bottom?: number; left?: number };
	borderColor?: string | null | { top?: string; right?: string; bottom?: string; left?: string };
	minBorderMargin?: number | null;
	markings?: Marking[] | ((axes: Record<string, Axis>) => Marking[]) | null;
	markingsColor?: string;
	markingsLineWidth?: number;
	clickable?: boolean;
	hoverable?: boolean;
	autoHighlight?: boolean;
	mouseActiveRadius?: number;
	[key: string]: unknown;
}

export interface Marking {
	xaxis?: { from?: number; to?: number };
	yaxis?: { from?: number; to?: number };
	color?: string;
	lineWidth?: number;
}

export interface LegendOptions {
	show?: boolean;
	labelFormatter?: ((label: string, series: unknown) => string) | null;
	labelBoxBorderColor?: string;
	noColumns?: number;
	position?: "ne" | "nw" | "se" | "sw";
	margin?: number | [number, number];
	backgroundColor?: string | null;
	backgroundOpacity?: number;
	container?: HTMLElement | null;
	sorted?:
		| boolean
		| "ascending"
		| "descending"
		| "reverse"
		| ((a: unknown, b: unknown) => number)
		| null;
	[key: string]: unknown;
}

export interface ZoomOptions {
	interactive?: boolean;
	active?: boolean;
	amount?: number;
	[key: string]: unknown;
}

export interface PanOptions {
	interactive?: boolean;
	active?: boolean;
	cursor?: string;
	frameRate?: number;
	mode?: "manual" | "smart";
	[key: string]: unknown;
}

export interface SelectionOptions {
	mode?: "x" | "y" | "xy" | null;
	color?: string;
	shape?: "round" | "miter" | "bevel";
	minSize?: number;
	[key: string]: unknown;
}

export interface PlotOptions {
	series?: SeriesOptions;
	xaxis?: AxisOptions;
	yaxis?: AxisOptions;
	xaxes?: AxisOptions[];
	yaxes?: AxisOptions[];
	grid?: GridOptions;
	legend?: LegendOptions;
	zoom?: ZoomOptions;
	pan?: PanOptions;
	selection?: SelectionOptions;
	colors?: string[];
	hooks?: Record<string, Array<(...args: unknown[]) => unknown>>;
	interaction?: { redrawOverlayInterval?: number };
	[key: string]: unknown;
}

// ============================================================================
// Plot runtime types
// ============================================================================

export interface Axis {
	n: number;
	direction: "x" | "y";
	min: number;
	max: number;
	datamin: number;
	datamax: number;
	scale: number;
	p2c(p: number): number;
	c2p(c: number): number;
	options: AxisOptions;
	ticks: Array<{ v: number; label: string }>;
	box?: { left: number; top: number; width: number; height: number };
}

export interface PlotOffset {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

export interface Position {
	pageX: number;
	pageY: number;
	[axisKey: string]: number;
}

export interface DataItem {
	datapoint: number[];
	dataIndex: number;
	series: DataSeries;
	seriesIndex: number;
	pageX: number;
	pageY: number;
}

/**
 * A plot instance. Returned by `plot()` and used to inspect or mutate the
 * chart after creation.
 */
export interface Plot {
	// Data and options
	getData(): DataSeries[];
	setData(data: DataSeries | DataSeries[]): void;
	getOptions(): PlotOptions;

	// Elements
	getPlaceholder(): HTMLElement;
	getCanvas(): HTMLCanvasElement;
	getSurface(): unknown;
	getEventHolder(): HTMLElement;
	getPlotOffset(): PlotOffset;
	width(): number;
	height(): number;
	offset(): { left: number; top: number };

	// Axes
	getAxes(): Record<string, Axis>;
	getXAxes(): Axis[];
	getYAxes(): Axis[];

	// Coordinate conversion
	c2p(pos: { left: number; top: number }): Position;
	p2c(pos: Position): { left: number; top: number };
	pointOffset(point: Record<string, number>): { left: number; top: number };

	// Lifecycle
	draw(): void;
	setupGrid(autoScale?: boolean): void;
	triggerRedrawOverlay(): void;
	resize(): void;
	shutdown(): void;
	destroy(): void;
	clearTextCache(): void;

	// Hit testing
	findNearbyItem(
		mouseX: number,
		mouseY: number,
		seriesFilter?: (s: DataSeries) => boolean,
		radius?: number,
	): DataItem | null;
	findNearbyItems(
		mouseX: number,
		mouseY: number,
		seriesFilter?: (s: DataSeries) => boolean,
		radius?: number,
	): DataItem[];
	findNearbyInterpolationPoint(
		mouseX: number,
		mouseY: number,
		seriesFilter?: (s: DataSeries) => boolean,
	): DataItem | null;

	// Axis helpers
	autoScaleAxis(axis: Axis): void;
	computeRangeForDataSeries(series: DataSeries): {
		xmin: number;
		xmax: number;
		ymin: number;
		ymax: number;
	};
	adjustSeriesDataRange(series: DataSeries, range: unknown): unknown;
	computeValuePrecision(min: number, max: number, direction: "x" | "y", noTicks: number): number;
	computeTickSize(min: number, max: number, noTicks?: number, tickDecimals?: number): number;

	// Event handler priority
	addEventHandler(
		event: string,
		handler: (e: Event) => void,
		eventHolder: HTMLElement,
		priority: number,
	): void;
	hooks: Record<string, Array<(...args: unknown[]) => unknown>>;

	// Plugin-provided methods (present when the relevant plugin is loaded)
	// Hover plugin:
	highlight?(series: number | DataSeries, point: number | DataPoint, auto?: boolean): void;
	unhighlight?(series?: number | DataSeries, point?: number | DataPoint): void;

	// Navigate plugin:
	pan?(args: { left?: number; top?: number; axes?: Axis[]; preventEvent?: boolean }): void;
	zoom?(args?: {
		amount?: number;
		center?: { left: number; top: number };
		axes?: Axis[];
		preventEvent?: boolean;
	}): void;
	zoomOut?(args?: { amount?: number }): void;
	recenter?(args?: { axes?: Axis[] }): void;
	smartPan?(
		delta: { x: number; y: number },
		initialState: unknown,
		panAxes?: Axis[],
		preventEvent?: boolean,
		smartLock?: boolean,
	): void;
	navigationState?(startPageX?: number, startPageY?: number): unknown;
	getTouchedAxis?(touchPointX: number, touchPointY: number): Axis[];
	activate?(): void;

	// Selection plugin:
	setSelection?(
		ranges: { xaxis?: { from: number; to: number }; yaxis?: { from: number; to: number } },
		preventEvent?: boolean,
	): void;
	getSelection?(): {
		xaxis?: { from: number; to: number };
		yaxis?: { from: number; to: number };
	} | null;
	clearSelection?(preventEvent?: boolean): void;

	// Compose images plugin:
	composeImages?(
		canvasOrSvgSources: Array<HTMLCanvasElement | SVGElement>,
		destinationCanvas: HTMLCanvasElement,
	): Promise<number>;
}

// ============================================================================
// Main entry points
// ============================================================================

/**
 * Create a plot in the given element.
 *
 * @param placeholder The container element. Must have explicit width and
 *   height set via CSS.
 * @param data An array of data series.
 * @param options Plot options.
 */
export function plot(
	placeholder: HTMLElement | string,
	data: DataSeries[],
	options?: PlotOptions,
): Plot;

export const version: string;

export const plugins: Array<{
	init: (plot: Plot, classes?: unknown) => void;
	options?: PlotOptions;
	name?: string;
	version?: string;
}>;

// ============================================================================
// Helper exports
// ============================================================================

export interface Color {
	r: number;
	g: number;
	b: number;
	a: number;
	add(channels: string, delta: number): Color;
	scale(channels: string, factor: number): Color;
	toString(): string;
	normalize(): Color;
	clone(): Color;
}

export const color: {
	make(r: number, g: number, b: number, a?: number): Color;
	parse(str: string): Color;
	extract(elem: HTMLElement, cssProp: string): Color;
};

export const saturated: {
	saturate(a: number): number;
	delta(min: number, max: number, noTicks: number): number;
	multiply(a: number, b: number): number;
	multiplyAdd(a: number, bInt: number, c: number): number;
	floorInBase(n: number, base: number): number;
};

export const browser: {
	getPageXY(e: MouseEvent | TouchEvent): { X: number; Y: number };
	getPixelRatio(context: CanvasRenderingContext2D): number;
	isSafari(): boolean;
	isMobileSafari(): boolean | null;
	isOpera(): boolean;
	isFirefox(): boolean;
	isIE(): boolean;
	isEdge(): boolean;
	isChrome(): boolean;
	isBlink(): boolean;
};

export const uiConstants: {
	SNAPPING_CONSTANT: number;
	PANHINT_LENGTH_CONSTANT: number;
	MINOR_TICKS_COUNT_CONSTANT: number;
	TICK_LENGTH_CONSTANT: number;
	ZOOM_DISTANCE_MARGIN: number;
};

export const drawSeries: {
	drawSeriesLines(
		series: DataSeries,
		ctx: CanvasRenderingContext2D,
		plotOffset: PlotOffset,
		plotWidth: number,
		plotHeight: number,
		drawSymbol: unknown,
		getColorOrGradient: unknown,
	): void;
	drawSeriesPoints(
		series: DataSeries,
		ctx: CanvasRenderingContext2D,
		plotOffset: PlotOffset,
		plotWidth: number,
		plotHeight: number,
		drawSymbol: unknown,
		getColorOrGradient: unknown,
	): void;
	drawSeriesBars(
		series: DataSeries,
		ctx: CanvasRenderingContext2D,
		plotOffset: PlotOffset,
		plotWidth: number,
		plotHeight: number,
		drawSymbol: unknown,
		getColorOrGradient: unknown,
	): void;
	drawBar(
		x: number,
		y: number,
		b: number,
		barLeft: number,
		barRight: number,
		fillStyleCallback: unknown,
		axisx: Axis,
		axisy: Axis,
		c: CanvasRenderingContext2D,
		horizontal: boolean,
		lineWidth: number,
	): void;
};

export class Canvas {
	constructor(cls: string, container: HTMLElement);
	element: HTMLCanvasElement;
	context: CanvasRenderingContext2D;
	pixelRatio: number;
	width: number;
	height: number;
	resize(width: number, height: number): void;
	clear(): void;
	render(): void;
	clearCache(): void;
	getTextInfo(
		layer: string,
		text: string,
		font: FontOptions,
		angle?: number,
		width?: number,
	): unknown;
	addText(
		layer: string,
		x: number,
		y: number,
		text: string,
		font: FontOptions,
		angle?: number,
		width?: number,
		halign?: string,
		valign?: string,
	): void;
	removeText(
		layer: string,
		x?: number,
		y?: number,
		text?: string,
		font?: FontOptions,
		angle?: number,
	): void;
}

// Tick generators and formatters
export function linearTickGenerator(axis: Axis): Array<number | [number, string]>;
export function defaultTickFormatter(value: number, axis: Axis, precision?: number): string;
export function expRepTickFormatter(value: number, axis: Axis, precision?: number): string;
export function logTicksGenerator(
	plot: Plot,
	axis: Axis,
	noTicks?: number,
): Array<number | [number, string]>;
export function logTickFormatter(value: number, axis: Axis, precision?: number): string;

// Time plugin exports
export function formatDate(
	d: Date,
	fmt: string,
	monthNames?: string[],
	dayNames?: string[],
): string;
export function makeUtcWrapper(d: Date): unknown;
export function dateGenerator(
	ts: number,
	opts: { timezone?: string; timeBase?: "seconds" | "milliseconds" | "microseconds" },
): unknown;
export function dateTickGenerator(axis: Axis): Array<number>;

// Compose images export
export function composeImages(
	canvasOrSvgSources: Array<HTMLCanvasElement | SVGElement>,
	destinationCanvas: HTMLCanvasElement,
): Promise<number>;
