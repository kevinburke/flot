SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

NODE_BIN := ./node_modules/.bin
BIOME := $(NODE_BIN)/biome

# Source files that have completed the strictness migration. Keep this list in
# sync with tsconfig.strict-files.json; the file-specific target below makes
# each entry independently reviewable in CI.
STRICT_SOURCE_FILES := \
	source/helpers.js \
	source/jquery.canvaswrapper.js \
	source/jquery.colorhelpers.js \
	source/jquery.flot.browser.js \
	source/jquery.flot.saturated.js

# Source files that the build depends on. Used to make `dist` an order-only
# rebuild instead of always re-running terser.
SOURCES := $(wildcard source/jquery.*.js)

.PHONY: all build clean format test test-unit test-browser size types types-source types-source-strict types-source-strict-files types-source-file publint ci install help

all: build

# `node_modules` is a real directory target. We touch it after install so
# `make` sees it as newer than package.json on subsequent runs and skips the
# install step. Without the touch, `make` would reinstall every time because
# npm install doesn't update the directory mtime.
node_modules: package.json
	npm install --no-audit --no-fund
	@touch node_modules

install: node_modules ## install build/test dependencies into node_modules

build: node_modules $(SOURCES) rollup.config.js source/index.js ## build dist/ artifacts via Rollup
	$(NODE_BIN)/rollup --config rollup.config.js

clean: ## remove built artifacts
	rm -rf dist

lint: node_modules ## run biome lint + format check
	$(BIOME) check .

format: node_modules ## auto-format with biome
	$(BIOME) check --write .

test: test-unit test-browser ## run the test suite

test-unit: build ## run unit tests in vitest
	$(NODE_BIN)/vitest run

test-browser: build ## run browser tests in playwright
	$(NODE_BIN)/playwright test

size: build node_modules ## check bundle size budget (brotli)
	$(NODE_BIN)/size-limit

types: node_modules ## type-check the .d.ts files and compile test
	$(NODE_BIN)/tsc --project types/tsconfig.json

types-source: node_modules ## run the current source check during strictness migration
	$(NODE_BIN)/tsc --project tsconfig.json --noImplicitAny false --noImplicitThis false

types-source-strict: node_modules ## run the fully strict source check
	$(NODE_BIN)/tsc --project tsconfig.json

types-source-strict-files: node_modules ## strictly check the migrated source files
	@for source_file in $(STRICT_SOURCE_FILES); do \
		test -n "$$source_file"; \
		$(NODE_BIN)/tsc --ignoreConfig --allowJs --checkJs --noEmit --noImplicitAny --noImplicitThis --strictNullChecks false --skipLibCheck --target ES2019 --module ESNext --moduleResolution bundler --lib ES2019,DOM --types jquery source/globals.d.ts "$$source_file"; \
	done

types-source-file: node_modules ## strictly check one source file and its imports
	test -n "$(FILE)"
	$(NODE_BIN)/tsc --ignoreConfig --allowJs --checkJs --noEmit --noImplicitAny --noImplicitThis --strictNullChecks false --skipLibCheck --target ES2019 --module ESNext --moduleResolution bundler --lib ES2019,DOM --types jquery source/globals.d.ts $(FILE)

publint: build ## validate package.json fields and exports
	npx --yes publint

ci: lint build test size types types-source types-source-strict-files publint ## run everything CI runs

help: ## list available targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
