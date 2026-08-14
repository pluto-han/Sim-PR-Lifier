(function exposeClassify(root, factory) {
  const classify = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = classify;
  } else {
    root.SimPRler = root.SimPRler || {};
    root.SimPRler.classify = classify;
  }
})(
  typeof globalThis === "undefined" ? this : globalThis,
  function createClassify() {
    "use strict";

    const TEST_DIRECTORIES = new Set([
      "__tests__",
      "cypress",
      "e2e",
      "integration-tests",
      "integration_tests",
      "spec",
      "specs",
      "test",
      "tests",
    ]);
    const TEST_ARTIFACT_DIRECTORIES = new Set([
      "__recordings__",
      "__snapshots__",
      "cassettes",
      "fixture",
      "fixtures",
      "golden",
      "goldens",
      "recordings",
      "snapshots",
      "test-artifacts",
      "test-data",
      "testdata",
    ]);

    const TEST_CONFIG_PATTERN = /^(?:conftest\.py|pytest\.ini|(?:jest|vitest|playwright|cypress)\.config\.[^.]+)$/i;
    const TEST_FILE_PATTERN = /(?:^test_[^/]+\.(?:py|rb)$|[^/]+_test\.(?:go|py|rb|rs)$|[^/]+\.(?:test|tests|spec)\.[^/]+$|[^/]+\.(?:snap|golden)$)/i;
    const DOCUMENTATION_DIRECTORIES = new Set([
      "doc",
      "docs",
      "documentation",
    ]);
    const TEST_ARTIFACT_FILE_PATTERN = /[^/]+\.(?:golden|snap)$/i;

    function normalizeFilePath(filePath) {
      if (typeof filePath !== "string") return "";

      const withoutQuery = filePath
        .split(/[?#]/, 1)[0]
        .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "");
      try {
        return decodeURIComponent(withoutQuery).replace(/^\/+|\/+$/g, "");
      } catch (_error) {
        return withoutQuery.replace(/^\/+|\/+$/g, "");
      }
    }

    function isTestFile(filePath) {
      const normalized = normalizeFilePath(filePath).toLowerCase();
      if (!normalized) return false;

      const segments = normalized.split("/");
      const fileName = segments.at(-1);
      const directories = segments.slice(0, -1);

      return (
        directories.some((directory, index) => {
          if (!TEST_DIRECTORIES.has(directory)) return false;
          if (
            (directory === "spec" || directory === "specs") &&
            directories
              .slice(0, index)
              .some((part) => DOCUMENTATION_DIRECTORIES.has(part))
          ) {
            return false;
          }
          return true;
        }) ||
        TEST_CONFIG_PATTERN.test(fileName) ||
        TEST_FILE_PATTERN.test(fileName) ||
        isTestArtifact(normalized)
      );
    }

    function isTestArtifact(filePath) {
      const normalized = normalizeFilePath(filePath).toLowerCase();
      if (!normalized) return false;

      const segments = normalized.split("/");
      const fileName = segments.at(-1);
      return (
        segments
          .slice(0, -1)
          .some((directory) => TEST_ARTIFACT_DIRECTORIES.has(directory)) ||
        TEST_ARTIFACT_FILE_PATTERN.test(fileName)
      );
    }

    function getFileCategory(filePath) {
      const normalized = normalizeFilePath(filePath).toLowerCase();
      if (isTestArtifact(normalized)) return "artifacts";
      if (isTestFile(normalized)) return "tests";
      if (/\.(?:jsonc?|ya?ml)$/.test(normalized)) return "config";
      if (/\.sql$/.test(normalized)) return "migrations";
      return "source";
    }

    return { getFileCategory, isTestArtifact, isTestFile, normalizeFilePath };
  },
);