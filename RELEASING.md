# Releasing @kevinburke/flot

## Pre-release checklist

1. Make sure `main` is clean and CI is green:

   ```bash
   git checkout main && git pull
   make ci
   ```

2. Bump the version in two places:

   - `package.json` → `"version": "X.Y.Z"`
   - `source/jquery.flot.js` → `export var version = "X.Y.Z";`

3. Update `CHANGELOG.md` with a new section for the version. Include
   the date and a summary of changes.

4. Commit the version bump:

   ```bash
   git add package.json package-lock.json source/jquery.flot.js CHANGELOG.md
   git commit -m "release: vX.Y.Z"
   git push origin main
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

9. Update the CDN URLs in `README.md` if the major version changed.

10. Verify the package is available:

    ```bash
    npm view @kevinburke/flot version
    curl -I https://unpkg.com/@kevinburke/flot@X.Y.Z/dist/flot.min.js
    ```

## Versioning

Follow [semver](https://semver.org/):

- **Patch** (5.0.1): bug fixes, no API changes.
- **Minor** (5.1.0): new features, backwards compatible.
- **Major** (6.0.0): breaking API changes.
