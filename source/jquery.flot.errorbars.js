/* Flot plugin for plotting error bars.

Copyright (c) 2007-2014 IOLA and Ole Laursen.
Licensed under the MIT license.

Error bars are used to show standard deviation and other statistical
properties in a plot.

* Created by Rui Pereira  -  rui (dot) pereira (at) gmail (dot) com

This plugin allows you to plot error-bars over points. Set "errorbars" inside
the points series to the axis name over which there will be error values in
your data array (*even* if you do not intend to plot them later, by setting
"show: null" on xerr/yerr).

The plugin supports these options:

    series: {
        points: {
            errorbars: "x" or "y" or "xy",
            xerr: {
                show: null/false or true,
                asymmetric: null/false or true,
                upperCap: null or "-" or function,
                lowerCap: null or "-" or function,
                color: null or color,
                radius: null or number
            },
            yerr: { same options as xerr }
        }
    }

Each data point array is expected to be of the type:

    "x"  [ x, y, xerr ]
    "y"  [ x, y, yerr ]
    "xy" [ x, y, xerr, yerr ]

Where xerr becomes xerr_lower,xerr_upper for the asymmetric error case, and
equivalently for yerr. Eg., a datapoint for the "xy" case with symmetric
error-bars on X and asymmetric on Y would be:

    [ x, y, xerr, yerr_lower, yerr_upper ]

By default no end caps are drawn. Setting upperCap and/or lowerCap to "-" will
draw a small cap perpendicular to the error bar. They can also be set to a
user-defined drawing function, with (ctx, x, y, radius) as parameters, as eg.

    function drawSemiCircle( ctx, x, y, radius ) {
        ctx.beginPath();
        ctx.arc( x, y, radius, 0, Math.PI, false );
        ctx.moveTo( x - radius, y );
        ctx.lineTo( x + radius, y );
        ctx.stroke();
    }

Color and radius both default to the same ones of the points series if not
set. The independent radius parameter on xerr/yerr is useful for the case when
we may want to add error-bars to a line, without showing the interconnecting
points (with radius: 0), and still showing end caps on the error-bars.
shadowSize and lineWidth are derived as well from the points series.

*/

import { plugins } from './plugin-registry.js';

/** @typedef {import('../types/index.js').ErrorBarOptions & { err: 'x' | 'y' }} ErrorBarOptions */
/** @typedef {import('../types/index.js').ErrorBarCap} ErrorBarCap */
/** @typedef {{ min: number, max: number, p2c: (value: number) => number }} ErrorBarAxis */
/** @typedef {NonNullable<import('../types/index.js').PointsOptions['errorbars']>} ErrorBarDirection */
/** @typedef {{ x: true, y?: never, number: true, required: true }} ErrorBarXField */
/** @typedef {{ x?: never, y: true, number: true, required: true }} ErrorBarYField */
/** @typedef {[ErrorBarXField, ErrorBarYField, ...Array<ErrorBarXField | ErrorBarYField>]} ErrorBarFormat */
/** @typedef {{ points: Array<number | null>, pointsize: number }} ErrorBarDatapoints */
/** @typedef {[number | null, number | null, number | null, number | null]} ErrorRanges Lower/upper x errors followed by lower/upper y errors. */

/**
 * Point options after the plot core merges defaults and per-series overrides.
 * @typedef {Object} ErrorBarPoints
 * @property {import('../types/index.js').PointsOptions['errorbars']} errorbars
 * @property {ErrorBarOptions} xerr
 * @property {ErrorBarOptions} yerr
 * @property {number} radius
 * @property {number} lineWidth
 * @property {number | null} [shadowSize]
 */

/**
 * @typedef {Object} ErrorBarSeries
 * @property {ErrorBarDatapoints} datapoints
 * @property {ErrorBarAxis} xaxis
 * @property {ErrorBarAxis} yaxis
 * @property {ErrorBarPoints} points
 * @property {string} color
 * @property {number} shadowSize
 */

/**
 * @typedef {Object} ErrorBarPlot
 * @property {() => ErrorBarSeries[]} getData
 * @property {() => { left: number, top: number }} getPlotOffset
 * @property {{ processRawData: Array<typeof processRawData>, draw: Array<typeof draw> }} hooks
 */

    /** @type {{ series: { points: Pick<ErrorBarPoints, 'errorbars' | 'xerr' | 'yerr'> } }} */
	var options = {
        series: {
            points: {
                errorbars: null, // Disable error-bar processing by default.
                xerr: {err: 'x', show: null, asymmetric: null, upperCap: null, lowerCap: null, color: null, radius: null},
                yerr: {err: 'y', show: null, asymmetric: null, upperCap: null, lowerCap: null, color: null, radius: null}
            }
        }
	};

    /**
     * Build a fresh format for x, y, and the configured error values. Error
     * fields follow x then y, with lower/upper fields for asymmetric errors.
     * Each field is a required number belonging to exactly one axis.
     *
     * @param {ErrorBarDirection} errors
     * @param {boolean | null} [xAsymmetric]
     * @param {boolean | null} [yAsymmetric]
     * @returns {ErrorBarFormat}
     * @internal
     */
    export function createErrorBarFormat(errors, xAsymmetric, yAsymmetric) {
        // x,y values
        /** @type {ErrorBarFormat} */
        var format = [
            { x: true, number: true, required: true },
            { y: true, number: true, required: true }
        ];

        // Error fields copy the matching coordinate's requirements. Each gets
        // its own descriptor so later processing can modify fields separately.
        for (var axis of errors) {
            var field = format[axis === 'x' ? 0 : 1];
            format.push({ ...field });
            if (axis === 'x' ? xAsymmetric : yAsymmetric) {
                format.push({ ...field });
            }
        }
        return format;
    }

    /**
     * Hook adapter: when error bars are configured, replace datapoints.format
     * with the format the plot core uses to copy raw data before rendering.
     *
     * @param {ErrorBarPlot} _plot Unused; retained for the hook signature.
     * @param {{ points: ErrorBarPoints }} series
     * @param {unknown} _data Unused raw data; retained for the hook signature.
     * @param {{ format?: Array<{ x?: boolean, y?: boolean, number?: boolean, required?: boolean }> }} datapoints
     * @returns {void}
     */
    function processRawData(_plot, series, _data, datapoints) {
        var points = series.points;
        if (points.errorbars) {
            datapoints.format = createErrorBarFormat(points.errorbars, points.xerr.asymmetric, points.yerr.asymmetric);
        }
    }

	/** @param {ErrorBarSeries} series @param {number} i @returns {ErrorRanges} */
	function parseErrors(series, i) {
        var points = series.datapoints.points;

        // read errors from points array
        var /** @type {number | null} */ exl = null,
            /** @type {number | null} */ exu = null,
            /** @type {number | null} */ eyl = null,
            /** @type {number | null} */ eyu = null;
        var xerr = series.points.xerr,
            yerr = series.points.yerr;

        var eb = series.points.errorbars;
        // error bars - first X
        if (eb === 'x' || eb === 'xy') {
            if (xerr.asymmetric) {
                exl = points[i + 2];
                exu = points[i + 3];
                if (eb === 'xy') {
                    if (yerr.asymmetric) {
                        eyl = points[i + 4];
                        eyu = points[i + 5];
                    } else {
                        eyl = points[i + 4];
                    }
                }
            } else {
                exl = points[i + 2];
                if (eb === 'xy') {
                    if (yerr.asymmetric) {
                        eyl = points[i + 3];
                        eyu = points[i + 4];
                    } else {
                        eyl = points[i + 3];
                    }
                }
            }
        // only Y
        } else {
            if (eb === 'y') {
                if (yerr.asymmetric) {
                    eyl = points[i + 2];
                    eyu = points[i + 3];
                } else {
                    eyl = points[i + 2];
                }
            }
        }

        // symmetric errors?
        if (exu == null) {
            exu = exl;
        }
        if (eyu == null) {
            eyu = eyl;
        }

        /** @type {ErrorRanges} */
        var errRanges = [exl, exu, eyl, eyu];
        // nullify if not showing
        if (!xerr.show) {
            errRanges[0] = null;
            errRanges[1] = null;
        }
        if (!yerr.show) {
            errRanges[2] = null;
            errRanges[3] = null;
        }
        return errRanges;
    }

	/** @param {ErrorBarPlot} plot @param {CanvasRenderingContext2D} ctx @param {ErrorBarSeries} s */
	function drawSeriesErrors(plot, ctx, s) {
        var points = s.datapoints.points,
            ps = s.datapoints.pointsize,
            ax = [s.xaxis, s.yaxis],
            radius = s.points.radius,
            err = [s.points.xerr, s.points.yerr],
            /** @type {ErrorBarCap | number | boolean} */ tmp;

        //sanity check, in case some inverted axis hack is applied to flot
        var invertX = false;
        if (ax[0].p2c(ax[0].max) < ax[0].p2c(ax[0].min)) {
            invertX = true;
            tmp = err[0].lowerCap;
            err[0].lowerCap = err[0].upperCap;
            err[0].upperCap = tmp;
        }

        var invertY = false;
        if (ax[1].p2c(ax[1].min) < ax[1].p2c(ax[1].max)) {
            invertY = true;
            tmp = err[1].lowerCap;
            err[1].lowerCap = err[1].upperCap;
            err[1].upperCap = tmp;
        }

        for (var i = 0; i < s.datapoints.points.length; i += ps) {
            //parse
            var errRanges = parseErrors(s, i);

            //cycle xerr & yerr
            for (var e = 0; e < err.length; e++) {
                /** @type {[number, number]} */
                var minmax = [ax[e].min, ax[e].max];

                //draw this error?
                if (errRanges[e * err.length]) {
                    //data coordinates
                    var x = points[i],
                        y = points[i + 1];

                    //errorbar ranges
                    var upper = [x, y][e] + errRanges[e * err.length + 1],
                        lower = [x, y][e] - errRanges[e * err.length];

                    //points outside of the canvas
                    if (err[e].err === 'x') {
                        if (y > ax[1].max || y < ax[1].min || upper < ax[0].min || lower > ax[0].max) {
                            continue;
                        }
                    }

                    if (err[e].err === 'y') {
                        if (x > ax[0].max || x < ax[0].min || upper < ax[1].min || lower > ax[1].max) {
                            continue;
                        }
                    }

                    // prevent errorbars getting out of the canvas
                    var drawUpper = true,
                        drawLower = true;

                    if (upper > minmax[1]) {
                        drawUpper = false;
                        upper = minmax[1];
                    }
                    if (lower < minmax[0]) {
                        drawLower = false;
                        lower = minmax[0];
                    }

                    //sanity check, in case some inverted axis hack is applied to flot
                    if ((err[e].err === 'x' && invertX) || (err[e].err === 'y' && invertY)) {
                        //swap coordinates
                        tmp = lower;
                        lower = upper;
                        upper = tmp;
                        tmp = drawLower;
                        drawLower = drawUpper;
                        drawUpper = tmp;
                        tmp = minmax[0];
                        minmax[0] = minmax[1];
                        minmax[1] = tmp;
                    }

                    // convert to pixels
                    x = ax[0].p2c(x);
                    y = ax[1].p2c(y);
                    upper = ax[e].p2c(upper);
                    lower = ax[e].p2c(lower);
                    minmax[0] = ax[e].p2c(minmax[0]);
                    minmax[1] = ax[e].p2c(minmax[1]);

                    //same style as points by default
                    var lw = err[e].lineWidth ? err[e].lineWidth : s.points.lineWidth,
                        sw = s.points.shadowSize != null ? s.points.shadowSize : s.shadowSize;

                    //shadow as for points
                    if (lw > 0 && sw > 0) {
                        var w = sw / 2;
                        ctx.lineWidth = w;
                        ctx.strokeStyle = "rgba(0,0,0,0.1)";
                        drawError(ctx, err[e], x, y, upper, lower, drawUpper, drawLower, radius, w + w / 2, minmax);

                        ctx.strokeStyle = "rgba(0,0,0,0.2)";
                        drawError(ctx, err[e], x, y, upper, lower, drawUpper, drawLower, radius, w / 2, minmax);
                    }

                    ctx.strokeStyle = err[e].color
                        ? err[e].color
                        : s.color;
                    ctx.lineWidth = lw;
                    //draw it
                    drawError(ctx, err[e], x, y, upper, lower, drawUpper, drawLower, radius, 0, minmax);
                }
            }
        }
    }

	/**
     * @param {CanvasRenderingContext2D} ctx
     * @param {ErrorBarOptions} err
     * @param {number} x
     * @param {number} y
     * @param {number} upper
     * @param {number} lower
     * @param {boolean} drawUpper
     * @param {boolean} drawLower
     * @param {number} radius
     * @param {number} offset
     * @param {[number, number]} minmax
     */
	function drawError(ctx, err, x, y, upper, lower, drawUpper, drawLower, radius, offset, minmax) {
        //shadow offset
        y += offset;
        upper += offset;
        lower += offset;

        // error bar - avoid plotting over circles
        if (err.err === 'x') {
            if (upper > x + radius) {
                drawPath(ctx, [[upper, y], [Math.max(x + radius, minmax[0]), y]]);
            } else {
                drawUpper = false;
            }

            if (lower < x - radius) {
                drawPath(ctx, [[Math.min(x - radius, minmax[1]), y], [lower, y]]);
            } else {
                drawLower = false;
            }
        } else {
            if (upper < y - radius) {
                drawPath(ctx, [[x, upper], [x, Math.min(y - radius, minmax[0])]]);
            } else {
                drawUpper = false;
            }

            if (lower > y + radius) {
                drawPath(ctx, [[x, Math.max(y + radius, minmax[1])], [x, lower]]);
            } else {
                drawLower = false;
            }
        }

        //internal radius value in errorbar, allows to plot radius 0 points and still keep proper sized caps
        //this is a way to get errorbars on lines without visible connecting dots
        radius = err.radius != null
            ? err.radius
            : radius;

        // upper cap
        if (drawUpper) {
            if (err.upperCap === '-') {
                if (err.err === 'x') {
                    drawPath(ctx, [[upper, y - radius], [upper, y + radius]]);
                } else {
                    drawPath(ctx, [[x - radius, upper], [x + radius, upper]]);
                }
            } else if (typeof err.upperCap === 'function') {
                if (err.err === 'x') {
                    err.upperCap(ctx, upper, y, radius);
                } else {
                    err.upperCap(ctx, x, upper, radius);
                }
            }
        }
        // lower cap
        if (drawLower) {
            if (err.lowerCap === '-') {
                if (err.err === 'x') {
                    drawPath(ctx, [[lower, y - radius], [lower, y + radius]]);
                } else {
                    drawPath(ctx, [[x - radius, lower], [x + radius, lower]]);
                }
            } else if (typeof err.lowerCap === 'function') {
                if (err.err === 'x') {
                    err.lowerCap(ctx, lower, y, radius);
                } else {
                    err.lowerCap(ctx, x, lower, radius);
                }
            }
        }
    }

	/** @param {CanvasRenderingContext2D} ctx @param {Array<[number, number]>} pts */
	function drawPath(ctx, pts) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var p = 1; p < pts.length; p++) {
            ctx.lineTo(pts[p][0], pts[p][1]);
        }

        ctx.stroke();
    }

	/** @param {ErrorBarPlot} plot @param {CanvasRenderingContext2D} ctx */
	function draw(plot, ctx) {
        var plotOffset = plot.getPlotOffset();

        ctx.save();
        ctx.translate(plotOffset.left, plotOffset.top);
		plot.getData().forEach(function (s) {
            if (s.points.errorbars && (s.points.xerr.show || s.points.yerr.show)) {
                drawSeriesErrors(plot, ctx, s);
            }
        });
        ctx.restore();
    }

	/** @param {ErrorBarPlot} plot */
	function init(plot) {
        plot.hooks.processRawData.push(processRawData);
        plot.hooks.draw.push(draw);
    }

    plugins.push({
        init: init,
        options: options,
        name: 'errorbars',
        version: '1.0'
    });
