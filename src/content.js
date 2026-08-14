(function initializeSimprler() {
  "use strict";

  const { classify, dom, storage, ui } = globalThis.SimPRler || {};
  if (!classify || !dom || !storage || !ui) return;

  const reloadPage =
    globalThis.SimPRlerTestHooks?.reloadPage || (() => location.reload());

  const state = {
    settings: { ...storage.DEFAULT_SETTINGS },
    scheduled: false,
  };

  const observer = new MutationObserver(scheduleRefresh);

  function isFilesPage() {
    return /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:changes|files)(?:\/|$)/.test(
      location.pathname,
    );
  }

  function ensureWhitespaceHidden() {
    if (!isFilesPage()) return false;

    const url = new URL(location.href);
    if (url.searchParams.get("w") === "1") return false;

    url.searchParams.set("w", "1");
    history.replaceState(history.state, "", url);
    reloadPage();
    return true;
  }

  function getViewSettings() {
    const focusCategories = new Set(state.settings.focusCategories);
    const hasFocus = focusCategories.size > 0;
    return {
      focusCategories,
      hasFocus,
      hideCode: hasFocus && !focusCategories.has("core"),
      hideCodeComments: hasFocus && !focusCategories.has("comments"),
    };
  }

  function isExtensionContextInvalidated(error) {
    return String(error?.message || error).includes(
      "Extension context invalidated",
    );
  }

  function deactivate() {
    observer.disconnect();
    try {
      ui.removeFilters();
    } catch (_error) {
      // Cleanup is best-effort once the browser has invalidated the world.
    }
  }

  function saveSettings() {
    if (!storage.isContextValid()) {
      deactivate();
      return;
    }
    let pending;
    try {
      pending = storage.setSettings(state.settings);
    } catch (_error) {
      deactivate();
      return;
    }
    pending?.catch?.(deactivate);
    refresh();
  }

  function toggleCategoryFocus(category) {
    const selected = new Set(state.settings.focusCategories);
    if (selected.has(category)) {
      selected.delete(category);
    } else {
      selected.add(category);
    }
    state.settings.focusCategories = ui.CATEGORY_ORDER.filter((item) =>
      selected.has(item),
    );
    saveSettings();
  }

  function refresh() {
    state.scheduled = false;
    try {
      if (!storage.isContextValid()) {
        deactivate();
        return;
      }

      if (!isFilesPage()) {
        ui.removeFilters();
        return;
      }
      if (ensureWhitespaceHidden()) return;

      const view = getViewSettings();
      ui.applyFilters(view);
      ui.renderLineBreakdown(view, toggleCategoryFocus);
    } catch (error) {
      if (!isExtensionContextInvalidated(error)) throw error;
      deactivate();
    }
  }

  function scheduleRefresh() {
    if (!storage.isContextValid()) {
      deactivate();
      return;
    }
    if (state.scheduled) return;
    state.scheduled = true;
    requestAnimationFrame(refresh);
  }

  async function loadSettings() {
    try {
      const settings = await storage.getSettings();
      state.settings = {
        focusCategories: ui.CATEGORY_ORDER.filter((category) =>
          settings.focusCategories.includes(category),
        ),
      };
      refresh();
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    } catch (_error) {
      deactivate();
    }
  }

  document.addEventListener("turbo:load", scheduleRefresh);
  document.addEventListener("pjax:end", scheduleRefresh);
  window.addEventListener("popstate", scheduleRefresh);
  window.addEventListener("pagehide", () => observer.disconnect());
  loadSettings();
})();