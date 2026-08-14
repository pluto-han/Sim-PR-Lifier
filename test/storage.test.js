const test = require("node:test");
const assert = require("node:assert/strict");

const storage = require("../src/storage.js");

async function withGlobals(globals, fn) {
  const previous = {};
  for (const key of Object.keys(globals)) {
    previous[key] = globalThis[key];
    globalThis[key] = globals[key];
  }
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(globals)) {
      if (previous[key] === undefined) {
        delete globalThis[key];
      } else {
        globalThis[key] = previous[key];
      }
    }
  }
}

test("reads defaults when nothing is stored (chrome callback API)", async () => {
  await withGlobals(
    {
      chrome: {
        storage: {
          sync: {
            get: (_defaults, callback) => callback({}),
            set: () => {},
          },
        },
      },
    },
    async () => {
      const settings = await storage.getSettings();
      assert.deepEqual(settings, { focusCategories: [] });
    },
  );
});

test("reads stored settings and writes them (chrome callback API)", async () => {
  const writes = [];
  await withGlobals(
    {
      chrome: {
        storage: {
          sync: {
            get: (_defaults, callback) =>
              callback({ [storage.STORAGE_KEY]: { focusCategories: ["code"] } }),
            set: (value, callback) => {
              writes.push(value);
              callback();
            },
          },
        },
      },
    },
    async () => {
      const settings = await storage.getSettings();
      assert.deepEqual(settings, { focusCategories: ["code"] });
      await storage.setSettings({ focusCategories: ["code", "tests"] });
      assert.deepEqual(writes, [
        { [storage.STORAGE_KEY]: { focusCategories: ["code", "tests"] } },
      ]);
    },
  );
});

test("supports the promise-based browser API (firefox)", async () => {
  const writes = [];
  await withGlobals(
    {
      browser: {
        storage: {
          sync: {
            get: () => Promise.resolve({ [storage.STORAGE_KEY]: { focusCategories: ["config"] } }),
            set: (value) => {
              writes.push(value);
              return Promise.resolve();
            },
          },
        },
      },
    },
    async () => {
      const settings = await storage.getSettings();
      assert.deepEqual(settings, { focusCategories: ["config"] });
      await storage.setSettings({ focusCategories: [] });
      assert.deepEqual(writes, [
        { [storage.STORAGE_KEY]: { focusCategories: [] } },
      ]);
    },
  );
});

test("normalizes a non-array focusCategories value", () => {
  assert.deepEqual(
    storage.readSettings({
      [storage.STORAGE_KEY]: { focusCategories: "code" },
    }),
    { focusCategories: [] },
  );
  assert.deepEqual(storage.readSettings({}), { focusCategories: [] });
});

test("isContextValid reports invalid extension contexts", async () => {
  await withGlobals({ chrome: { runtime: { id: "", getManifest: () => ({}) } } }, () => {
    assert.equal(storage.isContextValid(), false);
  });
  await withGlobals(
    {
      chrome: {
        runtime: { id: "test", getManifest: () => ({ manifest_version: 3 }) },
      },
    },
    () => {
      assert.equal(storage.isContextValid(), true);
    },
  );
  await withGlobals(
    { chrome: { runtime: { id: "test", getManifest: () => { throw new Error("Extension context invalidated."); } } } },
    () => {
      assert.equal(storage.isContextValid(), false);
    },
  );
  await withGlobals({}, () => {
    assert.equal(storage.isContextValid(), true);
  });
});

test("throws setSettings synchronously when the extension context is invalidated", () => {
  withGlobals(
    {
      chrome: {
        storage: {
          sync: {
            set: () => {
              throw new Error("Extension context invalidated.");
            },
          },
        },
      },
    },
    () => {
      assert.throws(
        () => storage.setSettings({ focusCategories: ["code"] }),
        /Extension context invalidated/,
      );
    },
  );
});