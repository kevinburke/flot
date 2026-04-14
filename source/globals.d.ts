// Ambient globals referenced by flot source files for browser/environment
// detection. These are intentionally undefined in many environments; the
// source uses `typeof X !== 'undefined'` guards.

declare const opr: { addons?: unknown } | undefined;
declare const InstallTrigger: unknown;
declare const TextEncoderLite: typeof TextEncoder | undefined;
declare const timezoneJS: { Date: new (...args: unknown[]) => Date } | undefined;
