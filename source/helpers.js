// Vanilla replacements for jQuery utility functions used throughout flot.

/** @param {any} value */
function isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') {
        return false;
    }

    var prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

/** @param {any} value @returns {any} */
function cloneDeepValue(value) {
    if (Array.isArray(value)) {
        return value.map(cloneDeepValue);
    }

    if (isPlainObject(value)) {
		/** @type {Record<string, any>} */
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
/** @param {...any} args */
export function extend(...args) {
    var deep = args[0],
        target = args[1],
        sources = args.slice(2);
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
            if (key === '__proto__' || key === 'constructor') {
                continue;
            }
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
/** @param {HTMLElement} el */
export function width(el) {
    return el.clientWidth;
}

// Get inner height of an element.
/** @param {HTMLElement} el */
export function height(el) {
    return el.clientHeight;
}

// Get or set a CSS property on an element.
/** @param {HTMLElement} el @param {string} prop @param {any} [val] */
export function css(el, prop, val) {
    if (val !== undefined) {
		/** @type {any} */ (el.style)[prop] = typeof val === 'number' ? val + 'px' : val;
        return undefined;
    }
	return /** @type {any} */ (getComputedStyle(el))[prop];
}

// Store or retrieve arbitrary data on an element.
/** @type {WeakMap<object, Record<string, any>>} */
var dataStore = new WeakMap();

/** @param {HTMLElement} el @param {string} key @param {any} [val] */
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

/** @param {HTMLElement} el @param {string} key */
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

// Default trigger: dispatches a native CustomEvent with extra args stashed
// on `event.detail` (an array). The jQuery adapter overrides this via
// setTrigger so handlers bound with $(el).on(type, fn) receive the extra
// args as positional parameters, matching upstream flot/flot behavior.
/** @type {(el: any, type: string, args?: any) => Event} */
var triggerImpl = function(el, type, args) {
    var event = new CustomEvent(type, {
        detail: args || [],
        bubbles: true,
        cancelable: true
    });
    el.dispatchEvent(event);
    return event;
};

/** @param {any} el @param {string} type @param {any} [args] */
export function trigger(el, type, args) {
    return triggerImpl(el, type, args);
}

/** @param {(el: any, type: string, args?: any) => any} fn */
export function setTrigger(fn) {
    triggerImpl = fn;
}

// Bind an event listener, tracking it so unbindAll can remove it later.
/** @type {WeakMap<object, Array<{type: string, handler: EventListener}>>} */
var listenerStore = new WeakMap();

/** @param {HTMLElement} el @param {string} type @param {EventListener} handler */
export function bind(el, type, handler) {
    el.addEventListener(type, handler);
    var listeners = listenerStore.get(el);
    if (!listeners) {
        listeners = [];
        listenerStore.set(el, listeners);
    }
    listeners.push({ type: type, handler: handler });
}

/** @param {HTMLElement} el @param {string} [type] @param {EventListener} [handler] */
export function unbind(el, type, handler) {
    if (type && handler) {
        el.removeEventListener(type, handler);
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
                el.removeEventListener(listeners[i].type, listeners[i].handler);
            }
        }
        listenerStore.set(el, remaining);
    }
}
