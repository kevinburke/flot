# @kevinburke/flot

A JavaScript plotting library for engineering and scientific applications.

This is a maintained fork of [flot/flot](https://github.com/flot/flot), which
has been unmaintained since 2019. The plotting API and behavior are the same;
this fork modernizes the build toolchain, test infrastructure, and packaging.

## Differences from flot/flot

- **Package**: published as `@kevinburke/flot` on npm (v5.0.0+).
- **Build**: gulp + babel + uglify replaced with terser (ES2019 target). Build
  is a single `build.mjs` script with no framework dependencies.
- **Tests**: Karma + Jasmine replaced with Vitest (unit) and Playwright
  (browser). All original test assertions are preserved via a Jasmine
  compatibility layer.
- **Lint**: eslint-config-standard replaced with Biome.
- **CI**: Travis CI and CircleCI replaced with GitHub Actions.
- **Size budget**: size-limit gates the main bundle at 30 KB brotli.
- **Install footprint**: dev dependency count reduced from ~1,000 packages to
  ~90.
- **IE dropped**: minimum target is ES2019 (Chrome 73+, Firefox 67+, Safari
  12.1+, Edge 79+).

The `$.plot()` API, options, events, and plugin interface are unchanged. Code
that works with flot/flot 3.x or 4.x should work with this fork without
modification.

## Installation

```bash
npm install @kevinburke/flot
```

Or include the built file directly via a `<script>` tag:

```html
<script src="jquery.js"></script>
<script src="dist/jquery.flot.min.js"></script>
```

jQuery >= 1.2.6 is required as a peer dependency.

## Basic usage

Create a placeholder div with explicit dimensions:

```html
<div id="placeholder" style="width:600px;height:300px"></div>
```

Then call `$.plot`:

```js
$.plot($("#placeholder"), data, options);
```

Here, `data` is an array of data series and `options` is an object with
settings. A quick example that draws a line from (0, 0) to (1, 1):

```js
$.plot($("#placeholder"), [[[0, 0], [1, 1]]], { yaxis: { max: 1 } });
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

## License

MIT. See [LICENSE.txt](LICENSE.txt).
