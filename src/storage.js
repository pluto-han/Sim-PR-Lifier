(function exposeStorage(root, factory) {
  const storage = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = storage;
  } else {
    root.SimPRler = root.SimPRler || {};
    root.SimPRler.storage = storage;
  }
})(typeof globalThis === "undefined" ? this : globalThis, function createStorage() {
  "use strict";

  const STORAGE_KEY = "simprlerSettings";
  const DEFAULT_SETTINGS = Object.freeze({ focusCategories: [] });

  function getRuntime() {
    return globalThis.browser?.runtime || globalThis.chrome?.runtime;
  }

  function isContextValid() {
    const runtime = getRuntime();
    if (!runtime) return true;
    try {
      if (!runtime.id) return false;
      runtime.getManifest?.();
      return true;
    } catch (_error) {
      return false;
    }
  }

  function getSyncStorage() {
    return globalThis.browser?.storage?.sync || globalThis.chrome?.storage?.sync;
  }

  function usesPromiseApi() {
    return Boolean(globalThis.browser?.storage?.sync);
  }

  function readSettings(stored) {
    const saved = stored[STORAGE_KEY] || {};
    const categories = Array.isArray(saved.focusCategories)
      ? saved.focusCategories
      : [];
    return { focusCategories: categories };
  }

  function getSettings() {
    return new Promise((resolve) => {
      const storage = getSyncStorage();
      if (!storage || !isContextValid()) {
        resolve({ ...DEFAULT_SETTINGS });
        return;
      }
      const complete = (stored) => resolve(readSettings(stored || {}));
      if (usesPromiseApi()) {
        storage
          .get({ [STORAGE_KEY]: DEFAULT_SETTINGS })
          .then(complete, () => resolve({ ...DEFAULT_SETTINGS }));
      } else {
        try {
          storage.get({ [STORAGE_KEY]: DEFAULT_SETTINGS }, complete);
        } catch (_error) {
          resolve({ ...DEFAULT_SETTINGS });
        }
      }
    });
  }

  function setSettings(settings) {
    const storage = getSyncStorage();
    if (!storage) return Promise.resolve();
    if (!isContextValid()) {
      return Promise.reject(new Error("Extension context invalidated."));
    }
    const value = { [STORAGE_KEY]: { ...settings } };
    if (usesPromiseApi()) {
      return storage.set(value).then(() => undefined);
    }
    // Chrome's callback API throws synchronously when the extension context
    // is invalidated; let that propagate to the caller for prompt cleanup.
    storage.set(value, () => {});
    return Promise.resolve();
  }

  return {
    DEFAULT_SETTINGS,
    STORAGE_KEY,
    getSettings,
    isContextValid,
    readSettings,
    setSettings,
  };
});