'use strict';

export var browser = {
    getPageXY: function (e) {
        var doc = document.documentElement,
            pageX = e.clientX + (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0),
            pageY = e.clientY + (window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0);
        return { X: pageX, Y: pageY };
    },

    getPixelRatio: function(context) {
        var devicePixelRatio = window.devicePixelRatio || 1,
            backingStoreRatio =
            context.webkitBackingStorePixelRatio ||
            context.mozBackingStorePixelRatio ||
            context.msBackingStorePixelRatio ||
            context.oBackingStorePixelRatio ||
            context.backingStorePixelRatio || 1;
        return devicePixelRatio / backingStoreRatio;
    },

    isSafari: function() {
        var top = window.top;
        if (!top) return false;
        return /constructor/i.test(/** @type {any} */ (top.HTMLElement)) || (function (/** @type {any} */ p) { return p.toString() === "[object SafariRemoteNotification]"; })(!(/** @type {any} */ (top))['safari'] || (typeof (/** @type {any} */ (top)).safari !== 'undefined' && (/** @type {any} */ (top)).safari.pushNotification));
    },

    isMobileSafari: function() {
        return navigator.userAgent.match(/(iPod|iPhone|iPad)/) && navigator.userAgent.match(/AppleWebKit/);
    },

    isOpera: function() {
        return (!!window.opr && !!window.opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
    },

    isFirefox: function() {
        return typeof InstallTrigger !== 'undefined';
    },

    isIE: function() {
        return /*@cc_on!@*/false || !!document.documentMode;
    },

    isEdge: function() {
        return !browser.isIE() && !!window.StyleMedia;
    },

    isChrome: function() {
        return !!window.chrome && !!window.chrome.webstore;
    },

    isBlink: function() {
        return (browser.isChrome() || browser.isOpera()) && !!window.CSS;
    }
};
