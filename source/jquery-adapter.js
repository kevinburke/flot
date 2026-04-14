// jQuery adapter for @kevinburke/flot.
//
// Loads the core (jQuery-free) and wires everything onto the jQuery
// namespace so existing $.plot() code works unchanged.
//
// Usage:
//   <script src="jquery.js"></script>
//   <script src="dist/jquery.flot.js"></script>
//   <script>$.plot("#placeholder", data, options);</script>
//
// Or as ESM:
//   import '@kevinburke/flot/jquery';
//   $.plot("#placeholder", data, options);

import $ from 'jquery';

import {
    Canvas,
    color,
    saturated,
    browser,
    uiConstants,
    drawSeries,
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
} from './index.js';

// Register $.plot and $.color on the jQuery object.
$.plot = function(placeholder, data, options) {
    var el = typeof placeholder === 'string'
        ? document.querySelector(placeholder)
        : (placeholder instanceof $ ? placeholder[0] : placeholder);
    return plot(el, data, options);
};

$.plot.plugins = plugins;
$.plot.version = version;
$.plot.saturated = saturated;
$.plot.browser = browser;
$.plot.uiConstants = uiConstants;
$.plot.drawSeries = drawSeries;
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
// Wrap color.extract to accept jQuery-wrapped elements.
var origExtract = color.extract;
$.color = Object.create(color);
$.color.extract = function(elem, cssProp) {
    if (elem instanceof $ && elem.length) elem = elem[0];
    return origExtract(elem, cssProp);
};

// Chainable jQuery plugin: $(el).plot(data, options)
$.fn.plot = function(data, options) {
    return this.each(function() {
        plot(this, data, options);
    });
};

if (typeof window !== 'undefined') {
    if (!window.Flot) {
        window.Flot = {};
    }
    window.Flot.Canvas = Canvas;
}
