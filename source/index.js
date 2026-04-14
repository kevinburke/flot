// Main entry point for @kevinburke/flot.
//
// This module has NO jQuery dependency. It exports the core plot
// function and all bundled plugins. Use it directly:
//
//   import { plot } from '@kevinburke/flot';
//   plot(document.getElementById('ph'), data, options);
//
// For jQuery backwards compatibility ($.plot), import the adapter:
//
//   import '@kevinburke/flot/jquery';

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

// Named exports.
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
