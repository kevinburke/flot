# Releasing @kevinburke/flot

## Pre-release checklist

1. Create a release worktree from the latest `origin/main`. Do not commit
   in the primary checkout:

   ```bash
   set -euo pipefail
   ~/local/bin/create-worktree -m -b main release-X.Y.Z
   cd worktrees/release-X.Y.Z
   ```

2. Bump the version consistently:

   - `package.json` → `"version": "X.Y.Z"`
   - `package-lock.json` → top-level and root package versions
   - `source/jquery.flot.js` → `export var version = "X.Y.Z";`

3. Update `CHANGELOG.md` with a new section for the version. Include
   the date and a summary of changes. Update the CDN URLs in `README.md`.

   Install the locked dependencies, then run all release checks and inspect
   the package contents:

   ```bash
   npm ci --no-audit --no-fund
   npx playwright install chromium
   make ci
   npm pack --dry-run
   ```

4. Commit the version bump:

   ```bash
   safegit add package.json package-lock.json source/jquery.flot.js CHANGELOG.md README.md
   printf 'release: vX.Y.Z\n' > /tmp/flot-release-commit.txt
   safegit commit --file /tmp/flot-release-commit.txt
   git push origin HEAD:main
   ```

5. Wait for CI to pass:

   ```bash
   github-actions wait
   ```

## Publish

6. Publish to npm (the `prepack` script runs the Rollup build
   automatically):

   ```bash
   npm publish --access public
   ```

7. Tag and push the release:

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

8. Create a GitHub Release:

   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes "Release notes here."
   ```

   Or use `--generate-notes` to auto-generate from commits.

## Post-release

9. Verify the package is available:

    ```bash
    npm view @kevinburke/flot version
    curl --fail --head https://unpkg.com/@kevinburke/flot@X.Y.Z/dist/flot.min.js
    ```

## Versioning

Follow [semver](https://semver.org/):

- **Patch** (5.0.1): bug fixes, no API changes.
- **Minor** (5.1.0): new features, backwards compatible.
- **Major** (6.0.0): breaking API changes.
