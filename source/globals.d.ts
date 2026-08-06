// Ambient globals referenced by flot source files for browser/environment
// detection. These are intentionally undefined in many environments; the
// source uses `typeof X !== 'undefined'` or `!!window.X` guards.

declare const opr: { addons?: unknown } | undefined;
declare const InstallTrigger: unknown;
declare const TextEncoderLite: typeof TextEncoder | undefined;
declare const timezoneJS: { Date: new (...args: unknown[]) => Date } | undefined;

// Browser-specific / non-standard globals accessed for feature detection.
interface Window {
	opr?: { addons?: unknown };
	opera?: unknown;
	chrome?: { webstore?: unknown };
	StyleMedia?: unknown;
	safari?: { pushNotification?: unknown };
	HTMLElement: typeof HTMLElement;
	Flot?: {
		Canvas?: unknown;
		plugins?: unknown;
		helpers?: unknown;
	};
}

interface Document {
	documentMode?: unknown;
}

interface FlotGesturePagePoint {
	/** Horizontal page coordinate in CSS pixels from the document's left edge. */
	x: number;
	/** Vertical page coordinate in CSS pixels from the document's top edge. */
	y: number;
}

interface FlotGestureTouchEvent extends TouchEvent {
	firstTouch?: FlotGesturePagePoint;
	secondTouch?: FlotGesturePagePoint;
}

// Augment TypeScript's generated DOM event map through interface declaration
// merging. Upstream references:
// https://github.com/microsoft/TypeScript-DOM-lib-generator
// https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces
interface HTMLElementEventMap {
	doubletap: CustomEvent<
		FlotGestureTouchEvent & {
			firstTouch: FlotGesturePagePoint;
			secondTouch: FlotGesturePagePoint;
		}
	>;
	longtap: CustomEvent<FlotGestureTouchEvent>;
	pandrag: CustomEvent<FlotGestureTouchEvent>;
	panend: CustomEvent<FlotGestureTouchEvent>;
	panstart: CustomEvent<FlotGestureTouchEvent>;
	pinchdrag: CustomEvent<FlotGestureTouchEvent>;
	pinchend: CustomEvent<FlotGestureTouchEvent>;
	pinchstart: CustomEvent<FlotGestureTouchEvent>;
	tap: CustomEvent<FlotGestureTouchEvent>;
	touchevent: CustomEvent<FlotGestureTouchEvent>;
}
