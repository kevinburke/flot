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
}

interface Document {
    documentMode?: unknown;
}
