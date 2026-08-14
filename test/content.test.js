const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM, VirtualConsole } = require("jsdom");

const extensionRoot = path.resolve(__dirname, "..");
const MODULES = ["classify", "storage", "dom", "ui", "content"];

function source(fileName) {
  return fs.readFileSync(path.join(extensionRoot, "src", fileName), "utf8");
}

function loadExtension(dom) {
  for (const name of MODULES) {
    vm.runInContext(source(`${name}.js`), dom.getInternalVMContext());
  }
}

function nextFrame(window) {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

test("applies saved focus to old and dynamically loaded diff content", async () => {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div class="Popover-message">
        <div>Unified</div><div>Split</div>
        <form><div><label>Hide whitespace</label></div></form>
      </div>
      <div class="js-file" data-path="src/app.ts">
        <table><tbody>
          <tr id="comment-line"><td><span class="blob-code-inner"><span class="pl-c">// Note</span></span></td></tr>
          <tr id="mixed-line"><td><span class="blob-code-inner">run()<span class="pl-c"> // Note</span></span></td></tr>
          <tr id="directive-line"><td><span class="blob-code-inner"><span class="pl-c">//go:build e2e</span></span></td></tr>
        </tbody></table>
      </div>
      <div class="js-file" data-path="src/app.test.ts"></div>
    </body></html>`,
    {
      pretendToBeVisual: true,
      runScripts: "outside-only",
      url: "https://github.com/acme/project/pull/42/files?w=1",
    },
  );

  const writes = [];
  dom.window.chrome = {
    storage: {
      sync: {
        get: (_defaults, callback) =>
          callback({
            simprlerSettings: { focusCategories: ["code"] },
          }),
        set: (value) => writes.push(value),
      },
    },
  };

  loadExtension(dom);
  await nextFrame(dom.window);

  assert.equal(
    dom.window.document.querySelector("[data-path='src/app.test.ts']").classList.contains("ghprf-hidden-category"),
    true,
  );
  assert.equal(
    dom.window.document.querySelector("[data-path='src/app.ts']").classList.contains("ghprf-hidden-category"),
    false,
  );
  assert.equal(
    dom.window.document.querySelector("#comment-line").classList.contains("ghprf-hidden-code-comment"),
    true,
  );
  assert.equal(
    dom.window.document.querySelector("#mixed-line").classList.contains("ghprf-hidden-code-comment"),
    false,
  );
  assert.equal(
    dom.window.document.querySelector("#directive-line").classList.contains("ghprf-hidden-code-comment"),
    false,
  );

  const dynamicTest = dom.window.document.createElement("div");
  dynamicTest.className = "js-file";
  dynamicTest.dataset.path = "api/user_test.go";
  dom.window.document.body.append(dynamicTest);
  await nextFrame(dom.window);
  await nextFrame(dom.window);
  assert.equal(dynamicTest.classList.contains("ghprf-hidden-category"), true);
  assert.equal(writes.length, 0);

  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  dom.window.close();
});

test("leaves GitHub's diff settings menu unchanged", () => {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div role="menu">
        <h3>Layout</h3>
        <button>Unified</button><button>Split</button>
        <button>Minimize comments</button>
        <button>Hide whitespace</button>
        <button>Compact line height</button>
      </div>
    </body></html>`,
    {
      pretendToBeVisual: true,
      runScripts: "outside-only",
      url: "https://github.com/acme/project/pull/42/files?w=1",
    },
  );

  dom.window.chrome = {
    storage: {
      sync: {
        get: (_defaults, callback) => callback({}),
        set: () => {},
      },
    },
  };
  loadExtension(dom);

  assert.equal(
    dom.window.document.querySelector("[data-ghprf-controls]"),
    null,
  );

  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  dom.window.close();
});

test("supports the current changes route and progressive diff containers", async () => {
  const dom = new JSDOM(
    `<!doctype html><html><body><main>
      <div id="native-summary">
        <span>+15</span><span>-4</span>
        <span class="sr-only">Lines changed: 15 additions & 4 deletions</span>
      </div>
      <ul role="menu" aria-label="Open diff view settings">
        <li role="none"><ul role="group" aria-label="Layout">
          <li role="menuitemradio">Unified</li><li role="menuitemradio">Split</li>
        </ul></li>
        <li role="none"><ul role="group" aria-label="Comments">
          <li role="menuitemcheckbox">Minimize comments</li>
        </ul></li>
        <li role="none"><ul role="group" aria-label="Format">
          <li role="menuitemcheckbox">Hide whitespace</li>
          <li role="menuitemcheckbox">Compact line height</li>
        </ul></li>
      </ul>
      <ul role="tree" aria-label="File Tree">
        <li role="treeitem" id="templates"><div>templates</div>
          <ul role="group">
            <li role="treeitem" id="templates/backend/tests"><div>tests</div>
              <ul role="group">
                <li role="treeitem" id="templates/backend/tests/conftest.py">
                  <div><a href="#diff-test">conftest.py</a></div>
                </li>
              </ul>
            </li>
            <li role="treeitem" id="templates/backend/server.py">
              <div><a href="#diff-source">server.py</a></div>
            </li>
            <li role="treeitem" id="config/app.yaml">
              <div><a href="#diff-config">app.yaml</a></div>
            </li>
            <li role="treeitem" id="db/migrations/001_init.sql">
              <div><a href="#diff-migration">001_init.sql</a></div>
            </li>
            <li role="treeitem" id="tests/fixtures/user.json">
              <div><a href="#diff-artifact">user.json</a></div>
            </li>
          </ul>
        </li>
      </ul>
      <div data-testid="progressive-diffs-list">
        <div id="test-wrapper"><div role="region" id="diff-test">
          <h3><a href="#diff-test">\u200etemplates/backend/tests/conftest.py\u200e</a></h3>
          <span class="sr-only">Lines changed: 3 additions & 1 deletion</span>
        </div></div>
        <div id="source-wrapper"><div role="region" id="diff-source">
          <h3><a href="#diff-source">\u200etemplates/backend/server.py\u200e</a></h3>
          <span class="sr-only">Lines changed: 4 additions & 2 deletions</span>
          <table><tbody>
            <tr id="current-comment-line" class="diff-line-row"><td role="gridcell">
              <code class="diff-text addition">+ <span class="pl-c">// Comment only</span></code>
            </td></tr>
            <tr id="current-mixed-line" class="diff-line-row"><td role="gridcell">
              <code class="diff-text addition">+ run()<span class="pl-c"> // trailing</span></code>
            </td></tr>
            <tr id="current-deleted-comment" class="diff-line-row"><td role="gridcell">
              <code class="diff-text deletion">- <span class="pl-c">// Removed comment</span></code>
            </td></tr>
          </tbody></table>
        </div></div>
        <div id="config-wrapper"><div role="region" id="diff-config">
          <h3><a href="#diff-config">config/app.yaml</a></h3>
          <span class="sr-only">Lines changed: 2 additions & 0 deletions</span>
        </div></div>
        <div id="migration-wrapper"><div role="region" id="diff-migration">
          <h3><a href="#diff-migration">db/migrations/001_init.sql</a></h3>
          <span class="sr-only">Lines changed: 5 additions & 1 deletion</span>
        </div></div>
        <div id="artifact-wrapper"><div role="region" id="diff-artifact">
          <h3><a href="#diff-artifact">tests/fixtures/user.json</a></h3>
          <span class="sr-only">Lines changed: 1 addition & 0 deletions</span>
        </div></div>
      </div>
    </main></body></html>`,
    {
      pretendToBeVisual: true,
      runScripts: "outside-only",
      url: "https://github.com/acme/project/pull/42/changes?w=1",
    },
  );

  const persistedSettings = [];
  dom.window.chrome = {
    storage: {
      sync: {
        get: (_defaults, callback) =>
          callback({
            simprlerSettings: {
              focusCategories: [],
            },
          }),
        set: (value) =>
          persistedSettings.push(JSON.parse(JSON.stringify(value))),
      },
    },
  };
  loadExtension(dom);
  await nextFrame(dom.window);

  const testWrapper = dom.window.document.querySelector("#test-wrapper");
  const sourceWrapper = dom.window.document.querySelector("#source-wrapper");
  const configWrapper = dom.window.document.querySelector("#config-wrapper");
  const migrationWrapper = dom.window.document.querySelector("#migration-wrapper");
  const artifactWrapper = dom.window.document.querySelector("#artifact-wrapper");
  const commentLine = dom.window.document.querySelector("#current-comment-line");
  const mixedLine = dom.window.document.querySelector("#current-mixed-line");
  const testTreeItem = dom.window.document.querySelector(
    "[id='templates/backend/tests/conftest.py']",
  );
  const sourceTreeItem = dom.window.document.querySelector(
    "[id='templates/backend/server.py']",
  );
  const artifactTreeItem = dom.window.document.querySelector(
    "[id='tests/fixtures/user.json']",
  );
  assert.equal(testWrapper.classList.contains("ghprf-hidden-category"), false);
  assert.equal(sourceWrapper.classList.contains("ghprf-hidden-category"), false);
  assert.equal(commentLine.classList.contains("ghprf-hidden-code-comment"), false);
  assert.equal(mixedLine.classList.contains("ghprf-hidden-code-line"), false);
  assert.equal(testTreeItem.classList.contains("ghprf-hidden-tree-item"), false);
  assert.equal(sourceTreeItem.classList.contains("ghprf-hidden-tree-item"), false);
  const lineBreakdown = dom.window.document.querySelector(
    "[data-ghprf-line-breakdown]",
  );
  assert.ok(lineBreakdown, "line-count breakdown was injected");
  assert.equal(
    dom.window.document
      .querySelector("#native-summary")
      .classList.contains("ghprf-native-line-summary"),
    true,
  );

  const codeStat = lineBreakdown.querySelector("[data-ghprf-category='code']");
  const commentStat = lineBreakdown.querySelector(
    "[data-ghprf-category='comments']",
  );
  const testStat = lineBreakdown.querySelector("[data-ghprf-category='tests']");
  const configStat = lineBreakdown.querySelector("[data-ghprf-category='config']");
  const migrationStat = lineBreakdown.querySelector(
    "[data-ghprf-category='migrations']",
  );
  const artifactStat = lineBreakdown.querySelector(
    "[data-ghprf-category='artifacts']",
  );
  const otherStat = lineBreakdown.querySelector("[data-ghprf-category='other']");
  assert.equal(codeStat.tagName, "BUTTON");
  assert.equal(commentStat.tagName, "BUTTON");
  assert.equal(testStat.tagName, "BUTTON");
  assert.equal(configStat.tagName, "BUTTON");
  assert.equal(migrationStat.tagName, "BUTTON");
  assert.equal(artifactStat.tagName, "BUTTON");
  assert.equal(codeStat.getAttribute("aria-pressed"), "false");
  assert.equal(commentStat.getAttribute("aria-pressed"), "false");
  assert.equal(testStat.getAttribute("aria-pressed"), "false");
  assert.equal(codeStat.textContent.replace(/\s+/g, ""), "Code+3−1");
  assert.equal(commentStat.textContent.replace(/\s+/g, ""), "Comments+1−1");
  assert.equal(testStat.textContent.replace(/\s+/g, ""), "Tests+3−1");
  assert.equal(configStat.textContent.replace(/\s+/g, ""), "Config+2−0");
  assert.equal(
    migrationStat.textContent.replace(/\s+/g, ""),
    "Migrations+5−1",
  );
  assert.equal(artifactStat.textContent.replace(/\s+/g, ""), "Artifacts+1−0");
  assert.equal(commentStat.classList.contains("ghprf-line-stat--excluded"), false);
  assert.equal(testStat.classList.contains("ghprf-line-stat--excluded"), false);
  assert.equal(otherStat.hidden, true);

  codeStat.click();
  assert.equal(codeStat.getAttribute("aria-pressed"), "true");
  assert.equal(testWrapper.classList.contains("ghprf-hidden-category"), true);
  assert.equal(configWrapper.classList.contains("ghprf-hidden-category"), true);
  assert.equal(migrationWrapper.classList.contains("ghprf-hidden-category"), true);
  assert.equal(artifactWrapper.classList.contains("ghprf-hidden-category"), true);
  assert.equal(commentLine.classList.contains("ghprf-hidden-code-comment"), true);
  assert.equal(mixedLine.classList.contains("ghprf-hidden-code-line"), false);
  assert.equal(testTreeItem.classList.contains("ghprf-hidden-tree-item"), true);
  configStat.click();
  assert.equal(codeStat.getAttribute("aria-pressed"), "true");
  assert.equal(configStat.getAttribute("aria-pressed"), "true");
  assert.equal(sourceWrapper.classList.contains("ghprf-hidden-category"), false);
  assert.equal(configWrapper.classList.contains("ghprf-hidden-category"), false);
  assert.equal(testWrapper.classList.contains("ghprf-hidden-category"), true);
  assert.equal(migrationWrapper.classList.contains("ghprf-hidden-category"), true);
  assert.deepEqual(persistedSettings.at(-1), {
    simprlerSettings: { focusCategories: ["code", "config"] },
  });

  codeStat.click();
  assert.equal(codeStat.getAttribute("aria-pressed"), "false");
  assert.equal(configStat.getAttribute("aria-pressed"), "true");
  assert.equal(sourceWrapper.classList.contains("ghprf-hidden-category"), true);
  assert.equal(configWrapper.classList.contains("ghprf-hidden-category"), false);

  commentStat.click();
  testStat.click();
  assert.equal(configStat.getAttribute("aria-pressed"), "true");
  assert.equal(commentStat.getAttribute("aria-pressed"), "true");
  assert.equal(testStat.getAttribute("aria-pressed"), "true");
  assert.equal(configWrapper.classList.contains("ghprf-hidden-category"), false);
  assert.equal(testWrapper.classList.contains("ghprf-hidden-category"), false);
  assert.equal(sourceWrapper.classList.contains("ghprf-hidden-category"), false);
  assert.equal(commentLine.classList.contains("ghprf-hidden-code-comment"), false);
  assert.equal(mixedLine.classList.contains("ghprf-hidden-code-line"), true);
  assert.equal(artifactWrapper.classList.contains("ghprf-hidden-category"), true);

  configStat.click();
  commentStat.click();
  testStat.click();
  assert.equal(configStat.getAttribute("aria-pressed"), "false");
  assert.equal(commentStat.getAttribute("aria-pressed"), "false");
  assert.equal(testStat.getAttribute("aria-pressed"), "false");
  assert.equal(sourceWrapper.classList.contains("ghprf-hidden-category"), false);
  assert.equal(testWrapper.classList.contains("ghprf-hidden-category"), false);
  assert.equal(configWrapper.classList.contains("ghprf-hidden-category"), false);
  assert.equal(sourceTreeItem.classList.contains("ghprf-hidden-tree-item"), false);
  assert.equal(artifactTreeItem.classList.contains("ghprf-hidden-tree-item"), false);
  assert.deepEqual(persistedSettings.at(-1), {
    simprlerSettings: { focusCategories: [] },
  });

  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  dom.window.close();
});

test("deactivates stale UI when Chrome invalidates the extension context", async () => {
  const dom = new JSDOM(
    `<!doctype html><html><body><main>
      <div id="native-summary">
        <span class="sr-only">Lines changed: 1 addition & 0 deletions</span>
      </div>
      <div role="region" id="diff-source">
        <h3><a href="#diff-source">src/app.js</a></h3>
        <span class="sr-only">Lines changed: 1 addition & 0 deletions</span>
        <table><tbody><tr><td><code class="diff-text addition">+run()</code></td></tr></tbody></table>
      </div>
    </main></body></html>`,
    {
      pretendToBeVisual: true,
      runScripts: "outside-only",
      url: "https://github.com/acme/project/pull/42/changes?w=1",
    },
  );

  dom.window.chrome = {
    storage: {
      sync: {
        get: (_defaults, callback) => callback({}),
        set: () => {
          throw new Error("Extension context invalidated.");
        },
      },
    },
  };
  loadExtension(dom);
  await nextFrame(dom.window);

  const codeStat = dom.window.document.querySelector(
    "[data-ghprf-category='code']",
  );
  assert.ok(codeStat);
  assert.doesNotThrow(() => codeStat.click());
  assert.equal(
    dom.window.document.querySelector("[data-ghprf-line-breakdown]"),
    null,
  );
  assert.equal(
    dom.window.document
      .querySelector("#native-summary")
      .classList.contains("ghprf-native-line-summary"),
    false,
  );

  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  dom.window.close();
});

test("aborts a queued refresh when the extension context becomes invalid", async () => {
  const dom = new JSDOM(
    `<!doctype html><html><body><main>
      <div id="native-summary">
        <span class="sr-only">Lines changed: 1 addition & 0 deletions</span>
      </div>
      <div role="region" id="diff-source">
        <h3><a href="#diff-source">src/app.js</a></h3>
        <table><tbody><tr><td><code class="diff-text addition">+run()</code></td></tr></tbody></table>
      </div>
    </main></body></html>`,
    {
      pretendToBeVisual: true,
      runScripts: "outside-only",
      url: "https://github.com/acme/project/pull/42/changes?w=1",
    },
  );

  let invalidated = false;
  const queuedFrames = [];
  dom.window.requestAnimationFrame = (callback) => {
    queuedFrames.push(callback);
    return queuedFrames.length;
  };
  dom.window.cancelAnimationFrame = (frameId) => {
    queuedFrames[frameId - 1] = null;
  };
  dom.window.chrome = {
    runtime: {
      id: "simprler-test",
      getManifest: () => ({ manifest_version: 3 }),
    },
    storage: {
      sync: {
        get: (_defaults, callback) => callback({}),
        set: () => {},
      },
    },
  };
  loadExtension(dom);

  const changedLine = dom.window.document.querySelector("code.diff-text");
  const nativeMatches = changedLine.matches.bind(changedLine);
  changedLine.matches = (...args) => {
    if (invalidated) throw new Error("Extension context invalidated.");
    return nativeMatches(...args);
  };

  dom.window.document.dispatchEvent(new dom.window.Event("turbo:load"));
  assert.equal(queuedFrames.length, 1);
  const queuedRefresh = queuedFrames[0];
  invalidated = true;

  assert.doesNotThrow(() => queuedRefresh());
  assert.equal(
    dom.window.document.querySelector("[data-ghprf-line-breakdown]"),
    null,
  );

  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  dom.window.close();
});

test("enables hidden whitespace by default without dropping URL state", async () => {
  const dom = new JSDOM(
    `<!doctype html><html><body><main>
      <div id="native-summary">
        <span class="sr-only">Lines changed: 1 addition & 0 deletions</span>
      </div>
    </main></body></html>`,
    {
      pretendToBeVisual: true,
      runScripts: "outside-only",
      url: "https://github.com/acme/project/pull/42/changes?diff=split#diff-source",
      virtualConsole: new VirtualConsole(),
    },
  );

  dom.window.chrome = {
    storage: {
      sync: {
        get: (_defaults, callback) => callback({}),
        set: () => {},
      },
    },
  };
  dom.window.SimPRlerTestHooks = { reloadPage: () => {} };
  loadExtension(dom);
  await nextFrame(dom.window);

  assert.equal(dom.window.location.search, "?diff=split&w=1");
  assert.equal(dom.window.location.hash, "#diff-source");
  assert.equal(
    dom.window.document.querySelector("[data-ghprf-line-breakdown]"),
    null,
  );

  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  dom.window.close();
});