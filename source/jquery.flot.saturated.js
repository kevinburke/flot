'use strict';

export var saturated = {
		saturate: function (/** @type {number} */ a) {
        if (a === Infinity) {
            return Number.MAX_VALUE;
        }

        if (a === -Infinity) {
            return -Number.MAX_VALUE;
        }

        return a;
    },
		delta: function(/** @type {number} */ min, /** @type {number} */ max, /** @type {number} */ noTicks) {
        return ((max - min) / noTicks) === Infinity ? (max / noTicks - min / noTicks) : (max - min) / noTicks
    },
		multiply: function (/** @type {number} */ a, /** @type {number} */ b) {
        return saturated.saturate(a * b);
    },
    // returns c * bInt * a. Beahves properly in the case where c is negative
    // and bInt * a is bigger that Number.MAX_VALUE (Infinity)
		multiplyAdd: function (/** @type {number} */ a, /** @type {number} */ bInt, /** @type {number} */ c) {
        if (isFinite(a * bInt)) {
            return saturated.saturate(a * bInt + c);
        } else {
            var result = c;

            for (var i = 0; i < bInt; i++) {
                result += a;
            }

            return saturated.saturate(result);
        }
    },
    // round to nearby lower multiple of base
		floorInBase: function(/** @type {number} */ n, /** @type {number} */ base) {
        return base * Math.floor(n / base);
    }
};
