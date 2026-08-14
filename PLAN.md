# SimPRler Refactor Plan

> Rebuild a simplified cross-browser browser extension in the empty `SimPRler`
> repo, based on `github-pr-focus` (a Chrome MV3 extension).
> Targets **Chrome / Firefox / Edge**, **plain JS with zero build step**.

## 1. Background & Goals

The original project injects category filters into the GitHub pull request
**Files changed** page so maintainers can manually filter by category
(Code / Comments / Tests / Config / Migrations / Artifacts) and cut review time.

Goals of this rewrite:

- **Feature parity**: keep filtering, per-line comment/code splitting, the line
  breakdown, file-tree filtering, `w=1` whitespace hiding, and settings sync.
- **Simplification**: split the 668-line `content.js` into focused modules,
  drop dead code and legacy-compat logic, replace repetitive boilerplate with
  config-driven code.
- **Three platforms**: WebExtensions-compatible, public APIs only.
- **Zero build**: content scripts use the UMD / global-namespace pattern loaded
  in order (Firefox does not uniformly support ES modules in content scripts,
  so we keep the original multi-file injection approach).
- **Testable**: `node:test` + `jsdom`, no runtime dependencies.

## 2. New Directory Structure

```
SimPRler/
├── manifest.json          # MV3, includes browser_specific_settings (Firefox)
├── src/
│   ├── classify.js        # Pure file-classification functions (mostly original filters.js)
│   ├── storage.js         # Cross-browser storage adapter (promise-based)
│   ├── dom.js             # DOM selectors / path reading / line-stat parsing
│   ├── ui.js              # Breakdown rendering + filter class application (pure side-effect fns)
│   ├── content.js         # Orchestrator: lifecycle / scheduling / routing (much slimmer)
│   └── styles.css         # Styles (kept, dead classes removed)
├── test/
│   ├── classify.test.js
│   ├── storage.test.js
│   ├── dom.test.js
│   └── content.test.js
├── scripts/
│   ├── package.sh         # Produces chrome and firefox zips
│   └── prep-manifest.js   # Generates a Firefox manifest copy with browser_specific_settings
├── package.json           # scripts: test / package
├── .gitignore
├── README.md
└── PLAN.md
```

Content script injection order (the `js` array in manifest):
`classify.js → storage.js → dom.js → ui.js → content.js`, each attaching to a
`globalThis.SimPRler` namespace.

## 3. Module Responsibilities

### classify.js (≈ original filters.js, barely touched)
- `getFileCategory(filePath)` → `source | tests | config | migrations | artifacts`
- `isTestFile` / `isTestArtifact` / `normalizeFilePath`
- Pure functions; tests ported directly.

### storage.js (new; replaces inline chrome.storage calls)
- `getSettings()` / `setSettings()` return Promises.
- Unified namespace: `globalThis.browser?.storage || globalThis.chrome?.storage`.
  - Firefox: `browser.storage.sync` is natively promise-based.
  - Chrome/Edge: `chrome.storage.sync` callbacks wrapped in a Promise.
- Includes `isContextValid()`: only active when `chrome` exists (Firefox has no
  extension-context invalidation), consolidated into one place.

### dom.js (new; aggregates all DOM reads)
- Selector constants (`.js-file`, `[role='region'][id^='diff-']`,
  `[data-testid=...]`, progressive containers, etc.).
- `readFilePath` / `getFileDiffs` (dedupe) / `getFileHideTarget`
- `getChangedLineCells` / `getChangedRows` / `getLineChangeType`
- `getFileLineStats` / `getNativeLineSummaries` / `parseLineStats`
- `getCodeCommentRows` / `isCommentOnlyCell` / `normalizeCodeText` / directive pattern

### ui.js (new; pure side-effect functions)
- `createLineBreakdown()`: builds the 7 stat buttons from a `CATEGORIES`
  config array in a loop, removing the original's 7 repetitive blocks.
- `updateLineStat()` / `renderLineBreakdown()`
- `applyFilters(view)` / `applyFileTreeFilter(view)` / `removeFilters()`

### content.js (orchestrator, target ≤ 200 lines)
- Lifecycle: `loadSettings → refresh → MutationObserver + rAF scheduling`.
- Routing: `isFilesPage()` (supports `/changes` and `/files`).
- `ensureWhitespaceHidden()` (preserves URL params, `history.replaceState` + reload).
- Events: `turbo:load` / `pjax:end` / `popstate` / `pagehide`.
- Unified `deactivate()` cleanup.

## 4. Simplifications (vs. the original)

1. **View model**: the original `renderLineBreakdown` had 7 handwritten blocks;
   replace with a `CATEGORIES` config array + loop.
2. **State**: keep only the single-key `{ focusCategories: [] }` format; drop the
   legacy `focusCategory` migration branch (no legacy users in a new project).
3. **Remove dead code**: `.ghprf-hidden-test` / `.ghprf-hidden-non-test` /
   `.ghprf-hidden-comment` appear only in the `removeFilters` cleanup list and
   CSS, never set anywhere — remove them all.
4. **Context-invalidation handling**: consolidate into a single `isContextValid()`
   in storage.js plus a unified try/catch → `deactivate()` in refresh/save,
   removing scattered check points.
5. **Promise-based storage**: eliminates callback nesting; `loadSettings` /
   `saveSettings` become straightforward.

## 5. Testing Strategy (node:test + jsdom)

| File | Contents |
| --- | --- |
| classify.test.js | Port the original 77-line classification tests (test/non-test/path normalization/category split) |
| storage.test.js | New: both `browser` and `chrome` namespaces, callback→Promise, invalidation guard |
| dom.test.js | New: file-path extraction, line-stat parsing, dedupe selectors |
| content.test.js | Port the 5 original integration scenarios (focus+dynamic content / menu untouched / changes route+progressive / context invalidation / w=1 preserves URL state) |

Verification: `npm install && npm test`.

## 6. Cross-Browser Notes

- **manifest**: `manifest_version: 3`; `browser_specific_settings.gecko.id` is
  only in the packaged Firefox build (`prep-manifest.js` produces a copy).
  Chrome/Edge ignore it without error, but separate artifacts keep AMO clean.
- **API limits**: only `storage.sync`, `runtime.getManifest`, `runtime.id` —
  all public and available in all three browsers.
- **Edge**: Chromium core, behaves like Chrome; same artifact.
- **Events**: `turbo:load` / `pjax:end` / `popstate` are consistent across all three.

## 7. Packaging & Release

- `npm run package` → `dist/simprler-<version>-chrome.zip` and
  `-firefox.zip` (firefox build includes `browser_specific_settings`).
- Manual load: Chrome/Edge `chrome://extensions`, Firefox `about:debugging#/runtime/this-firefox`.

## 8. Milestones

1. **Scaffold**: manifest / package.json / .gitignore / directories + port
   classify.js + tests passing.
2. **Storage adapter**: cross-browser promise wrapper + tests.
3. **Split content.js**: extract dom.js / ui.js, port integration tests.
4. **Cross-browser verification**: manual smoke test in Chrome + Firefox + Edge.
5. **Packaging scripts + README**.
6. **Real-world smoke test**: real PR (w=1, progressive diff, file tree, lazy loading).

## 9. Open Items

- Extension display name: suggested `SimPRler — Simpler PR Focus` (changeable in
  manifest anytime).
- Icons: use a simple placeholder or skip for now (MV3 allows omitting; Chrome
  falls back to a default puzzle-piece icon).