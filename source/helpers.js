// Vanilla replacements for jQuery utility functions used throughout flot.

function isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') {
        return false;
    }

    var prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function cloneDeepValue(value) {
    if (Array.isArray(value)) {
        return value.map(cloneDeepValue);
    }

    if (isPlainObject(value)) {
        var copy = {};
        var keys = Object.keys(value);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var nestedValue = value[key];
            if (nestedValue !== undefined) {
                copy[key] = cloneDeepValue(nestedValue);
            }
        }
        return copy;
    }

    return value;
}

// Deep-extend target with one or more source objects. When `deep` is true,
// nested objects are recursively merged rather than replaced. Arrays are
// replaced, not concatenated (matching $.extend behavior that flot relies on).
export function extend(deep, target) {
    var sources = Array.prototype.slice.call(arguments, 2);
    if (typeof deep !== 'boolean') {
        sources.unshift(target);
        target = deep;
        deep = false;
    }

    for (var i = 0; i < sources.length; i++) {
        var src = sources[i];
        if (src == null) continue;
        var keys = Object.keys(src);
        for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            var val = src[key];
            if (val === undefined) {
                continue;
            }
            if (deep && Array.isArray(val)) {
                target[key] = cloneDeepValue(val);
                continue;
            }
            if (deep && isPlainObject(val)) {
                if (typeof target[key] !== 'object' || target[key] == null) {
                    target[key] = {};
                }
                extend(true, target[key], val);
            } else {
                target[key] = val;
            }
        }
    }

    return target;
}

// Get inner width of an element (content area, no padding/border/scrollbar).
export function width(el) {
    return el.clientWidth;
}

// Get inner height of an element.
export function height(el) {
    return el.clientHeight;
}

// Get or set a CSS property on an element.
export function css(el, prop, val) {
    if (val !== undefined) {
        el.style[prop] = typeof val === 'number' ? val + 'px' : val;
        return;
    }
    return getComputedStyle(el)[prop];
}

// Store or retrieve arbitrary data on an element.
var dataStore = new WeakMap();

export function data(el, key, val) {
    var store = dataStore.get(el);
    if (!store) {
        store = {};
        dataStore.set(el, store);
    }
    if (val !== undefined) {
        store[key] = val;
        return;
    }
    return store[key];
}

export function removeData(el, key) {
    var store = dataStore.get(el);
    if (store) {
        if (key) {
            delete store[key];
        } else {
            dataStore.delete(el);
        }
    }
}

// Trigger a custom event on an element. Extra args are passed as the
// event's `detail` property (an array). For jQuery adapter compatibility,
// the adapter re-dispatches these as jQuery events so $(el).on() works.
export function trigger(el, type, args) {
    var event = new CustomEvent(type, {
        detail: args || [],
        bubbles: true,
        cancelable: true
    });
    el.dispatchEvent(event);
    return event;
}

// Bind an event listener, tracking it so unbindAll can remove it later.
var listenerStore = new WeakMap();

function usesJQuerySpecialEvent(type) {
    if (typeof window === 'undefined' || !window.jQuery || !window.jQuery.event || !window.jQuery.event.special) {
        return false;
    }

    return type === 'drag' || type === 'dragstart' || type === 'dragend' || type === 'mousewheel';
}

export function bind(el, type, handler) {
    if (usesJQuerySpecialEvent(type)) {
        window.jQuery(el).on(type, handler);
    } else {
        el.addEventListener(type, handler);
    }

    var listeners = listenerStore.get(el);
    if (!listeners) {
        listeners = [];
        listenerStore.set(el, listeners);
    }
    listeners.push({ type: type, handler: handler, jquery: usesJQuerySpecialEvent(type) });
}

export function unbind(el, type, handler) {
    if (type && handler) {
        if (usesJQuerySpecialEvent(type)) {
            window.jQuery(el).off(type, handler);
        } else {
            el.removeEventListener(type, handler);
        }

        var listeners = listenerStore.get(el);
        if (listeners) {
            listenerStore.set(el, listeners.filter(function(l) {
                return l.type !== type || l.handler !== handler;
            }));
        }
        return;
    }
    // Remove all listeners (optionally filtered by type)
    var listeners = listenerStore.get(el);
    if (listeners) {
        var remaining = [];
        for (var i = 0; i < listeners.length; i++) {
            if (type && listeners[i].type !== type) {
                remaining.push(listeners[i]);
            } else {
                if (listeners[i].jquery) {
                    window.jQuery(el).off(listeners[i].type, listeners[i].handler);
                } else {
                    el.removeEventListener(listeners[i].type, listeners[i].handler);
                }
            }
        }
        listenerStore.set(el, remaining);
    }
}
