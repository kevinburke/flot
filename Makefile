SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

NODE_BIN := ./node_modules/.bin
BIOME := $(NODE_BIN)/biome

# Source files that the build depends on. Used to make `dist` an order-only
# rebuild instead of always re-running terser.
SOURCES := $(wildcard source/jquery.*.js)

.PHONY: all build clean lint format test test-unit test-browser size types types-source publint ci install help

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

types-source: node_modules ## run tsc --checkJs on source; fail if error count exceeds baseline
	@set -euo pipefail; \
	count=$$($(NODE_BIN)/tsc --project tsconfig.json 2>&1 | grep -c "error TS" || true); \
	baseline=$$(cat .tsc-baseline); \
	echo "tsc source errors: $$count (baseline $$baseline)"; \
	if [ "$$count" -gt "$$baseline" ]; then \
		echo "ERROR: error count $$count exceeds baseline $$baseline."; \
		echo "Fix new errors or update .tsc-baseline (only to decrease it)."; \
		$(NODE_BIN)/tsc --project tsconfig.json 2>&1 | grep "error TS" | head -20; \
		exit 1; \
	fi; \
	if [ "$$count" -lt "$$baseline" ]; then \
		echo "Error count decreased — please update .tsc-baseline to $$count"; \
	fi

publint: build ## validate package.json fields and exports
	npx --yes publint

ci: lint build test size types types-source publint ## run everything CI runs

help: ## list available targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
