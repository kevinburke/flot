# Upstream bug-fix porting plan

Triage of open issues/PRs on upstream `flot/flot` that are worth porting to
`@kevinburke/flot`. Focus: patches, not new features.

Scoring: recent + reproducible + small + has a test > older + speculative.

## Tier 1 — port now

Clean, recent, real crashes or miscalibrations. Port with a test where
feasible, and reference the upstream issue/PR number in the commit.

- [x] **upstream #1869 / PR #1870** — `setupTickGeneration` extraDec
  branch when `axis.delta == 0` (min == max). `Math.log(0) = -Infinity`
  → `extraDec = +Infinity` → either `toFixed(Infinity)` throws
  downstream, or `axis.tickDecimals` silently becomes `Infinity`. Fix:
  skip the extra-decimal branch when `axis.delta <= 0`. Regression test
  in `tests/jquery.flot.Test.js` runs `plot.setupGrid()` a second time
  (no autoScale, skips widening) and asserts `tickDecimals` is finite.
  - Upstream PR: https://github.com/flot/flot/pull/1870
  - Upstream issue: https://github.com/flot/flot/issues/1869

- [x] **upstream #1871 / PR #1872** — Hover highlights points outside
  `mouseActiveRadius` when an axis has `transform`/`inverseTransform`.
  Root cause: `smallestDistance` was seeded with `+Infinity`, so when
  the `maxx`/`maxy` coordinate-space pre-filter is skipped (which it
  is for transformed axes) nothing ever enforces the radius. Seed with
  `maxDistance` (or `maxDistance * maxDistance` for the default
  squared-distance metric). Regression test in
  `tests/browser/hover.spec.ts` uses identity transform on both axes
  and hovers past the radius.
  - Upstream PR: https://github.com/flot/flot/pull/1872
  - Upstream issue: https://github.com/flot/flot/issues/1871

- [x] **upstream #1867** — `ctx.createLinearGradient` threw
  `Argument 4 is not finite floating-point value` when `top` or
  `bottom` reached `NaN` or `±Infinity`. No upstream PR. Added
  `isFinite` guard in the single `createLinearGradient` call site
  (`getColorOrGradient` in `source/jquery.flot.js`) that falls back
  to `defaultColor`. Global `isFinite` coerces `null → 0`, preserving
  behavior for the `drawSeriesPoints` path that passes `(null, null)`.
  Regression tests in `tests/jquery.flot.Test.js` corrupt an axis to
  force non-finite coordinates and assert `plot.draw()` does not
  throw, both for a bar series with gradient fill and for the grid
  background.
  - Upstream issue: https://github.com/flot/flot/issues/1867

## Tier 2 — port if Tier 1 lands cleanly

Older but still legitimate; port after verifying the reported bug still
reproduces against current `source/`.

- [skip] **upstream PR #1744** — already present in our source as of
  upstream commit `0429a1e6` (2022-08-01). No action needed.
  - https://github.com/flot/flot/pull/1744

- [skip] **upstream PR #1672** — superseded by upstream PR #1830
  ("Fix drawSeries step mode to connect last two points when middle
  point is present"), which is in our source. No action needed.
  - https://github.com/flot/flot/pull/1672

- [x] **upstream PR #1559 / #1547** — pie plugin read `options` from
  closure that was `null` until `processDatapoints` ran. Added a
  local `var options = plot.getOptions();` at the top of
  `drawDonutHole` and `triggerClickHoverEvent`.
  - https://github.com/flot/flot/pull/1559

- [x] **upstream PR #1750** — legend container could be a jQuery
  wrapper rather than a DOM element. Inlined the unwrap
  (`container.get(0)` → `container[0]`) inside
  `insertLegend` since this fork is jQuery-optional.
  - https://github.com/flot/flot/pull/1750

- [skip] **upstream PR #1528** — the PR changes range-update semantics
  for multi-axis plots in a way that isn't clearly a bug fix (and has
  no unit test). Leaving alone.
  - https://github.com/flot/flot/pull/1528

- [x] **upstream PR #1444** — `positions == null` guard added in
  `canvaswrapper.removeText` to avoid a crash when the text cache
  contains entries without a `positions` array.
  - https://github.com/flot/flot/pull/1444

- [x] **upstream PR #1641** — legend entries for plugin-drawn series
  (pie, errorbars, custom symbols) now render a `#box` fallback icon
  instead of label-only. Added a new `#box` SVG symbol and a `case
  'box'` in `getEntryIconHtml`. The upstream `else if` chain was
  *not* ported because it regresses intentional overlay combos
  (e.g. lines + points).
  - https://github.com/flot/flot/pull/1641

## Tier 3 — investigate, possibly synthesize

Competing patches or reports without PRs; need judgment.

- [ ] **upstream #1789 / PR #1790 / PR #1793** — pan gets locked at
  `panRange[0]` for y-axis. #1793 is a minimal 4-line swap for y-axis.
  #1790 is more thorough (handles inverted axes) and ships with tests,
  but is 190 lines. Evaluate whether #1790 supersedes #1793 cleanly;
  if so port #1790. If not, port #1793 as the minimal fix.

- [ ] **upstream #1838** — legend `Cannot set properties of undefined`
  when the container element isn't in the DOM yet. Reporter proposes
  writing `legendEl.style` instead of `options.legend.container.style`.
  Verify this doesn't regress the external-container use case.

- [ ] **upstream #1773** — `Cannot read property 'floorInBase'` crash.
  Needs a repro; log-axis territory.

## Explicitly skipped

- All RohitPaul0007 PRs (#1840–1862) — mechanical `var` → `let` edits
  on files we've either deleted (`build.js`, `gulpfile.js`,
  `karma.conf.js`, vendored `jquery.js`) or don't want to churn.
- All upstream Dependabot bumps (#1746, #1758, #1759, #1764, #1777,
  #1778, #1780, #1782, #1783, #1791, #1812, #1814, #1822–1833) — our
  dev-dep tree is completely different (Rollup/Vitest/Playwright vs.
  gulp/karma).
- `reedy` delete-file PRs (#1753, #1754, #1755) — already done in our
  rewrite.
- Feature requests (#1513 fill function, #1508 ellipsis option, #1487
  tickLineWidth, #1816 nanoseconds, #1538 symbol spin, etc.) — user
  preference is patches over features; revisit separately.

## Porting checklist (per PR)

1. Fetch upstream patch: `gh pr diff <N> --repo flot/flot`.
2. Apply to `source/` (note: our files are ES modules; upstream is
   jQuery IIFE — adjust exports/imports).
3. Add or port the test. Upstream uses Jasmine; our unit tests use
   Vitest and browser tests use Playwright + a Jasmine compat shim.
4. Run `make ci` locally.
5. Commit with message referencing upstream issue and PR:
   `fix(<package>): <summary> (upstream #NNNN via PR #MMMM)`.
6. Update CHANGELOG.md under an "Unreleased" heading.
