'use strict';

export var saturated = {
		/** @param {number} a */
		saturate: function (a) {
        if (a === Infinity) {
            return Number.MAX_VALUE;
        }

        if (a === -Infinity) {
            return -Number.MAX_VALUE;
        }

        return a;
    },
		/** @param {number} min @param {number} max @param {number} noTicks */
		delta: function(min, max, noTicks) {
        return ((max - min) / noTicks) === Infinity ? (max / noTicks - min / noTicks) : (max - min) / noTicks
    },
		/** @param {number} a @param {number} b */
		multiply: function (a, b) {
        return saturated.saturate(a * b);
    },
    // returns c * bInt * a. Beahves properly in the case where c is negative
    // and bInt * a is bigger that Number.MAX_VALUE (Infinity)
		/** @param {number} a @param {number} bInt @param {number} c */
		multiplyAdd: function (a, bInt, c) {
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
		/** @param {number} n @param {number} base */
		floorInBase: function(n, base) {
        return base * Math.floor(n / base);
    }
};
