const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const extensionRoot = path.resolve(__dirname, "..");

function withDom(html, url, fn) {
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url,
  });
  vm.runInContext(
    fs.readFileSync(path.join(extensionRoot, "src", "dom.js"), "utf8"),
    dom.getInternalVMContext(),
  );
  try {
    return fn(dom.window.SimPRler.dom, dom);
  } finally {
    dom.window.dispatchEvent(new dom.window.Event("pagehide"));
    dom.window.close();
  }
}

test("readFilePath prefers direct attributes and falls back to anchors", () => {
  withDom(
    `<!doctype html><body>
      <div class="js-file" data-path="src/app.ts"></div>
      <div class="js-file"><h3><a href="#diff-b">src/app.go</a></h3></div>
    </body>`,
    "https://github.com/acme/project/pull/42/files?w=1",
    (domModule, dom) => {
      const files = dom.window.document.querySelectorAll(".js-file");
      assert.equal(domModule.readFilePath(files[0]), "src/app.ts");
      assert.equal(domModule.readFilePath(files[1]), "src/app.go");
    },
  );
});

test("parseLineStats extracts addition and deletion counts", () => {
  withDom(
    `<!doctype html><body></body>`,
    "https://github.com/acme/project/pull/42/files?w=1",
    (domModule) => {
      const parsed = domModule.parseLineStats(
        "Lines changed: 12 additions & 3 deletions",
      );
      assert.equal(parsed.additions, 12);
      assert.equal(parsed.deletions, 3);
      const thousands = domModule.parseLineStats(
        "Lines changed: 1,024 additions & 0 deletions",
      );
      assert.equal(thousands.additions, 1024);
      assert.equal(thousands.deletions, 0);
      assert.equal(domModule.parseLineStats("no match"), null);
    },
  );
});

test("getFileDiffs dedupes nested diff containers", () => {
  withDom(
    `<!doctype html><body>
      <div data-testid="progressive-diffs-list">
        <div id="wrapper"><div role="region" id="diff-a">
          <h3><a href="#diff-a">a.go</a></h3>
        </div></div>
        <div role="region" id="diff-b">
          <h3><a href="#diff-b">b.go</a></h3>
        </div>
      </div>
    </body>`,
    "https://github.com/acme/project/pull/42/changes?w=1",
    (domModule, dom) => {
      assert.equal(domModule.getFileDiffs().length, 2);
    },
  );
});

test("getFileHideTarget returns the progressive wrapper for nested regions", () => {
  withDom(
    `<!doctype html><body>
      <div data-testid="progressive-diffs-list">
        <div id="wrapper"><div role="region" id="diff-a">
          <h3><a href="#diff-a">a.go</a></h3>
        </div></div>
      </div>
    </body>`,
    "https://github.com/acme/project/pull/42/changes?w=1",
    (domModule, dom) => {
      const region = dom.window.document.querySelector("#diff-a");
      assert.equal(domModule.getFileHideTarget(region).id, "wrapper");
    },
  );
});

test("isCommentOnlyCell distinguishes comments, directives, and mixed lines", () => {
  withDom(
    `<!doctype html><body>
      <div class="js-file">
        <table><tbody>
          <tr id="pure"><td><span class="blob-code-inner"><span class="pl-c">// Note</span></span></td></tr>
          <tr id="directive"><td><span class="blob-code-inner"><span class="pl-c">//go:build e2e</span></span></td></tr>
          <tr id="mixed"><td><span class="blob-code-inner">run()<span class="pl-c"> // Note</span></span></td></tr>
        </tbody></table>
      </div>
    </body>`,
    "https://github.com/acme/project/pull/42/files?w=1",
    (domModule, dom) => {
      const window = dom.window;
      assert.equal(
        domModule.isCommentOnlyCell(window.document.querySelector("#pure .blob-code-inner")),
        true,
      );
      assert.equal(
        domModule.isCommentOnlyCell(window.document.querySelector("#directive .blob-code-inner")),
        false,
      );
      assert.equal(
        domModule.isCommentOnlyCell(window.document.querySelector("#mixed .blob-code-inner")),
        false,
      );
    },
  );
});