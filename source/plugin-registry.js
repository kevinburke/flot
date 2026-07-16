/**
 * Shared registry populated by Flot plugins at module initialization time.
 *
 * Plugin init functions deliberately accept different plot extensions, so the
 * registry only constrains the stable metadata shared by every plugin.
 *
 * @type {Array<{ init: Function, options?: object, name?: string, version?: string }>}
 */
export const plugins = [];
