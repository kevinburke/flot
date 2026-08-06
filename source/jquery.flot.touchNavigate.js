import { plugins } from './plugin-registry.js';
import { uiConstants } from './jquery.flot.uiConstants.js';
import { trigger } from './helpers.js';

/** @typedef {'pan' | 'pinch'} TouchNavigationGesture */
/** @typedef {'x' | 'y'} AxisDirection */
/** @typedef {'none' | AxisDirection} TouchedAxisDirection */
/** @typedef {'unconstrained' | 'axisConstrained'} NavigationConstraint */
/** @typedef {CustomEvent<FlotGestureTouchEvent>} GestureEvent */

/**
 * @typedef {Object} PagePoint
 * @property {number} x Horizontal page coordinate in CSS pixels from the document's left edge
 * @property {number} y Vertical page coordinate in CSS pixels from the document's top edge
 */

/**
 * @typedef {Object} PixelDelta
 * @property {number} x Horizontal displacement in CSS pixels
 * @property {number} y Vertical displacement in CSS pixels
 */

/**
 * @typedef {Object} PlotPoint
 * @property {number} left Horizontal plot coordinate in CSS pixels from the plot area's left edge
 * @property {number} top Vertical plot coordinate in CSS pixels from the plot area's top edge
 */

/**
 * @typedef {Object} PlotPageOffset
 * @property {number} left Horizontal page coordinate of the plot area's left edge, in CSS pixels
 * @property {number} top Vertical page coordinate of the plot area's top edge, in CSS pixels
 */

/** @typedef {{ direction: AxisDirection }} NavigationAxis */
/** @typedef {{ startPageX: number, startPageY: number, [axisName: string]: unknown }} PlotNavigationState */

/**
 * @typedef {Object} GestureState
 * @property {boolean} zoomEnable Whether the current pinch has crossed the zoom-distance threshold
 * @property {number | null} prevDistance Previous distance between pinch touches in CSS pixels
 * @property {number} prevTapTime Previous tap timestamp in milliseconds
 * @property {PagePoint} prevPanPosition Previous touch centroid in page CSS pixels
 * @property {PagePoint} prevTapPosition Touch centroid preceding the current pan position, in page CSS pixels
 */

/**
 * @typedef {Object} NavigationStateBase
 * @property {TouchedAxisDirection} prevTouchedAxis Axis touched by the preceding tap
 * @property {PlotNavigationState | null} initialState Plot state captured at the beginning of smart panning
 */

/**
 * @typedef {NavigationStateBase & (
 *   { navigationConstraint: 'unconstrained', currentTouchedAxis: TouchedAxisDirection, touchedAxis: NavigationAxis[] | null | undefined }
 *   | { navigationConstraint: 'axisConstrained', currentTouchedAxis: AxisDirection, touchedAxis: NavigationAxis[] }
 * )} NavigationState Navigation state whose constraint determines whether a concrete axis is required
 */

/**
 * @typedef {Object} TouchNavigateOptions
 * @property {{ interactive: boolean, enableTouch: boolean }} zoom
 * @property {{ interactive: boolean, enableTouch: boolean, touchMode: 'manual' | 'smart' | 'smartLock' }} pan
 * @property {{ interactive: boolean, enableTouch: boolean }} recenter
 */

/** @typedef {((delta: PixelDelta, initialState: PlotNavigationState, axes: NavigationAxis[] | null | undefined, preventEvent: boolean, smartLock: boolean) => void) & { end: () => void }} SmartPan */

/**
 * @typedef {Object} TouchNavigatePlot
 * @property {() => TouchNavigateOptions} getOptions
 * @property {() => HTMLElement} getPlaceholder
 * @property {() => PlotPageOffset} offset
 * @property {(pageX: number, pageY: number) => NavigationAxis[]} getTouchedAxis
 * @property {(startPageX: number, startPageY: number) => PlotNavigationState} navigationState
 * @property {SmartPan} smartPan
 * @property {(args: { left: number, top: number, axes: NavigationAxis[] | null | undefined }) => void} pan
 * @property {(args: { center: PlotPoint, amount: number, axes: NavigationAxis[] | null | undefined }) => void} zoom
 * @property {(args: { axes: NavigationAxis[] | null | undefined }) => void} recenter
 * @property {{
 *   processOptions: Array<(plot: TouchNavigatePlot, options: TouchNavigateOptions) => void>,
 *   bindEvents: Array<(plot: TouchNavigatePlot, eventHolder: HTMLElement) => void>,
 *   shutdown: Array<(plot: TouchNavigatePlot, eventHolder: HTMLElement) => void>
 * }} hooks
 */

/**
 * @typedef {Object} PanHandlers
 * @property {(e: HTMLElementEventMap['panstart']) => void} start
 * @property {(e: HTMLElementEventMap['pandrag']) => void} drag
 * @property {(e: HTMLElementEventMap['panend']) => void} end
 */

/**
 * @typedef {Object} PinchHandlers
 * @property {(e: HTMLElementEventMap['pinchstart']) => void} start
 * @property {(e: HTMLElementEventMap['pinchdrag']) => void} drag
 * @property {(e: HTMLElementEventMap['pinchend']) => void} end
 */

/** @typedef {{ recenterPlot: (e: HTMLElementEventMap['doubletap']) => void }} DoubleTapHandlers */

    'use strict';

    var options = {
        zoom: {
            enableTouch: false
        },
        pan: {
            enableTouch: false,
            touchMode: 'manual'
        },
        recenter: {
            enableTouch: true
        }
    };

    var ZOOM_DISTANCE_MARGIN = uiConstants.ZOOM_DISTANCE_MARGIN;

    /** @param {TouchNavigatePlot} plot */
    function init(plot) {
        plot.hooks.processOptions.push(initTouchNavigation);
    }

    /** @param {TouchNavigatePlot} plot @param {TouchNavigateOptions} options */
    function initTouchNavigation(plot, options) {
        /** @type {GestureState} */
        var gestureState = {
                zoomEnable: false,
                prevDistance: null,
                prevTapTime: 0,
                prevPanPosition: { x: 0, y: 0 },
                prevTapPosition: { x: 0, y: 0 }
            },
            /** @type {NavigationState} */
            navigationState = {
                prevTouchedAxis: 'none',
                currentTouchedAxis: 'none',
                touchedAxis: null,
                navigationConstraint: 'unconstrained',
                initialState: null
            },
            useManualPan = options.pan.interactive && options.pan.touchMode === 'manual',
            smartPanLock = options.pan.touchMode === 'smartLock',
            useSmartPan = options.pan.interactive && (smartPanLock || options.pan.touchMode === 'smart');

        /** @type {PanHandlers} */
        var pan;
        /** @type {PinchHandlers} */
        var pinch;
        /** @type {DoubleTapHandlers} */
        var doubleTap;

        /** @param {TouchNavigatePlot} plot @param {HTMLElement} eventHolder */
        function bindEvents(plot, eventHolder) {
            var o = plot.getOptions();

            if (o.zoom.interactive && o.zoom.enableTouch) {
                eventHolder.addEventListener('pinchstart', pinch.start, false);
                eventHolder.addEventListener('pinchdrag', pinch.drag, false);
                eventHolder.addEventListener('pinchend', pinch.end, false);
            }

            if (o.pan.interactive && o.pan.enableTouch) {
                eventHolder.addEventListener('panstart', pan.start, false);
                eventHolder.addEventListener('pandrag', pan.drag, false);
                eventHolder.addEventListener('panend', pan.end, false);
            }

            if ((o.recenter.interactive && o.recenter.enableTouch)) {
                eventHolder.addEventListener('doubletap', doubleTap.recenterPlot, false);
            }
        }

        /** @param {TouchNavigatePlot} plot @param {HTMLElement} eventHolder */
        function shutdown(plot, eventHolder) {
            eventHolder.removeEventListener('panstart', pan.start);
            eventHolder.removeEventListener('pandrag', pan.drag);
            eventHolder.removeEventListener('panend', pan.end);
            eventHolder.removeEventListener('pinchstart', pinch.start);
            eventHolder.removeEventListener('pinchdrag', pinch.drag);
            eventHolder.removeEventListener('pinchend', pinch.end);
            eventHolder.removeEventListener('doubletap', doubleTap.recenterPlot);
        }

        pan = {
            start: function(e) {
                presetNavigationState(e, 'pan', gestureState);
                updateData(e, 'pan', gestureState, navigationState);

                if (useSmartPan) {
                    var point = getPoint(e, 'pan');
                    navigationState.initialState = plot.navigationState(point.x, point.y);
                }
            },

            drag: function(e) {
                presetNavigationState(e, 'pan', gestureState);

                if (useSmartPan && navigationState.initialState) {
                    var point = getPoint(e, 'pan');
                    plot.smartPan({
                        x: navigationState.initialState.startPageX - point.x,
                        y: navigationState.initialState.startPageY - point.y
                    }, navigationState.initialState, navigationState.touchedAxis, false, smartPanLock);
                } else if (useManualPan) {
                    plot.pan({
                        left: -delta(e, 'pan', gestureState).x,
                        top: -delta(e, 'pan', gestureState).y,
                        axes: navigationState.touchedAxis
                    });
                    updatePrevPanPosition(e, 'pan', gestureState, navigationState);
                }
            },

            end: function(e) {
                presetNavigationState(e, 'pan', gestureState);

                if (useSmartPan) {
                    plot.smartPan.end();
                }

                if (wasPinchEvent(e, gestureState)) {
                    updatePrevPanPosition(e, 'pan', gestureState, navigationState);
                }
            }
        };

        /** @type {ReturnType<typeof setTimeout> | null} */
        var pinchDragTimeout;
        pinch = {
            start: function(e) {
                if (pinchDragTimeout) {
                    clearTimeout(pinchDragTimeout);
                    pinchDragTimeout = null;
                }
                presetNavigationState(e, 'pinch', gestureState);
                setPrevDistance(e, gestureState);
                updateData(e, 'pinch', gestureState, navigationState);
            },

            drag: function(e) {
                if (pinchDragTimeout) {
                    return;
                }
                pinchDragTimeout = setTimeout(function() {
                    presetNavigationState(e, 'pinch', gestureState);
                    plot.pan({
                        left: -delta(e, 'pinch', gestureState).x,
                        top: -delta(e, 'pinch', gestureState).y,
                        axes: navigationState.touchedAxis
                    });
                    updatePrevPanPosition(e, 'pinch', gestureState, navigationState);

                    var dist = pinchDistance(e);

                    if (gestureState.zoomEnable || (gestureState.prevDistance != null && Math.abs(dist - gestureState.prevDistance) > ZOOM_DISTANCE_MARGIN)) {
                        zoomPlot(plot, e, gestureState, navigationState);

                        //activate zoom mode
                        gestureState.zoomEnable = true;
                    }
                    pinchDragTimeout = null;
                }, 1000 / 60);
            },

            end: function(e) {
                if (pinchDragTimeout) {
                    clearTimeout(pinchDragTimeout);
                    pinchDragTimeout = null;
                }
                presetNavigationState(e, 'pinch', gestureState);
                gestureState.prevDistance = null;
            }
        };

        doubleTap = {
            recenterPlot: function(e) {
                if (e && e.detail && e.detail.type === 'touchstart') {
                    // only do not recenter for touch start;
                    recenterPlotOnDoubleTap(plot, e, gestureState, navigationState);
                }
            }
        };

        if (options.pan.enableTouch === true || options.zoom.enableTouch === true) {
            plot.hooks.bindEvents.push(bindEvents);
            plot.hooks.shutdown.push(shutdown);
        }

        /** @param {GestureEvent} e @param {TouchNavigationGesture} gesture @param {GestureState} gestureState */
        function presetNavigationState(e, gesture, gestureState) {
            navigationState.touchedAxis = getAxis(plot, e, gesture, navigationState);
            if (noAxisTouched(navigationState)) {
                navigationState.navigationConstraint = 'unconstrained';
            } else {
                navigationState.navigationConstraint = 'axisConstrained';
            }
        }
    }

    plugins.push({
        init: init,
        options: options,
        name: 'navigateTouch',
        version: '0.3'
    });

    /** @param {TouchNavigatePlot} plot @param {HTMLElementEventMap['doubletap']} e @param {GestureState} gestureState @param {NavigationState} navigationState */
    function recenterPlotOnDoubleTap(plot, e, gestureState, navigationState) {
        checkAxesForDoubleTap(plot, e, navigationState);
        if ((navigationState.currentTouchedAxis === 'x' && navigationState.prevTouchedAxis === 'x') ||
            (navigationState.currentTouchedAxis === 'y' && navigationState.prevTouchedAxis === 'y') ||
            (navigationState.currentTouchedAxis === 'none' && navigationState.prevTouchedAxis === 'none')) {
            plot.recenter({ axes: navigationState.touchedAxis });

            if (navigationState.touchedAxis) {
                trigger(plot.getPlaceholder(), 're-center', { axisTouched: navigationState.touchedAxis });
            } else {
                trigger(plot.getPlaceholder(), 're-center', e);
            }
        }
    }

    /** @param {TouchNavigatePlot} plot @param {HTMLElementEventMap['doubletap']} e @param {NavigationState} navigationState */
    function checkAxesForDoubleTap(plot, e, navigationState) {
        var axis = plot.getTouchedAxis(e.detail.firstTouch.x, e.detail.firstTouch.y);
        if (axis[0] !== undefined) {
            navigationState.prevTouchedAxis = axis[0].direction;
        }

        axis = plot.getTouchedAxis(e.detail.secondTouch.x, e.detail.secondTouch.y);
        if (axis[0] !== undefined) {
            navigationState.touchedAxis = axis;
            navigationState.currentTouchedAxis = axis[0].direction;
        }

        if (noAxisTouched(navigationState)) {
            navigationState.touchedAxis = null;
            navigationState.prevTouchedAxis = 'none';
            navigationState.currentTouchedAxis = 'none';
        }
    }

    /** @param {TouchNavigatePlot} plot @param {GestureEvent} e @param {GestureState} gestureState @param {NavigationState} navigationState */
    function zoomPlot(plot, e, gestureState, navigationState) {
        var offset = plot.offset(),
            point = getPoint(e, 'pinch'),
            center = {
                left: point.x - offset.left,
                top: point.y - offset.top
            },
            zoomAmount = pinchDistance(e) / gestureState.prevDistance,
            dist = pinchDistance(e);

        // send the computed touched axis to the zoom function so that it only zooms on that one
        plot.zoom({
            center: center,
            amount: zoomAmount,
            axes: navigationState.touchedAxis
        });
        gestureState.prevDistance = dist;
    }

    /** @param {GestureEvent} e @param {GestureState} gestureState */
    function wasPinchEvent(e, gestureState) {
        return (gestureState.zoomEnable && e.detail.touches.length === 1);
    }

    /** @param {TouchNavigatePlot} plot @param {GestureEvent} e @param {TouchNavigationGesture} gesture @param {NavigationState} navigationState */
    function getAxis(plot, e, gesture, navigationState) {
        if (e.type === 'pinchstart') {
            var axisTouch1 = plot.getTouchedAxis(e.detail.touches[0].pageX, e.detail.touches[0].pageY);
            var axisTouch2 = plot.getTouchedAxis(e.detail.touches[1].pageX, e.detail.touches[1].pageY);

            if (axisTouch1.length === axisTouch2.length && axisTouch1.toString() === axisTouch2.toString()) {
                return axisTouch1;
            }
            return undefined;
        } else if (e.type === 'panstart') {
            return plot.getTouchedAxis(e.detail.touches[0].pageX, e.detail.touches[0].pageY);
        } else if (e.type === 'pinchend') {
            //update axis since instead on pinch, a pan event is made
            return plot.getTouchedAxis(e.detail.touches[0].pageX, e.detail.touches[0].pageY);
        } else {
            return navigationState.touchedAxis;
        }
    }

    /** @param {NavigationState} navigationState */
    function noAxisTouched(navigationState) {
        return (!navigationState.touchedAxis || navigationState.touchedAxis.length === 0);
    }

    /** @param {GestureEvent} e @param {GestureState} gestureState */
    function setPrevDistance(e, gestureState) {
        gestureState.prevDistance = pinchDistance(e);
    }

    /** @param {GestureEvent} e @param {TouchNavigationGesture} gesture @param {GestureState} gestureState @param {NavigationState} navigationState */
    function updateData(e, gesture, gestureState, navigationState) {
        var axisDir,
            point = getPoint(e, gesture);

        switch (navigationState.navigationConstraint) {
            case 'unconstrained':
                navigationState.touchedAxis = null;
                gestureState.prevTapPosition = {
                    x: gestureState.prevPanPosition.x,
                    y: gestureState.prevPanPosition.y
                };
                gestureState.prevPanPosition = {
                    x: point.x,
                    y: point.y
                };
                break;
            case 'axisConstrained':
                axisDir = navigationState.touchedAxis[0].direction;
                navigationState.currentTouchedAxis = axisDir;
                gestureState.prevTapPosition[axisDir] = gestureState.prevPanPosition[axisDir];
                gestureState.prevPanPosition[axisDir] = point[axisDir];
                break;
            default:
                break;
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

    /** @param {GestureEvent} e */
    function pinchDistance(e) {
        var t1 = e.detail.touches[0],
            t2 = e.detail.touches[1];
        return pageDistance(t1.pageX, t1.pageY, t2.pageX, t2.pageY);
    }

    /** @param {GestureEvent} e @param {TouchNavigationGesture} gesture @param {GestureState} gestureState @param {NavigationState} navigationState */
    function updatePrevPanPosition(e, gesture, gestureState, navigationState) {
        var point = getPoint(e, gesture);

        switch (navigationState.navigationConstraint) {
            case 'unconstrained':
                gestureState.prevPanPosition.x = point.x;
                gestureState.prevPanPosition.y = point.y;
                break;
            case 'axisConstrained':
                gestureState.prevPanPosition[navigationState.currentTouchedAxis] =
                point[navigationState.currentTouchedAxis];
                break;
            default:
                break;
        }
    }

    /** @param {GestureEvent} e @param {TouchNavigationGesture} gesture @param {GestureState} gestureState @returns {PixelDelta} */
    function delta(e, gesture, gestureState) {
        var point = getPoint(e, gesture);

        return {
            x: point.x - gestureState.prevPanPosition.x,
            y: point.y - gestureState.prevPanPosition.y
        }
    }

    /** @param {GestureEvent} e @param {TouchNavigationGesture} gesture @returns {PagePoint} */
    function getPoint(e, gesture) {
        if (gesture === 'pinch') {
            return {
                x: (e.detail.touches[0].pageX + e.detail.touches[1].pageX) / 2,
                y: (e.detail.touches[0].pageY + e.detail.touches[1].pageY) / 2
            }
        } else {
            return {
                x: e.detail.touches[0].pageX,
                y: e.detail.touches[0].pageY
            }
        }
    }
