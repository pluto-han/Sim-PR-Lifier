(function exposeUi(root, factory) {
  const ui = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = ui;
  } else {
    root.SimPRler = root.SimPRler || {};
    root.SimPRler.ui = ui;
  }
})(typeof globalThis === "undefined" ? this : globalThis, function createUi() {
  "use strict";

  const CATEGORY_ORDER = [
    "code",
    "comments",
    "tests",
    "config",
    "migrations",
    "artifacts",
  ];
  const CATEGORIES = [
    { id: "code", label: "Code" },
    { id: "comments", label: "Comments" },
    { id: "tests", label: "Tests" },
    { id: "config", label: "Config" },
    { id: "migrations", label: "Migrations" },
    { id: "artifacts", label: "Artifacts" },
  ];

  const classify = globalThis.SimPRler?.classify;
  const dom = globalThis.SimPRler?.dom;

  function isFileCategoryVisible(category, view) {
    if (!view.hasFocus) return true;
    if (category === "source") {
      return (
        view.focusCategories.has("code") ||
        view.focusCategories.has("comments")
      );
    }
    return view.focusCategories.has(category);
  }

  function isLineCategoryVisible(category, view) {
    if (category === "code") {
      return isFileCategoryVisible("source", view) && !view.hideCode;
    }
    if (category === "comments") {
      return isFileCategoryVisible("source", view) && !view.hideCodeComments;
    }
    return isFileCategoryVisible(category, view);
  }

  function setClass(element, className, enabled) {
    if (element.classList.contains(className) === enabled) return;
    element.classList.toggle(className, enabled);
  }

  function createLineStat(category, label, onToggle) {
    const interactive = CATEGORY_ORDER.includes(category);
    const stat = document.createElement(interactive ? "button" : "span");
    stat.className = "ghprf-line-stat";
    stat.dataset.ghprfCategory = category;
    if (interactive) {
      stat.type = "button";
      stat.classList.add("ghprf-line-stat--action");
      stat.addEventListener("click", () => onToggle(category));
    }

    const labelElement = document.createElement("span");
    labelElement.className = "ghprf-line-stat-label";
    labelElement.textContent = label;

    const additions = document.createElement("span");
    additions.className = "ghprf-line-additions";

    const deletions = document.createElement("span");
    deletions.className = "ghprf-line-deletions";
    stat.append(labelElement, additions, deletions);
    return stat;
  }

  function createLineBreakdown(onToggle) {
    const element = document.createElement("div");
    element.className = "ghprf-line-breakdown";
    element.dataset.ghprfLineBreakdown = "";
    element.setAttribute("role", "group");
    element.setAttribute("aria-label", "Line changes split by category");
    element.append(
      ...CATEGORIES.map((category) =>
        createLineStat(category.id, category.label, onToggle),
      ),
      createLineStat("other", "Other", onToggle),
    );
    return element;
  }

  function updateLineStat(element, stats, excluded, focused = false) {
    element.querySelector(".ghprf-line-additions").textContent =
      `+${stats.additions.toLocaleString()}`;
    element.querySelector(".ghprf-line-deletions").textContent =
      `−${stats.deletions.toLocaleString()}`;
    element.classList.toggle("ghprf-line-stat--excluded", excluded);
    element.hidden = stats.additions === 0 && stats.deletions === 0;
    if (element.matches("button")) {
      element.setAttribute("aria-pressed", String(focused));
      element.title = focused
        ? `Remove ${element.dataset.ghprfCategory} from focus`
        : `Add ${element.dataset.ghprfCategory} to focus`;
      return;
    }
    element.title = excluded
      ? "Excluded by the current PR Focus filters"
      : "Included in the visible diff";
  }

  function collectLineBreakdown() {
    const breakdown = {
      artifacts: { additions: 0, deletions: 0 },
      code: { additions: 0, deletions: 0 },
      comments: { additions: 0, deletions: 0 },
      config: { additions: 0, deletions: 0 },
      migrations: { additions: 0, deletions: 0 },
      other: { additions: 0, deletions: 0 },
      tests: { additions: 0, deletions: 0 },
    };

    for (const file of dom.getFileDiffs()) {
      const fileStats = dom.getFileLineStats(file);
      const fileCategory = classify.getFileCategory(dom.readFilePath(file));
      if (fileCategory !== "source") {
        breakdown[fileCategory].additions += fileStats.additions;
        breakdown[fileCategory].deletions += fileStats.deletions;
        continue;
      }

      breakdown.code.additions += fileStats.additions;
      breakdown.code.deletions += fileStats.deletions;
      for (const cell of dom.getChangedLineCells(file)) {
        if (!dom.isCommentOnlyCell(cell)) continue;
        const type = dom.getLineChangeType(cell);
        if (type) breakdown.comments[type] += 1;
      }
    }

    breakdown.code.additions = Math.max(
      0,
      breakdown.code.additions - breakdown.comments.additions,
    );
    breakdown.code.deletions = Math.max(
      0,
      breakdown.code.deletions - breakdown.comments.deletions,
    );

    const nativeTotal = dom
      .getNativeLineSummaries()
      .map((element) => dom.parseLineStats(element.textContent.trim()))
      .find(Boolean);
    if (nativeTotal) {
      const knownAdditions =
        breakdown.code.additions +
        breakdown.comments.additions +
        breakdown.config.additions +
        breakdown.migrations.additions +
        breakdown.artifacts.additions +
        breakdown.tests.additions;
      const knownDeletions =
        breakdown.code.deletions +
        breakdown.comments.deletions +
        breakdown.config.deletions +
        breakdown.migrations.deletions +
        breakdown.artifacts.deletions +
        breakdown.tests.deletions;
      breakdown.other.additions = Math.max(
        0,
        nativeTotal.additions - knownAdditions,
      );
      breakdown.other.deletions = Math.max(
        0,
        nativeTotal.deletions - knownDeletions,
      );
    }
    return breakdown;
  }

  function renderLineBreakdown(view, onToggle) {
    const nativeSummaries = dom.getNativeLineSummaries();
    if (!nativeSummaries.length) return;

    const breakdown = collectLineBreakdown();
    for (const summary of nativeSummaries) {
      const nativeContainer = summary.parentElement;
      if (!nativeContainer) continue;
      nativeContainer.classList.add("ghprf-native-line-summary");

      let element = nativeContainer.nextElementSibling;
      if (!element?.matches("[data-ghprf-line-breakdown]")) {
        element = createLineBreakdown(onToggle);
        nativeContainer.insertAdjacentElement("afterend", element);
      }

      for (const category of CATEGORIES) {
        updateLineStat(
          element.querySelector(`[data-ghprf-category='${category.id}']`),
          breakdown[category.id],
          !isLineCategoryVisible(category.id, view),
          view.focusCategories.has(category.id),
        );
      }
      updateLineStat(
        element.querySelector("[data-ghprf-category='other']"),
        breakdown.other,
        view.hasFocus,
      );
    }
  }

  function getTreeFileItems(tree) {
    return [...tree.querySelectorAll("[role='treeitem'][id]")].filter((item) => {
      const ownContent = item.querySelector(":scope > div");
      return Boolean(ownContent?.querySelector("a[href^='#diff-']"));
    });
  }

  function applyFileTreeFilter(view) {
    const tree = document.querySelector("[role='tree'][aria-label='File Tree']");
    if (!tree) return 0;

    const fileItems = getTreeFileItems(tree);
    for (const item of fileItems) {
      const category = classify.getFileCategory(item.id);
      setClass(
        item,
        "ghprf-hidden-tree-item",
        !isFileCategoryVisible(category, view),
      );
    }

    const folderItems = [...tree.querySelectorAll("[role='treeitem']")].filter(
      (item) => item.querySelector(":scope > [role='group']"),
    );
    for (const folder of folderItems) {
      const descendantFiles = getTreeFileItems(folder);
      const allFilesHidden =
        descendantFiles.length > 0 &&
        descendantFiles.every((item) =>
          item.classList.contains("ghprf-hidden-tree-item"),
        );
      setClass(folder, "ghprf-hidden-tree-item", allFilesHidden);
    }
  }

  function applyFilters(view) {
    for (const row of document.querySelectorAll(
      ".ghprf-hidden-code-comment, .ghprf-hidden-code-line",
    )) {
      row.classList.remove(
        "ghprf-hidden-code-comment",
        "ghprf-hidden-code-line",
      );
    }

    for (const file of dom.getFileDiffs()) {
      const fileCategory = classify.getFileCategory(dom.readFilePath(file));
      const hideTarget = dom.getFileHideTarget(file);
      setClass(
        hideTarget,
        "ghprf-hidden-category",
        !isFileCategoryVisible(fileCategory, view),
      );

      const commentRows = new Set(
        fileCategory === "source" ? dom.getCodeCommentRows(file) : [],
      );
      for (const row of commentRows) {
        setClass(row, "ghprf-hidden-code-comment", view.hideCodeComments);
      }
      for (const row of dom.getChangedRows(file)) {
        setClass(
          row,
          "ghprf-hidden-code-line",
          fileCategory === "source" && view.hideCode && !commentRows.has(row),
        );
      }
    }

    applyFileTreeFilter(view);
  }

  function removeFilters() {
    for (const element of document.querySelectorAll(
      ".ghprf-hidden-category, .ghprf-hidden-tree-item, " +
        ".ghprf-hidden-code-line, .ghprf-hidden-code-comment",
    )) {
      element.classList.remove(
        "ghprf-hidden-category",
        "ghprf-hidden-tree-item",
        "ghprf-hidden-code-line",
        "ghprf-hidden-code-comment",
      );
    }
    for (const element of document.querySelectorAll(
      ".ghprf-native-line-summary",
    )) {
      element.classList.remove("ghprf-native-line-summary");
    }
    for (const element of document.querySelectorAll(
      "[data-ghprf-line-breakdown]",
    )) {
      element.remove();
    }
  }

  return {
    CATEGORIES,
    CATEGORY_ORDER,
    applyFileTreeFilter,
    applyFilters,
    isFileCategoryVisible,
    isLineCategoryVisible,
    removeFilters,
    renderLineBreakdown,
  };
});