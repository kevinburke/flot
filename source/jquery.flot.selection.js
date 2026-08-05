/* Flot plugin for selecting regions of a plot.

Copyright (c) 2007-2014 IOLA and Ole Laursen.
Licensed under the MIT license.

The plugin supports these options:

selection: {
    mode: null or "x" or "y" or "xy" or "smart",
    color: color,
    shape: "round" or "miter" or "bevel",
    visualization: "fill" or "focus",
    displaySelectionDecorations: true or false,
    minSize: number of pixels
}

Selection support is enabled by setting the mode to one of "x", "y" or "xy".
In "x" mode, the user will only be able to specify the x range, similarly for
"y" mode. For "xy", the selection becomes a rectangle where both ranges can be
specified. "color" is color of the selection (if you need to change the color
later on, you can get to it with plot.getOptions().selection.color). "shape"
is the shape of the corners of the selection.

The way how the selection is visualized, can be changed by using the option
"visualization". Flot currently supports two modes: "focus" and "fill". The
option "focus" draws a colored bezel around the selected area while keeping
the selected area clear. The option "fill" highlights (i.e., fills) the
selected area with a colored highlight.

There are optional selection decorations (handles) that are rendered with the
"focus" visualization option. The selection decoration is rendered by default
but can be turned off by setting displaySelectionDecorations to false.

"minSize" is the minimum size a selection can be in pixels. This value can
be customized to determine the smallest size a selection can be and still
have the selection rectangle be displayed. When customizing this value, the
fact that it refers to pixels, not axis units must be taken into account.
Thus, for example, if there is a bar graph in time mode with BarWidth set to 1
minute, setting "minSize" to 1 will not make the minimum selection size 1
minute, but rather 1 pixel. Note also that setting "minSize" to 0 will prevent
"plotunselected" events from being fired when the user clicks the mouse without
dragging.

When selection support is enabled, a "plotselected" event will be emitted on
the DOM element you passed into the plot function. The event handler gets a
parameter with the ranges selected on the axes, like this:

    placeholder.bind( "plotselected", function( event, ranges ) {
        alert("You selected " + ranges.xaxis.from + " to " + ranges.xaxis.to)
        // similar for yaxis - with multiple axes, the extra ones are in
        // x2axis, x3axis, ...
    });

The "plotselected" event is only fired when the user has finished making the
selection. A "plotselecting" event is fired during the process with the same
parameters as the "plotselected" event, in case you want to know what's
happening while it's happening,

A "plotunselected" event with no arguments is emitted when the user clicks the
mouse to remove the selection. As stated above, setting "minSize" to 0 will
destroy this behavior.

The plugin allso adds the following methods to the plot object:

- setSelection( ranges, preventEvent )

  Set the selection rectangle. The passed in ranges is on the same form as
  returned in the "plotselected" event. If the selection mode is "x", you
  should put in either an xaxis range, if the mode is "y" you need to put in
  an yaxis range and both xaxis and yaxis if the selection mode is "xy", like
  this:

    setSelection({ xaxis: { from: 0, to: 10 }, yaxis: { from: 40, to: 60 } });

  setSelection will trigger the "plotselected" event when called. If you don't
  want that to happen, e.g. if you're inside a "plotselected" handler, pass
  true as the second parameter. If you are using multiple axes, you can
  specify the ranges on any of those, e.g. as x2axis/x3axis/... instead of
  xaxis, the plugin picks the first one it sees.

- clearSelection( preventEvent )

  Clear the selection rectangle. Pass in true to avoid getting a
  "plotunselected" event.

- getSelection()

  Returns the current selection in the same format as the "plotselected"
  event. If there's currently no selection, the function returns null.

*/

import { plugins } from './plugin-registry.js';
import { uiConstants } from './jquery.flot.uiConstants.js';
import { color } from './jquery.colorhelpers.js';
import { trigger, unbind } from './helpers.js';

/** @typedef {'x' | 'y'} AxisDirection */
/** @typedef {'' | 'x' | 'y' | 'xy' | 'smart' | null} SelectionMode */
/** @typedef {{ x: number, y: number }} SelectionPosition */
/** @typedef {{ from: number, to: number }} SelectionRange */
/** @typedef {Record<string, SelectionRange>} SelectionResult */
/** @typedef {Record<string, SelectionRange | number | undefined>} SelectionRanges */

/**
 * @typedef {Object} SelectionState
 * @property {SelectionPosition} first
 * @property {SelectionPosition} second
 * @property {boolean} show
 * @property {SelectionMode} currentMode
 * @property {boolean} active
 */

/**
 * @typedef {Object} SelectionAxis
 * @property {AxisDirection} direction
 * @property {number} n
 * @property {boolean} used
 * @property {(value: number) => number} c2p
 * @property {(value: number) => number} p2c
 */

/**
 * @typedef {Object} SelectionOptions
 * @property {SelectionMode} mode
 * @property {'fill' | 'focus'} visualization
 * @property {boolean} displaySelectionDecorations
 * @property {string} color
 * @property {CanvasLineJoin} shape
 * @property {number} minSize
 */

/**
 * @typedef {Object} SelectionPlot
 * @property {() => HTMLElement} getPlaceholder
 * @property {() => { selection: SelectionOptions }} getOptions
 * @property {() => number} width
 * @property {() => number} height
 * @property {() => Record<string, SelectionAxis>} getAxes
 * @property {() => SelectionAxis[]} getXAxes
 * @property {() => SelectionAxis[]} getYAxes
 * @property {() => { left: number, right: number, top: number, bottom: number }} getPlotOffset
 * @property {() => void} triggerRedrawOverlay
 * @property {(
 *   event: string,
 *   handler: EventListener,
 *   eventHolder: HTMLElement,
 *   priority: number
 * ) => void} addEventHandler
 * @property {{
 *   bindEvents: Array<(plot: SelectionPlot, eventHolder: HTMLElement) => void>,
 *   drawOverlay: Array<(plot: SelectionPlot, ctx: CanvasRenderingContext2D) => void>,
 *   shutdown: Array<(plot: SelectionPlot, eventHolder: HTMLElement) => void>
 * }} hooks
 * @property {(preventEvent?: boolean) => void} [clearSelection]
 * @property {(ranges: SelectionRanges, preventEvent?: boolean) => void} [setSelection]
 * @property {() => SelectionResult | null} [getSelection]
 */

    /** @param {SelectionPlot} plot */
    function init(plot) {
        /** @type {SelectionState} */
        var selection = {
            first: {x: -1, y: -1},
            second: {x: -1, y: -1},
            show: false,
            currentMode: 'xy',
            active: false
        };

        var SNAPPING_CONSTANT = uiConstants.SNAPPING_CONSTANT;

        // FIXME: The drag handling implemented here should be
        // abstracted out, there's some similar code from a library in
        // the navigation plugin, this should be massaged a bit to fit
        // the Flot cases here better and reused. Doing this would
        // make this plugin much slimmer.
        /** @type {{ onselectstart?: Document['onselectstart'], ondrag?: Document['ondrag'] }} */
        var savedhandlers = {};

        /** @param {PointerEvent} e */
        function onDrag(e) {
            if (selection.active) {
                updateSelection(e);

                trigger(plot.getPlaceholder(), "plotselecting", [ getSelection() ]);
            }
        }

        /** @param {PointerEvent} e */
        function onDragStart(e) {
            var o = plot.getOptions();
            // only accept left-click
            if (e.button !== 0 || o.selection.mode === null) {
                return;
            }

            // reinitialize currentMode
            selection.currentMode = 'xy';

            // cancel out any text selections
            document.body.focus();

            // prevent text selection and drag in old-school browsers
            if (document.onselectstart !== undefined && savedhandlers.onselectstart == null) {
                savedhandlers.onselectstart = document.onselectstart;
                document.onselectstart = function () { return false; };
            }
            if (document.ondrag !== undefined && savedhandlers.ondrag == null) {
                savedhandlers.ondrag = document.ondrag;
                document.ondrag = function () { return false; };
            }

            setSelectionPos(selection.first, e);

            selection.active = true;
        }

        /** @param {PointerEvent} e */
        function onDragEnd(e) {
            // revert drag stuff for old-school browsers
            if (document.onselectstart !== undefined) {
                document.onselectstart = savedhandlers.onselectstart;
            }

            if (document.ondrag !== undefined) {
                document.ondrag = savedhandlers.ondrag;
            }

            // no more dragging
            selection.active = false;
            updateSelection(e);

            if (selectionIsSane()) {
                triggerSelectedEvent();
            } else {
                // this counts as a clear
                trigger(plot.getPlaceholder(), "plotunselected", [ ]);
                trigger(plot.getPlaceholder(), "plotselecting", [ null ]);
            }

            return false;
        }

        function getSelection() {
            if (!selectionIsSane()) {
                return null;
            }

            if (!selection.show) {
                return null;
            }

            /** @type {SelectionResult} */
            var r = {},
                c1 = {x: selection.first.x, y: selection.first.y},
                c2 = {x: selection.second.x, y: selection.second.y};

            if (selectionDirection(plot) === 'x') {
                c1.y = 0;
                c2.y = plot.height();
            }

            if (selectionDirection(plot) === 'y') {
                c1.x = 0;
                c2.x = plot.width();
            }

            var axes = plot.getAxes();
            Object.keys(axes).forEach(function (name) {
                var axis = axes[name];
                if (axis.used) {
                    var p1 = axis.c2p(c1[axis.direction]), p2 = axis.c2p(c2[axis.direction]);
                    r[name] = { from: Math.min(p1, p2), to: Math.max(p1, p2) };
                }
            });
            return r;
        }

        function triggerSelectedEvent() {
            var r = getSelection();
            if (r === null) {
                return;
            }

            trigger(plot.getPlaceholder(), "plotselected", [ r ]);

            // backwards-compat stuff, to be removed in future
            if (r.xaxis && r.yaxis) {
                trigger(plot.getPlaceholder(), "selected", [ { x1: r.xaxis.from, y1: r.yaxis.from, x2: r.xaxis.to, y2: r.yaxis.to } ]);
            }
        }

        /** @param {number} min @param {number} value @param {number} max */
        function clamp(min, value, max) {
            return value < min ? min : (value > max ? max : value);
        }

        /** @param {SelectionPlot} plot @returns {SelectionMode} */
        function selectionDirection(plot) {
            var o = plot.getOptions();

            if (o.selection.mode === 'smart') {
                return selection.currentMode;
            } else {
                return o.selection.mode;
            }
        }

        /** @param {SelectionPosition} pos */
        function updateMode(pos) {
            if (selection.first) {
                var delta = {
                    x: pos.x - selection.first.x,
                    y: pos.y - selection.first.y
                };

                if (Math.abs(delta.x) < SNAPPING_CONSTANT) {
                    selection.currentMode = 'y';
                } else if (Math.abs(delta.y) < SNAPPING_CONSTANT) {
                    selection.currentMode = 'x';
                } else {
                    selection.currentMode = 'xy';
                }
            }
        }

        /** @param {SelectionPosition} pos @param {Pick<PointerEvent, 'pageX' | 'pageY'>} e */
        function setSelectionPos(pos, e) {
            var placeholderRect = plot.getPlaceholder().getBoundingClientRect();
            var offset = { left: placeholderRect.left + window.scrollX, top: placeholderRect.top + window.scrollY };
            var plotOffset = plot.getPlotOffset();
            pos.x = clamp(0, e.pageX - offset.left - plotOffset.left, plot.width());
            pos.y = clamp(0, e.pageY - offset.top - plotOffset.top, plot.height());

            if (pos !== selection.first) {
                updateMode(pos);
            }

            if (selectionDirection(plot) === "y") {
                pos.x = pos === selection.first ? 0 : plot.width();
            }

            if (selectionDirection(plot) === "x") {
                pos.y = pos === selection.first ? 0 : plot.height();
            }
        }

        /** @param {PointerEvent} pos */
        function updateSelection(pos) {
            if (pos.pageX == null) {
                return;
            }

            setSelectionPos(selection.second, pos);
            if (selectionIsSane()) {
                selection.show = true;
                plot.triggerRedrawOverlay();
            } else {
                clearSelection(true);
            }
        }

        /** @param {boolean} [preventEvent] */
        function clearSelection(preventEvent) {
            if (selection.show) {
                selection.show = false;
                selection.currentMode = '';
                plot.triggerRedrawOverlay();
                if (!preventEvent) {
                    trigger(plot.getPlaceholder(), "plotunselected", [ ]);
                }
            }
        }

        // function taken from markings support in Flot
        /** @param {SelectionRanges} ranges @param {AxisDirection} coord */
        function extractRange(ranges, coord) {
            /** @type {SelectionAxis | undefined} */
            var axis;
            /** @type {number | undefined} */
            var from;
            /** @type {number | undefined} */
            var to;
            /** @type {string | undefined} */
            var key;
            var axes = plot.getAxes();

            for (var k in axes) {
                var currentAxis = axes[k];
                if (currentAxis.direction === coord) {
                    axis = currentAxis;
                    key = coord + axis.n + "axis";
                    if (!ranges[key] && axis.n === 1) {
                        // support x1axis as xaxis
                        key = coord + "axis";
                    }

                    var range = ranges[key];
                    if (range && typeof range === 'object') {
                        from = range.from;
                        to = range.to;
                        break;
                    }
                }
            }

            // backwards-compat stuff - to be removed in future
            if (key && !ranges[key]) {
                axis = coord === "x" ? plot.getXAxes()[0] : plot.getYAxes()[0];
                var legacyFrom = ranges[coord + "1"];
                var legacyTo = ranges[coord + "2"];
                from = typeof legacyFrom === 'number' ? legacyFrom : undefined;
                to = typeof legacyTo === 'number' ? legacyTo : undefined;
            }

            // auto-reverse as an added bonus
            if (from != null && to != null && from > to) {
                var tmp = from;
                from = to;
                to = tmp;
            }

            if (!axis || from == null || to == null) {
                throw new Error('Selection ranges must include values for the selected axes.');
            }

            return { from: from, to: to, axis: axis };
        }

        /** @param {SelectionRanges} ranges @param {boolean} [preventEvent] */
        function setSelection(ranges, preventEvent) {
            var range;

            if (selectionDirection(plot) === "y") {
                selection.first.x = 0;
                selection.second.x = plot.width();
            } else {
                range = extractRange(ranges, "x");
                selection.first.x = range.axis.p2c(range.from);
                selection.second.x = range.axis.p2c(range.to);
            }

            if (selectionDirection(plot) === "x") {
                selection.first.y = 0;
                selection.second.y = plot.height();
            } else {
                range = extractRange(ranges, "y");
                selection.first.y = range.axis.p2c(range.from);
                selection.second.y = range.axis.p2c(range.to);
            }

            selection.show = true;
            plot.triggerRedrawOverlay();
            if (!preventEvent && selectionIsSane()) {
                triggerSelectedEvent();
            }
        }

        function selectionIsSane() {
            var minSize = plot.getOptions().selection.minSize;
            return Math.abs(selection.second.x - selection.first.x) >= minSize &&
                Math.abs(selection.second.y - selection.first.y) >= minSize;
        }

        plot.clearSelection = clearSelection;
        plot.setSelection = setSelection;
        plot.getSelection = getSelection;

        /** @param {Event} e */
        function onPointerDown(e) {
            if (!(e instanceof PointerEvent)) {
                return;
            }
            if (e.button !== 0) {
                return;
            }
            const el = e.currentTarget;
            if (!(el instanceof HTMLElement)) {
                return;
            }
            /** @type {HTMLElement} */
            const eventHolder = el;
            onDragStart(e);

            /** @param {Event} e */
            function onPointerMove(e) {
                if (!(e instanceof PointerEvent)) {
                    return;
                }
                onDrag(e);
            }

            /** @param {Event} e */
            function onPointerUp(e) {
                if (!(e instanceof PointerEvent)) {
                    return;
                }
                onDragEnd(e);
                eventHolder.removeEventListener("pointermove", onPointerMove);
                eventHolder.removeEventListener("pointerup", onPointerUp);
                eventHolder.removeEventListener("pointercancel", onPointerUp);
                eventHolder.releasePointerCapture(e.pointerId);
            }

            eventHolder.setPointerCapture(e.pointerId);
            eventHolder.addEventListener("pointermove", onPointerMove);
            eventHolder.addEventListener("pointerup", onPointerUp);
            eventHolder.addEventListener("pointercancel", onPointerUp);
        }

        plot.hooks.bindEvents.push(function(plot, eventHolder) {
            var o = plot.getOptions();
            if (o.selection.mode != null) {
                plot.addEventHandler("pointerdown", onPointerDown, eventHolder, 0);
            }
        });

        /**
         * @param {CanvasRenderingContext2D} ctx Overlay context translated to the plot origin.
         * @param {number} x Left edge of the rendered selection, in plot pixels.
         * @param {number} y Top edge of the rendered selection, in plot pixels.
         * @param {number} width Width of the rendered selection, in plot pixels.
         * @param {number} height Height of the rendered selection, in plot pixels.
         * @param {number} unexpandedX Left edge before a y-only selection expands to full width.
         * @param {number} unexpandedY Top edge before an x-only selection expands to full height.
         * @param {SelectionMode} mode Axes selected by the drag gesture.
         */
        function drawSelectionDecorations(ctx, x, y, width, height, unexpandedX, unexpandedY, mode) {
            var spacing = 3;
            var fullEarWidth = 15;
            var earWidth = Math.max(0, Math.min(fullEarWidth, width / 2 - 2, height / 2 - 2));
            ctx.fillStyle = '#ffffff';

            if (mode === 'xy') {
                ctx.beginPath();
                ctx.moveTo(x, y + earWidth);
                ctx.lineTo(x - 3, y + earWidth);
                ctx.lineTo(x - 3, y - 3);
                ctx.lineTo(x + earWidth, y - 3);
                ctx.lineTo(x + earWidth, y);
                ctx.lineTo(x, y);
                ctx.closePath();

                ctx.moveTo(x, y + height - earWidth);
                ctx.lineTo(x - 3, y + height - earWidth);
                ctx.lineTo(x - 3, y + height + 3);
                ctx.lineTo(x + earWidth, y + height + 3);
                ctx.lineTo(x + earWidth, y + height);
                ctx.lineTo(x, y + height);
                ctx.closePath();

                ctx.moveTo(x + width, y + earWidth);
                ctx.lineTo(x + width + 3, y + earWidth);
                ctx.lineTo(x + width + 3, y - 3);
                ctx.lineTo(x + width - earWidth, y - 3);
                ctx.lineTo(x + width - earWidth, y);
                ctx.lineTo(x + width, y);
                ctx.closePath();

                ctx.moveTo(x + width, y + height - earWidth);
                ctx.lineTo(x + width + 3, y + height - earWidth);
                ctx.lineTo(x + width + 3, y + height + 3);
                ctx.lineTo(x + width - earWidth, y + height + 3);
                ctx.lineTo(x + width - earWidth, y + height);
                ctx.lineTo(x + width, y + height);
                ctx.closePath();

                ctx.stroke();
                ctx.fill();
            }

            x = unexpandedX;
            y = unexpandedY;

            if (mode === 'x') {
                ctx.beginPath();
                ctx.moveTo(x, y + fullEarWidth);
                ctx.lineTo(x, y - fullEarWidth);
                ctx.lineTo(x - spacing, y - fullEarWidth);
                ctx.lineTo(x - spacing, y + fullEarWidth);
                ctx.closePath();

                ctx.moveTo(x + width, y + fullEarWidth);
                ctx.lineTo(x + width, y - fullEarWidth);
                ctx.lineTo(x + width + spacing, y - fullEarWidth);
                ctx.lineTo(x + width + spacing, y + fullEarWidth);
                ctx.closePath();
                ctx.stroke();
                ctx.fill();
            }

            if (mode === 'y') {
                ctx.beginPath();

                ctx.moveTo(x - fullEarWidth, y);
                ctx.lineTo(x + fullEarWidth, y);
                ctx.lineTo(x + fullEarWidth, y - spacing);
                ctx.lineTo(x - fullEarWidth, y - spacing);
                ctx.closePath();

                ctx.moveTo(x - fullEarWidth, y + height);
                ctx.lineTo(x + fullEarWidth, y + height);
                ctx.lineTo(x + fullEarWidth, y + height + spacing);
                ctx.lineTo(x - fullEarWidth, y + height + spacing);
                ctx.closePath();
                ctx.stroke();
                ctx.fill();
            }
        }

        plot.hooks.drawOverlay.push(function (plot, ctx) {
            // draw selection
            if (selection.show && selectionIsSane()) {
                var plotOffset = plot.getPlotOffset();
                var o = plot.getOptions();

                ctx.save();
                ctx.translate(plotOffset.left, plotOffset.top);

                var c = color.parse(o.selection.color);
                var visualization = o.selection.visualization;
                var displaySelectionDecorations = o.selection.displaySelectionDecorations;

                var scalingFactor = 1;

                // use a dimmer scaling factor if visualization is "fill"
                if (visualization === "fill") {
                    scalingFactor = 0.8;
                }

                ctx.strokeStyle = c.scale('a', scalingFactor).toString();
                ctx.lineWidth = 1;
                ctx.lineJoin = o.selection.shape;
                ctx.fillStyle = c.scale('a', 0.4).toString();

                var x = Math.min(selection.first.x, selection.second.x) + 0.5,
                    oX = x,
                    y = Math.min(selection.first.y, selection.second.y) + 0.5,
                    oY = y,
                    w = Math.abs(selection.second.x - selection.first.x) - 1,
                    h = Math.abs(selection.second.y - selection.first.y) - 1;

                if (selectionDirection(plot) === 'x') {
                    h += y;
                    y = 0;
                }

                if (selectionDirection(plot) === 'y') {
                    w += x;
                    x = 0;
                }

                if (visualization === "fill") {
                    ctx.fillRect(x, y, w, h);
                    ctx.strokeRect(x, y, w, h);
                } else {
                    ctx.fillRect(0, 0, plot.width(), plot.height());
                    ctx.clearRect(x, y, w, h);

                    if (displaySelectionDecorations) {
                        drawSelectionDecorations(ctx, x, y, w, h, oX, oY, selectionDirection(plot));
                    }
                }

                ctx.restore();
            }
        });

        plot.hooks.shutdown.push(function (plot, eventHolder) {
            unbind(eventHolder, "pointerdown", onPointerDown);
        });
    }

    plugins.push({
        init: init,
        options: {
            selection: {
                mode: null, // one of null, "x", "y" or "xy"
                visualization: "focus", // "focus" or "fill"
                displaySelectionDecorations: true, // true or false (currently only relevant for the focus visualization)
                color: "#888888",
                shape: "round", // one of "round", "miter", or "bevel"
                minSize: 5 // minimum number of pixels
            }
        },
        name: 'selection',
        version: '1.1'
    });
