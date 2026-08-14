# Sim-PR-Lifier

A cross-browser browser extension that adds focusable change categories to a
GitHub pull request's **Files changed** page. Selections are stored with browser
sync and continue to work as GitHub loads more files or navigates without a full
page refresh.

The pull-request header replaces GitHub's combined line total with a breakdown
for **Core**, **Comments**, **Tests**, **Config**, **Migrations**, and test
**Artifacts**. JSON, JSONC, YAML, and YML files count as Config; SQL counts as
Migrations. Snapshots, golden files, fixtures, recordings, cassettes, and
`testdata` paths count as Artifacts. A category excluded by the active filters
is muted and struck through. An **Other** category appears only if GitHub has not
yet loaded enough file metadata to classify every changed line.

Click one or more categories to compose a focused view, such as **Core +
Config**. Click selected categories again to remove them; clearing the final
selection returns to the full diff. GitHub's gear menu is left unchanged.

Whitespace-only changes are hidden by default. When a pull-request diff opens,
the extension preserves the existing URL options and enables GitHub's native
`w=1` diff mode if it is not already active.

The extension supports both GitHub's current `/changes` interface and the legacy
`/files` interface.

## Supported browsers

Chrome, Firefox, and Edge (Manifest V3).

## Install

1. Open `chrome://extensions` in Chrome/Edge, or
   `about:debugging#/runtime/this-firefox` in Firefox.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this directory.
4. Open a pull request and choose **Files changed**.

Reload an already-open GitHub tab once after installing the extension.

## Test-file detection

The extension recognizes common conventions including `tests/`, `test/`,
`__tests__/`, `spec/`, `e2e/`, Cypress, `*_test.go`, `test_*.py`,
`*.test.tsx`, `*.spec.js`, and popular test-runner config files. Test fixtures,
snapshots, golden files, recordings, and cassettes are classified separately as
Artifacts.

## Development

The extension has no runtime dependencies or build step. To run its tests:

```bash
npm install
npm test
```

To package distributable zips for Chrome and Firefox:

```bash
npm run package
```

The Firefox build adds `browser_specific_settings` to its manifest copy.

## Architecture

- `src/classify.js` — pure file-category classification.
- `src/storage.js` — cross-browser promise-based settings sync and
  extension-context guard.
- `src/dom.js` — DOM selectors, path reading, and line-stat parsing.
- `src/ui.js` — breakdown rendering and filter class application.
- `src/content.js` — orchestrator: lifecycle, scheduling, and routing.
