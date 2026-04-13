// Main entry point for @kevinburke/flot.
//
// Imports all core modules and bundled plugins, wires up the $.plot
// namespace for backwards compatibility with <script> tag users.
//
// ESM consumers can import individual pieces:
//   import { plot, color, saturated } from '@kevinburke/flot';
//
// IIFE consumers get $.plot() registered on jQuery as before.

import $ from 'jquery';

// Core modules
import { Canvas } from './jquery.canvaswrapper.js';
import { color } from './jquery.colorhelpers.js';
import { saturated } from './jquery.flot.saturated.js';
import { browser } from './jquery.flot.browser.js';
import { uiConstants } from './jquery.flot.uiConstants.js';
import { drawSeries as drawSeriesModule } from './jquery.flot.drawSeries.js';

// Core plot function and plugin registry
import {
    plot,
    plugins,
    version,
    linearTickGenerator,
    defaultTickFormatter,
    expRepTickFormatter,
} from './jquery.flot.js';

// Bundled plugins (side-effect imports — each pushes to `plugins`)
import './jquery.flot.errorbars.js';
import { logTicksGenerator, logTickFormatter } from './jquery.flot.logaxis.js';
import './jquery.flot.symbol.js';
import './jquery.flot.flatdata.js';
import './jquery.flot.navigate.js';
import './jquery.flot.fillbetween.js';
import './jquery.flot.categories.js';
import './jquery.flot.stack.js';
import './jquery.flot.touchNavigate.js';
import './jquery.flot.hover.js';
import './jquery.flot.touch.js';
import { formatDate, makeUtcWrapper, dateGenerator, dateTickGenerator } from './jquery.flot.time.js';
import './jquery.flot.axislabels.js';
import './jquery.flot.selection.js';
import { composeImages } from './jquery.flot.composeImages.js';
import './jquery.flot.legend.js';

// Wire up the jQuery namespace for backwards compatibility.
// <script> tag users expect $.plot(...) to work.
if (typeof $ === 'function') {
    $.plot = plot;
    $.plot.plugins = plugins;
    $.plot.version = version;
    $.plot.saturated = saturated;
    $.plot.browser = browser;
    $.plot.uiConstants = uiConstants;
    $.plot.drawSeries = drawSeriesModule;
    $.plot.linearTickGenerator = linearTickGenerator;
    $.plot.defaultTickFormatter = defaultTickFormatter;
    $.plot.expRepTickFormatter = expRepTickFormatter;
    $.plot.logTicksGenerator = logTicksGenerator;
    $.plot.logTickFormatter = logTickFormatter;
    $.plot.formatDate = formatDate;
    $.plot.makeUtcWrapper = makeUtcWrapper;
    $.plot.dateGenerator = dateGenerator;
    $.plot.dateTickGenerator = dateTickGenerator;
    $.plot.composeImages = composeImages;
    $.color = color;

    // Also add the plot function as a chainable property
    $.fn.plot = function(data, options) {
        return this.each(function() {
            plot(this, data, options);
        });
    };

    if (!window.Flot) {
        window.Flot = {};
    }
    window.Flot.Canvas = Canvas;
}

// Named exports for ESM consumers.
export {
    Canvas,
    color,
    saturated,
    browser,
    uiConstants,
    drawSeriesModule as drawSeries,
    plot,
    plugins,
    version,
    linearTickGenerator,
    defaultTickFormatter,
    expRepTickFormatter,
    logTicksGenerator,
    logTickFormatter,
    formatDate,
    makeUtcWrapper,
    dateGenerator,
    dateTickGenerator,
    composeImages,
};
