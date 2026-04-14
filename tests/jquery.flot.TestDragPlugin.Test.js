/* Test Flot plugin for purposes of testing in conjunction with other plugins
   that use pointer-based drag interactions.

Copyright (c) 2007-2014 IOLA and Ole Laursen.
Licensed under the MIT license.
*/

(function () {
    function init(plot) {
        function onPointerDown(e) {
            e.stopImmediatePropagation();
            e.preventDefault();
        }

        plot.hooks.bindEvents.push(function(plot, eventHolder) {
            var o = plot.getOptions();
            if (o.testDrag.on === true) {
                plot.addEventHandler("pointerdown", onPointerDown, eventHolder, 10);
            }
        });

        plot.hooks.shutdown.push(function (plot, eventHolder) {
            eventHolder.removeEventListener("pointerdown", onPointerDown);
        });
    }

    jQuery.plot.plugins.push({
        init: init,
        options: {
            testDrag: {
                on: false
            }
        },
        name: 'testDragPlugin',
        version: '1.1'
    });
})();
