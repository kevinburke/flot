/* global jQuery */

/**
## jquery.flot.hover.js

This plugin is used for mouse hover and tap on a point of plot series.
It supports the following options:
```js
grid: {
    hoverable: false, //to trigger plothover event on mouse hover or tap on a point
    clickable: false //to trigger plotclick event on mouse hover
}
```

It listens to native mouse move event or click, as well as artificial generated
tap and touchevent.

When the mouse is over a point or a tap on a point is performed, that point or
the correscponding bar will be highlighted and a "plothover" event will be generated.

Custom "touchevent" is triggered when any touch interaction is made. Hover plugin
handles this events by unhighlighting all of the previously highlighted points and generates
"plothovercleanup" event to notify any part that is handling plothover (for exemple to cleanup
the tooltip from webcharts).
*/

import { plugins } from './plugin-registry.js';
import { browser } from './jquery.flot.browser.js';
import { drawSeries } from './jquery.flot.drawSeries.js';
import { color } from './jquery.colorhelpers.js';
import { bind, unbind, trigger } from './helpers.js';

/** @typedef {'click' | 'hover'} HoverEventType */
/** @typedef {Array<number>} HoverPoint */
/** @typedef {{ min: number, max: number, p2c: (value: number) => number, c2p?: (value: number) => number }} HoverAxis */
/** @typedef {(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, shadow: boolean) => void} DrawSymbol */

/**
 * @typedef {Object} HoverSeries
 * @property {{ points: Array<number | null>, pointsize: number }} datapoints
 * @property {HoverAxis} xaxis
 * @property {HoverAxis} yaxis
 * @property {string} color
 * @property {string | null} highlightColor
 * @property {boolean} clickable
 * @property {boolean} hoverable
 * @property {{ radius: number, lineWidth: number, symbol: string }} points
 * @property {{ show: boolean, barWidth: number | [number, boolean], align: 'left' | 'right' | 'center', lineWidth: number, horizontal: boolean, fillTowards?: number }} bars
 */

/**
 * @typedef {Object} HoverItem
 * @property {HoverPoint} datapoint
 * @property {HoverSeries} series
 * @property {number} [distance]
 * @property {number} [pageX]
 * @property {number} [pageY]
 */

/** @typedef {{ grid: { hoverable: boolean, clickable: boolean, autoHighlight: boolean, mouseActiveRadius: number } }} HoverOptions */
/** @typedef {HTMLElement & { lastMouseMoveEvent?: MouseEvent }} HoverPlaceholder */
/** @typedef {{ [axis: string]: number }} HoverPosition */
/** @typedef {{ series: HoverSeries, point: HoverPoint, auto: string | boolean | undefined }} Highlight */

/**
 * @typedef {Object} HoverPlot
 * @property {() => HoverOptions} getOptions
 * @property {() => HoverSeries[]} getData
 * @property {() => HoverPlaceholder} getPlaceholder
 * @property {() => { left: number, top: number }} offset
 * @property {(position: { left: number, top: number }) => HoverPosition} c2p
 * @property {(canvasX: number, canvasY: number, seriesFilter: (index: number) => boolean, distance: number) => HoverItem[]} findNearbyItems
 * @property {() => { left: number, top: number }} getPlotOffset
 * @property {() => void} triggerRedrawOverlay
 * @property {(series?: number | HoverSeries, point?: number | HoverPoint) => void} unhighlight
 * @property {(series: number | HoverSeries, point: number | HoverPoint, auto?: boolean) => void} highlight
 * @property {Record<string, DrawSymbol>} [drawSymbol]
 * @property {{
 *   bindEvents: Array<(plot: HoverPlot, eventHolder: HTMLElement) => void>,
 *   shutdown: Array<(plot: HoverPlot, eventHolder: HTMLElement) => void>,
 *   processOptions: Array<(plot: HoverPlot, options: HoverOptions) => void>,
 *   drawOverlay: Array<(plot: HoverPlot, ctx: CanvasRenderingContext2D, overlay: unknown) => void>,
 *   processDatapoints: Array<() => void>,
 *   setupGrid: Array<() => void>
 * }} hooks
 */

    'use strict';

    var options = {
        grid: {
            hoverable: false,
            clickable: false
        }
    };

    /** @type {{ click: HoverEventType, hover: HoverEventType }} */
    var eventType = {
        click: 'click',
        hover: 'hover'
    }

    /** @param {HoverPlot} plot */
    function init(plot) {
        /** @type {MouseEvent | undefined} */
        var lastMouseMoveEvent;
        /** @type {Highlight[]} */
        var highlights = [];

        /** @param {HoverPlot} plot @param {HTMLElement} eventHolder */
        function bindEvents(plot, eventHolder) {
            var o = plot.getOptions();

            if (o.grid.hoverable || o.grid.clickable) {
                eventHolder.addEventListener('touchevent', triggerCleanupEvent, false);
                eventHolder.addEventListener('tap', generatePlothoverEvent, false);
            }

            if (o.grid.clickable) {
                bind(eventHolder, "click", onClick);
            }

            if (o.grid.hoverable) {
                bind(eventHolder, "mousemove", onMouseMove);
                bind(eventHolder, "mouseleave", onMouseLeave);
            }
        }

        /** @param {HoverPlot} plot @param {HTMLElement} eventHolder */
        function shutdown(plot, eventHolder) {
            eventHolder.removeEventListener('tap', generatePlothoverEvent);
            eventHolder.removeEventListener('touchevent', triggerCleanupEvent);
            unbind(eventHolder, "mousemove", onMouseMove);
            unbind(eventHolder, "mouseleave", onMouseLeave);
            unbind(eventHolder, "click", onClick);
            highlights = [];
        }

        /** @param {CustomEvent<TouchEvent>} e */
        function generatePlothoverEvent(e) {
            var o = plot.getOptions(),
                touch = e.detail.changedTouches[0],
                newEvent = new MouseEvent('mouseevent', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });

            if (o.grid.hoverable) {
                doTriggerClickHoverEvent(newEvent, eventType.hover, 30);
            }
            return false;
        }

        /**
         * @param {MouseEvent | undefined} event
         * @param {HoverEventType} eventType
         * @param {number} [searchDistance]
         */
        function doTriggerClickHoverEvent(event, eventType, searchDistance) {
            var series = plot.getData();
            if (event !== undefined &&
                series.length > 0 &&
                series[0].xaxis.c2p !== undefined &&
                series[0].yaxis.c2p !== undefined) {
                var eventToTrigger = "plot" + eventType;
                triggerClickHoverEvent(eventToTrigger, event,
                    function(i) {
                        return eventType === "click" ? series[i].clickable !== false : series[i].hoverable !== false;
                    }, searchDistance);
            }
        }

        /** @param {Event} e */
        function onMouseMove(e) {
            if (!(e instanceof MouseEvent)) {
                return;
            }

            lastMouseMoveEvent = e;
            plot.getPlaceholder().lastMouseMoveEvent = e;
            doTriggerClickHoverEvent(e, eventType.hover);
        }

        /** @param {Event} e */
        function onMouseLeave(e) {
            if (!(e instanceof MouseEvent)) {
                return;
            }

            lastMouseMoveEvent = undefined;
            plot.getPlaceholder().lastMouseMoveEvent = undefined;
            triggerClickHoverEvent("plothover", e,
                function(i) {
                    return false;
                });
        }

        /** @param {Event} e */
        function onClick(e) {
            if (!(e instanceof MouseEvent)) {
                return;
            }

            doTriggerClickHoverEvent(e, eventType.click);
        }

        function triggerCleanupEvent() {
            plot.unhighlight();
            trigger(plot.getPlaceholder(), 'plothovercleanup');
        }

        // trigger click or hover event (they send the same parameters
        // so we share their code)
        /**
         * @param {string} eventname
         * @param {MouseEvent} event
         * @param {(index: number) => boolean} seriesFilter
         * @param {number} [searchDistance]
         */
        function triggerClickHoverEvent(eventname, event, seriesFilter, searchDistance) {
            var options = plot.getOptions(),
                offset = plot.offset(),
                page = browser.getPageXY(event),
                canvasX = page.X - offset.left,
                canvasY = page.Y - offset.top,
                pos = plot.c2p({
                    left: canvasX,
                    top: canvasY
                }),
                distance = searchDistance !== undefined ? searchDistance : options.grid.mouseActiveRadius;

            pos.pageX = page.X;
            pos.pageY = page.Y;

            var items = plot.findNearbyItems(canvasX, canvasY, seriesFilter, distance);
            var item = items[0];

            for (let i = 1; i < items.length; ++i) {
                if (item.distance === undefined ||
                    items[i].distance < item.distance) {
                    item = items[i];
                }
            }

            if (item) {
                // fill in mouse pos for any listeners out there
                item.pageX = Math.trunc(item.series.xaxis.p2c(item.datapoint[0]) + offset.left);
                item.pageY = Math.trunc(item.series.yaxis.p2c(item.datapoint[1]) + offset.top);
            } else {
                item = null;
            }

            if (options.grid.autoHighlight) {
                // clear auto-highlights
                for (let i = 0; i < highlights.length; ++i) {
                    var h = highlights[i];
                    if ((h.auto === eventname &&
                        !(item && h.series === item.series &&
                            h.point[0] === item.datapoint[0] &&
                            h.point[1] === item.datapoint[1])) || !item) {
                        unhighlight(h.series, h.point);
                    }
                }

                if (item) {
                    highlight(item.series, item.datapoint, eventname);
                }
            }

            trigger(plot.getPlaceholder(), eventname, [pos, item, items]);
        }

        /**
         * @param {number | HoverSeries} s Series or series index to highlight
         * @param {number | HoverPoint} point Datapoint or datapoint index to highlight
         * @param {string | boolean} [auto] Event name for automatic highlights, or whether the highlight is automatic
         */
        function highlight(s, point, auto) {
            if (typeof s === "number") {
                s = plot.getData()[s];
            }

            if (typeof point === "number") {
                var ps = s.datapoints.pointsize;
                point = s.datapoints.points.slice(ps * point, ps * (point + 1));
            }

            var i = indexOfHighlight(s, point);
            if (i === -1) {
                highlights.push({
                    series: s,
                    point: point,
                    auto: auto
                });

                plot.triggerRedrawOverlay();
            } else if (!auto) {
                highlights[i].auto = false;
            }
        }

        /**
         * @param {number | HoverSeries} [s] Series or series index to stop highlighting
         * @param {number | HoverPoint} [point] Datapoint or datapoint index to stop highlighting
         */
        function unhighlight(s, point) {
            if (s == null && point == null) {
                highlights = [];
                plot.triggerRedrawOverlay();
                return;
            }

            if (typeof s === "number") {
                s = plot.getData()[s];
            }

            if (typeof point === "number") {
                var ps = s.datapoints.pointsize;
                point = s.datapoints.points.slice(ps * point, ps * (point + 1));
            }

            var i = indexOfHighlight(s, point);
            if (i !== -1) {
                highlights.splice(i, 1);

                plot.triggerRedrawOverlay();
            }
        }

        /** @param {HoverSeries} s @param {HoverPoint} p */
        function indexOfHighlight(s, p) {
            for (var i = 0; i < highlights.length; ++i) {
                var h = highlights[i];
                if (h.series === s &&
                    h.point[0] === p[0] &&
                    h.point[1] === p[1]) {
                    return i;
                }
            }

            return -1;
        }

        function processDatapoints() {
            triggerCleanupEvent();
            doTriggerClickHoverEvent(lastMouseMoveEvent, eventType.hover);
        }

        function setupGrid() {
            doTriggerClickHoverEvent(lastMouseMoveEvent, eventType.hover);
        }

        /** @param {HoverPlot} plot @param {CanvasRenderingContext2D} octx @param {unknown} overlay */
        function drawOverlay(plot, octx, overlay) {
            var plotOffset = plot.getPlotOffset(),
                i, hi;

            octx.save();
            octx.translate(plotOffset.left, plotOffset.top);
            for (i = 0; i < highlights.length; ++i) {
                hi = highlights[i];

                if (hi.series.bars.show) {
                    drawBarHighlight(hi.series, hi.point, octx);
                } else {
                    drawPointHighlight(hi.series, hi.point, octx, plot);
                }
            }
            octx.restore();
        }

        /** @param {HoverSeries} series @param {HoverPoint} point @param {CanvasRenderingContext2D} octx @param {HoverPlot} plot */
        function drawPointHighlight(series, point, octx, plot) {
            var x = point[0],
                y = point[1],
                axisx = series.xaxis,
                axisy = series.yaxis,
                highlightColor = (typeof series.highlightColor === "string") ? series.highlightColor : color.parse(series.color).scale('a', 0.5).toString();

            if (x < axisx.min || x > axisx.max || y < axisy.min || y > axisy.max) {
                return;
            }

            var pointRadius = series.points.radius + series.points.lineWidth / 2;
            octx.lineWidth = pointRadius;
            octx.strokeStyle = highlightColor;
            var radius = 1.5 * pointRadius;
            x = axisx.p2c(x);
            y = axisy.p2c(y);

            octx.beginPath();
            var symbol = series.points.symbol;
            if (symbol === 'circle') {
                octx.arc(x, y, radius, 0, 2 * Math.PI, false);
            } else if (typeof symbol === 'string' && plot.drawSymbol && plot.drawSymbol[symbol]) {
                plot.drawSymbol[symbol](octx, x, y, radius, false);
            }

            octx.closePath();
            octx.stroke();
        }

        /** @param {HoverSeries} series @param {HoverPoint} point @param {CanvasRenderingContext2D} octx */
        function drawBarHighlight(series, point, octx) {
            var highlightColor = (typeof series.highlightColor === "string") ? series.highlightColor : color.parse(series.color).scale('a', 0.5).toString(),
                fillStyle = highlightColor,
                barLeft;

            var barWidth = Array.isArray(series.bars.barWidth) ? series.bars.barWidth[0] : series.bars.barWidth;
            switch (series.bars.align) {
                case "left":
                    barLeft = 0;
                    break;
                case "right":
                    barLeft = -barWidth;
                    break;
                default:
                    barLeft = -barWidth / 2;
            }

            octx.lineWidth = series.bars.lineWidth;
            octx.strokeStyle = highlightColor;

            var fillTowards = series.bars.fillTowards || 0,
                bottom = fillTowards > series.yaxis.min ? Math.min(series.yaxis.max, fillTowards) : series.yaxis.min;

            drawSeries.drawBar(point[0], point[1], point[2] || bottom, barLeft, barLeft + barWidth,
                function() {
                    return fillStyle;
                }, series.xaxis, series.yaxis, octx, series.bars.horizontal, series.bars.lineWidth);
        }

        /** @param {HoverPlot} plot @param {HoverOptions} options */
        function initHover(plot, options) {
            plot.highlight = highlight;
            plot.unhighlight = unhighlight;
            if (options.grid.hoverable || options.grid.clickable) {
                plot.hooks.drawOverlay.push(drawOverlay);
                plot.hooks.processDatapoints.push(processDatapoints);
                plot.hooks.setupGrid.push(setupGrid);
            }

            lastMouseMoveEvent = plot.getPlaceholder().lastMouseMoveEvent;
        }

        plot.hooks.bindEvents.push(bindEvents);
        plot.hooks.shutdown.push(shutdown);
        plot.hooks.processOptions.push(initHover);
    }

    plugins.push({
        init: init,
        options: options,
        name: 'hover',
        version: '0.1'
    });
