/* Flot plugin for adding the ability to pan and zoom the plot.

Copyright (c) 2007-2014 IOLA and Ole Laursen.
Copyright (c) 2016 Ciprian Ceteras.
Copyright (c) 2017 Raluca Portase.
Licensed under the MIT license.

*/

/**
## jquery.flot.navigate.js

This flot plugin is used for adding the ability to pan and zoom the plot.
A higher level overview is available at [interactions](interactions.md) documentation.

The default behaviour is scrollwheel up/down to zoom in, drag
to pan. The plugin defines plot.zoom({ center }), plot.zoomOut() and
plot.pan( offset ) so you easily can add custom controls. It also fires
"plotpan" and "plotzoom" events, useful for synchronizing plots.

The plugin supports these options:
```js
    zoom: {
        interactive: false,
        active: false,
        amount: 1.5         // 2 = 200% (zoom in), 0.5 = 50% (zoom out)
    }

    pan: {
        interactive: false,
        active: false,
        cursor: "move",     // CSS mouse cursor value used when dragging, e.g. "pointer"
        frameRate: 60,
        mode: "smart"       // enable smart pan mode
    }

    xaxis: {
        axisZoom: true, //zoom axis when mouse over it is allowed
        plotZoom: true, //zoom axis is allowed for plot zoom
        axisPan: true, //pan axis when mouse over it is allowed
        plotPan: true, //pan axis is allowed for plot pan
        panRange: [undefined, undefined], // no limit on pan range, or [min, max] in axis units
        zoomRange: [undefined, undefined], // no limit on zoom range, or [closest zoom, furthest zoom] in axis units
    }

    yaxis: {
        axisZoom: true, //zoom axis when mouse over it is allowed
        plotZoom: true, //zoom axis is allowed for plot zoom
        axisPan: true, //pan axis when mouse over it is allowed
        plotPan: true //pan axis is allowed for plot pan
        panRange: [undefined, undefined], // no limit on pan range, or [min, max] in axis units
        zoomRange: [undefined, undefined], // no limit on zoom range, or [closest zoom, furthest zoom] in axis units
    }
```
**interactive** enables the built-in drag/click behaviour. If you enable
interactive for pan, then you'll have a basic plot that supports moving
around; the same for zoom.

**active** is true after a touch tap on plot. This enables plot navigation.
Once activated, zoom and pan cannot be deactivated. When the plot becomes active,
"plotactivated" event is triggered.

**amount** specifies the default amount to zoom in (so 1.5 = 150%) relative to
the current viewport.

**cursor** is a standard CSS mouse cursor string used for visual feedback to the
user when dragging.

**frameRate** specifies the maximum number of times per second the plot will
update itself while the user is panning around on it (set to null to disable
intermediate pans, the plot will then not update until the mouse button is
released).

**mode** a string specifies the pan mode for mouse interaction. Accepted values:
'manual': no pan hint or direction snapping;
'smart': The graph shows pan hint bar and the pan movement will snap
to one direction when the drag direction is close to it;
'smartLock'. The graph shows pan hint bar and the pan movement will always
snap to a direction that the drag diorection started with.

Example API usage:
```js
    plot = $.plot(...);

    // zoom default amount in on the pixel ( 10, 20 )
    plot.zoom({ center: { left: 10, top: 20 } });

    // zoom out again
    plot.zoomOut({ center: { left: 10, top: 20 } });

    // zoom 200% in on the pixel (10, 20)
    plot.zoom({ amount: 2, center: { left: 10, top: 20 } });

    // pan 100 pixels to the left (changing x-range in a positive way) and 20 down
    plot.pan({ left: -100, top: 20 })
```

Here, "center" specifies where the center of the zooming should happen. Note
that this is defined in pixel space, not the space of the data points (you can
use the p2c helpers on the axes in Flot to help you convert between these).

**amount** is the amount to zoom the viewport relative to the current range, so
1 is 100% (i.e. no change), 1.5 is 150% (zoom in), 0.7 is 70% (zoom out). You
can set the default in the options.
*/

/* eslint-enable */
import { plugins } from './plugin-registry.js';
import { saturated } from './jquery.flot.saturated.js';
import { browser } from './jquery.flot.browser.js';
import { uiConstants } from './jquery.flot.uiConstants.js';
import { bind, unbind, trigger, css } from './helpers.js';

/** @typedef {'x' | 'y'} AxisDirection */
/** @typedef {'manual' | 'smart' | 'smartLock'} PanMode */
/** @typedef {{ x: number, y: number }} PixelDelta */
/** @typedef {{ left: number, top: number }} PlotPoint */
/** @typedef {{ left: number, top: number }} PlotPageOffset */
/** @typedef {{ left: number, right: number, top: number, bottom: number }} PlotOffset */
/** @typedef {[number | undefined, number | undefined]} AxisRange */

/**
 * @typedef {Object} NavigationAxisOptions
 * @property {boolean} axisZoom
 * @property {boolean} plotZoom
 * @property {boolean} axisPan
 * @property {boolean} plotPan
 * @property {AxisRange} panRange
 * @property {AxisRange} zoomRange
 * @property {{ below?: number, above?: number }} offset
 */

/**
 * @typedef {Object} NavigationAxis
 * @property {AxisDirection} direction
 * @property {number} min
 * @property {number} max
 * @property {{ left: number, top: number, width: number, height: number }} [box]
 * @property {NavigationAxisOptions} options
 * @property {(value: number | undefined) => number} p2c
 * @property {(value: number) => number} c2p
 */

/** @typedef {NavigationAxis[] | Record<string, NavigationAxis>} AxisCollection */

/**
 * @typedef {Object} NavigationOptions
 * @property {{ interactive: boolean, active: boolean, amount: number }} zoom
 * @property {{ interactive: boolean, active: boolean, cursor: string, frameRate: number | null, mode: PanMode }} pan
 * @property {{ interactive: boolean }} recenter
 * @property {Omit<NavigationAxisOptions, 'offset'>} xaxis
 * @property {Omit<NavigationAxisOptions, 'offset'>} yaxis
 */

/**
 * @typedef {Object} NavigationAxisState
 * @property {{ below: number, above: number }} navigationOffset
 * @property {number} axisMin
 * @property {number} axisMax
 * @property {boolean} diagMode
 */

/**
 * @typedef {{ startPageX: number, startPageY: number, diagMode?: boolean }
 *   & Record<string, NavigationAxisState | number | boolean>} NavigationState
 */

/** @typedef {{ amount?: number | null, center?: PlotPoint, axes?: AxisCollection, preventEvent?: boolean }} ZoomArguments */
/** @typedef {{ left: number, top: number, axes?: AxisCollection | null, preventEvent?: boolean }} PanArguments */
/** @typedef {{ axes?: AxisCollection | null }} RecenterArguments */
/** @typedef {{ start: PixelDelta, end: PixelDelta | false }} PanHint */
/** @typedef {((delta: PixelDelta, initialState: NavigationState, panAxes?: AxisCollection | null, preventEvent?: boolean, smartLock?: boolean) => void) & { end: () => void }} SmartPan */

/**
 * @typedef {Object} NavigationPlot
 * @property {() => NavigationOptions} getOptions
 * @property {() => HTMLElement} getPlaceholder
 * @property {() => PlotPageOffset} offset
 * @property {() => PlotOffset} getPlotOffset
 * @property {() => number} width
 * @property {() => number} height
 * @property {() => Record<string, NavigationAxis>} getAxes
 * @property {() => NavigationAxis[]} getXAxes
 * @property {() => NavigationAxis[]} getYAxes
 * @property {(redraw?: boolean) => void} setupGrid
 * @property {() => void} draw
 * @property {() => void} triggerRedrawOverlay
 * @property {() => void} activate
 * @property {(args?: ZoomArguments) => void} zoom
 * @property {(args?: ZoomArguments) => void} zoomOut
 * @property {(args: PanArguments) => void} pan
 * @property {(args: RecenterArguments) => void} recenter
 * @property {SmartPan} smartPan
 * @property {(startPageX?: number, startPageY?: number) => NavigationState} navigationState
 * @property {(touchPointX: number, touchPointY: number) => NavigationAxis[]} getTouchedAxis
 * @property {{
 *   processOptions: Array<(plot: NavigationPlot, options: NavigationOptions) => void>,
 *   bindEvents: Array<(plot: NavigationPlot, eventHolder: HTMLElement) => void>,
 *   shutdown: Array<(plot: NavigationPlot, eventHolder: HTMLElement) => void>,
 *   drawOverlay: Array<(plot: NavigationPlot, ctx: CanvasRenderingContext2D) => void>
 * }} hooks
 */

    'use strict';

    /** @type {NavigationOptions} */
    var options = {
        zoom: {
            interactive: false,
            active: false,
            amount: 1.5 // how much to zoom relative to current position, 2 = 200% (zoom in), 0.5 = 50% (zoom out)
        },
        pan: {
            interactive: false,
            active: false,
            cursor: "move",
            frameRate: 60,
            mode: 'smart'
        },
        recenter: {
            interactive: true
        },
        xaxis: {
            axisZoom: true, //zoom axis when mouse over it is allowed
            plotZoom: true, //zoom axis is allowed for plot zoom
            axisPan: true, //pan axis when mouse over it is allowed
            plotPan: true, //pan axis is allowed for plot pan
            panRange: [undefined, undefined], // no limit on pan range, or [min, max] in axis units
            zoomRange: [undefined, undefined] // no limit on zoom range, or [closest zoom, furthest zoom] in axis units
        },
        yaxis: {
            axisZoom: true,
            plotZoom: true,
            axisPan: true,
            plotPan: true,
            panRange: [undefined, undefined], // no limit on pan range, or [min, max] in axis units
            zoomRange: [undefined, undefined] // no limit on zoom range, or [closest zoom, furthest zoom] in axis units
        }
    };

    var SNAPPING_CONSTANT = uiConstants.SNAPPING_CONSTANT;
    var PANHINT_LENGTH_CONSTANT = uiConstants.PANHINT_LENGTH_CONSTANT;

    /** @param {NavigationPlot} plot */
    function init(plot) {
        plot.hooks.processOptions.push(initNevigation);
    }

    /** @param {NavigationPlot} plot @param {NavigationOptions} options */
    function initNevigation(plot, options) {
        /** @type {NavigationAxis[] | null | undefined} */
        var panAxes = null;
        /** @type {HTMLElement} */
        var navigationEventHolder;
        var canDrag = false;
        var useManualPan = options.pan.mode === 'manual',
            smartPanLock = options.pan.mode === 'smartLock',
            useSmartPan = smartPanLock || options.pan.mode === 'smart';

        /** @param {MouseEvent} e @param {boolean} zoomOut @param {number | null} amount */
        function onZoomClick(e, zoomOut, amount) {
            var page = browser.getPageXY(e);

            var c = plot.offset();
            c.left = page.X - c.left;
            c.top = page.Y - c.top;

            var placeholderRect = plot.getPlaceholder().getBoundingClientRect();
            var ec = { left: placeholderRect.left + window.scrollX, top: placeholderRect.top + window.scrollY };
            ec.left = page.X - ec.left;
            ec.top = page.Y - ec.top;

            var axes = plot.getXAxes().concat(plot.getYAxes()).filter(function (axis) {
                var box = axis.box;
                if (box !== undefined) {
                    return (ec.left > box.left) && (ec.left < box.left + box.width) &&
                        (ec.top > box.top) && (ec.top < box.top + box.height);
                }
                return false;
            });

            if (axes.length === 0) {
                axes = undefined;
            }

            if (zoomOut) {
                plot.zoomOut({
                    center: c,
                    axes: axes,
                    amount: amount
                });
            } else {
                plot.zoom({
                    center: c,
                    axes: axes,
                    amount: amount
                });
            }
        }

        var prevCursor = 'default',
            /** @type {PanHint | null} */
            panHint = null,
            /** @type {ReturnType<typeof setTimeout> | null} */
            panTimeout = null,
            /** @type {NavigationState} */
            plotState,
            prevDragPosition = { x: 0, y: 0 },
            isPanAction = false;

        /** @param {Event} e */
        function onMouseWheel(e) {
            if (!(e instanceof WheelEvent)) {
                return undefined;
            }
            var delta = -e.deltaY;
            var maxAbsoluteDeltaOnMac = 1,
                isMacScroll = Math.abs(e.deltaY) <= maxAbsoluteDeltaOnMac,
                defaultNonMacScrollAmount = null,
                macMagicRatio = 50,
                amount = isMacScroll ? 1 + Math.abs(e.deltaY) / macMagicRatio : defaultNonMacScrollAmount;

            if (isPanAction) {
                onDragEnd(e);
            }

            if (plot.getOptions().zoom.active) {
                e.preventDefault();
                onZoomClick(e, delta < 0, amount);
                return false;
            }
            return undefined;
        }

        plot.navigationState = function(startPageX, startPageY) {
            var axes = this.getAxes();
            /** @type {NavigationState} */
            var result = { startPageX: startPageX || 0, startPageY: startPageY || 0 };
            Object.keys(axes).forEach(function(axisName) {
                var axis = axes[axisName];
                result[axisName] = {
                    navigationOffset: { below: axis.options.offset.below || 0,
                        above: axis.options.offset.above || 0},
                    axisMin: axis.min,
                    axisMax: axis.max,
                    diagMode: false
                }
            });

            return result;
        }

        /** @param {MouseEvent} e */
        function onDragStart(e) {

            isPanAction = true;
            var page = browser.getPageXY(e);

            var placeholderRect = plot.getPlaceholder().getBoundingClientRect();
            var ec = { left: placeholderRect.left + window.scrollX, top: placeholderRect.top + window.scrollY };
            ec.left = page.X - ec.left;
            ec.top = page.Y - ec.top;

            panAxes = plot.getXAxes().concat(plot.getYAxes()).filter(function (axis) {
                var box = axis.box;
                if (box !== undefined) {
                    return (ec.left > box.left) && (ec.left < box.left + box.width) &&
                        (ec.top > box.top) && (ec.top < box.top + box.height);
                }
                return false;
            });

            if (panAxes.length === 0) {
                panAxes = undefined;
            }

            var c = css(plot.getPlaceholder(), 'cursor');
            if (c) {
                prevCursor = c;
            }

            css(plot.getPlaceholder(), 'cursor', plot.getOptions().pan.cursor);

            if (useSmartPan) {
                plotState = plot.navigationState(page.X, page.Y);
            } else if (useManualPan) {
                prevDragPosition.x = page.X;
                prevDragPosition.y = page.Y;
            }
        }

        /** @param {MouseEvent} e */
        function onDrag(e) {
            if (!isPanAction) {
                return;
            }

            var page = browser.getPageXY(e);
            var frameRate = plot.getOptions().pan.frameRate;

            if (frameRate === -1) {
                if (useSmartPan) {
                    plot.smartPan({
                        x: plotState.startPageX - page.X,
                        y: plotState.startPageY - page.Y
                    }, plotState, panAxes, false, smartPanLock);
                } else if (useManualPan) {
                    plot.pan({
                        left: prevDragPosition.x - page.X,
                        top: prevDragPosition.y - page.Y,
                        axes: panAxes
                    });
                    prevDragPosition.x = page.X;
                    prevDragPosition.y = page.Y;
                }
                return;
            }

            if (panTimeout || !frameRate) {
                return;
            }

            panTimeout = window.setTimeout(function() {
                if (useSmartPan) {
                    plot.smartPan({
                        x: plotState.startPageX - page.X,
                        y: plotState.startPageY - page.Y
                    }, plotState, panAxes, false, smartPanLock);
                } else if (useManualPan) {
                    plot.pan({
                        left: prevDragPosition.x - page.X,
                        top: prevDragPosition.y - page.Y,
                        axes: panAxes
                    });
                    prevDragPosition.x = page.X;
                    prevDragPosition.y = page.Y;
                }

                panTimeout = null;
            }, 1 / frameRate * 1000);
        }

        /** @param {MouseEvent} e */
        function onDragEnd(e) {
            if (!isPanAction) {
                return;
            }

            if (panTimeout) {
                window.clearTimeout(panTimeout);
                panTimeout = null;
            }

            isPanAction = false;
            var page = browser.getPageXY(e);

            css(plot.getPlaceholder(), 'cursor', prevCursor);

            if (useSmartPan) {
                plot.smartPan({
                    x: plotState.startPageX - page.X,
                    y: plotState.startPageY - page.Y
                }, plotState, panAxes, false, smartPanLock);
                plot.smartPan.end();
            } else if (useManualPan) {
                plot.pan({
                    left: prevDragPosition.x - page.X,
                    top: prevDragPosition.y - page.Y,
                    axes: panAxes
                });
                prevDragPosition.x = 0;
                prevDragPosition.y = 0;
            }
        }

        /** @param {Event} e */
        function onDblClick(e) {
            if (!(e instanceof MouseEvent)) {
                return;
            }
            plot.activate();
            var o = plot.getOptions()

            if (!o.recenter.interactive) {
                return;
            }

            var axes = plot.getTouchedAxis(e.clientX, e.clientY);

            plot.recenter({ axes: axes[0] ? axes : null });

            if (axes[0]) {
                trigger(plot.getPlaceholder(), 're-center', { axisTouched: axes[0] });
            } else {
                trigger(plot.getPlaceholder(), 're-center', e);
            }
        }

        /** @param {Event} e */
        function onClick(e) {
            if (!(e instanceof MouseEvent)) {
                return undefined;
            }
            plot.activate();

            if (isPanAction) {
                onDragEnd(e);
            }

            return false;
        }

        plot.activate = function() {
            var o = plot.getOptions();
            if (!o.pan.active || !o.zoom.active) {
                o.pan.active = true;
                o.zoom.active = true;
                trigger(plot.getPlaceholder(), "plotactivated", [plot]);
            }
        }

        /** @param {Event} e */
        function onPointerDown(e) {
            if (!(e instanceof PointerEvent)) {
                return;
            }
            if (e.button !== 0) {
                return;
            }
            var el = navigationEventHolder;
            canDrag = true;
            onDragStart(e);

            /** @param {PointerEvent} e */
            function onPointerMove(e) {
                onDrag(e);
            }

            /** @param {PointerEvent} e */
            function onPointerUp(e) {
                onDragEnd(e);
                canDrag = false;
                el.removeEventListener("pointermove", onPointerMove);
                el.removeEventListener("pointerup", onPointerUp);
                el.removeEventListener("pointercancel", onPointerUp);
                el.releasePointerCapture(e.pointerId);
            }

            el.setPointerCapture(e.pointerId);
            el.addEventListener("pointermove", onPointerMove);
            el.addEventListener("pointerup", onPointerUp);
            el.addEventListener("pointercancel", onPointerUp);
        }

        /** @param {NavigationPlot} plot @param {HTMLElement} eventHolder */
        function bindEvents(plot, eventHolder) {
            navigationEventHolder = eventHolder;
            var o = plot.getOptions();
            if (o.zoom.interactive) {
                bind(eventHolder, "wheel", onMouseWheel);
            }

            if (o.pan.interactive) {
                bind(eventHolder, "pointerdown", onPointerDown);
            }

            bind(eventHolder, "dblclick", onDblClick);
            bind(eventHolder, "click", onClick);
        }

        /** @param {ZoomArguments} [args] */
        plot.zoomOut = function(args) {
            if (!args) {
                args = {};
            }

            if (!args.amount) {
                args.amount = plot.getOptions().zoom.amount;
            }

            args.amount = 1 / args.amount;
            plot.zoom(args);
        };

        /** @param {ZoomArguments} [args] */
        plot.zoom = function(args) {
            if (!args) {
                args = {};
            }

            var c = args.center,
                amount = args.amount || plot.getOptions().zoom.amount,
                w = plot.width(),
                h = plot.height(),
                axes = args.axes || plot.getAxes();

            if (!c) {
                c = {
                    left: w / 2,
                    top: h / 2
                };
            }

            var xf = c.left / w,
                yf = c.top / h,
                minmax = {
                    x: {
                        min: c.left - xf * w / amount,
                        max: c.left + (1 - xf) * w / amount
                    },
                    y: {
                        min: c.top - yf * h / amount,
                        max: c.top + (1 - yf) * h / amount
                    }
                };

            Object.values(axes).forEach(function(axis) {
                var
                    opts = axis.options,
                    min = minmax[axis.direction].min,
                    max = minmax[axis.direction].max,
                    navigationOffset = axis.options.offset;

                //skip axis without axisZoom when zooming only on certain axis or axis without plotZoom for zoom on entire plot
                if ((!opts.axisZoom && args.axes) || (!args.axes && !opts.plotZoom)) {
                    return;
                }

                min = saturated.saturate(axis.c2p(min));
                max = saturated.saturate(axis.c2p(max));
                if (min > max) {
                    // make sure min < max
                    var tmp = min;
                    min = max;
                    max = tmp;
                }

                // test for zoom limits zoomRange: [min,max]
                if (opts.zoomRange) {
                    // zoomed in too far
                    if (max - min < opts.zoomRange[0]) {
                        return;
                    }
                    // zoomed out to far
                    if (max - min > opts.zoomRange[1]) {
                        return;
                    }
                }

                var offsetBelow = saturated.saturate(navigationOffset.below - (axis.min - min));
                var offsetAbove = saturated.saturate(navigationOffset.above - (axis.max - max));
                opts.offset = { below: offsetBelow, above: offsetAbove };
            });

            plot.setupGrid(true);
            plot.draw();

            if (!args.preventEvent) {
                trigger(plot.getPlaceholder(), "plotzoom", [plot, args]);
            }
        };

        /** @param {PanArguments} args */
        plot.pan = function(args) {
            var delta = {
                x: +args.left,
                y: +args.top
            };

            if (isNaN(delta.x)) {
                delta.x = 0;
            }
            if (isNaN(delta.y)) {
                delta.y = 0;
            }

            var panAxesOrAll = args.axes || plot.getAxes();
            Object.values(panAxesOrAll).forEach(function(axis) {
                var opts = axis.options,
                    d = delta[axis.direction];

                //skip axis without axisPan when panning only on certain axis or axis without plotPan for pan the entire plot
                if ((!opts.axisPan && args.axes) || (!opts.plotPan && !args.axes)) {
                    return;
                }

                // calc min delta (revealing left edge of plot)
                var minD = axis.p2c(opts.panRange[0]) - axis.p2c(axis.min);
                // calc max delta (revealing right edge of plot)
                var maxD = axis.p2c(opts.panRange[1]) - axis.p2c(axis.max);
                // For the y-axis, screen coordinates are inverted
                // (p2c(smaller v) > p2c(larger v)), so minD/maxD end up
                // with the opposite signs from the x-axis case. Swap
                // them so the clamp comparisons below keep their
                // x-axis semantics. Upstream flot/flot#1789, ports the
                // minimal form of PR #1793.
                if (axis.direction === 'y') {
                    var swap = minD;
                    minD = maxD;
                    maxD = swap;
                }
                // limit delta to min or max if enabled
                if (opts.panRange[0] !== undefined && d >= maxD) {
                    d = maxD;
                }
                if (opts.panRange[1] !== undefined && d <= minD) {
                    d = minD;
                }

                if (d !== 0) {
                    var navigationOffsetBelow = saturated.saturate(axis.c2p(axis.p2c(axis.min) + d) - axis.c2p(axis.p2c(axis.min))),
                        navigationOffsetAbove = saturated.saturate(axis.c2p(axis.p2c(axis.max) + d) - axis.c2p(axis.p2c(axis.max)));

                    if (!isFinite(navigationOffsetBelow)) {
                        navigationOffsetBelow = 0;
                    }

                    if (!isFinite(navigationOffsetAbove)) {
                        navigationOffsetAbove = 0;
                    }

                    opts.offset = {
                        below: saturated.saturate(navigationOffsetBelow + (opts.offset.below || 0)),
                        above: saturated.saturate(navigationOffsetAbove + (opts.offset.above || 0))
                    };
                }
            });

            plot.setupGrid(true);
            plot.draw();
            if (!args.preventEvent) {
                trigger(plot.getPlaceholder(), "plotpan", [plot, args]);
            }
        };

        /** @param {RecenterArguments} args */
        plot.recenter = function(args) {
            var recenterAxes = args.axes || plot.getAxes();
            Object.values(recenterAxes).forEach(function(axis) {
                if (args.axes) {
                    if (axis.direction === 'x') {
                        axis.options.offset = { below: 0 };
                    } else if (axis.direction === 'y') {
                        axis.options.offset = { above: 0 };
                    }
                } else {
                    axis.options.offset = { below: 0, above: 0 };
                }
            });
            plot.setupGrid(true);
            plot.draw();
        };

        /** @param {PixelDelta} delta */
        var shouldSnap = function(delta) {
            return (Math.abs(delta.y) < SNAPPING_CONSTANT && Math.abs(delta.x) >= SNAPPING_CONSTANT) ||
                (Math.abs(delta.x) < SNAPPING_CONSTANT && Math.abs(delta.y) >= SNAPPING_CONSTANT);
        }

        // adjust delta so the pan action is constrained on the vertical or horizontal direction
        // it the movements in the other direction are small
        /** @param {PixelDelta} delta */
        var adjustDeltaToSnap = function(delta) {
            if (Math.abs(delta.x) < SNAPPING_CONSTANT && Math.abs(delta.y) >= SNAPPING_CONSTANT) {
                return {x: 0, y: delta.y};
            }

            if (Math.abs(delta.y) < SNAPPING_CONSTANT && Math.abs(delta.x) >= SNAPPING_CONSTANT) {
                return {x: delta.x, y: 0};
            }

            return delta;
        }

        /** @type {AxisDirection | null} */
        var lockedDirection = null;
        /** @param {PixelDelta} delta */
        var lockDeltaDirection = function(delta) {
            if (!lockedDirection && Math.max(Math.abs(delta.x), Math.abs(delta.y)) >= SNAPPING_CONSTANT) {
                lockedDirection = Math.abs(delta.x) < Math.abs(delta.y) ? 'y' : 'x';
            }

            switch (lockedDirection) {
                case 'x':
                    return { x: delta.x, y: 0 };
                case 'y':
                    return { x: 0, y: delta.y };
                default:
                    return { x: 0, y: 0 };
            }
        }

        /** @param {PixelDelta} delta */
        var isDiagonalMode = function(delta) {
            if (Math.abs(delta.x) > 0 && Math.abs(delta.y) > 0) {
                return true;
            }
            return false;
        }

        /** @param {AxisCollection} axes @param {NavigationState} initialState @param {PixelDelta} delta */
        var restoreAxisOffset = function(axes, initialState, delta) {
            Object.entries(axes).forEach(function(entry) {
                var axisName = entry[0], axis = entry[1];
                if (delta[axis.direction] === 0) {
                    var axisState = initialState[axisName];
                    if (typeof axisState !== 'object') {
                        return;
                    }
                    axis.options.offset.below = axisState.navigationOffset.below;
                    axis.options.offset.above = axisState.navigationOffset.above;
                }
            });
        }

        var prevDelta = { x: 0, y: 0 };
        /**
         * @param {PixelDelta} delta
         * @param {NavigationState} initialState
         * @param {AxisCollection | null} [panAxes]
         * @param {boolean} [preventEvent]
         * @param {boolean} [smartLock]
         */
        function smartPan(delta, initialState, panAxes, preventEvent, smartLock) {
            var snap = smartLock ? true : shouldSnap(delta),
                /** @type {AxisCollection} */
                axes = plot.getAxes(),
                opts;
            delta = smartLock ? lockDeltaDirection(delta) : adjustDeltaToSnap(delta);

            if (isDiagonalMode(delta)) {
                initialState.diagMode = true;
            }

            if (snap && initialState.diagMode === true) {
                initialState.diagMode = false;
                restoreAxisOffset(axes, initialState, delta);
            }

            if (snap) {
                panHint = {
                    start: {
                        x: initialState.startPageX - plot.offset().left + plot.getPlotOffset().left,
                        y: initialState.startPageY - plot.offset().top + plot.getPlotOffset().top
                    },
                    end: {
                        x: initialState.startPageX - delta.x - plot.offset().left + plot.getPlotOffset().left,
                        y: initialState.startPageY - delta.y - plot.offset().top + plot.getPlotOffset().top
                    }
                }
            } else {
                panHint = {
                    start: {
                        x: initialState.startPageX - plot.offset().left + plot.getPlotOffset().left,
                        y: initialState.startPageY - plot.offset().top + plot.getPlotOffset().top
                    },
                    end: false
                }
            }

            if (isNaN(delta.x)) {
                delta.x = 0;
            }
            if (isNaN(delta.y)) {
                delta.y = 0;
            }

            if (panAxes) {
                axes = panAxes;
            }

            var axisMin, axisMax, p, d;
            Object.values(axes).forEach(function(axis) {
                axisMin = axis.min;
                axisMax = axis.max;
                opts = axis.options;

                d = delta[axis.direction];
                p = prevDelta[axis.direction];

                //skip axis without axisPan when panning only on certain axis or axis without plotPan for pan the entire plot
                if ((!opts.axisPan && panAxes) || (!panAxes && !opts.plotPan)) {
                    return;
                }

                // calc min delta (revealing left edge of plot)
                var minD = p + axis.p2c(opts.panRange[0]) - axis.p2c(axisMin);
                // calc max delta (revealing right edge of plot)
                var maxD = p + axis.p2c(opts.panRange[1]) - axis.p2c(axisMax);
                // Same y-axis swap as plot.pan — see comment there.
                // Upstream flot/flot#1789 / PR #1793.
                if (axis.direction === 'y') {
                    var swap = minD;
                    minD = maxD;
                    maxD = swap;
                }
                // limit delta to min or max if enabled
                if (opts.panRange[0] !== undefined && d >= maxD) {
                    d = maxD;
                }
                if (opts.panRange[1] !== undefined && d <= minD) {
                    d = minD;
                }

                if (d !== 0) {
                    var navigationOffsetBelow = saturated.saturate(axis.c2p(axis.p2c(axisMin) - (p - d)) - axis.c2p(axis.p2c(axisMin))),
                        navigationOffsetAbove = saturated.saturate(axis.c2p(axis.p2c(axisMax) - (p - d)) - axis.c2p(axis.p2c(axisMax)));

                    if (!isFinite(navigationOffsetBelow)) {
                        navigationOffsetBelow = 0;
                    }

                    if (!isFinite(navigationOffsetAbove)) {
                        navigationOffsetAbove = 0;
                    }

                    axis.options.offset.below = saturated.saturate(navigationOffsetBelow + (axis.options.offset.below || 0));
                    axis.options.offset.above = saturated.saturate(navigationOffsetAbove + (axis.options.offset.above || 0));
                }
            });

            prevDelta = delta;
            plot.setupGrid(true);
            plot.draw();

            if (!preventEvent) {
                trigger(plot.getPlaceholder(), "plotpan", [plot, delta, panAxes, initialState]);
            }
        }

        smartPan.end = function() {
            panHint = null;
            lockedDirection = null;
            prevDelta = { x: 0, y: 0 };
            plot.triggerRedrawOverlay();
        }
        plot.smartPan = smartPan;

        /** @param {NavigationPlot} plot @param {HTMLElement} eventHolder */
        function shutdown(plot, eventHolder) {
            unbind(eventHolder, "wheel", onMouseWheel);
            unbind(eventHolder, "pointerdown", onPointerDown);
            unbind(eventHolder, "dblclick", onDblClick);
            unbind(eventHolder, "click", onClick);

            if (panTimeout) {
                window.clearTimeout(panTimeout);
            }
        }

        /** @param {NavigationPlot} plot @param {CanvasRenderingContext2D} ctx */
        function drawOverlay(plot, ctx) {
            if (panHint) {
                ctx.strokeStyle = 'rgba(96, 160, 208, 0.7)';
                ctx.lineWidth = 2;
                ctx.lineJoin = "round";
                var startx = Math.round(panHint.start.x),
                    starty = Math.round(panHint.start.y);

                ctx.beginPath();

                if (panHint.end === false) {
                    ctx.moveTo(startx, starty - PANHINT_LENGTH_CONSTANT);
                    ctx.lineTo(startx, starty + PANHINT_LENGTH_CONSTANT);

                    ctx.moveTo(startx + PANHINT_LENGTH_CONSTANT, starty);
                    ctx.lineTo(startx - PANHINT_LENGTH_CONSTANT, starty);
                } else {
                    var endx = Math.round(panAxes && panAxes[0].direction === 'y' ? panHint.start.x : panHint.end.x),
                        endy = Math.round(panAxes && panAxes[0].direction === 'x' ? panHint.start.y : panHint.end.y);
                    var dirX = starty === endy;

                    ctx.moveTo(startx - (dirX ? 0 : PANHINT_LENGTH_CONSTANT), starty - (dirX ? PANHINT_LENGTH_CONSTANT : 0));
                    ctx.lineTo(startx + (dirX ? 0 : PANHINT_LENGTH_CONSTANT), starty + (dirX ? PANHINT_LENGTH_CONSTANT : 0));

                    ctx.moveTo(startx, starty);
                    ctx.lineTo(endx, endy);

                    ctx.moveTo(endx - (dirX ? 0 : PANHINT_LENGTH_CONSTANT), endy - (dirX ? PANHINT_LENGTH_CONSTANT : 0));
                    ctx.lineTo(endx + (dirX ? 0 : PANHINT_LENGTH_CONSTANT), endy + (dirX ? PANHINT_LENGTH_CONSTANT : 0));
                }

                ctx.stroke();
            }
        }

        /** @param {number} touchPointX @param {number} touchPointY */
        plot.getTouchedAxis = function(touchPointX, touchPointY) {
            var placeholderRect = plot.getPlaceholder().getBoundingClientRect();
            var ec = { left: placeholderRect.left + window.scrollX, top: placeholderRect.top + window.scrollY };
            ec.left = touchPointX - ec.left;
            ec.top = touchPointY - ec.top;

            var axis = plot.getXAxes().concat(plot.getYAxes()).filter(function (axis) {
                var box = axis.box;
                if (box !== undefined) {
                    return (ec.left > box.left) && (ec.left < box.left + box.width) &&
                            (ec.top > box.top) && (ec.top < box.top + box.height);
                }
                return false;
            });

            return axis;
        }

        plot.hooks.drawOverlay.push(drawOverlay);
        plot.hooks.bindEvents.push(bindEvents);
        plot.hooks.shutdown.push(shutdown);
    }

    plugins.push({
        init: init,
        options: options,
        name: 'navigate',
        version: '1.3'
    });
