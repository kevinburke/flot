
/* global jQuery */

import { plugins } from './plugin-registry.js';

/** @typedef {'pan' | 'pinch' | 'doubleTap' | 'longTap' | 'tap'} Gesture */

/**
 * @typedef {Object} PagePoint
 * @property {number} x Horizontal page coordinate in CSS pixels from the document's left edge
 * @property {number} y Vertical page coordinate in CSS pixels from the document's top edge
 */

/** @typedef {{ touchstart: (e: FlotGestureTouchEvent) => void, touchmove: (e: FlotGestureTouchEvent) => void, touchend: (e: FlotGestureTouchEvent) => void }} GestureHandlers */
/** @typedef {GestureHandlers & { isLongTap: (e: FlotGestureTouchEvent) => boolean, waitForLongTap: (e: FlotGestureTouchEvent) => void }} LongTapHandlers */
/** @typedef {GestureHandlers & { isTap: (e: FlotGestureTouchEvent) => boolean }} TapHandlers */

/**
 * @typedef {Object} TouchOptions
 * @property {boolean} propagateSupportedGesture Whether supported gestures continue propagating to ancestor elements
 * @property {{ active: boolean, enableTouch: boolean }} pan
 * @property {{ active: boolean, enableTouch: boolean }} zoom
 */

/**
 * @typedef {Object} TouchPlot
 * @property {() => TouchOptions} getOptions
 * @property {() => HTMLElement} getEventHolder
 * @property {{
 *   processOptions: Array<(plot: TouchPlot, options: TouchOptions) => void>,
 *   bindEvents: Array<(plot: TouchPlot, eventHolder: HTMLElement) => void>,
 *   shutdown: Array<(plot: TouchPlot, eventHolder: HTMLElement) => void>
 * }} hooks
 */

/**
 * @typedef {Object} GestureState
 * @property {boolean} twoTouches Whether the preceding event was a pinch with two active touches
 * @property {PagePoint} currentTapStart Page position where the current press began
 * @property {PagePoint} currentTapEnd Most recent page position during the current press
 * @property {PagePoint} prevTap Page position of the preceding tap for double-tap detection
 * @property {PagePoint} currentTap Page position of the current tap for double-tap detection
 * @property {boolean} interceptedLongTap Whether the current press has already emitted a long-tap event
 * @property {boolean} isUnsupportedGesture Whether three or more touches are active
 * @property {number | null} prevTapTime Time of the preceding tap in milliseconds
 * @property {number | null} tapStartTime Time the current press began in milliseconds
 * @property {ReturnType<typeof setTimeout> | null} longTapTriggerId Pending long-tap timer
 */

    'use strict';

    var options = {
        propagateSupportedGesture: false
    };

    /** @param {TouchPlot} plot */
    function init(plot) {
        plot.hooks.processOptions.push(initTouchNavigation);
    }

    /** @param {TouchPlot} plot @param {TouchOptions} options */
    function initTouchNavigation(plot, options) {
        /** @type {GestureState} */
        var gestureState = {
                twoTouches: false,
                currentTapStart: { x: 0, y: 0 },
                currentTapEnd: { x: 0, y: 0 },
                prevTap: { x: 0, y: 0 },
                currentTap: { x: 0, y: 0 },
                interceptedLongTap: false,
                isUnsupportedGesture: false,
                prevTapTime: null,
                tapStartTime: null,
                longTapTriggerId: null
            },
            maxDistanceBetweenTaps = 20, // CSS pixels in page coordinates
            maxIntervalBetweenTaps = 500,
            maxLongTapDistance = 20, // CSS pixels in page coordinates
            minLongTapDuration = 1500,
            pressedTapDuration = 125,
            /** @type {HTMLElement} */
            mainEventHolder;

        /** @param {FlotGestureTouchEvent} e */
        function interpretGestures(e) {
            var o = plot.getOptions();

            if (!o.pan.active && !o.zoom.active) {
                return;
            }

            updateOnMultipleTouches(e);
            mainEventHolder.dispatchEvent(new CustomEvent('touchevent', { detail: e }));

            if (isPinchEvent(e)) {
                executeAction(e, 'pinch');
            } else {
                executeAction(e, 'pan');
                if (!wasPinchEvent(e)) {
                    if (isDoubleTap(e)) {
                        executeAction(e, 'doubleTap');
                    }
                    executeAction(e, 'tap');
                    executeAction(e, 'longTap');
                }
            }
        }

        /** @param {GestureHandlers} handlers @param {FlotGestureTouchEvent} e */
        function dispatchTouchEvent(handlers, e) {
            switch (e.type) {
                case 'touchstart':
                    handlers.touchstart(e);
                    break;
                case 'touchmove':
                    handlers.touchmove(e);
                    break;
                case 'touchend':
                    handlers.touchend(e);
                    break;
            }
        }

        /** @param {FlotGestureTouchEvent} e @param {Gesture} gesture */
        function executeAction(e, gesture) {
            switch (gesture) {
                case 'pan':
                    dispatchTouchEvent(pan, e);
                    break;
                case 'pinch':
                    dispatchTouchEvent(pinch, e);
                    break;
                case 'doubleTap':
                    doubleTap.onDoubleTap(e);
                    break;
                case 'longTap':
                    dispatchTouchEvent(longTap, e);
                    break;
                case 'tap':
                    dispatchTouchEvent(tap, e);
                    break;
            }
        }

        /** @param {TouchPlot} plot @param {HTMLElement} eventHolder */
        function bindEvents(plot, eventHolder) {
            mainEventHolder = eventHolder;
            eventHolder.addEventListener('touchstart', interpretGestures, false);
            eventHolder.addEventListener('touchmove', interpretGestures, false);
            eventHolder.addEventListener('touchend', interpretGestures, false);
        }

        /** @param {TouchPlot} plot @param {HTMLElement} eventHolder */
        function shutdown(plot, eventHolder) {
            eventHolder.removeEventListener('touchstart', interpretGestures);
            eventHolder.removeEventListener('touchmove', interpretGestures);
            eventHolder.removeEventListener('touchend', interpretGestures);
            if (gestureState.longTapTriggerId) {
                clearTimeout(gestureState.longTapTriggerId);
                gestureState.longTapTriggerId = null;
            }
        }

        /** @type {GestureHandlers} */
        var pan = {
            touchstart: function(e) {
                updatePrevForDoubleTap();
                updateCurrentForDoubleTap(e);
                updateStateForLongTapStart(e);

                mainEventHolder.dispatchEvent(new CustomEvent('panstart', { detail: e }));
            },

            touchmove: function(e) {
                preventEventBehaviors(e);

                updateCurrentForDoubleTap(e);
                updateStateForLongTapEnd(e);

                if (!gestureState.isUnsupportedGesture) {
                    mainEventHolder.dispatchEvent(new CustomEvent('pandrag', { detail: e }));
                }
            },

            touchend: function(e) {
                preventEventBehaviors(e);

                if (wasPinchEvent(e)) {
                    mainEventHolder.dispatchEvent(new CustomEvent('pinchend', { detail: e }));
                    mainEventHolder.dispatchEvent(new CustomEvent('panstart', { detail: e }));
                } else if (noTouchActive(e)) {
                    mainEventHolder.dispatchEvent(new CustomEvent('panend', { detail: e }));
                }
            }
        };

        /** @type {GestureHandlers} */
        var pinch = {
            touchstart: function(e) {
                mainEventHolder.dispatchEvent(new CustomEvent('pinchstart', { detail: e }));
            },

            touchmove: function(e) {
                preventEventBehaviors(e);
                gestureState.twoTouches = isPinchEvent(e);
                if (!gestureState.isUnsupportedGesture) {
                    mainEventHolder.dispatchEvent(new CustomEvent('pinchdrag', { detail: e }));
                }
            },

            touchend: function(e) {
                preventEventBehaviors(e);
            }
        };

        /** @type {{ onDoubleTap: (e: FlotGestureTouchEvent) => void }} */
        var doubleTap = {
            onDoubleTap: function(e) {
                preventEventBehaviors(e);
                mainEventHolder.dispatchEvent(new CustomEvent('doubletap', { detail: e }));
            }
        };

        /** @type {LongTapHandlers} */
        var longTap = {
            touchstart: function(e) {
                longTap.waitForLongTap(e);
            },

            touchmove: function(e) {
            },

            touchend: function(e) {
                if (gestureState.longTapTriggerId) {
                    clearTimeout(gestureState.longTapTriggerId);
                    gestureState.longTapTriggerId = null;
                }
            },

            isLongTap: function(e) {
                if (gestureState.tapStartTime == null) {
                    return false;
                }
                var currentTime = new Date().getTime(),
                    tapDuration = currentTime - gestureState.tapStartTime;
                if (tapDuration >= minLongTapDuration && !gestureState.interceptedLongTap) {
                    if (pageDistance(gestureState.currentTapStart.x, gestureState.currentTapStart.y, gestureState.currentTapEnd.x, gestureState.currentTapEnd.y) < maxLongTapDistance) {
                        gestureState.interceptedLongTap = true;
                        return true;
                    }
                }
                return false;
            },

            waitForLongTap: function(e) {
                var longTapTrigger = function() {
                    if (longTap.isLongTap(e)) {
                        mainEventHolder.dispatchEvent(new CustomEvent('longtap', { detail: e }));
                    }
                    gestureState.longTapTriggerId = null;
                };
                if (!gestureState.longTapTriggerId) {
                    gestureState.longTapTriggerId = setTimeout(longTapTrigger, minLongTapDuration);
                }
            }
        };

        /** @type {TapHandlers} */
        var tap = {
            touchstart: function(e) {
                gestureState.tapStartTime = new Date().getTime();
            },

            touchmove: function(e) {
            },

            touchend: function(e) {
                if (tap.isTap(e)) {
                    mainEventHolder.dispatchEvent(new CustomEvent('tap', { detail: e }));
                    preventEventBehaviors(e);
                }
            },

            isTap: function(e) {
                if (gestureState.tapStartTime == null) {
                    return false;
                }
                var currentTime = new Date().getTime(),
                    tapDuration = currentTime - gestureState.tapStartTime;
                if (tapDuration <= pressedTapDuration) {
                    if (pageDistance(gestureState.currentTapStart.x, gestureState.currentTapStart.y, gestureState.currentTapEnd.x, gestureState.currentTapEnd.y) < maxLongTapDistance) {
                        return true;
                    }
                }
                return false;
            }
        };

        if (options.pan.enableTouch === true || options.zoom.enableTouch) {
            plot.hooks.bindEvents.push(bindEvents);
            plot.hooks.shutdown.push(shutdown);
        };

        function updatePrevForDoubleTap() {
            gestureState.prevTap = {
                x: gestureState.currentTap.x,
                y: gestureState.currentTap.y
            };
        };

        /** @param {FlotGestureTouchEvent} e */
        function updateCurrentForDoubleTap(e) {
            gestureState.currentTap = {
                x: e.touches[0].pageX,
                y: e.touches[0].pageY
            };
        }

        /** @param {FlotGestureTouchEvent} e */
        function updateStateForLongTapStart(e) {
            gestureState.tapStartTime = new Date().getTime();
            gestureState.interceptedLongTap = false;
            gestureState.currentTapStart = {
                x: e.touches[0].pageX,
                y: e.touches[0].pageY
            };
            gestureState.currentTapEnd = {
                x: e.touches[0].pageX,
                y: e.touches[0].pageY
            };
        };

        /** @param {FlotGestureTouchEvent} e */
        function updateStateForLongTapEnd(e) {
            gestureState.currentTapEnd = {
                x: e.touches[0].pageX,
                y: e.touches[0].pageY
            };
        };

        /** @param {FlotGestureTouchEvent} e */
        function isDoubleTap(e) {
            var currentTime = new Date().getTime(),
                intervalBetweenTaps = gestureState.prevTapTime != null
                    ? currentTime - gestureState.prevTapTime
                    : Infinity;

            if (intervalBetweenTaps >= 0 && intervalBetweenTaps < maxIntervalBetweenTaps) {
                if (pageDistance(gestureState.prevTap.x, gestureState.prevTap.y, gestureState.currentTap.x, gestureState.currentTap.y) < maxDistanceBetweenTaps) {
                    e.firstTouch = gestureState.prevTap;
                    e.secondTouch = gestureState.currentTap;
                    return true;
                }
            }
            gestureState.prevTapTime = currentTime;
            return false;
        }

        /** @param {FlotGestureTouchEvent} e */
        function preventEventBehaviors(e) {
            if (!gestureState.isUnsupportedGesture) {
                e.preventDefault();
                if (!plot.getOptions().propagateSupportedGesture) {
                    e.stopPropagation();
                }
            }
        }

        /**
         * @param {number} firstPageX First horizontal page coordinate in CSS pixels
         * @param {number} firstPageY First vertical page coordinate in CSS pixels
         * @param {number} secondPageX Second horizontal page coordinate in CSS pixels
         * @param {number} secondPageY Second vertical page coordinate in CSS pixels
         */
        function pageDistance(firstPageX, firstPageY, secondPageX, secondPageY) {
            return Math.sqrt((firstPageX - secondPageX) * (firstPageX - secondPageX) + (firstPageY - secondPageY) * (firstPageY - secondPageY));
        }

        /** @param {FlotGestureTouchEvent} e */
        function noTouchActive(e) {
            return (e.touches && e.touches.length === 0);
        }

        /** @param {FlotGestureTouchEvent} e */
        function wasPinchEvent(e) {
            return (gestureState.twoTouches && e.touches.length === 1);
        }

        /** @param {FlotGestureTouchEvent} e */
        function updateOnMultipleTouches(e) {
            if (e.touches.length >= 3) {
                gestureState.isUnsupportedGesture = true;
            } else {
                gestureState.isUnsupportedGesture = false;
            }
        }

        /** @param {FlotGestureTouchEvent} e */
        function isPinchEvent(e) {
            if (e.touches && e.touches.length >= 2) {
                if (e.touches[0].target === plot.getEventHolder() &&
                    e.touches[1].target === plot.getEventHolder()) {
                    return true;
                }
            }
            return false;
        }
    }

    plugins.push({
        init: init,
        options: options,
        name: 'navigateTouch',
        version: '0.3'
    });
