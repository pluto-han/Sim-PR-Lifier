(function exposeDom(root, factory) {
  const dom = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = dom;
  } else {
    root.SimPRler = root.SimPRler || {};
    root.SimPRler.dom = dom;
  }
})(typeof globalThis === "undefined" ? this : globalThis, function createDom() {
  "use strict";

  const FILE_SELECTOR = [
    ".js-file",
    "[role='region'][id^='diff-']",
    "[data-testid='file-diff']",
    "[data-testid='file-diff-container']",
    "[data-file-path]",
  ].join(",");

  const SOURCE_DIRECTIVE_PATTERN = /^(?:\/\/\s*(?:go:|nolint\b|lint:|line\b|eslint\b|@ts-)|#\s*(?:noqa\b|type:|pragma:|pylint:|ruff:|fmt:|nosec\b|shellcheck\b)|\/\*\s*(?:eslint|prettier)|<!--\s*(?:eslint|prettier|svelte|vue))/i;

  function readFilePath(file) {
    const directPath =
      file.getAttribute("data-path") || file.getAttribute("data-file-path");
    if (directPath && !directPath.includes("{{")) return directPath;

    const pathElement = file.querySelector(
      "[data-path], [data-file-path], .file-info a[title], " +
        ".js-file-header a[title], h3 a[href^='#diff-'], [data-testid='file-name']",
    );
    if (!pathElement) return "";

    return (
      pathElement.getAttribute("data-path") ||
      pathElement.getAttribute("data-file-path") ||
      pathElement.getAttribute("title") ||
      pathElement.textContent ||
      ""
    ).trim();
  }

  function getFileDiffs() {
    const candidates = [...document.querySelectorAll(FILE_SELECTOR)];
    return candidates.filter(
      (candidate, index) =>
        !candidates.some(
          (other, otherIndex) =>
            otherIndex !== index && other.contains(candidate),
        ),
    );
  }

  function getFileHideTarget(file) {
    if (
      file.matches("[role='region'][id^='diff-']") &&
      file.parentElement?.parentElement?.matches(
        "[data-testid='progressive-diffs-list']",
      )
    ) {
      return file.parentElement;
    }
    return file;
  }

  function normalizeCodeText(text) {
    return text
      .replace(/\u00a0/g, " ")
      .replace(/^[\t ]*[+-]?[\t ]?/, "")
      .trim();
  }

  function isCommentOnlyCell(cell) {
    const commentTokens = [...cell.querySelectorAll(".pl-c")].filter(
      (token) => !token.parentElement?.closest(".pl-c"),
    );
    if (!commentTokens.length) return false;

    const fullText = normalizeCodeText(cell.textContent);
    const commentText = normalizeCodeText(
      commentTokens.map((token) => token.textContent).join(""),
    );
    return (
      Boolean(fullText) &&
      fullText === commentText &&
      !SOURCE_DIRECTIVE_PATTERN.test(commentText)
    );
  }

  function getCodeCommentRows(root) {
    const rows = new Set(
      [...root.querySelectorAll(".pl-c")]
        .map((token) => token.closest("tr"))
        .filter((row) => row?.closest(FILE_SELECTOR)),
    );

    return [...rows].filter((row) => {
      const codeCells = [
        ...row.querySelectorAll("code.diff-text, .blob-code-inner"),
      ].filter((cell) => normalizeCodeText(cell.textContent));
      return codeCells.length > 0 && codeCells.every(isCommentOnlyCell);
    });
  }

  function parseLineStats(text) {
    const match = text.match(
      /Lines changed:\s*([\d,]+) additions?\s*&\s*([\d,]+) deletions?/i,
    );
    if (!match) return null;
    return {
      additions: Number(match[1].replaceAll(",", "")),
      deletions: Number(match[2].replaceAll(",", "")),
    };
  }

  function getChangedLineCells(file) {
    return [
      ...file.querySelectorAll(
        "code.diff-text.addition, code.diff-text.deletion, " +
          "td.blob-code-addition .blob-code-inner, " +
          "td.blob-code-deletion .blob-code-inner",
      ),
    ];
  }

  function getChangedRows(file) {
    return [
      ...new Set(
        getChangedLineCells(file)
          .map((cell) => cell.closest("tr"))
          .filter(Boolean),
      ),
    ];
  }

  function getLineChangeType(cell) {
    if (
      cell.matches("code.diff-text.deletion") ||
      cell.closest("td.blob-code-deletion")
    ) {
      return "deletions";
    }
    if (
      cell.matches("code.diff-text.addition") ||
      cell.closest("td.blob-code-addition")
    ) {
      return "additions";
    }
    return null;
  }

  function getFileLineStats(file) {
    const summary = [...file.querySelectorAll(".sr-only")].find((element) =>
      element.textContent.trim().startsWith("Lines changed:"),
    );
    const parsed = summary ? parseLineStats(summary.textContent.trim()) : null;
    if (parsed) return parsed;

    const fallback = { additions: 0, deletions: 0 };
    for (const cell of getChangedLineCells(file)) {
      const type = getLineChangeType(cell);
      if (type) fallback[type] += 1;
    }
    return fallback;
  }

  function getNativeLineSummaries() {
    return [...document.querySelectorAll("main .sr-only")].filter(
      (element) =>
        element.textContent.trim().startsWith("Lines changed:") &&
        !element.closest(FILE_SELECTOR),
    );
  }

  return {
    FILE_SELECTOR,
    SOURCE_DIRECTIVE_PATTERN,
    readFilePath,
    getFileDiffs,
    getFileHideTarget,
    normalizeCodeText,
    isCommentOnlyCell,
    getCodeCommentRows,
    parseLineStats,
    getChangedLineCells,
    getChangedRows,
    getLineChangeType,
    getFileLineStats,
    getNativeLineSummaries,
  };
});