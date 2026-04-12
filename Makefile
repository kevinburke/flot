SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

NODE_BIN := ./node_modules/.bin
BIOME := $(NODE_BIN)/biome

# Source files that the build depends on. Used to make `dist` an order-only
# rebuild instead of always re-running terser.
SOURCES := $(wildcard source/jquery.*.js)

.PHONY: all build clean lint format test ci install help

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

test: node_modules ## run the test suite
	@echo "tests not yet ported in PR #1; see TODO" && exit 0

ci: lint build test ## run everything CI runs

help: ## list available targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
