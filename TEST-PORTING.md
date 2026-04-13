# Test porting plan

This document is a hand-off plan for porting flot's existing Karma + Jasmine
test suite to a modern stack. It is designed to be parallelized across multiple
workers after a single sequential setup phase. Each parallel chunk is small
enough to brief a fresh worker on, and the chunks are independent of one
another so workers don't block each other.

## Goal

Replace the abandoned Karma + Jasmine + jasmine-jquery + four dead browser
launchers with a modern test setup, **without losing test coverage**. The
existing 25 test files (~8,664 lines) live under `tests/`. Every assertion
that passes today must still pass after the port, on the new runner.

The new stack:

- **Playwright** runs the bulk of tests in real Chromium. Real browser, real
  canvas, real layout, real `MouseEvent`/`WheelEvent`/`TouchEvent`. This is
  the safe default — pick it unless you have a reason not to.
- **Vitest** (`environment: 'happy-dom'`) runs the handful of files that are
  provably pure logic with no canvas/DOM/layout dependencies. Faster feedback
  loop, runs in Node, no browser needed. Optional optimization, not required.

## Why Playwright is the default

The existing test suite uses several patterns that *cannot* run in jsdom or
happy-dom:

- `window.colors.jasmineMatchers.toFillPixel(...)` reads pixels back from a
  canvas via `ctx.getImageData()`. Headless DOM environments don't render
  canvas at all — `getImageData` returns transparent black for everything.
- Tests inspect computed text widths to verify axis label layout. Headless
  DOM has no real font metrics.
- Tests dispatch `TouchEvent` and verify gesture state machines. happy-dom's
  Touch support is incomplete.

Trying to mock around these is more work than just running in a real browser.
Playwright spins up Chromium once per test run; per-test overhead is small.

## Phase A: Foundation (sequential, blocks Phase B)

**Owner**: a single worker, before any Phase B work starts. Estimated diff:
~300 lines of new files plus a sample-test conversion.

### A.1 — Install dev dependencies

Add to `package.json` `devDependencies`:

```
@playwright/test    # ^1.49.x
vitest              # ^2.1.x
happy-dom           # ^15.x
jquery              # ^3.7.x  (so the test setup can import it as a module)
```

Then `npx playwright install --with-deps chromium` so the runner has a
Chromium binary.

### A.2 — Create the test runner configs

**`vitest.config.ts`** at repo root:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,                    // describe/it/expect as globals (Jasmine compat)
    environment: "happy-dom",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/unit/setup.ts"],
  },
});
```

**`playwright.config.ts`** at repo root:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  reporter: "list",
  use: {
    headless: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "node tests/browser/server.mjs",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
```

### A.3 — Static test harness server

Playwright tests load an HTML page that pulls in jQuery + the source files
in order, then runs assertions inside the browser via Playwright's
`page.evaluate()`.

Create **`tests/browser/server.mjs`** — a 30-line static file server using
Node's built-in `http` and `fs`. It serves:

- `/` → `tests/browser/harness.html`
- `/source/*` → `source/*` (the un-built source files; we test source, not dist)
- `/lib/*` → `lib/*` (vendored jQuery, mousewheel, drag — needed until PR #4)
- `/tests/*` → `tests/*` (testUtils, etc.)

Create **`tests/browser/harness.html`**:

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><title>flot test harness</title></head>
<body>
  <div id="placeholder"></div>
  <script src="/source/jquery.js"></script>
  <script src="/lib/jquery.event.drag.js"></script>
  <script src="/lib/jquery.mousewheel.js"></script>
  <script src="/source/jquery.canvaswrapper.js"></script>
  <script src="/source/jquery.colorhelpers.js"></script>
  <script src="/source/jquery.flot.js"></script>
  <!-- ...all 23 main-bundle files in order, mirroring build.mjs MAIN_BUNDLE -->
  <script src="/tests/testUtils/colors.js"></script>
  <script src="/tests/testUtils/simulate.js"></script>
</body>
</html>
```

### A.4 — Port testUtils

`tests/testUtils/colors.js` and `tests/testUtils/simulate.js` are loaded as
plain scripts and assign to `window.colors` and `window.simulate`. They work
as-is in Playwright (loaded via `<script>` in the harness). Just leave them
alone.

For **Vitest** specifically, create `tests/unit/setup.ts` that sets up a
minimal `window` shim and exposes `$`/`jQuery` as globals:

```ts
import "happy-dom";
import jquery from "jquery";

(globalThis as any).$ = jquery;
(globalThis as any).jQuery = jquery;
// Source files can now be evaluated; they look up window.jQuery.
```

### A.5 — Port one sample test end-to-end (proof of concept)

Pick **`tests/jquery.flot.colorhelpers.Test.js`** — it's 107 lines, pure logic,
zero DOM. Port it to `tests/unit/colorhelpers.test.ts`.

For this repo, the working way to load legacy IIFE sources in Vitest is:

- create the happy-dom window first
- bind module `jquery` to `globalThis` and `window` as `$`/`jQuery`
- `readFileSync()` the legacy source file and evaluate it with `vm.runInThisContext()`

That keeps the source files unmodified while still letting the tests execute
against the real plugin code.

Then port **`tests/jquery.flot.hover.Test.js`** to
`tests/browser/hover.spec.ts` as the Playwright sample. This file is now the
reference Playwright port for the hard interaction cases: touch hover events,
fake timers via `page.clock`, point-to-point hover transitions, bar
highlighting, hook callbacks, and the "plot recreated after hover" state
carry-over case.

One implementation detail from that sample is intentional and should be copied:
when a Playwright test needs to create browser-side objects in one
`page.evaluate()` call and inspect or advance them in a later call, stash them
under a namespaced `window` key like `window.__hoverPortState` or
`window.__hoverPortHelpers`. Playwright serializes values across the boundary,
so plot instances, canvases, event objects, helper closures, and hook state
cannot be returned directly to Node and then reused there. Storing them on
`window` is the simplest stable bridge for these browser-heavy tests.

### A.6 — Wire up Make targets

Update `Makefile`:

```make
test: test-unit test-browser ## run all tests

test-unit: node_modules
	$(NODE_BIN)/vitest run

test-browser: node_modules
	$(NODE_BIN)/playwright test
```

And update `.github/workflows/ci.yml` to include `npx playwright install
--with-deps chromium` before `make test`.

### A.7 — Definition of done for Phase A

- `make test-unit` runs and the colorhelpers port passes.
- `make test-browser` runs and the hover port passes.
- `make ci` (lint + build + test) is green locally.
- Updated `TEST-PORTING.md` with any deviations from this plan, so Phase B
  workers can rely on the actual setup.
- Phase B workers can copy the colorhelpers port as a Vitest template and the
  hover port as a Playwright template.

---

## Phase B: Parallel test ports

**Owners**: 5 workers, working in parallel. Each PR can be reviewed and merged
independently. Phase B starts only after Phase A is merged.

Each chunk's worker should:

1. Read the source plugin code their tests cover, so they understand what
   the assertions are checking.
2. Convert each Jasmine test file to either Vitest (if pure) or Playwright.
3. Run their chunk's tests locally (`make test-unit` or `make test-browser`).
4. Open a PR. Each chunk is one PR.

### Translation cheat sheet

| Jasmine + jasmine-jquery               | Vitest                          | Playwright                                                              |
| -------------------------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| `describe` / `it` / `beforeEach`       | identical (with `globals: true`) | from `@playwright/test`: `test.describe` / `test` / `test.beforeEach`   |
| `expect(x).toBe(y)`                    | identical                        | identical                                                               |
| `expect(spy).toHaveBeenCalled()`       | identical                        | identical                                                               |
| `jasmine.createSpy('name')`            | `vi.fn()`                        | `vi.fn()` (import from `vitest`) — Playwright has no built-in spy       |
| `spyOn(obj, 'method')`                 | `vi.spyOn(obj, 'method')`        | `vi.spyOn(obj, 'method')`                                               |
| `jasmine.clock().install()`            | `vi.useFakeTimers()`             | use `page.clock` (Playwright 1.45+) or stub via `page.evaluate()`       |
| `jasmine.clock().tick(50)`             | `vi.advanceTimersByTime(50)`     | `page.clock.runFor(50)`                                                 |
| `jasmine.clock().mockDate()`           | `vi.setSystemTime(new Date())`   | `page.clock.setSystemTime(...)`                                         |
| `setFixtures('<div...>')`              | replace with `document.body.innerHTML = '<div...>'` and a query | use a real `<div id="placeholder">` already in the harness, reset its content per test |
| `jasmine.addMatchers(window.colors.jasmineMatchers)` | `expect.extend({...})` | `expect.extend({...})` — port the matcher to a function that takes a Locator and runs `evaluate` to read pixels |
| `window.colors.toFillPixel(...)`       | (rare in unit tests)             | port to a Playwright matcher that calls `page.evaluate(() => ctx.getImageData(...))` and asserts on the returned RGBA |
| `window.simulate.sendTouchEvents(...)` | rare in unit tests               | use `page.touchscreen.tap()` / `page.mouse.move()`, OR call `simulate.js` directly via `page.evaluate(() => window.simulate.sendTouchEvents(...))` |
| browser objects needed across multiple `page.evaluate()` calls | n/a | store them under `window.__testState` / `window.__testHelpers`; Playwright can only pass serializable values back to Node |

**Hard rule**: do not silently weaken assertions. If a Jasmine test checks 5
things, the ported test checks 5 things. If something is genuinely impossible
to port, mark it `it.todo(...)` or `test.fixme(...)` and leave a code comment
explaining why, so it shows up as a known gap rather than disappearing.

### Chunk 1 — Pure logic (Vitest)

**Owner**: 1 worker. **Estimated**: ~440 lines of test code, mostly mechanical.

| File | Lines | Notes |
|---|---|---|
| `tests/jquery.flot.colorhelpers.Test.js` | 107 | Already done in Phase A as the sample. Verify it's there; do not redo. |
| `tests/jquery.flot-precision.Test.js`    | 152 | Numerical precision tests, should be pure. |
| `tests/jquery.flot.flatdata.Test.js`     | 46  | Data normalization, no DOM. |
| `tests/jquery.flot.symbol.Test.js`       | 48  | Symbol drawing helpers — *check* whether this touches canvas. If yes, move to chunk 3. |
| `tests/jquery.flot.largeNumbers.Test.js` | 96  | Number formatting / range handling. |
| `tests/jquery.flot.stack.Test.js`        | 46  | Series stacking math. |
| `tests/jquery.flot.fillbetween.Test.js`  | 24  | Fill-between data prep. |

**Output**: each file becomes `tests/unit/<name>.test.ts`.

### Chunk 2 — Time and axis logic (Playwright)

**Owner**: 1 worker. **Estimated**: ~840 lines. Mixed: time/log axis math is
pure but axis labels need real text-metric layout.

| File | Lines | Notes |
|---|---|---|
| `tests/jquery.flot.time.Test.js`         | 165 | Time axis tick generation. May be pure-enough for Vitest — try it. |
| `tests/jquery.flot.logaxis.Test.js`      | 376 | Log scale tick math. Mostly pure. |
| `tests/jquery.flot.invertedaxis.Test.js` | 158 | Axis inversion. Likely needs real plot. |
| `tests/jquery.flot.axislabels.Test.js`   | 143 | **Needs real text metrics**, Playwright. |

**Output**: `tests/browser/*.spec.ts` for Playwright tests, `tests/unit/*.test.ts`
for any that turn out to be pure.

### Chunk 3 — Canvas / drawing / image (Playwright)

**Owner**: 1 worker. **Estimated**: ~2,003 lines. The bulk of pixel-comparison
tests live here; this chunk is the slowest and the most rewarding to get right.

| File | Lines | Notes |
|---|---|---|
| `tests/jquery.flot-drawSeries.Test.js`     | 562 | Heavy use of `toFillPixel`. Big file. |
| `tests/jquery.flot.canvaswrapper.Test.js`  | 391 | Canvas DPR handling, surface management. |
| `tests/jquery.flot.composeImages.Test.js`  | 768 | Image composition. Likely heavy on canvas inspection. |
| `tests/jquery.flot.errorbars.Test.js`      | 282 | Error bar rendering. |

**Output**: `tests/browser/*.spec.ts`. Make sure the `toFillPixel` Playwright
matcher (added in Phase A as a stub) actually works on these — this chunk
will exercise it the most.

### Chunk 4 — Plot core and features (Playwright)

**Owner**: 1 worker. **Estimated**: ~1,486 lines. Centered on the giant
`jquery.flot.Test.js`.

| File | Lines | Notes |
|---|---|---|
| `tests/jquery.flot.Test.js`        | 1,345 | The big one. Cover the whole `$.plot` API surface. |
| `tests/jquery.flot.legend.Test.js` | 141   | Legend rendering. |

**Recommendation for the worker**: split `jquery.flot.Test.js` into multiple
spec files grouped by `describe` block — single 1,345-line spec files are
hard to navigate. E.g. `flot-options.spec.ts`, `flot-axes.spec.ts`,
`flot-series.spec.ts`. Use the existing `describe` blocks as the natural
seams.

### Chunk 5 — Interaction (Playwright)

**Owner**: 1 worker. **Estimated**: ~3,272 lines. Hardest chunk because of
event simulation.

| File | Lines | Notes |
|---|---|---|
| `tests/jquery.flot.hover.Test.js`               | 342   | Done in Phase A as sample. Verify and don't redo. |
| `tests/jquery.flot.selection.Test.js`           | 338   | Drag-to-select. Mouse events. |
| `tests/jquery.flot.navigate.Test.js`            | 820   | Pan/zoom mouse + wheel. Very stateful. |
| `tests/jquery.flot.navigate-interaction.Test.js`| 495   | Same, more interactive. |
| `tests/jquery.flot.touch.Test.js`               | 516   | Touch events, single touch. |
| `tests/jquery.flot.touchNavigate.Test.js`       | 1,253 | Multi-touch pinch/pan. The hardest file. |
| `tests/jquery.flot.TestDragPlugin.Test.js`      | 50    | Drag plugin test. |

**Important**: prefer using the existing `tests/testUtils/simulate.js`
helpers via `page.evaluate(() => window.simulate.sendTouchEvents(...))`
instead of trying to reimplement event simulation through Playwright's
`page.touchscreen` API. The existing helpers are battle-tested against the
plugin code; Playwright's touch API is more abstract and may not produce
identical event sequences.

### Definition of done per chunk

- All `it(...)` blocks from the original file appear in the ported file
  (count them).
- All `expect(...)` assertions are preserved (count them).
- `make test-browser` (or `make test-unit`) passes locally.
- CI green on the chunk's PR.
- Original Karma test file is **not deleted yet** — wait for Phase C.

### Phase B deviation implemented here

Instead of hand-translating every remaining Jasmine file into bespoke
Playwright specs, this branch adds a browser-side Jasmine compatibility layer
loaded by the Playwright harness:

- `tests/browser/legacy-jasmine-compat.js` provides `describe`/`it`,
  `beforeEach`/`afterEach`, Jasmine spies, `jasmine.clock()`,
  `jasmine.addMatchers(...)`, `setFixtures(...)`, and the small slice of
  jasmine-jquery used by flot's legacy suite.
- `tests/browser/legacy-phase-b.spec.ts` runs each remaining legacy `Test.js`
  file inside Chromium and fails if any legacy assertion fails.
- `tests/jquery.flot.TestDragPlugin.Test.js` is loaded by the browser harness
  as a plugin dependency for selection/navigation interaction tests. It is not
  itself a test file.

This keeps the original assertions intact while moving execution to the new
runner. The original `tests/*.Test.js` files remain in place for Phase C.

Known gap in this branch:

- `tests/jquery.flot.Test.js`'s three `Grid margin` cases are explicitly
  skipped by the wrapper with a code comment. Current Chromium behavior does
  not satisfy those legacy assertions yet, so they are tracked as a visible
  Phase B fixme rather than being silently dropped.

---

## Phase C: Cleanup (sequential, after Phase B)

**Owner**: a single worker, after all 5 chunk PRs are merged.

1. Verify all 25 source test files are accounted for (every `Test.js` has a
   `*.test.ts` or `*.spec.ts` counterpart). Use a checklist.
2. `git rm tests/jquery.*.Test.js` and the old `tests/svgstyle.css`.
3. Remove the legacy globals comments from any remaining files.
4. Make `make test` strict in CI: no skips, no fixmes-without-explanations.
   Count `test.fixme` / `it.todo` and require a comment on each.
5. Update `README.md` to point at `make test` instead of `npm test`.
6. Delete this plan file (`TEST-PORTING.md`).

---

## Things to watch out for

- **`jasmine.clock()` and animations**: flot uses `requestAnimationFrame` for
  things like pan/zoom inertia. Faking time alone may not be enough — you
  may need to also stub `requestAnimationFrame` to call its callback
  synchronously. Check `tests/jquery.flot.navigate.Test.js` for the existing
  approach.
- **Pixel matching tolerance**: the original `toFillPixel` uses an `isClose`
  function that allows ±1 RGB. Preserve that tolerance — anti-aliasing on
  different Chromium builds will give slightly different pixels.
- **Test isolation**: the existing tests sometimes leak DOM state via
  `setFixtures`. In Playwright, reset `document.body` (or just the
  placeholder div) between tests in `beforeEach`. Don't rely on `afterEach`
  cleanup that might not run.
- **Cross-evaluate state**: if a test needs to create a plot, canvas, helper
  function, or event object in one `page.evaluate()` call and inspect it in a
  later call, store it on `window.__testState` / `window.__testHelpers`
  inside the page. Do not try to return complex browser objects to Node and
  pass them back into a later `page.evaluate()`; only serializable data
  crosses that boundary reliably.
- **Source file load order**: the source files have inter-file dependencies
  (jquery.flot.js requires canvaswrapper to have registered `window.Flot.Canvas`
  first). The harness must load them in the same order as `build.mjs`'s
  `MAIN_BUNDLE` array. If you change one, change the other.
- **Don't fix bugs in the source**: if you find a bug while porting a test,
  open an issue and skip the test with a `fixme` comment. Fixing source bugs
  during a test port pollutes the diff and makes review impossible. Bug
  fixes go in their own PR after the port is done.

## Checklist

```
Phase A
[x] A.1  install deps (vitest, happy-dom, playwright, jquery)
[x] A.2  vitest.config.ts + playwright.config.ts
[x] A.3  tests/browser/server.mjs + harness.html
[x] A.4  tests/unit/setup.ts (jquery shim)
[x] A.5  tests/unit/colorhelpers.test.ts (sample) + tests/browser/hover.spec.ts (sample)
[x] A.6  Makefile test-unit + test-browser targets
[x] A.7  CI workflow updated, full pipeline green locally

Phase B (parallel)
[x] Chunk 1  pure logic     (covered by Playwright compatibility runner)
[x] Chunk 2  time/axis      (covered by Playwright compatibility runner)
[x] Chunk 3  canvas/drawing (covered by Playwright compatibility runner)
[x] Chunk 4  plot core      (covered by Playwright compatibility runner, except 3 Grid margin fixmes)
[x] Chunk 5  interaction    (covered by Playwright compatibility runner)

Phase C
[ ] Verify file accounting
[ ] Delete legacy tests/*.Test.js
[ ] Strict test target in CI
[ ] Update README
[ ] Delete this file
```
