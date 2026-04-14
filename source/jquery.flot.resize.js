/* Flot plugin for automatically redrawing plots as the placeholder resizes.

Copyright (c) 2007-2014 IOLA and Ole Laursen.
Licensed under the MIT license.

It works by listening for changes on the placeholder div using ResizeObserver.
If the size changes, it will redraw the plot.

There are no options. If you need to disable the plugin for some plots, you
can just fix the size of their placeholders.

*/

import { plugins } from './jquery.flot.js';

    var options = { }; // no options

    function init(plot) {
        var observer = null;

        function onResize() {
            var placeholder = plot.getPlaceholder();

            // somebody might have hidden us and we can't plot
            // when we don't have the dimensions
            if (placeholder.clientWidth === 0 || placeholder.clientHeight === 0) return;

            plot.resize();
            plot.setupGrid();
            plot.draw();
        }

        function bindEvents(plot, eventHolder) {
            var placeholder = plot.getPlaceholder();
            observer = new ResizeObserver(function(entries) {
                onResize();
            });
            observer.observe(placeholder);
        }

        function shutdown(plot, eventHolder) {
            if (observer) {
                observer.disconnect();
                observer = null;
            }
        }

        plot.hooks.bindEvents.push(bindEvents);
        plot.hooks.shutdown.push(shutdown);
    }

    plugins.push({
        init: init,
        options: options,
        name: 'resize',
        version: '1.0'
    });
