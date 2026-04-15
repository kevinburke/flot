# @kevinburke/flot

A JavaScript plotting library for engineering and scientific applications.

This is a maintained fork of [flot/flot](https://github.com/flot/flot), which
has been unmaintained since 2019. The plotting API and behavior are the same;
this fork modernizes the build toolchain, test infrastructure, and packaging.

## Differences from flot/flot

- **No jQuery required**: the core library works without jQuery. A jQuery
  adapter is included for backwards compatibility with existing `$.plot()`
  code.
- **ES module output**: `import { plot } from '@kevinburke/flot'` works with
  modern bundlers. Tree-shakeable.
- **No vendored dependencies**: `jquery.event.drag`, `jquery.mousewheel`, and
  `globalize` replaced with native Pointer Events, `wheel` event, and `Intl`.
- **Build**: Rollup produces ES module, IIFE, and minified outputs. Source
  files are ES modules.
- **Tests**: Vitest (unit) + Playwright (browser). All original assertions
  preserved.
- **CI**: GitHub Actions. Size budget enforced via size-limit (30 KB brotli).
- **IE dropped**: minimum target is ES2019 (Chrome 73+, Firefox 67+, Safari
  12.1+, Edge 79+).

## Installation

```bash
npm install @kevinburke/flot
```

## Usage without jQuery

As an ES module:

```js
import { plot } from '@kevinburke/flot';

plot(document.getElementById('placeholder'), data, options);
```

Or via `<script>` tag from a CDN:

```html
<script src="https://unpkg.com/@kevinburke/flot@5.1.0/dist/flot.min.js"></script>
<script>
  Flot.plot(document.getElementById('placeholder'), data, options);
</script>
```

## Usage with jQuery (backwards compatible)

```html
<script src="https://unpkg.com/jquery@3/dist/jquery.min.js"></script>
<script src="https://unpkg.com/@kevinburke/flot@5.1.0/dist/jquery.flot.min.js"></script>
<script>
  $.plot("#placeholder", data, options);
</script>
```

The jQuery adapter registers `$.plot()`, `$.color`, and `$.fn.plot()` so
existing code works unchanged.

## Basic example

Create a placeholder div with explicit dimensions:

```html
<div id="placeholder" style="width:600px;height:300px"></div>
```

Then call `plot`:

```js
import { plot } from '@kevinburke/flot';

plot(document.getElementById('placeholder'), [
  [[0, 0], [1, 1], [2, 4]],
  [[0, 3], [4, 8], [8, 5]],
], { yaxis: { max: 10 } });
```

The plot function draws the chart immediately and returns a plot object. See
the [API reference](docs/API.md) for the full option set.

## Documentation

- [API reference](docs/API.md)
- [Plugins](docs/PLUGINS.md)
- [Interactions](docs/interactions.md)
- Examples are in the `examples/` directory.

## Development

All commands go through Make:

```bash
make install     # install dependencies into node_modules
make build       # build dist/ (main bundle + standalone plugins)
make lint        # run Biome lint + format check
make format      # auto-format with Biome
make test        # run all tests (Vitest unit + Playwright browser)
make size        # check bundle size budget (brotli)
make ci          # lint + build + test + size (what CI runs)
make help        # list all targets
```

## Releasing

```bash
# bump version in package.json + source/jquery.flot.js, update CHANGELOG
make ci          # verify everything passes
npm publish      # prepack hook runs the build automatically
git tag v5.x.y && git push origin v5.x.y
```

## License

MIT. See [LICENSE.txt](LICENSE.txt).
