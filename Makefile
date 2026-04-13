SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

NODE_BIN := ./node_modules/.bin
BIOME := $(NODE_BIN)/biome

# Source files that the build depends on. Used to make `dist` an order-only
# rebuild instead of always re-running terser.
SOURCES := $(wildcard source/jquery.*.js)

.PHONY: all build clean lint format test test-unit test-browser size ci install help

all: build

# `node_modules` is a real directory target. We touch it after install so
# `make` sees it as newer than package.json on subsequent runs and skips the
# install step. Without the touch, `make` would reinstall every time because
# npm install doesn't update the directory mtime.
node_modules: package.json
	npm install --no-audit --no-fund
	@touch node_modules

install: node_modules ## install build/test dependencies into node_modules

build: node_modules $(SOURCES) build.mjs ## build dist/ artifacts (main bundle + standalone plugins)
	node build.mjs

clean: ## remove built artifacts
	rm -rf dist

lint: node_modules ## run biome lint + format check
	$(BIOME) check .

format: node_modules ## auto-format with biome
	$(BIOME) check --write .

test: test-unit test-browser ## run the test suite

test-unit: node_modules ## run unit tests in vitest
	$(NODE_BIN)/vitest run

test-browser: node_modules ## run browser tests in playwright
	$(NODE_BIN)/playwright test

size: build node_modules ## check bundle size budget (brotli)
	$(NODE_BIN)/size-limit

ci: lint build test size ## run everything CI runs

help: ## list available targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
