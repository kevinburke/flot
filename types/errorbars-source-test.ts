// Internal source contracts, checked by make types-source-strict-files.
import { createErrorBarFormat } from "../source/jquery.flot.errorbars.js";

const format = createErrorBarFormat("xy", true, false);
const _x: true = format[0].x;
const _y: true = format[1].y;
for (const field of format) {
	const _numeric: true = field.number;
	const _required: true = field.required;
}

// @ts-expect-error error directions are x, y, or xy
createErrorBarFormat("yx");
// @ts-expect-error symmetry is a boolean option
createErrorBarFormat("xy", "true");
// @ts-expect-error the first coordinate must belong to x
const _wrongFirstAxis: (typeof format)[0] = { y: true, number: true, required: true };
// @ts-expect-error every field must have a single axis
const _bothAxes: (typeof format)[number] = { x: true, y: true, number: true, required: true };
// @ts-expect-error every field must belong to an axis
const _noAxis: (typeof format)[number] = { number: true, required: true };
// @ts-expect-error error-bar fields must contain numbers
const _notNumeric: (typeof format)[number] = { x: true, number: false, required: true };
// @ts-expect-error error-bar fields are required
const _notRequired: (typeof format)[number] = { y: true, number: true, required: false };
