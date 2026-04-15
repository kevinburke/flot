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

- [ ] **upstream #1867** — `createLinearGradient` throws
  `Argument 4 is not finite`. No upstream PR. Add `Number.isFinite`
  guard around the call site(s) in `source/jquery.flot.drawSeries.js`
  (and wherever else we build gradients) to skip gradient construction
  when any coordinate is NaN/Infinity.
  - Upstream issue: https://github.com/flot/flot/issues/1867

## Tier 2 — port if Tier 1 lands cleanly

Older but still legitimate; port after verifying the reported bug still
reproduces against current `source/`.

- [ ] **upstream PR #1744** — time-tick milliseconds reset. Two-line
  fix. Pair with issue #1743 for repro steps.
  - https://github.com/flot/flot/pull/1744

- [ ] **upstream PR #1672** — `drawSeries` trailing-step interpolation
  bug. Steps mode draws the final segment incorrectly in some
  configurations.
  - https://github.com/flot/flot/pull/1672

- [ ] **upstream PR #1559 / #1547** — pie plugin undefined reference
  (duplicates of each other; pick one).
  - https://github.com/flot/flot/pull/1559

- [ ] **upstream PR #1750** — legend container fix (#1698).
  - https://github.com/flot/flot/pull/1750

- [ ] **upstream PR #1528** — label-gap bug in multiple-axes layout.
  - https://github.com/flot/flot/pull/1528

- [ ] **upstream PR #1444** — `positions` undefined error.
  - https://github.com/flot/flot/pull/1444

- [ ] **upstream PR #1641** — legend icons missing for series types
  other than lines/bars/points.
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
